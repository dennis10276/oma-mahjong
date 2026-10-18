import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from personal_known_plan_run import contained, materialize


class PersonalKnownPlanRunTests(unittest.TestCase):
    def test_copied_closure_survives_later_source_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot, source, runs = root / 'snapshot', root / 'source', root / 'runs'
            files = {'tools/sim/refit/personal_known_plan_count_data.js': b'entry', 'www/hard.js': b'engine'}
            hashes = {}
            for name, content in files.items():
                path = snapshot / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
                hashes[name] = hashlib.sha256(content).hexdigest()
            dependency = 'analysis/archive/personal-bots/experiments/parent/model.json'
            path = source / dependency
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'model')
            manifest = {'files': hashes, 'externalPinnedDependencies': {dependency: hashlib.sha256(b'model').hexdigest()}}
            (snapshot / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
            frozen = materialize(snapshot, source, runs)
            path.write_bytes(b'changed')
            self.assertEqual((frozen / dependency).read_bytes(), b'model')
            self.assertEqual((frozen / 'www/hard.js').read_bytes(), b'engine')
            self.assertEqual(len(json.loads((frozen / 'run-manifest.json').read_bytes())['sourceInputs']), 3)
            self.assertRaises(ValueError, materialize, snapshot, source, runs)

    def test_manifest_paths_cannot_escape_the_declared_roots(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertRaises(ValueError, contained, root, '../escape.txt')
            self.assertRaises(ValueError, contained, root, root.parent / 'escape.txt')
            self.assertRaises(ValueError, contained, root, '.')

    def test_explicit_entry_time_runtime_loads_are_frozen_too(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot, source = root / 'snapshot', root / 'source'
            files = {'tools/sim/refit/personal_known_plan_count_data.js': b'entry', 'www/hard.js': b'engine'}
            for name, content in files.items():
                path = snapshot / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
            source.mkdir()
            (source / 'compat.json').write_bytes(b'compatibility-load')
            (snapshot / 'manifest.json').write_text(json.dumps({'files': {name: hashlib.sha256(content).hexdigest()
                for name, content in files.items()}, 'externalPinnedDependencies': {}}), encoding='utf-8')
            frozen = materialize(snapshot, source, root / 'runs', ['compat.json'])
            (source / 'compat.json').write_bytes(b'changed')
            self.assertEqual((frozen / 'compat.json').read_bytes(), b'compatibility-load')
            proof = json.loads((frozen / 'run-manifest.json').read_bytes())
            self.assertIn('compat.json', proof['additionalRuntimeDependencies'])


if __name__ == '__main__':
    unittest.main()
