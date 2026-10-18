import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from personal_plan_count_snapshot import validate_bytes


class PersonalPlanSnapshotTests(unittest.TestCase):
    def test_runtime_filename_hashes_and_count_byte_hashes_are_not_interchangeable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            name, content = 'input.txt', b'content'
            (root / name).write_bytes(content)
            runtime = {'fingerprintFiles': [name], 'fingerprint': hashlib.sha256(name.encode() + content).hexdigest()}
            count = {'fingerprintFiles': [name], 'fingerprint': hashlib.sha256(content).hexdigest()}
            with patch('personal_plan_count_snapshot.ROOT', root):
                validate_bytes(runtime, include_names=True)
                validate_bytes(count)
                self.assertRaises(ValueError, validate_bytes, runtime)
                self.assertRaises(ValueError, validate_bytes, count, True)


if __name__ == '__main__':
    unittest.main()
