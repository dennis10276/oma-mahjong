import math
import unittest

import numpy as np

from personal_kind_fit import KINDS, samples, fit, score


class PersonalKindTests(unittest.TestCase):
    def decision(self, clock, chosen):
        flip = [0] * 64
        flip[19] = 1
        pair = [0] * 64
        pair[14] = 1
        context = [0] * 20
        context[0] = 1
        context[11] = clock
        return {'F': [flip, pair], 'k': chosen, 'tray': 0, 'kindContext': context}

    def test_kind_likelihood_matches_masked_engine_rates(self):
        games = [{'t': 1, 'availableAt': 2, 'decisions': [self.decision(0, 0)]}]
        data = samples(games, {'t0p': {'flip': 0.8, 'pair': 0.2}}, 20)
        result = score(data, np.zeros((4, 20)))
        self.assertAlmostEqual(result['logLoss'], -math.log(0.8))
        self.assertEqual(result['topKindAccuracy'], 1)

    def test_context_can_learn_distinct_clock_behavior_without_unseen_faces(self):
        decisions = [self.decision(0, 0)] * 50 + [self.decision(1, 1)] * 50
        data = samples([{'t': 1, 'availableAt': 2, 'decisions': decisions}], {'t0p': {'flip': 0.5, 'pair': 0.5}}, 20)
        base = np.zeros((4, 20))
        weights = fit(data, base)
        self.assertLess(score(data, weights)['logLoss'], score(data, base)['logLoss'])
        self.assertLess(weights[KINDS.index('flip'), 11], 0)
        self.assertGreater(weights[KINDS.index('pair'), 11], 0)

    def test_unavailable_fatal_action_has_zero_probability_even_with_large_weight(self):
        data = samples([{'t': 1, 'availableAt': 2, 'decisions': [self.decision(0, 0)]}], {}, 20)
        weights = np.zeros((4, 20))
        weights[KINDS.index('fatal'), 0] = 500
        self.assertAlmostEqual(score(data, weights)['logLoss'], math.log(2))


if __name__ == '__main__':
    unittest.main()
