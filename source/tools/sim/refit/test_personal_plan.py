import copy
import math
import unittest

import numpy as np
from scipy.special import logsumexp

from personal_plan import FEATURES, component_probabilities, failure_reason, fit_plan, plan_features, retry_links, score_plan


class PersonalPlanTests(unittest.TestCase):
    def decision(self, chosen=0):
        choices = [[0] * 76 for index in range(2)]
        choices[1][21] = 1
        return {'F': choices, 'immediate': [[0] * 29 for index in range(2)], 'kindContext': [1] + [0] * 25, 'k': chosen}

    def game(self, aid='old', time=1, chosen=0, **changes):
        return {'aid': aid, 't': time, 'availableAt': time + 1, 'at': 1, 'initialNewLevel': True,
                'complete': True, 'stopReason': 'end', 'ending': 'stuck', 'reconstructed': {'why': 'tray'},
                'decisions': [self.decision(chosen)] * 40, **changes}

    def fit(self, games, cutoff=100, allowed=None):
        return fit_plan(games, np.zeros((4, 26)), np.zeros(76), cutoff,
                        set(game['aid'] for game in games) if allowed is None else allowed, iterations=5)

    def test_whole_episode_explains_consistent_routes_better_than_independent_taps(self):
        games = [self.game(str(index), index * 3 + 1, chosen=index % 2) for index in range(8)]
        model = self.fit(games)
        target = self.game('new', 100)
        score = score_plan(target, np.zeros((4, 26)), np.zeros(76), model)
        self.assertLess(score['jointLogLoss'], score['stepLogLoss'] - 0.1)
        self.assertGreater(score['topActionAccuracy'], 0.8)
        self.assertGreater(np.linalg.norm(np.asarray(model['weights'])[0] - np.asarray(model['weights'])[1]), 0.5)
        self.assertTrue(all(later <= earlier + 1e-6 for earlier, later in zip(model['trainingObjectives'], model['trainingObjectives'][1:])))
        log_components = np.zeros(2)
        for decision in target['decisions']:
            log_components += np.log(component_probabilities(decision, np.zeros((4, 26)), np.zeros(76), model)[:, decision['k']])
        expected = -logsumexp(np.log(model['initialPrior']) + log_components)
        self.assertAlmostEqual(score['jointLogLoss'] * score['decisions'], expected, places=10)

    def test_future_target_and_unavailable_memory_do_not_change_fits(self):
        earlier = self.game()
        future = self.game('future', 99)
        target = self.game('target', 3)
        dependent = self.game('retry', 5, memorySources=[{'aid': 'target', 'availableAt': 1}])
        allowed = {'old', 'future', 'retry'}
        self.assertEqual(self.fit([earlier], allowed=allowed), self.fit([earlier, future, target, dependent], allowed=allowed))
        self.assertEqual(self.fit([])['weights'], [[0] * len(FEATURES)] * 2)
        score = score_plan(earlier, np.zeros((4, 26)), np.zeros(76), self.fit([]))
        self.assertAlmostEqual(score['jointLogLoss'], math.log(2))

    def test_retry_links_require_adjacent_available_natural_failures_on_same_campaign_board(self):
        previous = self.game('previous', 1, campaignStart=0, campaignBoard='board')
        current = self.game('current', 4, at=2, campaignStart=0, campaignBoard='board')
        self.assertEqual(retry_links([previous, current]), [('previous', 'current', 'tray')])
        for altered in [{**current, 'at': 3}, {**current, 't': 2}, {**current, 'campaignStart': 3},
                        {**current, 'campaignBoard': 'different'}, {**current, 'campaignBoardChanged': True}]:
            self.assertEqual(retry_links([previous, altered]), [])
        for boundary in ['shuffle', 'rescue', 'incomplete', 'auto', 'historicalPhysicsBoundary']:
            censored = {**previous, 'stopReason': boundary, 'complete': False}
            self.assertIsNone(failure_reason(censored))
            self.assertEqual(retry_links([censored, current]), [])

    def test_new_level_initial_prior_and_retry_matrices_are_personal_and_normalized(self):
        games = [self.game(str(index), index * 3 + 1, chosen=index % 2, initialNewLevel=index % 2 == 0,
                           at=index + 1, campaignStart=0, campaignBoard='board') for index in range(8)]
        model = self.fit(games)
        self.assertEqual(len(model['transitionLinks']), 7)
        for matrix in model['transitions'].values():
            np.testing.assert_allclose(np.sum(matrix, axis=1), [1, 1])
            self.assertTrue(np.all(np.asarray(matrix) > 0))
        self.assertGreater(model['transitions']['tray'][0][1], model['transitions']['tray'][0][0])
        self.assertGreater(model['transitions']['tray'][1][0], model['transitions']['tray'][1][1])
        self.assertAlmostEqual(sum(model['initialPrior']), 1)
        self.assertNotAlmostEqual(model['initialPrior'][0], model['prior'][0])

    def test_plan_features_ignore_anticipated_followups_and_unknown_picture_identity(self):
        decision = self.decision()
        expected = plan_features(decision)
        changed = copy.deepcopy(decision)
        changed['F'][0][3] = 999
        changed['F'][0][68] = 999
        changed['F'][0][30] = 1
        np.testing.assert_array_equal(plan_features(changed), expected)
        changed['immediate'][0][3] = 4
        self.assertNotEqual(plan_features(changed)[0, FEATURES.index('mateDepth')], expected[0, FEATURES.index('mateDepth')])

    def test_held_target_outcomes_cannot_change_action_predictions(self):
        game = self.game()
        model = self.fit([])
        expected = score_plan(game, np.zeros((4, 26)), np.zeros(76), model)
        altered = {**game, 'ending': 'win', 'wonOn': 99, 'complete': False, 'stopReason': 'shuffle'}
        self.assertEqual(score_plan(altered, np.zeros((4, 26)), np.zeros(76), model), expected)


if __name__ == '__main__':
    unittest.main()
