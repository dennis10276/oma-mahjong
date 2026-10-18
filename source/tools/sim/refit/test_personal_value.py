import unittest

import numpy as np
from scipy.special import expit
from sklearn.ensemble import HistGradientBoostingClassifier

from personal_value import export_hist, fit_value, immediate_features, value_label, value_logits


class PersonalValueTests(unittest.TestCase):
    def game(self, aid='earlier', available=1, ending='win'):
        return {'aid': aid, 't': available, 'availableAt': available, 'complete': True, 'ending': ending, 'stopReason': 'end',
                'decisions': [{'F': [[0] * 76], 'immediate': [[0] * 29], 'kindContext': [0] * 26, 'k': 0}]}

    def test_tools_and_unfinished_prefixes_are_censored_not_losses(self):
        for boundary in ['hint', 'shuffle', 'rescue', 'incomplete', 'historicalPhysicsBoundary']:
            self.assertIsNone(value_label({**self.game(), 'complete': False, 'stopReason': boundary}))
        self.assertEqual(value_label({**self.game(), 'complete': False, 'ending': None, 'stopReason': 'auto'}), 1)
        self.assertEqual(value_label(self.game(ending='restart')), 0)

    def test_future_and_target_memory_sources_cannot_enter_value_training(self):
        features = ['feature' + str(index) for index in range(102)]
        earlier = self.game()
        model = fit_value([earlier], 10, features)
        self.assertEqual(model, fit_value([earlier, self.game('future', 10, 'stuck')], 10, features))
        dependent = {**self.game('retry', 5), 'memorySources': [{'aid': 'target', 'availableAt': 1}]}
        blocked = fit_value([dependent], 10, features, ['target'])
        self.assertEqual(blocked['trainingGames'], 0)
        self.assertEqual(blocked['trainedAids'], [])
        self.assertEqual(blocked['predictor']['probability'], 0.5)

    def test_immediate_state_replaces_anticipated_followup_effects(self):
        decision = self.game()['decisions'][0]
        decision['F'][0][0] = 9
        decision['F'][0][68] = 8
        decision['F'][0][27] = 1
        decision['immediate'][0][1] = 1
        decision['immediate'][0][21] = 0.5
        matrix = immediate_features(decision)
        self.assertEqual(matrix.shape, (1, 102))
        self.assertEqual(matrix[0, 0], 0)
        self.assertEqual(matrix[0, 1], 1)
        self.assertEqual(matrix[0, 27], 1)
        self.assertEqual(matrix[0, 68], 0.5)

    def test_tree_export_matches_installed_predictor(self):
        features = np.arange(80, dtype=float).reshape(-1, 2)
        labels = np.asarray([0] * 20 + [1] * 20)
        model = HistGradientBoostingClassifier(max_iter=3, max_depth=2, min_samples_leaf=2,
            early_stopping=False, random_state=1610).fit(features, labels)
        exported = export_hist(model, 2)
        np.testing.assert_allclose(expit(value_logits(exported, features)), model.predict_proba(features)[:, 1], atol=1e-12)


if __name__ == '__main__':
    unittest.main()
