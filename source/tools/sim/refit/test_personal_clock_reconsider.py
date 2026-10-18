import json
import subprocess
import unittest
from pathlib import Path

import numpy as np

from personal_clock_reconsider import fit_rate, fit_reconsideration, masks_of, proposal_sequence, score_reconsideration, transfer
from personal_clock_strategy import FEATURES, fit_strategy


class PersonalClockReconsiderTests(unittest.TestCase):
    def fixture(self):
        actor = {'name': 'one', 'trainingCut': 10, 'trainedAids': ['earlier'], 'trainingGames': {'one': 1},
                 'withinWeights': [0.0] * 76, 'kindModel': {'weights': {kind: [0.0] * 26
                     for kind in ['flip', 'pair', 'single', 'fatal']}}}
        features = [[0.0] * 76 for _ in range(3)]
        features[1][64] = 1
        decision = {'F': features, 'kindContext': [0.0] * 26, 'immediate': [[0.0] * 29 for _ in range(3)], 'k': 1,
                    'knownPlan': [[1, 0, 0, 0.25] + [0] * 8,
                                  [1, 1, 0, 0.5] + [0] * 8,
                                  [1, 1, 0, 0.75] + [0] * 8]}
        game = {'aid': 'earlier', 'availableAt': 9, 'initialNewLevel': True, 'decisions': [decision] * 3}
        return actor, game, fit_strategy([game], actor, iterations=2)

    def test_reconsideration_donates_only_from_bad_clock_proposals(self):
        values = [0.3, 0.2, 0.1, 0.4]
        actual = transfer(values, [True, False, False, False], [False, True, True, False], 0.5)
        np.testing.assert_allclose(actual, [0.15, 0.3, 0.15, 0.4])
        self.assertAlmostEqual(actual.sum(), 1)
        np.testing.assert_array_equal(transfer(values, [True, False, False, False], [False, True, True, False], 0), values)
        self.assertRaises(ValueError, transfer, values, [True] * 4, [True] * 4, 0.5)

    def test_rate_is_personal_shrunk_and_cannot_be_inferred_from_unrelated_safe_choices(self):
        self.assertEqual(fit_rate([]), 0)
        self.assertEqual(fit_rate([(False, False, 2, 100)]), 0)
        self.assertEqual(fit_rate([(True, False, 1, 3)]), 0)
        self.assertAlmostEqual(fit_rate([(False, True, 1, 3)]), 0.5, places=12)
        self.assertAlmostEqual(fit_rate([(False, True, 1, 3), (True, False, 1, 1)]), 0.2, places=12)
        self.assertRaises(ValueError, fit_rate, [(True, True, 1, 1)])

    def test_safe_direct_digging_is_neither_donor_nor_forced_pairing(self):
        features = [[0.0] * 76 for _ in range(3)]
        features[1][64] = 1
        decision = {'F': features, 'kindContext': [0] * 26,
                    'knownPlan': [[1, 0, 0, 0.25] + [0] * 8,
                                  [1, 1, 0, 0.5] + [0] * 8,
                                  [1, 1, 0, 0.75] + [0] * 8]}
        donors, recipients = masks_of(decision)
        np.testing.assert_array_equal(donors, [True, False, False])
        np.testing.assert_array_equal(recipients, [False, True, False])
        adjusted = transfer([0.2, 0.3, 0.5], donors, recipients, 1)
        np.testing.assert_allclose(adjusted, [0, 0.5, 0.5])

    def test_only_own_earlier_actions_fit_the_reconsideration_rate(self):
        actor, game, base = self.fixture()
        target = {'aid': 'target', 'availableAt': 11, 'decisions': [{**game['decisions'][0], 'k': 0}], 'wonOn': 100}
        model = fit_reconsideration([game, target], actor, base)
        self.assertEqual(model, fit_reconsideration([game, {**target, 'wonOn': 1}], actor, base))
        self.assertGreater(model['rates'][0], 0)
        self.assertEqual(model['rates'][1], 0)
        self.assertEqual(model['trainingContexts'], [3, 0])
        self.assertEqual(model['trainedAids'], ['earlier'])
        self.assertRaises(ValueError, fit_reconsideration, [{**game, 'availableAt': 10}], actor, base)

    def test_proposals_do_not_use_current_or_future_selected_actions(self):
        actor, game, base = self.fixture()
        original = [values for _, values in proposal_sequence(game, actor, base)]
        changed = {**game, 'decisions': [game['decisions'][0], game['decisions'][1], {**game['decisions'][2], 'k': 0}]}
        comparison = [values for _, values in proposal_sequence(changed, actor, base)]
        np.testing.assert_allclose(original, comparison, rtol=1e-12, atol=1e-12)
        invalid = {**game, 'decisions': [{**game['decisions'][0], 'k': -1}]}
        self.assertRaises(ValueError, list, proposal_sequence(invalid, actor, base))

    def test_native_and_javascript_selective_scores_match_and_zero_mass_is_not_sampled(self):
        actor, game, base = self.fixture()
        model = fit_reconsideration([game], actor, base)
        expected = score_reconsideration([game], actor, model)
        script = "const fs=require('fs'),assert=require('assert/strict');const {reconsiderFactory,reconsiderAttemptFactory}=require('./source/tools/sim/refit/personal_clock_reconsider_choice.js');const input=JSON.parse(fs.readFileSync(0,'utf8')),choose=reconsiderFactory(input.actor,input.model);let loss=0,hits=0,count=0;for(const decision of input.game.decisions){const values=choose.probabilities(decision);assert.deepEqual(choose.probabilities(decision),values);const maximum=Math.max(...values),ties=values.map(value=>Math.abs(value-maximum)<=1e-12+1e-8*Math.abs(maximum));loss-=Math.log(values[decision.k]);hits+=+ties[decision.k]/ties.filter(Boolean).length;choose.observe(decision,decision.k);count++;}const complete=reconsiderFactory(input.actor,{...input.model,rates:[1,1]});assert.notEqual(complete(input.game.decisions[0],0),0);const factory=reconsiderAttemptFactory(input.actor,input.model);assert.equal(typeof factory({attempt:1}),'function');assert.equal(typeof factory.physicalTrayPlanning,'function');assert.notEqual(factory({attempt:1}),factory({attempt:1}));console.log(JSON.stringify({decisions:count,jointLogLoss:loss/count,topActionAccuracy:hits/count}));"
        output = subprocess.check_output(['node', '-e', script], input=json.dumps({'actor': actor, 'model': model, 'game': game}),
                                         text=True, cwd=Path(__file__).resolve().parents[4])
        actual = json.loads(output)
        self.assertEqual(actual['decisions'], expected['decisions'])
        self.assertAlmostEqual(actual['jointLogLoss'], expected['jointLogLoss'], places=12)
        self.assertAlmostEqual(actual['topActionAccuracy'], expected['topActionAccuracy'], places=12)


if __name__ == '__main__':
    unittest.main()
