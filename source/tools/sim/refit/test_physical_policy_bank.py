import unittest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import physical_policy_bank as bank
from physical_policy_bank import eligible_players, plan_models


class PhysicalPolicyBankTests(unittest.TestCase):
    def game(self, aid, available, novel=True):
        return {'aid': aid, 'availableAt': available, 'initialNewLevel': novel}

    def test_available_prefixes_exclude_same_target_trajectory_even_with_inferred_late_start(self):
        players = {'Dennis': [self.game('prior', 1), self.game('target', 2), self.game('future', 10)],
                   'Gerda': [self.game('family', 3)]}
        request = {'name': 'Dennis', 'start': 10, 'excludedAids': ['target']}
        selected = eligible_players(players, request, 'all')
        self.assertEqual([game['aid'] for game in selected['Dennis']], ['prior'])
        self.assertEqual([game['aid'] for game in selected['Gerda']], ['family'])

    def test_novel_training_rejects_replay_and_retry_actions_without_using_outcomes(self):
        players = {'Dennis': [self.game('first-failed', 1), self.game('replayed', 2, False), self.game('retry-won', 3, False)]}
        selected = eligible_players(players, {'start': 10}, 'novel')
        self.assertEqual([game['aid'] for game in selected['Dennis']], ['first-failed'])

    def test_identical_prior_membership_reuses_models_without_training_later_records(self):
        data = {'players': {'Dennis': [self.game('prior', 1), self.game('later', 11)]}}
        planned, selected = plan_models(data, [{'name': 'Dennis', 'start': 10}, {'name': 'Dennis', 'start': 11}])
        self.assertEqual(len(planned), 4)
        self.assertEqual(selected[0]['models'], selected[1]['models'])
        self.assertTrue(all(model['trainingCut'] == 2 for model in planned))

    def test_empty_history_has_an_explicit_prior_not_a_future_recording_fallback(self):
        planned, _ = plan_models({'players': {'Dennis': [self.game('future', 20)]}}, [{'name': 'Dennis', 'start': 10}])
        self.assertTrue(all(model['trainingCut'] == 0 and model['roster'] == [] for model in planned))

    def test_own_scopes_never_include_another_person(self):
        players = {'Dennis': [self.game('mine', 1), self.game('replay', 2, False)],
                   'Gerda': [self.game('not-mine', 3)]}
        request = {'name': 'Dennis', 'start': 10}
        self.assertEqual(eligible_players(players, request, 'ownAll'), {'Dennis': players['Dennis']})
        self.assertEqual(eligible_players(players, request, 'ownNovel'), {'Dennis': [players['Dennis'][0]]})
        self.assertEqual(eligible_players(players, request, 'ownJointAll'), {'Dennis': players['Dennis']})
        self.assertEqual(eligible_players(players, request, 'ownJointNovel'), {'Dennis': [players['Dennis'][0]]})

    def test_worker_initializer_loads_the_explicit_scoring_dataset(self):
        with tempfile.TemporaryDirectory() as folder:
            filename = Path(folder) / 'single.json'
            data = {'physicalSingleStep': True, 'players': {}}
            filename.write_text(json.dumps(data), encoding='utf-8')
            with patch.object(bank, 'WORKER_DATA', None):
                bank.initialize(str(filename))
                self.assertEqual(bank.WORKER_DATA, data)

    def test_single_step_fitted_prior_preserves_instrumentation_metadata(self):
        features = ['feature' + str(index) for index in range(75)]
        features[64], features[66] = 'visibleTrayMatch', 'visiblePeekMatch'
        data = {'players': {'Dennis': []}, 'physicalSingleStep': True, 'base': [0] * 75,
                'features': features, 'kindContextFeatures': ['context' + str(index) for index in range(25)]}
        request = {'name': 'Dennis', 'start': 10}
        key, roster = bank.training_key(data['players'], 'Dennis', 'ownAll', True, schema=bank.schema_of(data))
        task = {'id': key, 'name': 'Dennis', 'scope': 'ownAll', 'trainingCut': 0, 'request': request, 'roster': roster}
        with patch.object(bank, 'WORKER_DATA', data):
            model = bank.fit_one(task)
        self.assertEqual(model['trainingGames'], {'Dennis': 0})
        self.assertTrue(model['physicalSingleStep'])

    def test_identical_recordings_with_different_scoring_modes_cannot_share_a_model_identity(self):
        players = {'Dennis': [self.game('prior', 1)]}
        self.assertNotEqual(bank.training_key(players, 'Dennis', 'ownAll', False)[0],
                            bank.training_key(players, 'Dennis', 'ownAll', True)[0])

    def test_different_observation_schemas_cannot_share_a_model_identity(self):
        players = {'Dennis': [self.game('prior', 1)]}
        original = bank.training_key(players, 'Dennis', 'ownAll', schema=[['knownReopen'], ['bias']])[0]
        relational = bank.training_key(players, 'Dennis', 'ownAll', schema=[['knownReopen', 'knownPairPrep'], ['bias', 'knownPairPrepShare']])[0]
        self.assertNotEqual(original, relational)

    def test_follow_through_fits_own_counts_with_explicit_empty_context_priors(self):
        fitted = bank.follow_through_of([{'availableAt': 1, 'followThroughSamples': [
            {'tray': 1, 'followed': True}, {'tray': 1, 'followed': False}, {'tray': 2, 'followed': True}]}])
        self.assertEqual(fitted['probabilities'], [0.0, 0.5, 2 / 3, 0.5])
        self.assertEqual(fitted['opportunities'], [0.0, 2.0, 1.0, 0.0])
        self.assertEqual(bank.follow_through_of([])['probabilities'], [0.0, 0.5, 0.5, 0.5])

    def test_intent_models_have_distinct_identity_and_use_only_earlier_own_cues(self):
        players = {'Dennis': [self.game('prior', 1)], 'Gerda': [self.game('other', 1)]}
        request = {'name': 'Dennis', 'start': 10}
        players['Dennis'][0]['followThroughSamples'] = [{'tray': 3, 'followed': True}]
        players['Gerda'][0]['followThroughSamples'] = [{'tray': 3, 'followed': False}] * 50
        players['Dennis'].append({**self.game('future', 10), 'followThroughSamples': [{'tray': 3, 'followed': False}] * 50})
        own = bank.eligible_players(players, request, 'ownAll')
        self.assertEqual(bank.follow_through_of(own['Dennis'])['probabilities'][3], 2 / 3)
        self.assertNotEqual(bank.training_key(own, 'Dennis', 'ownAll', False, False)[0],
                            bank.training_key(own, 'Dennis', 'ownAll', False, True)[0])

    def test_pair_context_includes_empty_tray_and_keeps_own_explicit_priors(self):
        games = [{'aid': 'prior', 'availableAt': 1, 'pairFollowThroughSamples': [{'tray': 0, 'followed': True}, {'tray': 3, 'followed': False}]}]
        fitted = bank.follow_through_of(games, 'pairFollowThroughSamples', (0, 1, 2, 3))
        self.assertEqual(fitted['probabilities'], [2 / 3, 0.5, 0.5, 1 / 3])
        self.assertEqual(bank.follow_through_of([], 'pairFollowThroughSamples', (0, 1, 2, 3))['probabilities'], [0.5] * 4)
        self.assertNotEqual(bank.training_key({'Dennis': games}, 'Dennis', 'ownAll', pair_intent=False)[0],
                            bank.training_key({'Dennis': games}, 'Dennis', 'ownAll', pair_intent=True)[0])

    def test_memory_source_cannot_bypass_target_exclusion_or_timestamp_gates(self):
        game = {**self.game('retry', 5, False), 't': 4,
                'memorySources': [{'aid': 'target', 'availableAt': 2}]}
        request = {'name': 'Dennis', 'start': 10, 'excludedAids': ['target']}
        self.assertEqual(bank.eligible_players({'Dennis': [game]}, request, 'ownCarryAll')['Dennis'], [])
        request['excludedAids'] = []
        self.assertEqual(bank.eligible_players({'Dennis': [game]}, request, 'ownCarryAll')['Dennis'], [game])
        for available in [4, 5, 10]:
            game['memorySources'][0]['availableAt'] = available
            self.assertEqual(bank.eligible_players({'Dennis': [game]}, request, 'ownCarryAll')['Dennis'], [])

    def test_memory_model_records_source_dependencies_and_uses_its_own_variant(self):
        features = ['feature' + str(index) for index in range(75)]
        features[64], features[66] = 'visibleTrayMatch', 'visiblePeekMatch'
        game = {**self.game('retry', 5, False), 't': 4, 'decisions': [],
                'memorySources': [{'aid': 'prior', 'availableAt': 2}]}
        data = {'players': {'Dennis': []}, 'retryMemoryMeasured': True,
                'memoryPlayers': {'configured': {'Dennis': [game]}}, 'base': [0] * 75,
                'features': features, 'kindContextFeatures': ['context' + str(index) for index in range(25)]}
        tasks, _ = bank.plan_models(data, [{'name': 'Dennis', 'start': 10}], ('ownCarryAll',))
        with patch.object(bank, 'WORKER_DATA', data):
            fitted = bank.fit_one(tasks[0])
        self.assertEqual(fitted['trainedAids'], ['prior', 'retry'])
        self.assertEqual(fitted['retryMemoryMode'], 'configured')
        self.assertEqual(fitted['trainingGames'], {'Dennis': 1})
        changed = {**game, 'memorySources': [{'aid': 'different', 'availableAt': 2}]}
        self.assertNotEqual(bank.training_key({'Dennis': [game]}, 'Dennis', 'ownCarryAll')[0],
                            bank.training_key({'Dennis': [changed]}, 'Dennis', 'ownCarryAll')[0])


if __name__ == '__main__':
    unittest.main()
