import json
import subprocess
import unittest
from pathlib import Path

import numpy as np

from personal_clock_crowding import adjust, cue_mask, fit_cue, score_cue
from personal_clock_strategy import FEATURES, fit_strategy


class PersonalClockCrowdingTests(unittest.TestCase):
    def setUp(self):
        self.actor = {'name': 'one', 'trainingCut': 10, 'trainedAids': ['earlier'], 'trainingGames': {'one': 1},
                      'withinWeights': [0.0] * 76, 'kindModel': {'weights': {kind: [0.0] * 26
                          for kind in ['flip', 'pair', 'single', 'fatal']}}}
        self.decision = {'F': [[0.0] * 76 for _ in range(2)], 'kindContext': [0, 0, 0, 1] + [0.0] * 22,
                         'knownPlan': [[0.0] * len(FEATURES) for _ in range(2)], 'immediate': [[0.0] * 29 for _ in range(2)], 'k': 0}
        self.decision['F'][0][64] = 1
        self.decision['immediate'][0][14] = 1
        self.decision['knownPlan'][0][1] = 1
        self.decision['knownPlan'][1][5] = 1
        self.game = {'aid': 'earlier', 'availableAt': 9, 'initialNewLevel': True, 'decisions': [self.decision]}
        self.base = fit_strategy([self.game], self.actor, iterations=2)

    def test_cue_requires_crowding_known_pair_and_a_found_acceptable_clock_exit(self):
        np.testing.assert_array_equal(cue_mask(self.decision), [True, False])
        self.assertEqual(self.decision['F'][0][14], 0)
        np.testing.assert_array_equal(cue_mask({**self.decision, 'kindContext': [0] * 26}), [False, False])
        forecast = {**self.decision, 'kindContext': [0] * 26,
                    'knownPlan': [self.decision['knownPlan'][0], [1, 0, 0, 0.25] + [0] * 8]}
        np.testing.assert_array_equal(cue_mask(forecast), [True, False])
        np.testing.assert_array_equal(cue_mask({**self.decision, 'knownPlan': [[0.0] * len(FEATURES)] * 2}), [False, False])
        np.testing.assert_array_equal(adjust([0.3, 0.7], [True, False], [0, 0]), [0.3, 0.7])
        self.assertGreater(adjust([0.3, 0.7], [True, False], [3, 0])[0], 0.3)
        self.assertLess(adjust([0.3, 0.7], [True, False], [0, 3])[0], 0.3)
        self.assertRaises(ValueError, adjust, [0.3, 0.7], [True, False], [-1, 0])

    def test_own_earlier_cue_counts_separate_initial_and_retry_without_winning_labels(self):
        target = {'aid': 'target', 'availableAt': 11, 'decisions': [{**self.decision, 'k': 1}], 'wonOn': 30}
        model = fit_cue([self.game, target], self.actor, self.base)
        same = fit_cue([self.game, {**target, 'wonOn': 1}], self.actor, self.base)
        self.assertEqual(model, same)
        self.assertEqual(model['counts'], [[1, 0], [0, 0]])
        self.assertEqual(model['trainingCueChoices'], [1, 0])
        self.assertEqual(model['trainedAids'], ['earlier'])
        self.assertRaises(ValueError, fit_cue, [{**self.game, 'availableAt': 10}], self.actor, self.base)
        self.assertRaises(ValueError, fit_cue, [self.game], self.actor, {**self.base, 'trainedAids': ['target']})

    def test_native_and_javascript_cue_probabilities_and_auxiliary_filter_match(self):
        model = fit_cue([self.game], self.actor, self.base)
        games = [{**self.game, 'decisions': [self.decision, {**self.decision, 'k': 1},
                  {**self.decision, 'kindContext': [0] * 26}]}]
        expected = score_cue(games, self.actor, model)
        script = "const fs=require('fs'),assert=require('assert/strict');const {crowdingFactory,crowdingAttemptFactory}=require('./source/tools/sim/refit/personal_clock_crowding_choice.js');const input=JSON.parse(fs.readFileSync(0,'utf8')),choose=crowdingFactory(input.actor,input.model);let loss=0,hits=0,count=0;for(const decision of input.games[0].decisions){const values=choose.probabilities(decision);assert.deepEqual(choose.probabilities(decision),values);const maximum=Math.max(...values),ties=values.map(value=>Math.abs(value-maximum)<=1e-12+1e-8*Math.abs(maximum));loss-=Math.log(values[decision.k]);hits+=+ties[decision.k]/ties.filter(Boolean).length;choose.observe(decision,decision.k);count++;}const factory=crowdingAttemptFactory(input.actor,input.model);assert.equal(typeof factory({attempt:1}),'function');assert.equal(typeof factory.physicalTrayPlanning,'function');console.log(JSON.stringify({decisions:count,jointLogLoss:loss/count,topActionAccuracy:hits/count}));"
        output = subprocess.check_output(['node', '-e', script], input=json.dumps({'actor': self.actor, 'model': model, 'games': games}),
                                         text=True, cwd=Path(__file__).resolve().parents[4])
        actual = json.loads(output)
        self.assertEqual(actual['decisions'], expected['decisions'])
        self.assertAlmostEqual(actual['jointLogLoss'], expected['jointLogLoss'], places=12)
        self.assertAlmostEqual(actual['topActionAccuracy'], expected['topActionAccuracy'], places=12)


if __name__ == '__main__':
    unittest.main()
