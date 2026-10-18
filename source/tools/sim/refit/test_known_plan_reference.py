import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


class KnownPlanReferenceTests(unittest.TestCase):
    def test_original_source_is_verified_even_when_current_helper_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot = root / 'snapshots/base'
            data_name = 'analysis/archive/personal-bots/policy-known-plan-prefix-data.json'
            source_name, original = 'www/hard.js', b'original-code'
            data = {'fingerprintFiles': [source_name], 'fingerprint': hashlib.sha256(source_name.encode() + original).hexdigest(),
                    'players': {}}
            data_bytes = json.dumps(data).encode()
            for base, name, content in [(snapshot, source_name, original), (root, source_name, b'edited-current-code'),
                                        (snapshot, data_name, data_bytes), (root, data_name, data_bytes)]:
                path = base / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
            manifest = {'files': {source_name: hashlib.sha256(original).hexdigest(), data_name: hashlib.sha256(data_bytes).hexdigest()},
                        'externalPinnedDependencies': {}}
            (snapshot / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
            script = "const {referenceData}=require('./source/tools/sim/refit/known_plan_reference.js');console.log(JSON.stringify(referenceData(process.argv[1],process.argv[2])));"
            command = ['node', '-e', script, str(root), str(snapshot)]
            workspace = Path(__file__).resolve().parents[4]
            result = subprocess.run(command, cwd=workspace, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            proof = json.loads(result.stdout)
            self.assertEqual(proof['referenceFeatureFingerprint'], data['fingerprint'])
            self.assertIn('snapshots/base/www/hard.js', proof['referenceFiles'])
            (snapshot / source_name).write_bytes(b'corrupt-reference')
            self.assertNotEqual(subprocess.run(command, cwd=workspace, capture_output=True).returncode, 0)
            (snapshot / source_name).write_bytes(original)
            (root / data_name).write_bytes(b'{}')
            self.assertNotEqual(subprocess.run(command, cwd=workspace, capture_output=True).returncode, 0)


if __name__ == '__main__':
    unittest.main()
