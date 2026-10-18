import json
import subprocess
import unittest
from pathlib import Path

import numpy as np
from sklearn.tree import DecisionTreeRegressor

from personal_context import context_probabilities, export_tree


class PersonalContextBridgeTests(unittest.TestCase):
    def test_javascript_matches_native_precision_and_python_joint_choice(self):
        right = np.float32(0.5)
        for step in range(3):
            right = np.nextafter(right, np.float32(1))
        tree = DecisionTreeRegressor(max_depth=1).fit([[0.5], [right]], [0, 1])
        threshold = float(tree.tree_.threshold[0])
        model = {'type': 'personalChoiceTrees-v1', 'inputPrecision': 'float32', 'dimensions': 102,
                 'trees': [export_tree(tree, 1)]}
        decision = {'F': [[0] * 76, [0] * 76, [0] * 76], 'immediate': [[0] * 29, [0] * 29, [0] * 29],
                    'kindContext': [1] + [0] * 25}
        decision['immediate'][0][0] = threshold
        decision['F'][2][19] = 1
        kind = np.zeros((4, 26))
        kind[0, 0] = 0.3
        within = np.zeros(76)
        within[21] = 0.4
        decision['F'][1][21] = 1
        actor = {'withinWeights': within.tolist(), 'kindModel': {'weights': dict(zip(['flip', 'pair', 'single', 'fatal'], kind.tolist()))}}
        helper = str(Path(__file__).with_name('personal_context_choice.js'))
        program = 'const input=JSON.parse(require("fs").readFileSync(0,"utf8")); const choose=require(' + json.dumps(helper) + ').choiceFactory(input.actor,input.model); process.stdout.write(JSON.stringify(choose.probabilities(input.decision)));'
        result = subprocess.run(['node', '-e', program], input=json.dumps({'actor': actor, 'model': model, 'decision': decision}),
                                text=True, capture_output=True, check=True)
        np.testing.assert_allclose(json.loads(result.stdout), context_probabilities(decision, kind, within, model), atol=1e-12, rtol=1e-12)


if __name__ == '__main__':
    unittest.main()
