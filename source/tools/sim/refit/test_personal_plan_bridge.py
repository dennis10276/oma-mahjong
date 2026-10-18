import json
import subprocess
import unittest
from pathlib import Path

import numpy as np

from personal_plan import FEATURES, component_probabilities, plan_features, score_plan


class PersonalPlanBridgeTests(unittest.TestCase):
    def test_javascript_features_components_and_causal_filter_match_python(self):
        decision = {'F': [[0] * 76 for index in range(3)], 'immediate': [[0] * 29 for index in range(3)],
                    'kindContext': [1] + [0] * 25, 'k': 1}
        decision['F'][1][21] = 1
        decision['F'][2][19] = 1
        decision['immediate'][2][19] = 1
        decision['immediate'][0][25] = 0.3
        decision['immediate'][1][3] = 3
        decision['immediate'][1][6] = 5
        weights = np.zeros((2, 16))
        weights[0, 0], weights[1, 0] = 2, -2
        weights[0, 10], weights[1, 12] = 0.4, -0.3
        model = {'type': 'personalEpisodeStyles-v1', 'features': FEATURES, 'weights': weights.tolist(),
                 'prior': [0.4, 0.6], 'initialPrior': [0.3, 0.7],
                 'transitions': {reason: [[0.2, 0.8], [0.7, 0.3]] for reason in ['any', 'clock', 'tray', 'restart', 'other']}}
        kind, within = np.zeros((4, 26)), np.zeros(76)
        kind[0, 0] = 0.3
        within[21] = 0.4
        actor = {'withinWeights': within.tolist(), 'kindModel': {'weights': dict(zip(['flip', 'pair', 'single', 'fatal'], kind.tolist()))}}
        game = {'initialNewLevel': True, 'decisions': [decision] * 4}
        helper = json.dumps(str(Path(__file__).with_name('personal_plan_choice.js')))
        program = 'const input=JSON.parse(require("fs").readFileSync(0,"utf8")); const helper=require(' + helper + '); const evaluator=helper.planEvaluator(input.actor,input.model); process.stdout.write(JSON.stringify({features:helper.planFeatures(input.game.decisions[0]),components:evaluator.components(input.game.decisions[0]),score:helper.scoreSequence(input.game,evaluator,input.model.initialPrior)}));'
        result = subprocess.run(['node', '-e', program], input=json.dumps({'actor': actor, 'model': model, 'game': game}),
                                text=True, capture_output=True, check=True)
        measured = json.loads(result.stdout)
        np.testing.assert_allclose(measured['features'], plan_features(decision), rtol=1e-12, atol=1e-12)
        np.testing.assert_allclose(measured['components'], component_probabilities(decision, kind, within, model), rtol=1e-12, atol=1e-12)
        expected = score_plan(game, kind, within, model)
        for field in ['jointLogLoss', 'topActionAccuracy', 'stepLogLoss', 'stepTopActionAccuracy']:
            self.assertAlmostEqual(measured['score'][field], expected[field], places=12)
        np.testing.assert_allclose(measured['score']['posterior'], expected['posterior'], rtol=1e-12, atol=1e-12)


if __name__ == '__main__':
    unittest.main()
