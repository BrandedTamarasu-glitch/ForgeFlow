#!/usr/bin/env python3
"""Prepare local paired sources and packets. Preparation never dispatches models."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / 'fixtures/completion-comparison-v3'
REVISION = '2bbb198b7a5852cd64fc243a1392cda56f517640'


def command(args, **options):
    result = subprocess.run(args, timeout=30, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **options)
    if result.returncode:
        raise RuntimeError(f'Command failed ({result.returncode}): {args}\n' +
                           result.stdout.decode(errors='replace') + result.stderr.decode(errors='replace'))
    return result


def hashes(files):
    return {str(file): hashlib.sha256(file.read_bytes()).hexdigest() for file in files}


def write_json(file, value):
    file.write_text(json.dumps(value, indent=2) + '\n')


def prepare(output, source):
    output.mkdir(parents=True, exist_ok=False)
    variants = output / 'sources'
    variants.mkdir()
    with tempfile.TemporaryDirectory(prefix='ff-comparison-source-') as temporary:
        archive = command(['git', '-C', str(source), 'archive', REVISION]).stdout
        command(['tar', '-x', '-C', temporary], input=archive)
        command(['git', 'apply', str(ROOT / 'fixtures/completion-control-v2/control.patch')], cwd=temporary)
        controller = variants / 'receipt-identity'
        shutil.copytree(temporary, controller / 'clean')
        shutil.copytree(temporary, controller / 'defective')
        original = command(['git', '-C', str(source), 'show', REVISION + ':packages/controller/controller.mjs']).stdout
        (controller / 'defective/packages/controller/controller.mjs').write_bytes(original)
    cases = [{
        'id': 'receipt-identity', 'task': ROOT / 'fixtures/completion-pilot/task.md',
        'implementation_files': ['packages/controller/controller.mjs'],
        'oracle': ROOT / 'fixtures/completion-control-v2/acceptance.mjs',
        'tests': ['packages/controller/test/controller.test.mjs'],
    }]
    for case in ('publish-reconcile', 'migration-fence'):
        fixture = FIXTURE / case
        for variant in ('clean', 'defective'):
            destination = variants / case / variant
            (destination / 'src').mkdir(parents=True)
            (destination / 'test').mkdir()
            (destination / 'src/store.mjs').write_bytes((fixture / ('src/store.mjs' if variant == 'clean' else 'src/store-defective.mjs')).read_bytes())
            shutil.copyfile(fixture / 'backend.mjs', destination / 'backend.mjs')
            shutil.copyfile(fixture / 'test/store.test.mjs', destination / 'test/store.test.mjs')
        task = fixture / 'task.md'
        if not task.exists():
            task = fixture / 'Task.md'
        cases.append({'id': case, 'task': task, 'implementation_files': ['src/store.mjs'],
                      'oracle': fixture / 'acceptance.mjs', 'tests': ['test/store.test.mjs']})
    selection_inputs, selections = {}, {}
    check_ids = {}
    for case in cases:
        result = command(['node', str(case['oracle']), str(variants / case['id'] / 'clean')])
        observations = json.loads(result.stdout)
        if not observations['pass']:
            raise ValueError('Clean control failed: ' + case['id'])
        check_ids[case['id']] = [check['id'] for check in observations['checks']]
        input_file = output / (case['id'] + '-selection-input.json')
        write_json(input_file, {'phase': 'implement', 'task': case['task'].read_text(), 'files': case['implementation_files']})
        selection = json.loads(command(['node', str(ROOT / 'scripts/forgeflow/select-capabilities.js'), '--input', str(input_file)]).stdout)
        if selection['selected'] != ['persistence-recovery']:
            raise ValueError('Ordinary selection did not select only recovery: ' + case['id'])
        selection_inputs[case['id']] = input_file
        selections[case['id']] = selection
        write_json(output / (case['id'] + '-selection.json'), selection)
    correction = output / 'correction.md'
    correction.write_text('Repair only the externally observed failing behavior within your original stage boundary. '
                          'Do not edit existing tests or acceptance artifacts. Reuse the exact context and inspect the preceding reports. '
                          'Report unresolved checks honestly. Failure feedback: {{FAILURE_FEEDBACK}}\n')
    procedure = (ROOT / 'forgeflow-patterns/capability-persistence-recovery.md').read_text()
    slots = []
    for case_index, case in enumerate(cases):
        for repetition in range(1, 4):
            for variant_index, variant in enumerate(('defective', 'clean')):
                order = ['baseline', 'selected-recovery-evaluation']
                if (case_index + repetition + variant_index) % 2:
                    order.reverse()
                for arm in order:
                    index = len(slots)
                    home = output / 'slots' / str(index)
                    home.mkdir(parents=True)
                    work = home / 'work'
                    shutil.copytree(variants / case['id'] / variant, work)
                    project = work / '.forgeflow/comparison'
                    project.mkdir(parents=True)
                    readme = case['task'].read_text()
                    readme += '\nVerify and repair only when the declared behavior requires it. Keep source unchanged if already correct. '
                    readme += 'Implementation and validation may add or refine new tests only in test/comparison/, ending in .test.mjs. Existing tests and backend are read-only.\n'
                    (work / 'TASK.md').write_text(readme)
                    (work / 'AGENTS.md').write_text('Use the provided task and local source only. No network, services, native prompts, production data, '
                                                  'original checkouts, peer workspaces, external controls or private oracle reads. '
                                                  'Do not commit, stage, reset, edit Git metadata, add dependencies or start persistent processes. '
                                                  'Owned disposable test artifacts must go under .forgeflow/comparison/ or the supplied TMPDIR. '
                                                  'Do not create .local-state or override TMPDIR. Local Unix sockets for fixture tests are permitted; external network calls remain forbidden. '
                                                  'Report failed and unrun checks.\n')
                    command(['git', 'init', '-q', str(work)])
                    command(['git', 'status', '--short'], cwd=work)
                    staged_files = [str(file.relative_to(work)) for file in work.rglob('*') if file.is_file() and '.git' not in file.relative_to(work).parts and '.forgeflow' not in file.relative_to(work).parts]
                    command(['git', 'add', '--'] + sorted(staged_files), cwd=work)
                    command(['git', '-c', 'user.name=Comparison input', '-c', 'user.email=input@example.invalid',
                             'commit', '-qm', 'Frozen comparison input'], cwd=work)
                    head = command(['git', 'rev-parse', 'HEAD'], cwd=work).stdout.decode().strip()
                    packets = {}
                    boundaries = {'implementation': 'You may edit only ' + ', '.join(case['implementation_files']) + ' and new test/comparison/*.test.mjs tests.',
                                  'validation': 'You may add or refine only new test/comparison/*.test.mjs tests. Source and existing tests are read-only.',
                                  'integration': 'All source and tests are read-only. Verify the preceding changes and commands.'}
                    for stage in ('implementation', 'validation', 'integration'):
                        text = f'Complete the {stage} stage of the software task below. {boundaries[stage]}\n\n{readme}\n'
                        text += '\nRun existing tests with: node --test --test-isolation=none --test-reporter=tap ' + ' '.join(case['tests']) + '\n'
                        text += '\nUse the supplied TMPDIR for fixture sockets. Put reports and disposable artifacts only under .forgeflow/comparison/ or TMPDIR; do not create .local-state or override TMPDIR. External network calls are forbidden.\n'
                        text += '\nPreserve authority, compatibility and callers. Read only directly relevant source. '
                        text += 'Run scoped regression checks and reserve time for the next stage. Final report at most 800 words: changes, commands/results, unresolved behavior. '
                        text += 'Do not count an unrun check as passed.\n'
                        if stage == 'implementation':
                            text += 'Use at most half the remaining workflow time for this stage; two more stages must finish inside the same deadline. '
                            text += 'Reuse the existing tests and seam; additional regression tests should be small and directly tied to a source finding. '
                            text += 'Do not build a general harness or reimplement existing coverage.\n'
                        if stage == 'validation':
                            text += 'Use at most half the remaining workflow time; integration must finish inside the same deadline. '
                            text += 'Start with the prior report, changed files and existing scoped tests. Add a small regression only for a concrete uncovered gap. '
                            text += 'Do not rebuild the implementation harness, restate an acceptance plan or duplicate existing coverage.\n'
                        if stage == 'integration':
                            text += 'Start with the prior reports and changed files, then run the required existing and added scoped tests. '
                            text += 'Inspect additional source only to resolve a concrete inconsistency. Report promptly within the remaining deadline; do not create another acceptance plan.\n'
                        if stage != 'implementation':
                            prior = 'implementation' if stage == 'validation' else 'validation'
                            text += '\nRead the verbatim prior report from .forgeflow/comparison/' + prior + '-report.md.\n'
                        if stage == 'implementation' and arm != 'baseline':
                            text += '\nOrdinary selection identified persistence recovery. This bounded evaluation permits its procedure only for this task; normal activation stays gated.\n\n' + procedure
                        file = home / (stage + '.md')
                        file.write_text(text)
                        packets[stage] = str(file)
                    files = [file for file in work.rglob('*') if file.is_file() and '.git' not in file.relative_to(work).parts]
                    files += [Path(value) for value in packets.values()]
                    slots.append({'index': index, 'case': case['id'], 'variant': variant, 'arm': arm, 'repetition': repetition,
                                  'workspace': str(work), 'project': str(project), 'output': str(home / 'result'), 'head': head,
                                  'packets': packets, 'hashes': hashes(files), 'profile': {
                                      'implementation_files': case['implementation_files'], 'new_test_prefixes': ['test/comparison'],
                                      'check_ids': check_ids[case['id']], 'acceptance_command': ['node', str(case['oracle'])],
                                      'test_command': ['node', '--test', '--test-isolation=none', '--test-reporter=tap'] + case['tests']}})
    immutable = list(FIXTURE.rglob('*')) + list((ROOT / 'fixtures/completion-control-v2').rglob('*'))
    immutable = [file for file in immutable if file.is_file()]
    immutable += [ROOT / 'scripts/forgeflow/run-completion-comparison.py', ROOT / 'scripts/forgeflow/run-completion-workflows.py',
                  ROOT / 'scripts/forgeflow/prepare-completion-comparison.py', ROOT / 'scripts/forgeflow/select-capabilities.js',
                  ROOT / 'scripts/forgeflow/capability-catalog.js', ROOT / 'forgeflow-patterns/capability-persistence-recovery.md', correction]
    immutable += list(selection_inputs.values()) + [output / (case['id'] + '-selection.json') for case in cases]
    environment = {'PATH': os.environ['PATH']}
    if os.environ.get('LD_LIBRARY_PATH'):
        environment['LD_LIBRARY_PATH'] = os.environ['LD_LIBRARY_PATH']
        for directory in environment['LD_LIBRARY_PATH'].split(':'):
            immutable += [file for file in Path(directory).glob('*.so*') if file.is_file()]
    immutable.append(Path(shutil.which('node')))
    config = {'version': 3, 'status': 'preparation', 'output': str(output / 'results'), 'slots': slots,
              'hashes': hashes(immutable), 'environment': environment,
              'budget': {'initial': 600, 'correction': 360, 'acceptance': 30, 'words': 800},
              'command': ['codex', 'exec', '--ignore-user-config', '--ignore-rules', '-c', 'approval_policy="never"',
                          '-c', 'sandbox_mode="workspace-write"', '-c', 'sandbox_workspace_write.network_access=true'],
              'correction_packet': str(correction)}
    write_json(output / 'schedule.json', config)
    write_json(output / 'preparation.json', {'status': 'prepared-not-frozen', 'slots': len(slots), 'check_counts': {key: len(value) for key, value in check_ids.items()},
                                           'selection': {key: value['selected'] for key, value in selections.items()},
                                           'limits': ['Two authored synthetic cases, one reused actual PR; not three new production PRs.',
                                                      'Input and final-write audits do not provide complete filesystem/read isolation.',
                                                      'A three-stage evaluation dispatch is not the full production consult-to-ship workflow.']})
    print(json.dumps({'status': 'prepared-not-frozen', 'slots': len(slots)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.output.resolve(), args.source.resolve())
