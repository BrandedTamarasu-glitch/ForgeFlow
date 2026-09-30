#!/usr/bin/env python3
"""Deterministic runner checks. No model dispatch or network."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

runner = load('comparison', 'run-completion-comparison.py')
legacy_tests = load('historical_tests', 'test-completion-runner.py')
legacy_tests.runner = runner


class ComparisonTests(legacy_tests.RunnerTests):
    def workflow_fixture(self, directory, bad_boundary=False):
        config, slot = super().workflow_fixture(directory, bad_boundary)
        slot.update(case='fixture', profile={
            'implementation_files': ['packages/controller/controller.mjs'],
            'new_test_prefixes': ['test/completion-pilot'], 'check_ids': ['behavior'],
            'acceptance_command': config.pop('acceptance_command'),
            'test_command': ['node', '--test', '--test-isolation=none', '--test-reporter=tap',
                             'packages/controller/test/controller.test.mjs'],
        })
        slot['hashes'] = {name: runner.digest(Path(name)) for name in slot['packets'].values()}
        config.update(version=3, status='frozen', hashes={config['correction_packet']: runner.digest(Path(config['correction_packet']))}, slots=[slot])
        return config, slot

    def test_duplicate_launch_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config, slot = self.workflow_fixture(directory)
            config['output'] = str(root / 'aggregate')
            file = root / 'config.json'
            file.write_text(json.dumps(config))
            self.assertEqual(runner.main(file), 0)
            with self.assertRaises(FileExistsError):
                runner.main(file)

    def test_preparation_and_drift_cannot_launch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config, slot = self.workflow_fixture(directory)
            config['output'] = str(root / 'aggregate')
            file = root / 'config.json'
            config['status'] = 'preparation'
            file.write_text(json.dumps(config))
            with self.assertRaises(ValueError):
                runner.main(file)
            self.assertFalse(Path(config['output']).exists())
            config['status'] = 'frozen'
            Path(slot['packets']['implementation']).write_text('changed')
            file.write_text(json.dumps(config))
            with self.assertRaises(ValueError):
                runner.main(file)
            self.assertFalse(Path(config['output']).exists())

    def test_empty_or_duplicate_oracle_never_passes(self):
        for checks in ([], [{'id': 'behavior', 'pass': True}] * 2, [{'id': 'unexpected', 'pass': True}],
                       [{'id': None, 'pass': True}, {'id': 'behavior', 'pass': True}],
                       [{'id': 1, 'pass': True}]):
            with self.subTest(checks=checks), tempfile.TemporaryDirectory() as directory:
                config, slot = self.workflow_fixture(directory)
                external = Path(slot['profile']['acceptance_command'][1])
                external.write_text('import json; print(' + repr(json.dumps({'pass': True, 'checks': checks})) + ')')
                result = runner.run_slot(config, slot)
                self.assertEqual(result['status'], 'failed')
                self.assertEqual(result['acceptance'][0]['failures'][0]['id'], 'external-output')

    def test_unsafe_or_overlapping_scope_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            config, slot = self.workflow_fixture(directory)
            slot['profile']['implementation_files'] = ['../source.mjs']
            with self.assertRaises(ValueError):
                runner.validate_config(config)
            slot['profile']['implementation_files'] = ['packages/controller/controller.mjs']
            config['slots'] = [slot, {**slot, 'index': 1}]
            with self.assertRaises(ValueError):
                runner.validate_config(config)

    def test_short_temp_and_shared_new_test_ownership(self):
        with tempfile.TemporaryDirectory() as directory:
            config, slot = self.workflow_fixture(directory)
            fake = Path(config['command'][1])
            text = fake.read_text()
            text += "\nimport os\nassert len(os.environ['TMPDIR']) < 40\n"
            text += "if stage in ('implementation','validation'):\n"
            text += " p=pathlib.Path('test/completion-pilot/regression.test.mjs');p.parent.mkdir(parents=True,exist_ok=True);p.write_text('import assert from \\\"node:assert/strict\\\"; assert.equal(1,1);\\n')\n"
            fake.write_text(text)
            result = runner.run_slot(config, slot)
            self.assertEqual(result['status'], 'passed')
            self.assertTrue(all(not stage['boundary_violations'] for stage in result['stages']))


if __name__ == '__main__':
    unittest.main()
