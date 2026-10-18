import math
import unittest

from personal_count_fit import outcome_loss, profile_weights, predictive_distribution, features_of, hazards_of, distribution_of, conditional_of, histories


class PersonalCountTests(unittest.TestCase):
    def row(self, **changes):
        return {'name': 'Gerda', 'start': 10, 'end': 20, 'firstAttempt': 1, 'wonOn': 2, 'observedAttempts': 2,
                'assisted': False, 'board': 'same', 'lv': 60, 'physical': [20, 0.2, 2, 6, 2, 0, 0, 0, 0, 0, 5],
                'reference': {'strong': 0.5, 'average': 0.3}, 'chains': {
                    'baseline': {'within': [0.8, 0.9], 'cond': [0.8, 0.5]},
                    'learning': {'within': [0.2, 0.9], 'cond': [0.2, 0.875]}}, **changes}

    def test_easy_replays_do_not_inflate_new_level_skill_history(self):
        first = self.row(firstClear=True, wonOn=4)
        replay = self.row(firstClear=False, start=30, end=40, wonOn=1)
        target = self.row(firstClear=True, start=100, board='new')
        values = histories([first, replay], target)
        self.assertEqual(values[0], 1)
        self.assertAlmostEqual(values[1], 1 / 3)
        self.assertEqual(values[3], 4)
        self.assertEqual(histories([first, replay], {**target, 'firstClear': False})[3], 2.5)

    def test_replay_and_changed_board_counts_cannot_fit_natural_new_level_profiles(self):
        target = self.row(firstClear=True, start=100)
        profiles = ['baseline', 'learning']
        prior = profile_weights([], target, profiles, 10)
        self.assertEqual(profile_weights([self.row(firstClear=False), self.row(firstClear=True, boardChangedWithinCampaign=True)], target, profiles, 10), prior)

    def test_first_clear_likelihood_and_censored_survival_do_not_invent_a_win(self):
        completed = self.row()
        censored = self.row(wonOn=None)
        self.assertLess(outcome_loss(completed, 'learning', 10), outcome_loss(completed, 'baseline', 10))
        hazards = hazards_of(censored['chains']['learning'], 10)
        self.assertAlmostEqual(outcome_loss(censored, 'learning', 10), -math.log((1 - hazards[0]) * (1 - hazards[1])), places=12)
        self.assertNotEqual(outcome_loss(censored, 'learning', 10), outcome_loss(completed, 'learning', 10))

    def test_profile_learning_uses_only_earlier_unassisted_confirmed_episodes(self):
        past, target = self.row(), self.row(start=100, end=200, wonOn=1)
        profiles = ['baseline', 'learning']
        expected = profile_weights([past], target, profiles, 10)
        polluted = [past, target, self.row(end=100), self.row(end=30, assisted=True), self.row(end=40, firstAttempt=2)]
        self.assertEqual(profile_weights(polluted, target, profiles, 10), expected)
        self.assertGreater(expected[0]['learning'], 1 / 3)
        target['wonOn'] = 30
        self.assertEqual(profile_weights([past], target, profiles, 10), expected)
        self.assertEqual(expected[1]['ownAvailableThrough'], 20)

    def test_distribution_smoothing_and_unobserved_tail_preserve_probability(self):
        distribution, tail = distribution_of(hazards_of({'within': [1.0], 'cond': [1.0]}, 10, 8))
        self.assertAlmostEqual(sum(distribution.values()) + tail, 1)
        self.assertGreater(distribution[2], 0)
        self.assertRaises(ValueError, hazards_of, {'within': [0.8, 0.7]}, 10)

    def test_late_conditional_hazard_avoids_subtracting_nearly_one(self):
        distribution, tail = distribution_of([0.99] * 128)
        self.assertAlmostEqual(conditional_of(distribution, 127, tail), 0.99)
        distribution, tail = distribution_of([0.01] * 128)
        self.assertAlmostEqual(conditional_of(distribution, 1, tail), 0.01)

    def test_predictive_features_and_profile_distribution_cannot_read_target_result(self):
        past, target = self.row(), self.row(start=100, end=200, wonOn=1)
        profiles = ['baseline', 'learning']
        features = features_of([past], target, profiles, 10)
        prediction = predictive_distribution([past], target, profiles, 10)
        target.update(wonOn=30, observedAttempts=30, assisted=True)
        self.assertEqual(features_of([past], target, profiles, 10), features)
        self.assertEqual(predictive_distribution([past], target, profiles, 10), prediction)

    def test_family_prior_cannot_use_later_outcomes_and_does_not_dominate_by_player_size(self):
        target = self.row(start=100, end=200)
        family = self.row(name='PUK')
        profiles = ['baseline', 'learning']
        expected = profile_weights([family], target, profiles, 10)
        self.assertEqual(profile_weights([family, self.row(name='PUK', end=101)], target, profiles, 10), expected)
        repeated = profile_weights([family] * 10, target, profiles, 10)
        for profile in profiles:
            self.assertAlmostEqual(expected[0][profile], repeated[0][profile])

    def test_own_only_strategy_and_features_ignore_other_people_completely(self):
        target = self.row(start=100, end=200)
        own, family = self.row(), self.row(name='PUK', wonOn=20)
        profiles = ['baseline', 'learning']
        self.assertEqual(profile_weights([own], target, profiles, 10, True),
                         profile_weights([own, family], target, profiles, 10, True))
        self.assertEqual(features_of([own], target, profiles, 10, True),
                         features_of([own, family], target, profiles, 10, True))
        self.assertIsNone(profile_weights([own, family], target, profiles, 10, True)[1]['familyAvailableThrough'])

    def test_own_only_count_features_do_not_use_a_family_fitted_baseline_actor(self):
        target = self.row(start=100)
        target['chains']['ownAll'] = target['chains']['learning']
        profiles = ['ownAll']
        original = features_of([], target, profiles, 10, True)
        target['chains']['baseline'] = {'within': [1.0], 'cond': [1.0]}
        self.assertEqual(features_of([], target, profiles, 10, True), original)


if __name__ == '__main__':
    unittest.main()
