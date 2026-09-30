#!/usr/bin/env python3
"""Run a trusted, frozen local completion schedule. Never retries a launched slot."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


def write_json(file, value):
    temporary = file.with_suffix(file.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(file)


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def snapshot(root):
    result = {}
    for directory, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if d not in ('.git', '.forgeflow')]
        for name in files + [d for d in dirs if Path(directory, d).is_symlink()]:
            file = Path(directory, name)
            result[str(file.relative_to(root))] = 'symlink' if file.is_symlink() else digest(file)
    return result


def differences(before, after):
    return sorted(k for k in before.keys() | after.keys() if before.get(k) != after.get(k))


def process(command, cwd, prefix, deadline, prompt=None, env=None):
    """Own the whole process group; kill descendants even when its leader exits."""
    started = time.monotonic()
    if started >= deadline:
        return {'exit': None, 'timeout': True, 'seconds': 0}
    with prefix.with_suffix('.stdout').open('w') as out, prefix.with_suffix('.stderr').open('w') as err:
        child = subprocess.Popen(command, cwd=cwd, stdin=subprocess.PIPE if prompt is not None else subprocess.DEVNULL,
                                 stdout=out, stderr=err, text=True, start_new_session=True, env=env)
        timed_out = False
        try:
            child.communicate(prompt, timeout=max(.001, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            timed_out = True
        finally:
            try:
                os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                child.wait(timeout=1)
            except subprocess.TimeoutExpired:
                pass
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait()
    return {'exit': child.returncode, 'timeout': timed_out or time.monotonic() > deadline,
            'seconds': time.monotonic() - started}


def cli_events(file):
    events = []
    for line in file.read_text().splitlines() if file.exists() else []:
        try:
            events.append(json.loads(line))
        except ValueError:
            continue
    return {'thread': next((e.get('thread_id') for e in events if e.get('type') == 'thread.started'), None),
            'completed': any(e.get('type') == 'turn.completed' for e in events),
            'usage': next((e.get('usage') for e in reversed(events) if e.get('type') == 'turn.completed'), None),
            'tool_events': sum(e.get('type') == 'item.completed' and e.get('item', {}).get('type') in
                               ('command_execution', 'file_change', 'mcp_tool_call', 'web_search') for e in events)}


def verify_hashes(hashes):
    for name, expected in hashes.items():
        if digest(Path(name)) != expected:
            raise ValueError('Frozen input changed: ' + name)


def run_slot(config, slot):
    out = Path(slot['output'])
    out.mkdir(parents=True, exist_ok=False)  # A launched attempt is never silently replaced.
    state = {'index': slot['index'], 'variant': slot['variant'], 'arm': slot['arm'],
             'status': 'running', 'events': [], 'stages': [], 'acceptance': [], 'correction_seconds': None}
    start = time.monotonic()
    work, project = Path(slot['workspace']), Path(slot['project'])
    initial = snapshot(work)
    previous = initial
    threads = {}
    failed_at = None
    env = dict(os.environ, TMPDIR=str(project / 't'), FORGEFLOW_DASHBOARD_AUTO_OPEN='off')
    (project / 't').mkdir(exist_ok=True)

    def event(kind, **fields):
        state['events'].append({'kind': kind, 'seconds': time.monotonic() - start, **fields})
        write_json(out / 'result.json', state)

    def terminal(status):
        state['status'] = status
        state['correction_status'] = ('observed' if status == 'passed' else 'censored') if failed_at is not None else ('not_applicable' if status == 'passed' else 'unobserved')
        state['final_changes'] = differences(initial, snapshot(work))
        event('terminal', outcome=status)
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
                allowed = lambda f: (stage == 'implementation' and f == 'packages/controller/controller.mjs') or (stage == 'validation' and f not in initial and f.startswith('test/completion-pilot/'))
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
            commands = [('external', config['acceptance_command'] + [str(work)]),
                        ('tests', ['node', '--test', '--test-isolation=none', '--test-reporter=tap',
                                   'packages/controller/test/controller.test.mjs'] +
                         [str(p.relative_to(work)) for p in sorted((work / 'test/completion-pilot').rglob('*')) if p.is_file()])]
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                futures = [(name, pool.submit(process, command, work, out / f'{cycle}-{name}', acceptance_deadline, None, env)) for name, command in commands]
                for name, future in futures:
                    checks.append({'name': name, **future.result()})
            try:
                external = json.loads((out / f'{cycle}-external.stdout').read_text())
                failures = [x for x in external['checks'] if not x['pass']]
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
    sys.exit(main(sys.argv[1]))
