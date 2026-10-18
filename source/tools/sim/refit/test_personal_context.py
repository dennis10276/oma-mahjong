import unittest

import numpy as np
from sklearn.tree import DecisionTreeRegressor

from personal_context import context_probabilities, export_tree, fit_context, tree_scores
from personal_full_choice_fit import probabilities


class PersonalContextTests(unittest.TestCase):
    def decision(self, chosen=0):
        choices = [[0] * 76 for index in range(2)]
        choices[1][21] = 1
        return {'F': choices, 'immediate': [[0] * 29 for index in range(2)], 'kindContext': [1] + [0] * 25, 'k': chosen}

    def game(self, **changes):
        return {'aid': 'old', 't': 1, 'availableAt': 2, 'decisions': [self.decision()] * 80, **changes}

    def fit(self, games, **changes):
        return fit_context(games, np.zeros((4, 26)), np.zeros(76), changes.get('cutoff', 10),
                           changes.get('allowed', {'old'}), ['feature' + str(index) for index in range(102)], stages=4)

    def test_zero_residual_and_serialized_tree_match_native_predictions(self):
        tree = DecisionTreeRegressor(max_depth=2, random_state=1).fit([[0], [1], [2]], [1, 3, -2])
        model = {'type': 'personalChoiceTrees-v1', 'inputPrecision': 'float32', 'dimensions': 1, 'trees': [export_tree(tree, 0.2)]}
        np.testing.assert_allclose(tree_scores(model, [[0], [1], [2]]), 0.2 * tree.predict([[0], [1], [2]]))
        decision = self.decision()
        empty = self.fit([])
        np.testing.assert_allclose(context_probabilities(decision, np.zeros((4, 26)), np.zeros(76), empty),
                                   probabilities(decision, np.zeros((4, 26)), np.zeros(76)))

    def test_float32_split_boundary_matches_native_tree(self):
        left = np.float32(0.5)
        right = left
        for step in range(3):
            right = np.nextafter(right, np.float32(1))
        tree = DecisionTreeRegressor(max_depth=1).fit([[left], [right]], [0, 1])
        threshold = float(tree.tree_.threshold[0])
        model = {'type': 'personalChoiceTrees-v1', 'inputPrecision': 'float32', 'dimensions': 1, 'trees': [export_tree(tree, 1)]}
        np.testing.assert_allclose(tree_scores(model, [[threshold]]), tree.predict([[threshold]]))

    def test_own_choices_can_learn_opposite_route_preferences(self):
        left = self.fit([self.game()])
        right = self.fit([self.game(decisions=[self.decision(1)] * 80)])
        arguments = (self.decision(), np.zeros((4, 26)), np.zeros(76))
        self.assertGreater(context_probabilities(*arguments, left)[0], 0.5)
        self.assertLess(context_probabilities(*arguments, right)[0], 0.5)
        np.testing.assert_allclose(context_probabilities(*arguments, left, stages=0), [0.5, 0.5])

    def test_later_target_and_memory_sources_do_not_change_fit(self):
        earlier = self.game()
        pollution = [self.game(aid='future', availableAt=10), self.game(aid='target'),
                     self.game(aid='retry', memorySources=[{'aid': 'target', 'availableAt': 0}])]
        allowed = {'old', 'future', 'retry'}
        self.assertEqual(self.fit([earlier], allowed=allowed), self.fit([earlier, *pollution], allowed=allowed))
        self.assertEqual(self.fit([earlier])['trainedAids'], ['old'])

    def test_same_person_can_change_route_preference_with_clock_context(self):
        ordinary = self.decision(0)
        clock = self.decision(1)
        clock['kindContext'][11] = 1
        game = self.game(decisions=[ordinary] * 120 + [clock] * 80)
        fitted = self.fit([game])
        arguments = (np.zeros((4, 26)), np.zeros(76), fitted)
        self.assertGreater(context_probabilities(ordinary, *arguments)[0], 0.5)
        self.assertGreater(context_probabilities(clock, *arguments)[1], 0.5)

    def test_choice_indices_and_feature_schema_are_checked(self):
        self.assertRaises(ValueError, self.fit, [self.game(decisions=[self.decision(2)] * 80)])
        self.assertRaises(ValueError, tree_scores, self.fit([]), [[0]])
        self.assertRaises(ValueError, tree_scores, self.fit([]), [[0] * 102], -1)


if __name__ == '__main__':
    unittest.main()
