import json
import subprocess
import unittest
from pathlib import Path

import numpy as np

from personal_known_plan import FEATURES, PARAMETERS, plan_probabilities


class PersonalKnownPlanBridgeTests(unittest.TestCase):
    def test_javascript_native_probabilities_match(self):
        random = np.random.default_rng(20261018)
        kind, within = random.normal(0, 0.2, (4, 26)), random.normal(0, 0.2, 76)
        actor = {'withinWeights': within.tolist(), 'kindModel': {'weights': dict(zip(['flip', 'pair', 'single', 'fatal'], kind.tolist()))}}
        model = {'type': 'personalKnownTrayPlan-v1', 'features': FEATURES, 'parameters': PARAMETERS, 'weights': [1, -0.4, -2, 0.7, 0]}
        decisions = []
        for _ in range(12):
            features = random.random((8, 76))
            features[:, [14, 18, 19]] = 0
            features[:2, 19] = 1
            features[2:4, 14] = 1
            features[6:, 18] = 1
            decisions.append({'F': features.tolist(), 'immediate': random.random((8, 29)).tolist(),
                              'kindContext': random.random(26).tolist(), 'knownPlan': random.random((8, 5)).tolist()})
        script = "const fs=require('fs');const {knownPlanFactory}=require('./source/tools/sim/refit/personal_known_plan_choice.js');const input=JSON.parse(fs.readFileSync(0,'utf8'));const choose=knownPlanFactory(input.actor,input.model);console.log(JSON.stringify(input.decisions.map(decision=>choose.probabilities(decision))));"
        output = subprocess.check_output(['node', '-e', script], input=json.dumps({'actor': actor, 'model': model, 'decisions': decisions}),
                                         text=True, cwd=Path(__file__).resolve().parents[4])
        expected = [plan_probabilities(decision, kind, within, model['weights']).tolist() for decision in decisions]
        np.testing.assert_allclose(json.loads(output), expected, rtol=1e-12, atol=1e-12)


if __name__ == '__main__':
    unittest.main()
