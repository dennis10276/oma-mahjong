import hashlib
import math
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

import personal_full_choice_fit as full


class FullChoiceTests(unittest.TestCase):
    def decision(self, chosen=0):
        matching = [0.0] * 65
        matching[-1] = 1
        unrelated = [0.0] * 65
        context = [0.0] * 22
        context[0] = 1
        context[20] = 1
        return {'F': [matching, unrelated], 'k': chosen, 'tray': 1, 'kindContext': context}

    def game(self, available=2, chosen=0):
        return {'t': 1, 'availableAt': available, 'decisions': [self.decision(chosen)]}

    def test_matching_preference_is_learned_from_same_kind_alternatives(self):
        samples = full.within_samples([self.game() for _ in range(20)])
        base = np.zeros(65)
        weights = full.fit_within(samples, base)
        self.assertGreater(weights[-1], 0)
        result = full.score([self.game()], np.zeros((4, 22)), weights)
        self.assertEqual(result['topActionAccuracy'], 1)
        self.assertLess(result['knownMatchLogLoss'], math.log(2))

    def test_joint_fit_compares_different_kinds_instead_of_conditioning_on_selected_kind(self):
        game = self.game()
        game['decisions'][0]['F'][1][19] = 1
        samples = full.joint_samples([game])
        self.assertEqual(samples[0][0].shape, (2, 65 + 4 * 22))
        kind, within, count = full.fit_person_joint([game] * 20, 10, np.zeros(65), 22)
        self.assertEqual(count, 20)
        values = full.joint_probabilities(game['decisions'][0], kind, within)
        self.assertGreater(values[0], 0.5)
        self.assertAlmostEqual(values.sum(), 1)

    def test_joint_model_accepts_personal_move_value_over_a_generic_kind_preference(self):
        decision = self.decision()
        decision['F'][1][19] = 1
        kind = np.zeros((4, 22))
        kind[full.KINDS.index('flip'), 0] = 20
        within = np.zeros(65)
        within[64] = 100
        self.assertGreater(full.joint_probabilities(decision, kind, within)[0], 0.999)

    def test_joint_empty_history_and_future_records_keep_only_declared_prior(self):
        base = np.arange(65, dtype=float)
        kind, within, count = full.fit_person_joint([self.game(available=10)], 10, base, 22)
        self.assertEqual(count, 0)
        np.testing.assert_array_equal(kind, np.zeros((4, 22)))
        np.testing.assert_array_equal(within, base)

    def test_ragged_softmax_fit_matches_direct_binary_objective(self):
        features = np.array([[1.0], [0.0]])
        fitted = full.fit_within([(features, 0, 2.0), (features, 1, 1.0)], np.zeros(1), penalty=0.1)
        probability = 1 / (1 + math.exp(-fitted[0]))
        self.assertAlmostEqual(3 * probability - 2 + 0.1 * fitted[0], 0, places=5)

    def test_kind_probabilities_mask_unavailable_actions(self):
        weights = np.zeros((4, 22))
        weights[full.KINDS.index('fatal'), 0] = 1000
        probabilities = full.probabilities(self.decision(), weights, np.zeros(65))
        np.testing.assert_allclose(probabilities, [0.5, 0.5])
        self.assertAlmostEqual(probabilities.sum(), 1)

    def test_empty_training_retains_prior(self):
        prior = np.arange(65, dtype=float)
        np.testing.assert_array_equal(full.fit_within([], prior), prior)

    def test_own_fit_uses_each_recording_once_and_never_a_fitted_family_prior(self):
        games = [self.game(), self.game(available=20, chosen=1)]
        with patch.object(full, 'fit_kind', wraps=full.fit_kind) as kind, patch.object(full, 'fit_within', wraps=full.fit_within) as within:
            result = full.fit_person(games, 10, np.zeros(65), 22)
        self.assertEqual(result[2], 1)
        self.assertEqual(kind.call_count, 1)
        self.assertEqual(within.call_count, 1)
        np.testing.assert_array_equal(kind.call_args.args[1], np.zeros((4, 22)))
        np.testing.assert_array_equal(within.call_args.args[1], np.zeros(65))

    def test_own_and_family_late_chunks_cannot_train_a_target(self):
        players = {'Dennis': [self.game()], 'Gerda': [self.game(chosen=1)]}
        first = full.fit_models(players, 'Dennis', 10, np.zeros(65), 22)
        contaminated = {name: games + [self.game(available=10, chosen=1), self.game(available=11, chosen=1)] for name, games in players.items()}
        second = full.fit_models(contaminated, 'Dennis', 10, np.zeros(65), 22)
        np.testing.assert_array_equal(first[0], second[0])
        np.testing.assert_array_equal(first[1], second[1])
        self.assertEqual(first[2], second[2])

    def test_person_balancing_does_not_let_recording_volume_dominate_family(self):
        alternatives = np.zeros((2, 65))
        grouped = full.equal_person([[(alternatives, 0, 1.0)] * 100, [(alternatives, 1, 1.0)]])
        self.assertAlmostEqual(sum(weight for _, selected, weight in grouped if selected == 0), 1)
        self.assertEqual(sum(weight for _, selected, weight in grouped if selected == 1), 1)

    def test_prefix_status_does_not_invent_win_or_failure_labels(self):
        first = full.fit_models({'Dennis': [self.game()]}, 'Dennis', 10, np.zeros(65), 22)
        tagged = {**self.game(), 'ending': 'restart', 'complete': True, 'wonOn': 999}
        second = full.fit_models({'Dennis': [tagged]}, 'Dennis', 10, np.zeros(65), 22)
        np.testing.assert_array_equal(first[0], second[0])
        np.testing.assert_array_equal(first[1], second[1])

    def test_changed_engine_invalidates_prefix_measurements(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'engine.js'
            source.write_bytes(b'old')
            digest = hashlib.sha256(b'engine.jsold').hexdigest()
            data = {'fingerprintFiles': ['engine.js'], 'fingerprint': digest}
            with patch.object(full, 'ROOT', root):
                full.validate(data)
                source.write_bytes(b'new')
                with self.assertRaisesRegex(ValueError, 'stale'):
                    full.validate(data)


if __name__ == '__main__':
    unittest.main()
