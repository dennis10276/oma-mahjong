"""Run pinned Python tests against a candidate's modules, without candidate test discovery."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import types
import unittest

sealed = Path(__file__).resolve().parent
repo, pattern, worker_python = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
refit = repo / 'source/tools/sim/refit'
sys.path[:0] = [str(sealed / 'source/tools/sim/refit'), str(refit)]
# Freeze the verifier import before any candidate module is imported.
import acceptance_evidence

# Existing scientific dependencies may be used by candidate modules, but no
# candidate .pth/sitecustomize is executed by this protected interpreter.
query = subprocess.run([worker_python, '-I', '-c', 'import json,site;print(json.dumps(site.getsitepackages()))'],
                       capture_output=True, text=True, check=True)
import json
sys.path.extend(json.loads(query.stdout))
suite = unittest.TestSuite()
tests = sorted((sealed / 'source/tools/sim/refit').glob(pattern))
if not tests:
    raise SystemExit('REFUSED: no pinned tests matched; zero tests cannot pass')
for path in tests:
    name = path.stem
    module = types.ModuleType(name)
    module.__file__ = str(refit / path.name)
    sys.modules[name] = module
    exec(compile(path.read_bytes(), module.__file__, 'exec'), module.__dict__)
    suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(module))
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() and result.testsRun > 0 else 1)
