import unittest
import hashlib
import tempfile
from pathlib import Path
from unittest.mock import patch

from attempt_count_fit import accuracy, completed_before, own_mode, attempt_features, is_correct, best_prediction, best_prediction_with_tail
from prospective import eligible_forecast, validate_inputs, score_ledger
from attempt_hazard import hazard_features, hazard_training, contextual_distribution


class AttemptCountTests(unittest.TestCase):
    def test_8plus_prediction_includes_unobserved_model_tail_without_inventing_a_winning_count(self):
        distribution = {1: 0.4, 2: 0.05, 3: 0.05, 8: 0.05}
        original = distribution.copy()
        self.assertEqual(best_prediction(distribution), 1)
        self.assertEqual(best_prediction_with_tail(distribution, 0.45, 129), 8)
        self.assertEqual(distribution, original)
        self.assertEqual(best_prediction_with_tail({}, 1, 129), 8)
        self.assertEqual(best_prediction_with_tail({1: 0.8, 8: 0.2}, 0, 129), 1)

    def test_8plus_tail_cannot_leak_into_lower_try_tolerance_or_hide_missing_mass(self):
        self.assertEqual(best_prediction_with_tail({1: 0.3, 6: 0.2, 7: 0.1}, 0.4, 129), 8)
        self.assertRaises(ValueError, best_prediction_with_tail, {1: 0.4}, 0.5, 129)
        self.assertRaises(ValueError, best_prediction_with_tail, {1: 0.5}, -0.5, 129)
        self.assertRaises(ValueError, best_prediction_with_tail, {1: 0.5}, 0.5, 8)
        self.assertRaises(ValueError, best_prediction_with_tail, {129: 0.5}, 0.5, 129)

    def test_own_mode_uses_completion_order_for_its_recent_window(self):
        completed_late = [{'name': 'Gerda', 'end': 100 + index, 'wonOn': 2} for index in range(20)]
        completed_early = [{'name': 'Gerda', 'end': index, 'wonOn': 1} for index in range(20)]
        self.assertEqual(own_mode(completed_late + completed_early, {'name': 'Gerda'}), 2)

    def test_replay_tolerance_uses_local_attempt_not_retained_displayed_counter(self):
        episode = {'name': 'Gerda', 'lv': 63, 'board': 'same', 'start': 100, 'end': 200,
                   'firstAttempt': 1, 'wonOn': 3, 'loggedFirstAttempt': 6, 'loggedWonOn': 8,
                   'openingRecorded': True}
        forecast = {'name': 'Gerda', 'lv': 63, 'board': 'same', 'predictedAttempt': 4,
                    'predictedDisplayedAttempt': 9, 'priorCounter': 5}
        ledger = [{'frozenAt': 50, 'forecasts': [forecast]}]
        report = score_ledger(ledger, [episode])
        self.assertEqual(report['players']['Gerda']['n'], 1)
        self.assertEqual(report['players']['Gerda']['correct'], 0)
        self.assertEqual(report['cohort']['Gerda']['correct'], 0)
        episode.update(wonOn=4, loggedWonOn=9)
        forecast.update(predictedAttempt=3, predictedDisplayedAttempt=8)
        report = score_ledger(ledger, [episode])
        self.assertEqual(report['players']['Gerda']['correct'], 1)
        self.assertEqual(report['cohort']['Gerda']['correct'], 1)

    def test_prospective_target_requires_eighty_percent_on_twenty_levels_for_every_player(self):
        names = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']
        episodes, forecasts = [], []
        for name in names:
            for index in range(20):
                episodes.append({'name': name, 'lv': index + 10, 'board': str(index), 'start': 100 + index * 10,
                                 'end': 105 + index * 10, 'firstAttempt': 1, 'wonOn': 1, 'openingRecorded': True})
                forecasts.append({'name': name, 'lv': index + 10, 'board': str(index),
                                  'predictedAttempt': 1 if index < 16 else 2, 'alternatives': {'perfectAfterTheFact': 1}})
        ledger = [{'frozenAt': 1, 'forecasts': forecasts}]
        self.assertTrue(score_ledger(ledger, episodes)['targetMet'])
        self.assertFalse(score_ledger(ledger, episodes[:-1])['targetMet'])
        forecasts[0]['predictedAttempt'] = 2
        self.assertFalse(score_ledger(ledger, episodes)['targetMet'])

    def test_scoring_does_not_reuse_a_forecast_for_later_easy_replays(self):
        episodes = [{'name': 'Gerda', 'lv': 63, 'board': 'same', 'start': start, 'end': start + 10,
                     'firstAttempt': 1, 'wonOn': 1, 'openingRecorded': True} for start in [100, 200]]
        forecast = {'name': 'Gerda', 'lv': 63, 'board': 'same', 'predictedAttempt': 1}
        report = score_ledger([{'frozenAt': 50, 'forecasts': [forecast]}], episodes)
        self.assertEqual(report['players']['Gerda']['n'], 1)
        report = score_ledger([{'frozenAt': 50, 'forecasts': [forecast]}, {'frozenAt': 150, 'forecasts': [forecast]}], episodes)
        self.assertEqual(report['players']['Gerda']['n'], 2)

    def test_unfinished_or_unforecasted_early_levels_cannot_be_skipped_to_pass_target(self):
        names = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']
        forecasts, episodes = [], []
        for name in names:
            episodes.append({'name': name, 'lv': 9, 'board': 'hard', 'start': 10, 'end': 11, 'firstAttempt': 1, 'wonOn': None, 'openingRecorded': True})
            for index in range(20):
                episode = {'name': name, 'lv': index + 10, 'board': str(index), 'start': 100 + index * 10,
                           'end': 105 + index * 10, 'firstAttempt': 1, 'wonOn': 1, 'openingRecorded': True}
                episodes.append(episode)
                forecasts.append({**episode, 'predictedAttempt': 1})
        ledger = [{'frozenAt': 1, 'forecasts': forecasts}]
        report = score_ledger(ledger, episodes)
        self.assertEqual(report['players']['Gerda']['accuracy'], 1)
        self.assertEqual(report['cohort']['Gerda']['pending'], 1)
        self.assertFalse(report['targetMet'])
        for episode in episodes:
            if episode['board'] == 'hard':
                episode['wonOn'] = 1
        report = score_ledger(ledger, episodes)
        self.assertEqual(report['cohort']['Gerda']['missingForecastsOrOpening'], 1)
        self.assertFalse(report['targetMet'])

    def test_inferred_opening_from_duration_is_not_proof_of_a_pre_start_forecast(self):
        episode = {'name': 'Gerda', 'lv': 63, 'board': 'same', 'start': 100, 'end': 200,
                   'firstAttempt': 1, 'wonOn': 1, 'openingRecorded': False}
        forecast = {'name': 'Gerda', 'lv': 63, 'board': 'same', 'predictedAttempt': 1}
        ledger = [{'frozenAt': 50, 'forecasts': [forecast]}]
        self.assertEqual(score_ledger(ledger, [episode])['players']['Gerda']['n'], 0)
        episode['openingRecorded'] = True
        self.assertEqual(score_ledger(ledger, [episode])['players']['Gerda']['n'], 1)

    def hazard_row(self, **changes):
        return {'name': 'Gerda', 'start': 10, 'end': 20, 'firstAttempt': 1, 'wonOn': 2,
                'observedAttempts': 2, 'physical': [20, 0.5, 1, 8, 2, 0.3, 1, 0, 2, 1, 5],
                'reference': {'strong': 0.5}, 'chain': {'cond': [0.5] * 20, 'within': [0.5]}, **changes}

    def test_contextual_hazards_learn_failed_censored_tries_without_inventing_a_win(self):
        censored = self.hazard_row(wonOn=None, observedAttempts=3)
        future = self.hazard_row(end=100, wonOn=1)
        missing = self.hazard_row(firstAttempt=2, wonOn=2)
        observations = hazard_training([censored, future, missing], 100)
        self.assertEqual(len(observations), 3)
        self.assertEqual([row[2] for row in observations], [0, 0, 0])
        self.assertEqual(len(hazard_training([self.hazard_row()], 100)), 2)

    def test_contextual_features_and_predictions_cannot_use_target_result(self):
        target = self.hazard_row(start=100, end=200)
        features, offset = hazard_features(target, 3)
        distribution, tail = contextual_distribution([], target)
        self.assertAlmostEqual(distribution[1], 0.5)
        self.assertAlmostEqual(sum(distribution.values()) + tail, 1)
        target['wonOn'] = 20
        self.assertEqual(hazard_features(target, 3)[0].tolist(), features.tolist())
        self.assertEqual(hazard_features(target, 3)[1], offset)
        self.assertEqual(contextual_distribution([target], target), (distribution, tail))

    def test_contextual_hazards_fit_only_observations_available_before_opening(self):
        target = self.hazard_row(start=100, end=200)
        earlier = self.hazard_row(wonOn=None, observedAttempts=8)
        fitted, tail = contextual_distribution([earlier], target)
        self.assertLess(fitted[1], 0.5)
        future = self.hazard_row(end=101, wonOn=1)
        self.assertEqual(contextual_distribution([earlier, future], target), (fitted, tail))

    def test_prospective_freezing_rejects_stale_features_and_changed_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            filename = root / 'input.json'
            filename.write_bytes(b'old')
            schema = {'version': 1, 'names': ['first']}
            inputs = {'featureSchema': schema, 'fingerprintFiles': ['input.json'],
                      'fingerprint': hashlib.sha256(b'old').hexdigest()}
            with patch('prospective.ROOT', root):
                validate_inputs(inputs, {'featureSchema': schema})
                with self.assertRaises(ValueError):
                    validate_inputs(inputs, {'featureSchema': {'version': 2}})
                filename.write_bytes(b'new')
                with self.assertRaises(ValueError):
                    validate_inputs(inputs, {'featureSchema': schema})

    def test_only_exact_attempt_counts_as_correct(self):
        rows = [
            {'wonOn': 2, 'predictions': {'bot': 1}},
            {'wonOn': 3, 'predictions': {'bot': 3}},
            {'wonOn': 3, 'predictions': {'bot': 2}},
        ]
        result = accuracy(rows, 'bot')
        self.assertEqual(result['correct'], 1)
        self.assertEqual(result['n'], 3)
        self.assertAlmostEqual(result['accuracy'], 1 / 3)

    def test_missing_test_levels_cannot_pass_target(self):
        result = accuracy([], 'bot')
        self.assertIsNone(result['accuracy'])
        self.assertEqual(result['n'], 0)

    def test_future_unfinished_and_missing_openings_are_excluded_from_training(self):
        rows = [
            {'end': 99, 'firstAttempt': 1, 'wonOn': 2},
            {'end': 100, 'firstAttempt': 1, 'wonOn': 1},
            {'end': 101, 'firstAttempt': 1, 'wonOn': 1},
            {'end': 98, 'firstAttempt': 1, 'wonOn': None},
            {'end': 97, 'firstAttempt': 2, 'wonOn': 4},
        ]
        self.assertEqual(completed_before(rows, 100), [rows[0]])

    def test_personal_mode_does_not_use_other_players_labels(self):
        before = [{'name': 'PUK', 'wonOn': 1, 'end': 1}] * 20 + [{'name': 'Gerda', 'wonOn': 2, 'end': 2}] * 10
        self.assertEqual(own_mode(before, {'name': 'Gerda'}), 2)
        self.assertEqual(own_mode(before, {'name': 'PUK'}), 1)

    def test_eighty_percent_sample_does_not_imply_eighty_percent_lower_bound(self):
        rows = [{'wonOn': 1, 'predictions': {'bot': 1 if index < 8 else 2}} for index in range(10)]
        result = accuracy(rows, 'bot')
        self.assertEqual(result['accuracy'], 0.8)
        self.assertLess(result['wilson95'][0], 0.8)

    def test_survival_features_use_simulated_attempt_not_actual_winning_count(self):
        row = {'features': [0.2, 0.7], 'chain': {'cond': [0.2, 0.4, None], 'within': [0.2, 0.52, 0.52]}, 'wonOn': 17}
        features = attempt_features(row, 3)
        self.assertEqual(features[-2:], [0.4, 0])
        row['wonOn'] = 1
        self.assertEqual(attempt_features(row, 3), features)

    def test_tolerance_uses_actual_attempt_and_preserves_first_three(self):
        self.assertFalse(is_correct(4, 3))
        self.assertTrue(is_correct(5, 4))
        self.assertTrue(is_correct(4, 5))
        self.assertTrue(is_correct(4, 6))
        self.assertTrue(is_correct(5, 7))
        self.assertFalse(is_correct(4, 7))

    def test_prediction_optimizes_allowed_tolerance_without_using_target_outcome(self):
        self.assertEqual(best_prediction({1: 0.3, 5: 0.25, 6: 0.25, 7: 0.2}), 5)

    def test_shared_eight_plus_bucket_preserves_earlier_actual_attempt_tolerances(self):
        self.assertTrue(is_correct(9, 12))
        self.assertTrue(is_correct(1000, 8))
        self.assertTrue(is_correct(8, 1000))
        self.assertFalse(is_correct(1000, 7))
        self.assertFalse(is_correct(7, 1000))
        self.assertTrue(is_correct(8, 6))
        self.assertTrue(is_correct(7, 9))
        self.assertTrue(is_correct(9, 7))
        self.assertFalse(is_correct(10, 7))
        self.assertFalse(is_correct(8, 3))
        for actual in range(1, 21):
            for predicted in range(1, 21):
                tolerance = 0 if actual <= 3 else 1 if actual <= 5 else 2
                expected = abs(predicted - actual) <= tolerance or predicted >= 8 and actual >= 8
                self.assertEqual(is_correct(predicted, actual), expected)

    def test_prediction_optimizer_uses_shared_bucket_without_changing_observed_winning_tries(self):
        distribution = {6: 0.2, 7: 0.1, 9: 0.3, 1000: 0.4}
        self.assertEqual(best_prediction(distribution), 8)
        self.assertEqual(distribution, {6: 0.2, 7: 0.1, 9: 0.3, 1000: 0.4})
        for actual in range(1, 41):
            for predicted in range(9, 41):
                self.assertGreaterEqual(is_correct(8, actual), is_correct(predicted, actual))

    def test_shared_bucket_uses_local_tries_not_retained_displayed_counter(self):
        episode = {'name': 'Gerda', 'lv': 63, 'board': 'same', 'start': 100, 'end': 200,
                   'firstAttempt': 1, 'wonOn': 12, 'loggedFirstAttempt': 7, 'loggedWonOn': 18, 'openingRecorded': True}
        ledger = [{'frozenAt': 50, 'forecasts': [{'name': 'Gerda', 'lv': 63, 'board': 'same',
                   'predictedAttempt': 9, 'predictedDisplayedAttempt': 15, 'priorCounter': 6}]}]
        report = score_ledger(ledger, [episode])
        self.assertEqual(report['players']['Gerda']['correct'], 1)
        self.assertEqual(report['cohort']['Gerda']['correct'], 1)
        self.assertEqual(report['scored'][0]['predictedAttempt'], 9)
        self.assertEqual(report['scored'][0]['wonOn'], 12)
        episode.update(wonOn=3, loggedWonOn=9)
        self.assertEqual(score_ledger(ledger, [episode])['players']['Gerda']['correct'], 0)

    def test_prospective_forecast_must_precede_level_opening(self):
        episode = {'name': 'Gerda', 'lv': 63, 'board': 'fixed', 'start': 100, 'end': 200}
        forecast = {'name': 'Gerda', 'lv': 63, 'board': 'fixed', 'predictedAttempt': 2}
        self.assertIsNone(eligible_forecast([{'frozenAt': 100, 'forecasts': [forecast]}], episode))
        self.assertIsNone(eligible_forecast([{'frozenAt': 150, 'forecasts': [forecast]}], episode))
        self.assertEqual(eligible_forecast([{'frozenAt': 99, 'forecasts': [forecast]}], episode)[0], 99)

    def test_prospective_scoring_uses_earliest_forecast_and_exact_board(self):
        episode = {'name': 'Gerda', 'lv': 63, 'board': 'fixed', 'start': 100}
        forecast = {'name': 'Gerda', 'lv': 63, 'board': 'fixed', 'predictedAttempt': 2}
        later = {**forecast, 'predictedAttempt': 1}
        ledger = [{'frozenAt': 90, 'forecasts': [later]}, {'frozenAt': 80, 'forecasts': [forecast]}]
        self.assertEqual(eligible_forecast(ledger, episode)[1]['predictedAttempt'], 2)
        self.assertIsNone(eligible_forecast(ledger, {**episode, 'board': 'replaced'}))
        self.assertIsNone(eligible_forecast(ledger, episode, after=95))


if __name__ == '__main__':
    unittest.main()
