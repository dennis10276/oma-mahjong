import json
import subprocess
import unittest
from pathlib import Path

import numpy as np

from personal_clock_route import FEATURES, PARAMETERS, fit_route, plan_probabilities


class PersonalClockRouteTests(unittest.TestCase):
    def test_preferences_are_personal_not_forced_clock_greed(self):
        decision = {'F': [[0.0] * 76 for _ in range(2)], 'kindContext': [0.0] * 26,
                    'knownPlan': [[0, 0, 0, 1, 0], [1, 0.75, 0, 0, 0]], 'k': 1}
        actor = {'name': 'one', 'trainingCut': 10, 'trainedAids': ['earlier'], 'trainingGames': {'one': 1},
                 'withinWeights': [0.0] * 76, 'kindModel': {'weights': {kind: [0.0] * 26
                     for kind in ['flip', 'pair', 'single', 'fatal']}}}
        games = [{'aid': 'earlier', 'availableAt': 9, 'decisions': [decision]},
                 {'aid': 'target', 'availableAt': 11, 'decisions': [{**decision, 'k': 0}]}]
        model = fit_route(games, actor)
        opposed = fit_route([{**games[0], 'decisions': [{**decision, 'k': 0}]}], actor)
        self.assertGreater(model['weights'][0], 0)
        self.assertLess(opposed['weights'][0], 0)
        self.assertEqual(model['weights'][-1], 0)
        self.assertEqual(model['trainedAids'], ['earlier'])
        self.assertEqual(model['features'], FEATURES)
        self.assertEqual(model['parameters'], PARAMETERS)
        self.assertEqual(model['type'], 'personalClockRoutes-v1')
        self.assertRaises(ValueError, fit_route, [{**games[0], 'availableAt': 10}], actor)

    def test_native_probabilities_match_javascript_and_zero_control(self):
        random = np.random.default_rng(20261019)
        kind, within = random.normal(0, 0.2, (4, 26)), random.normal(0, 0.2, 76)
        actor = {'withinWeights': within.tolist(), 'kindModel': {'weights': dict(zip(['flip', 'pair', 'single', 'fatal'], kind.tolist()))}}
        model = {'type': 'personalClockRoutes-v1', 'features': FEATURES, 'parameters': PARAMETERS, 'weights': [1, -0.4, -2, 0.7, 0]}
        decisions = []
        for _ in range(12):
            features = random.random((8, 76))
            features[:, [14, 18, 19]] = 0
            features[:2, 19] = 1
            features[2:4, 14] = 1
            features[6:, 18] = 1
            decisions.append({'F': features.tolist(), 'immediate': random.random((8, 29)).tolist(),
                              'kindContext': random.random(26).tolist(), 'knownPlan': random.random((8, 5)).tolist()})
        script = "const fs=require('fs');const {clockRouteFactory}=require('./source/tools/sim/refit/personal_clock_route_choice.js');const {choiceFactory}=require('./source/tools/sim/refit/personal_context_choice.js');const input=JSON.parse(fs.readFileSync(0,'utf8'));const choose=clockRouteFactory(input.actor,input.model),zero=clockRouteFactory(input.actor,input.model,0),base=choiceFactory(input.actor,{type:'personalChoiceTrees-v1',inputPrecision:'float32',dimensions:102,trees:[]},0);console.log(JSON.stringify(input.decisions.map(decision=>({actual:choose.probabilities(decision),zero:zero.probabilities(decision),base:base.probabilities(decision)}))));"
        output = subprocess.check_output(['node', '-e', script], input=json.dumps({'actor': actor, 'model': model, 'decisions': decisions}),
                                         text=True, cwd=Path(__file__).resolve().parents[4])
        for measured, decision in zip(json.loads(output), decisions):
            np.testing.assert_allclose(measured['actual'], plan_probabilities(decision, kind, within, model['weights']), rtol=1e-12, atol=1e-12)
            np.testing.assert_allclose(measured['zero'], measured['base'], rtol=1e-12, atol=1e-12)


if __name__ == '__main__':
    unittest.main()
