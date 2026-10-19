import unittest

import numpy as np

from personal_attention_hazard_probe import evaluate, fit, hazards_of


def row(actual, within=None):
    values = [0.] * 8 if within is None else within
    return {'wonOn': actual, 'chains': {'own': {'first': values[0], 'within': values}}}


class PersonalHazardProbeTests(unittest.TestCase):
    def test_fixed_offset_units_and_censoring_are_explicit(self):
        self.assertTrue(np.array_equal(hazards_of(row(1)['chains']['own']), np.full(8, 1 / 16)))
        with self.assertRaises(ValueError):
            hazards_of({'within': [0.] * 8, 'computationCensored': 1})
        with self.assertRaises(ValueError):
            hazards_of({'within': [1., .5] + [1.] * 6})

    def test_person_specific_count_fit_can_adjust_both_faster_and_slower_than_the_bot(self):
        faster = fit([row(1) for unused in range(20)], 'own')
        slower = fit([row(8, [.5, .75, .875, .9375, .96875, .984375, .9921875, .99609375]) for unused in range(20)], 'own')
        self.assertGreater(faster[0], 0)
        self.assertLess(slower[0], 0)
        self.assertTrue(np.all(np.isfinite(faster)))
        self.assertTrue(np.all(np.isfinite(slower)))

    def test_actual_labels_only_score_loss_not_the_returned_point(self):
        original = row(1)
        changed = {**original, 'wonOn': 20}
        self.assertEqual(evaluate(original, 'own', np.zeros(2))[1], evaluate(changed, 'own', np.zeros(2))[1])
        self.assertNotEqual(evaluate(original, 'own', np.zeros(2))[0], evaluate(changed, 'own', np.zeros(2))[0])


if __name__ == '__main__':
    unittest.main()
