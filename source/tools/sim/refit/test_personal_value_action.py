import math
import unittest

import numpy as np

from personal_value_action import fit_alignment, tilted_probabilities


class PersonalValueActionTests(unittest.TestCase):
    def game(self, chosen=1, **changes):
        return {'aid': 'older', 't': 1, 'availableAt': 2, 'critic': 'before-opening',
                'decisions': [{'logBase': [math.log(0.5)] * 2, 'valueLogits': [0, 1], 'k': chosen}], **changes}

    def test_value_preference_is_personal_signed_and_zero_has_no_effect(self):
        positive = fit_alignment([self.game()], 10, {'older'})
        negative = fit_alignment([self.game(0)], 10, {'older'})
        self.assertGreater(positive['strength'], 0)
        self.assertLess(negative['strength'], 0)
        np.testing.assert_allclose(tilted_probabilities(self.game()['decisions'][0], 0), [0.5, 0.5])
        self.assertEqual(fit_alignment([], 10, set())['strength'], 0)

    def test_alignment_rejects_future_target_and_memory_dependencies(self):
        older = self.game()
        expected = fit_alignment([older], 10, {'older', 'future', 'retry'})
        future = self.game(aid='future', availableAt=10)
        target = self.game(aid='target')
        retry = self.game(aid='retry', memorySources=[{'aid': 'target', 'availableAt': 1}])
        self.assertEqual(fit_alignment([older, future, target, retry], 10, {'older', 'future', 'retry'}), expected)
        self.assertEqual(expected['crossfitCritics'], {'older': 'before-opening'})

    def test_long_prefix_cannot_dominate_equal_outcome_game_weights(self):
        short = self.game()
        long = {**short, 'decisions': short['decisions'] * 20}
        self.assertAlmostEqual(fit_alignment([short], 10, {'older'})['strength'],
                               fit_alignment([long], 10, {'older'})['strength'], places=10)


if __name__ == '__main__':
    unittest.main()
