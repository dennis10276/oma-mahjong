import unittest

import numpy as np

from personal_attention import AttentionState, adjusted, fit_attention


def decision(remaining=1, known=True):
    feature = [0.] * 76
    feature[19] = 1
    feature[21], feature[22], feature[26] = .5, .25, 1
    feature[65] = float(known)
    other = list(feature)
    other[21] = .75
    return {'F': [feature, other], 'kindContext': [0.] * 9 + [remaining, 0, 1] + [0.] * 14}


class PersonalAttentionTests(unittest.TestCase):
    def test_first_inspection_is_allowed_and_counts_reset_after_actual_progress(self):
        state = AttentionState()
        first = decision(known=False)
        self.assertTrue(np.array_equal(state.features(first), np.zeros((2, 2))))
        state.observe(first, 0)
        repeated = decision()
        self.assertAlmostEqual(state.features(repeated)[0, 0], np.log(2))
        self.assertEqual(state.features(repeated)[1, 0], 0)
        self.assertTrue(np.array_equal(state.features(decision(.9)), np.zeros((2, 2))))
        state.observe(decision(.9), 1)
        self.assertEqual(state.features(decision(.9))[0, 0], 0)

    def test_ready_tray_or_peek_matches_and_novel_pictures_have_no_repeat_cost(self):
        state = AttentionState()
        state.observe(decision(), 0)
        for marker in (64, 66):
            changed = decision()
            changed['F'][0][marker] = 1
            self.assertEqual(state.features(changed)[0, 0], 0)
        self.assertEqual(state.features(decision(known=False))[0, 0], 0)
        untouched = state.features(decision()).copy()
        self.assertTrue(np.array_equal(state.features({**decision(), 'wonOn': 999}), untouched))

    def test_fit_is_a_soft_personal_preference_not_a_universal_reopening_ban(self):
        features = np.array([[1., 0], [0, 0]])
        avoiding = fit_attention([([.5, .5], features, 1, 1.)] * 30)
        preferring = fit_attention([([.5, .5], features, 0, 1.)] * 30)
        self.assertLess(avoiding['weights'][0], 0)
        self.assertGreater(preferring['weights'][0], 0)
        probability = adjusted([.5, .5], features, avoiding['weights'])
        self.assertGreater(probability[0], 0)
        self.assertLess(probability[0], .5)
        self.assertTrue(np.array_equal(adjusted([0, 1], features, avoiding['weights']), [0, 1]))
        self.assertEqual(fit_attention([])['weights'], [0, 0])

    def test_log_variant_does_not_stop_noticing_further_repetitions(self):
        clipped, logarithmic = AttentionState(), AttentionState(None)
        repeated = decision()
        for index in range(100):
            clipped.observe(repeated, index % 2)
            logarithmic.observe(repeated, index % 2)
        self.assertEqual(clipped.features(repeated)[0, 0], 3)
        self.assertAlmostEqual(logarithmic.features(repeated)[0, 0], np.log(51))
        self.assertGreater(logarithmic.features(repeated)[0, 0], clipped.features(repeated)[0, 0])
        self.assertEqual(fit_attention([], None)['type'], 'personalInspectionAttentionLog-v2')
        self.assertIsNone(fit_attention([], None)['strengthLimit'])
        with self.assertRaises(ValueError):
            AttentionState(-1)


if __name__ == '__main__':
    unittest.main()
