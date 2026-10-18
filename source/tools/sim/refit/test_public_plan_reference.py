import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from public_plan_reference import inside, load_reference


class PublicPlanReferenceTests(unittest.TestCase):
    def fixture(self, root):
        snapshot = root / 'analysis/archive/personal-bots/experiments/old'
        snapshot.mkdir(parents=True)
        source = 'analysis/archive/realdata/plays.json'
        original = b'{"old":true}'
        (root / source).parent.mkdir(parents=True)
        (root / source).write_bytes(b'{"fresh":true}')
        (snapshot / source).parent.mkdir(parents=True)
        (snapshot / source).write_bytes(original)
        fingerprint = hashlib.sha256(source.encode() + original).hexdigest()
        data_file = 'features.json'
        (snapshot / data_file).write_text(json.dumps({'fingerprintFiles': [source], 'fingerprint': fingerprint}), encoding='utf-8')
        files = {source: hashlib.sha256(original).hexdigest(), data_file: hashlib.sha256((snapshot / data_file).read_bytes()).hexdigest()}
        (snapshot / 'manifest.json').write_text(json.dumps({'files': files, 'externalPinnedDependencies': {}}), encoding='utf-8')
        return snapshot, source, data_file

    def test_fresh_root_raw_does_not_replace_old_training_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot, source, data_file = self.fixture(root)
            data, provenance = load_reference(snapshot, data_file, root)
            self.assertEqual(data['fingerprintFiles'], [source])
            self.assertTrue(provenance['referenceHashes'])
            self.assertNotIn(source, provenance['referenceHashes'])

    def test_mutated_pin_and_path_escape_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot, source, data_file = self.fixture(root)
            (snapshot / source).write_text('changed', encoding='utf-8')
            self.assertRaises(ValueError, load_reference, snapshot, data_file, root)
            self.assertRaises(ValueError, inside, snapshot, '../outside.json')

    def test_unpinned_root_raw_cannot_be_declared_an_external_immutable_input(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot, source, data_file = self.fixture(root)
            manifest = json.loads((snapshot / 'manifest.json').read_bytes())
            manifest['externalPinnedDependencies'][source] = manifest['files'].pop(source)
            (snapshot / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
            self.assertRaises(ValueError, load_reference, snapshot, data_file, root)


if __name__ == '__main__':
    unittest.main()
