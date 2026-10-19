import unittest

from attempt_count_fit import is_correct
from personal_attention_future_head import count_distribution, forecast


def chain(attempt=None):
    within = [float(attempt is not None and index >= attempt) for index in range(1, 10)]
    return {'first': within[0], 'within': within}


class AttentionFuturePointTests(unittest.TestCase):
    def test_nine_attempts_retain_all_differences_that_matter_to_the_full_user_metric(self):
        for actual in range(1, 101):
            for predicted in range(1, 9):
                self.assertEqual(is_correct(predicted, actual), is_correct(predicted, min(actual, 10)))
        self.assertTrue(is_correct(6, 8))
        self.assertTrue(is_correct(7, 9))
        self.assertFalse(is_correct(6, 10))
        self.assertFalse(is_correct(7, 10))

    def test_unknown_tail_is_not_a_fake_exact_eight_or_success_on_ten(self):
        result = forecast(chain())
        self.assertEqual(result['predictedAttempt'], 8)
        distribution = result['distribution1to9And10plus']
        self.assertGreater(distribution[10], .9)
        self.assertLess(distribution[8], .01)
        self.assertAlmostEqual(sum(distribution.values()), 1)

    def test_strict_first_three_counts_and_asymmetric_later_tolerances_are_preserved(self):
        for actual in range(1, 10):
            predicted = forecast(chain(actual))['predictedAttempt']
            self.assertTrue(is_correct(predicted, actual))
            if actual <= 3:
                self.assertEqual(predicted, actual)

    def test_caps_pilots_wrong_horizon_or_unsampled_masses_cannot_produce_points(self):
        with self.assertRaises(ValueError):
            count_distribution({**chain(), 'computationCensored': 1})
        with self.assertRaises(ValueError):
            count_distribution(chain(), 2)
        with self.assertRaises(ValueError):
            count_distribution({'first': 0, 'within': [0] * 32})
        with self.assertRaises(ValueError):
            count_distribution({'first': 0, 'within': [0, .1] + [1] * 7})
        with self.assertRaises(ValueError):
            count_distribution({'first': 1, 'within': [1, .5] + [1] * 7})


if __name__ == '__main__':
    unittest.main()
