#!/usr/bin/env python3
"""Exercise subprocess behavior without models or network."""
import importlib.util
import json
import os
import subprocess
from pathlib import Path
import sys
import tempfile
import time
import unittest

spec = importlib.util.spec_from_file_location('runner', Path(__file__).with_name('run-completion-workflows.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class RunnerTests(unittest.TestCase):
    def test_process_reports_and_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            result = runner.process([sys.executable, '-c', 'import sys;print(sys.stdin.read());sys.exit(3)'], root, root / 'run', time.monotonic() + 5, 'exact report')
            self.assertEqual(result['exit'], 3)
            self.assertFalse(result['timeout'])
            self.assertEqual((root / 'run.stdout').read_text(), 'exact report\n')

    def test_deadline_kills_descendant(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            code = "import subprocess,time;subprocess.Popen(['python3','-c',\"import time,pathlib;time.sleep(1);pathlib.Path('escaped').write_text('bad')\"]);time.sleep(5)"
            result = runner.process([sys.executable, '-c', code], root, root / 'run', time.monotonic() + .1)
            self.assertTrue(result['timeout'])
            time.sleep(1.1)
            self.assertFalse((root / 'escaped').exists())

    def test_exited_leader_does_not_leave_child(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            code = "import subprocess;subprocess.Popen(['python3','-c',\"import time,pathlib;time.sleep(1);pathlib.Path('escaped').write_text('bad')\"])"
            result = runner.process([sys.executable, '-c', code], root, root / 'run', time.monotonic() + 3)
            self.assertEqual(result['exit'], 0)
            time.sleep(1.1)
            self.assertFalse((root / 'escaped').exists())

    def test_expired_budget_does_not_launch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            result = runner.process(['nonexistent-program'], root, root / 'run', time.monotonic() - 1)
            self.assertTrue(result['timeout'])
            self.assertFalse((root / 'run.stdout').exists())

    def test_events_hashes_and_snapshots(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'a').write_text('first')
            frozen = {str(root / 'a'): runner.digest(root / 'a')}
            runner.verify_hashes(frozen)
            before = runner.snapshot(root)
            (root / 'a').write_text('second')
            with self.assertRaises(ValueError):
                runner.verify_hashes(frozen)
            self.assertEqual(runner.differences(before, runner.snapshot(root)), ['a'])
            (root / 'events').write_text('noise\n' + '\n'.join(json.dumps(x) for x in [{'type':'thread.started','thread_id':'unique'}, {'type':'item.completed','item':{'type':'command_execution'}}, {'type':'turn.completed','usage':{'input_tokens':10}}]))
            events = runner.cli_events(root / 'events')
            self.assertEqual(events, {'thread':'unique','completed':True,'tool_events':1,'usage':{'input_tokens':10}})

    def test_duplicate_launch_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / 'config.json'
            config.write_text(json.dumps({'output':str(root / 'out'),'hashes':{},'slots':[]}))
            self.assertEqual(runner.main(config), 0)
            with self.assertRaises(FileExistsError):
                runner.main(config)

    def workflow_fixture(self, directory, bad_boundary=False):
        root = Path(directory)
        work = root / 'work'
        project = work / '.forgeflow/work'
        project.mkdir(parents=True)
        controller = work / 'packages/controller/controller.mjs'
        controller.parent.mkdir(parents=True)
        controller.write_text('initial')
        tests = work / 'packages/controller/test/controller.test.mjs'
        tests.parent.mkdir()
        tests.write_text("import assert from 'node:assert/strict'; assert.equal(2+2,4);\n")
        subprocess.run(['git','init','-q'],cwd=work,check=True)
        subprocess.run(['git','add','--','.'],cwd=work,check=True)
        subprocess.run(['git','-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','input'],cwd=work,check=True)
        fake = root / 'fake.py'
        fake.write_text("""import sys,json,pathlib
args=sys.argv[1:];prompt=sys.stdin.read();stage=prompt.split('STAGE:')[1].split()[0]
if 'resume' in args:
 assert args[args.index('resume')+1]=='context-'+stage
 if stage=='implementation':pathlib.Path('packages/controller/controller.mjs').write_text('fixed')
if stage=='validation' and 'BAD_BOUNDARY' in prompt:pathlib.Path('unexpected').write_text('invalid')
if stage!='implementation':
 prior='implementation' if stage=='validation' else 'validation'
 assert pathlib.Path('.forgeflow/work/'+prior+'-report.md').read_text()=='report-'+prior
pathlib.Path(args[args.index('-o')+1]).write_text('report-'+stage)
print(json.dumps({'type':'thread.started','thread_id':'context-'+stage}))
print(json.dumps({'type':'turn.completed','usage':{'input_tokens':1,'output_tokens':1}}))
""")
        external = root / 'external.py'
        external.write_text("""import json,pathlib,sys
passed=pathlib.Path('packages/controller/controller.mjs').read_text()=='fixed'
print(json.dumps({'pass':passed,'checks':[{'id':'behavior','pass':passed,'error':'expected fixed'}]}))
sys.exit(0 if passed else 1)
""")
        packets = {}
        for stage in ['implementation','validation','integration']:
            file=root/(stage+'.md');file.write_text('STAGE:'+stage+(' BAD_BOUNDARY' if bad_boundary else ''));packets[stage]=str(file)
        correction=root/'correction.md';correction.write_text('Correction feedback: {{FAILURE_FEEDBACK}}')
        slot={'index':0,'variant':'fixture','arm':'fixture','workspace':str(work),'project':str(project),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=work,text=True).strip(),'packets':packets,'hashes':{},'output':str(root/'results')}
        config={'hashes':{},'command':[sys.executable,str(fake)],'budget':{'initial':10,'correction':10,'acceptance':3,'words':800},'acceptance_command':[sys.executable,str(external)],'correction_packet':str(correction)}
        return config,slot

    def test_complete_handoffs_and_same_context_correction(self):
        with tempfile.TemporaryDirectory() as directory:
            config,slot=self.workflow_fixture(directory)
            result=runner.run_slot(config,slot)
            self.assertEqual(result['status'],'passed')
            self.assertEqual(len(result['stages']),6)
            self.assertEqual(result['correction_status'],'observed')
            self.assertGreater(result['correction_seconds'],0)
            self.assertEqual(result['acceptance'][0]['failures'][0]['id'],'behavior')
            self.assertEqual(result['acceptance'][1]['failures'],[])
            self.assertEqual([s['thread'] for s in result['stages'][:3]],[s['thread'] for s in result['stages'][3:]])

    def test_stage_boundary_failure_prevents_acceptance(self):
        with tempfile.TemporaryDirectory() as directory:
            config,slot=self.workflow_fixture(directory,True)
            result=runner.run_slot(config,slot)
            self.assertEqual(result['status'],'boundary_or_format_failed')
            self.assertEqual(result['acceptance'],[])
            self.assertEqual(result['stages'][-1]['boundary_violations'],['unexpected'])

    def test_acceptance_timeout_never_passes(self):
        with tempfile.TemporaryDirectory() as directory:
            config,slot=self.workflow_fixture(directory)
            config['budget']['acceptance']=.000001
            result=runner.run_slot(config,slot)
            self.assertEqual(result['status'],'failed')
            self.assertEqual(result['correction_status'],'censored')
            self.assertIsNone(result['correction_seconds'])
            self.assertTrue(all(a['failures'] for a in result['acceptance']))


if __name__ == '__main__':
    unittest.main()
