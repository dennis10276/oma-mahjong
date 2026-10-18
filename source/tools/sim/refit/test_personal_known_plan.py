import unittest

import numpy as np

from personal_known_plan import FEATURES, fit_plan, objective, plan_features, plan_probabilities


class PersonalKnownPlanTests(unittest.TestCase):
    def setUp(self):
        self.decision = {'F': [[0.0] * 76 for _ in range(2)], 'kindContext': [0.0] * 26,
                         'knownPlan': [[0, 0, 0, 0, 0], [1, 1, 0, 0, 0]], 'k': 1}
        self.actor = {'name': 'one', 'trainingCut': 10, 'trainedAids': ['earlier'], 'trainingGames': {'one': 1},
                      'withinWeights': [0.0] * 76, 'kindModel': {'weights': {kind: [0.0] * 26
                          for kind in ['flip', 'pair', 'single', 'fatal']}}}

    def test_zero_residual_and_boundary_weight(self):
        kind, within = np.zeros((4, 26)), np.zeros(76)
        np.testing.assert_allclose(plan_probabilities(self.decision, kind, within, np.zeros(5)), [0.5, 0.5])
        self.assertGreater(plan_probabilities(self.decision, kind, within, [2, 0, 0, 0, 0])[1], 0.8)
        self.assertRaises(ValueError, plan_probabilities, self.decision, kind, within, [0, 0, 0, 0, 1])

    def test_gradient_matches_finite_difference(self):
        matrix = np.asarray(self.decision['knownPlan'], dtype=float)
        weights = np.asarray([0.2, -0.3, 0.1, 0.4, 0])
        arguments = (matrix, np.log([0.5, 0.5]), np.asarray([0]), np.asarray([2]), np.asarray([1]), np.asarray([0.7]), 20)
        _, gradient = objective(weights, *arguments)
        for index in range(len(FEATURES)):
            plus, minus = weights.copy(), weights.copy()
            plus[index] += 1e-6
            minus[index] -= 1e-6
            difference = (objective(plus, *arguments)[0] - objective(minus, *arguments)[0]) / 2e-6
            self.assertAlmostEqual(gradient[index], difference, places=7)

    def test_only_frozen_earlier_membership_enters_fit(self):
        games = [{'aid': 'earlier', 'availableAt': 9, 'decisions': [self.decision]},
                 {'aid': 'target', 'availableAt': 11, 'decisions': [{**self.decision, 'k': 0}]}]
        fitted = fit_plan(games, self.actor)
        self.assertEqual(fitted['trainedAids'], ['earlier'])
        self.assertEqual(fitted['availableThrough'], 9)
        self.assertGreater(fitted['weights'][0], 0)
        self.assertEqual(fitted['weights'][-1], 0)
        self.assertRaises(ValueError, fit_plan, [{**games[0], 'availableAt': 10}], self.actor)

    def test_feature_shape_and_finite_bounds(self):
        self.assertEqual(plan_features(self.decision).shape, (2, 5))
        self.assertRaises(ValueError, plan_features, {**self.decision, 'knownPlan': [[float('nan')] * 5] * 2})
        self.assertRaises(ValueError, plan_features, {**self.decision, 'knownPlan': [[2] * 5] * 2})


if __name__ == '__main__':
    unittest.main()
