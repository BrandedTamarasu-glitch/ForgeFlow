#!/usr/bin/env python3
"""Version 3 configurable comparison runner; historical runner stays unchanged."""
import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

_spec = importlib.util.spec_from_file_location('completion_v2', Path(__file__).with_name('run-completion-workflows.py'))
_v2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_v2)
write_json, digest, snapshot, differences, process, cli_events, verify_hashes = (
    _v2.write_json, _v2.digest, _v2.snapshot, _v2.differences, _v2.process, _v2.cli_events, _v2.verify_hashes)


def validate_config(config):
    if config.get('version') != 3 or config.get('status') != 'frozen':
        raise ValueError('Only a separately frozen version 3 schedule can launch')
    if not config.get('slots') or not config.get('hashes'):
        raise ValueError('Missing schedule or immutable input hashes')
    seen_paths, indexes = set(), set()
    for slot in config['slots']:
        if slot['index'] in indexes:
            raise ValueError('Duplicate slot index')
        indexes.add(slot['index'])
        for field in ('workspace', 'output'):
            candidate = Path(slot[field]).resolve()
            if candidate in seen_paths or any(candidate in prior.parents or prior in candidate.parents for prior in seen_paths):
                raise ValueError('Slot paths must be disjoint')
            seen_paths.add(candidate)
        project = Path(slot['project']).resolve()
        if not project.is_relative_to(Path(slot['workspace']).resolve() / '.forgeflow'):
            raise ValueError('Handoff directory must be inside the slot local state')
        profile = slot['profile']
        for field in ('implementation_files', 'new_test_prefixes'):
            for relative in profile[field]:
                path = Path(relative)
                if path.is_absolute() or '..' in path.parts or not path.parts:
                    raise ValueError('Unsafe stage path')
        ids = profile['check_ids']
        if not ids or len(ids) != len(set(ids)):
            raise ValueError('Expected check identities must be unique and nonempty')
        if not profile['acceptance_command'] or not profile['test_command']:
            raise ValueError('Missing acceptance command')
        verify_hashes(slot['hashes'])
    verify_hashes(config['hashes'])


def run_slot(config, slot):
    out = Path(slot['output'])
    out.mkdir(parents=True, exist_ok=False)  # A launched attempt is never silently replaced.
    profile = slot['profile']
    state = {'index': slot['index'], 'case': slot['case'], 'variant': slot['variant'], 'arm': slot['arm'],
             'status': 'running', 'events': [], 'stages': [], 'acceptance': [], 'correction_seconds': None}
    start = time.monotonic()
    work, project = Path(slot['workspace']), Path(slot['project'])
    initial = snapshot(work)
    previous = initial
    threads = {}
    failed_at = None
    temporary = tempfile.mkdtemp(prefix='ff3-', dir='/tmp')
    env = dict(os.environ, **config.get('environment', {}), TMPDIR=temporary, FORGEFLOW_DASHBOARD_AUTO_OPEN='off')

    def event(kind, **fields):
        state['events'].append({'kind': kind, 'seconds': time.monotonic() - start, **fields})
        write_json(out / 'result.json', state)

    def terminal(status):
        state['status'] = status
        state['correction_status'] = ('observed' if status == 'passed' else 'censored') if failed_at is not None else ('not_applicable' if status == 'passed' else 'unobserved')
        state['final_changes'] = differences(initial, snapshot(work))
        event('terminal', outcome=status)
        try:
            shutil.rmtree(temporary)
        except OSError as error:
            state['cleanup_error'] = type(error).__name__ + ': ' + str(error)
            event('cleanup_failed')
        print(json.dumps({'slot': slot['index'], 'status': status, 'seconds': state['events'][-1]['seconds']}), flush=True)
        return state

    try:
        verify_hashes(config['hashes'])
        verify_hashes(slot['hashes'])
        event('start')
        deadline = start + config['budget']['initial']
        for i, command in enumerate(slot.get('prepare', [])):
            result = process(command, work, out / f'prepare-{i}', deadline, env=env)
            event('prepare', result=result)
            if result['exit'] != 0 or result['timeout']:
                return terminal('timeout' if result['timeout'] else 'infrastructure_failed')
        for cycle in range(2):
            for stage in ('implementation', 'validation', 'integration'):
                prefix = out / f'{cycle}-{stage}'
                report = prefix.with_suffix('.report.md')
                prompt = Path(slot['packets'][stage]).read_text()
                if cycle:
                    prompt = Path(config['correction_packet']).read_text().replace('{{FAILURE_FEEDBACK}}', json.dumps(state['acceptance'][0]['failures'])) + '\n\n' + prompt
                prompt += '\n\nRemaining workflow seconds: ' + str(max(0, int(deadline - time.monotonic())))
                command = list(config['command'])
                if cycle:
                    command += ['resume', threads[stage]]
                command += ['--json', '-o', str(report), '-']
                prefix.with_suffix('.prompt.md').write_text(prompt)
                event('stage_start', cycle=cycle, stage=stage)
                result = process(command, work, prefix, deadline, prompt, env)
                result.update(cli_events(prefix.with_suffix('.stdout')))
                result.update({'stage': stage, 'cycle': cycle})
                state['stages'].append(result)
                if result['timeout']:
                    return terminal('timeout')
                if result['exit'] != 0 or not result['completed'] or not report.is_file():
                    return terminal('infrastructure_failed')
                if not cycle:
                    if not result['thread'] or result['thread'] in threads.values():
                        return terminal('context_failed')
                    threads[stage] = result['thread']
                elif result['thread'] != threads[stage]:
                    return terminal('context_failed')
                message = report.read_text()
                result['words'] = len(message.split())
                current = snapshot(work)
                changed = differences(previous, current)
                def allowed(f):
                    file = work / f
                    if file.is_symlink() or not file.is_file() or not file.resolve().is_relative_to(work.resolve()):
                        return False
                    return (stage == 'implementation' and f in profile['implementation_files']) or (
                        stage in ('implementation', 'validation') and f not in initial and f.endswith('.test.mjs') and
                        any(f.startswith(prefix.rstrip('/') + '/') for prefix in profile['new_test_prefixes']))
                result['boundary_violations'] = [f for f in changed if not allowed(f)]
                previous = current
                if result['words'] > config['budget']['words'] or result['boundary_violations']:
                    return terminal('boundary_or_format_failed')
                (project / (stage + '-report.md')).write_text(message)
                event('stage_complete', cycle=cycle, stage=stage)
            if time.monotonic() > deadline:
                return terminal('timeout')
            event('submission', cycle=cycle)
            checks = []
            acceptance_deadline = time.monotonic() + config['budget']['acceptance']
            added_tests = [str(p.relative_to(work)) for prefix in profile['new_test_prefixes']
                           for p in sorted((work / prefix).rglob('*.test.mjs')) if p.is_file()]
            commands = [('external', profile['acceptance_command'] + [str(work)]),
                        ('tests', profile['test_command'] + added_tests)]
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                futures = [(name, pool.submit(process, command, work, out / f'{cycle}-{name}', acceptance_deadline, None, env)) for name, command in commands]
                for name, future in futures:
                    checks.append({'name': name, **future.result()})
            try:
                external = json.loads((out / f'{cycle}-external.stdout').read_text())
                observations = external['checks']
                if (not isinstance(observations, list) or
                    any(not isinstance(x, dict) or not isinstance(x.get('pass'), bool) or
                        not isinstance(x.get('id'), str) for x in observations) or
                    sorted(x.get('id', '') for x in observations) != sorted(profile['check_ids']) or
                    not isinstance(external.get('pass'), bool) or
                    external['pass'] != all(x['pass'] for x in observations)):
                    raise ValueError('Acceptance identities, statuses or aggregate differ from frozen contract')
                failures = [x for x in observations if not x['pass']]
            except (ValueError, KeyError, OSError):
                external = None
                failures = [{'id': 'external-output', 'error': 'Missing or invalid acceptance output'}]
            for check in checks:
                if check['exit'] != 0 or check['timeout']:
                    if check['name'] != 'external' or not failures:
                        failures.append({'id': check['name'], 'error': 'Check command failed or timed out'})
            try:
                head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=work, text=True, timeout=max(.001, acceptance_deadline - time.monotonic())).strip()
                staged = subprocess.check_output(['git', 'diff', '--cached', '--name-only'], cwd=work, text=True, timeout=max(.001, acceptance_deadline - time.monotonic())).strip()
                if head != slot['head'] or staged or snapshot(work) != previous:
                    failures.append({'id': 'source-boundary', 'error': 'Git state or source changed outside permitted stage'})
            except subprocess.TimeoutExpired:
                failures.append({'id': 'source-audit-timeout', 'error': 'Git audit did not complete within the acceptance budget'})
            if time.monotonic() > acceptance_deadline:
                failures.append({'id': 'acceptance-budget', 'error': 'Acceptance and audit exceeded the time budget'})
            state['acceptance'].append({'checks': checks, 'external': external, 'failures': failures})
            event('acceptance', cycle=cycle, passed=not failures)
            if not failures:
                if failed_at is not None:
                    state['correction_seconds'] = time.monotonic() - failed_at
                return terminal('passed')
            if cycle:
                return terminal('failed')
            failed_at = time.monotonic()
            deadline = failed_at + config['budget']['correction']
            event('correction_start')
    except Exception as error:
        state['error'] = type(error).__name__ + ': ' + str(error)
        return terminal('infrastructure_failed')


def main(file):
    config = json.loads(Path(file).read_text())
    validate_config(config)
    output = Path(config['output'])
    output.mkdir(parents=True, exist_ok=True)
    lock = output / 'launched.json'
    with lock.open('x') as stream:
        json.dump({'pid': os.getpid(), 'started': time.time()}, stream)
    verify_hashes(config['hashes'])
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for offset in range(0, len(config['slots']), 2):
            results.extend(pool.map(lambda s: run_slot(config, s), config['slots'][offset:offset + 2]))
            write_json(output / 'results.json', results)
            if any(r['status'] in ('infrastructure_failed', 'context_failed') for r in results[-2:]):
                print('Infrastructure failure: remaining slots stay unlaunched.', flush=True)
                break
    return 0 if len(results) == len(config['slots']) and all(r['status'] == 'passed' for r in results) else 1


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--smoke':
        config = json.loads(Path(sys.argv[2]).read_text())
        home = Path(sys.argv[3]).resolve()
        home.mkdir(parents=True, exist_ok=False)
        slot = next(slot for slot in config['slots'] if slot['case'] == 'receipt-identity' and
                    slot['variant'] == 'clean' and slot['arm'] == 'selected-recovery-evaluation')
        original_work = Path(slot['workspace'])
        work = home / 'work'
        shutil.copytree(original_work, work)
        slot = dict(slot, index=-1, workspace=str(work), project=str(work / '.forgeflow/comparison'),
                    output=str(home / 'result'))
        # The smoke uses a separate copy/context; none of the scheduled slots launch.
        slot['hashes'] = {str(work / Path(file).relative_to(original_work)): value
                          for file, value in slot['hashes'].items() if Path(file).is_relative_to(original_work)} | {
                              file: value for file, value in slot['hashes'].items()
                              if not Path(file).is_relative_to(original_work)}
        result = run_slot(config, slot)
        sys.exit(0 if result['status'] == 'passed' else 1)
    elif len(sys.argv) == 2:
        sys.exit(main(sys.argv[1]))
    else:
        sys.exit('Usage: run-completion-comparison.py schedule.json | --smoke schedule.json unique-output')
