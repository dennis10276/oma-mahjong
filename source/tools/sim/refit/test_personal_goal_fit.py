import math
import unittest

import numpy as np

from personal_goal_fit import samples, fit, score


class PersonalGoalTests(unittest.TestCase):
    def test_zero_goal_weights_preserve_the_base_choice_likelihood(self):
        features = np.asarray([[0] * 8, [1] + [0] * 7], dtype=float)
        data = [(features, np.asarray([0, 1]), 1, 1)]
        result = score(data, np.zeros(8))
        self.assertAlmostEqual(result['logLoss'], math.log1p(math.exp(-1)))

    def test_goal_preferences_can_be_learned_without_replacing_planning_weights(self):
        features = np.asarray([[0] * 8, [1] + [0] * 7], dtype=float)
        data = [(features, np.zeros(2), 1, 1)] * 50
        weights = fit(data, np.zeros(8))
        self.assertGreater(weights[0], 0)
        self.assertLess(score(data, weights)['logLoss'], score(data, np.zeros(8))['logLoss'])

    def test_fatal_choices_are_excluded_from_the_safe_tile_goal_fit(self):
        fatal = [0] * 64
        fatal[18] = 1
        decision = {'F': [fatal, fatal], 'goals': [[0] * 8, [0] * 8], 'k': 0}
        self.assertEqual(samples([{'availableAt': 2, 'decisions': [decision]}], np.zeros(64)), [])


if __name__ == '__main__':
    unittest.main()
