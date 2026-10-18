import copy
import unittest

from personal_prefix_versions import build_versions, select_prefixes, training_identity


class PersonalPrefixVersionTests(unittest.TestCase):
    def fixture(self):
        old = {'aid': 'resumed128', 'lv': 128, 'at': 1, 't': 1, 'availableAt': 9, 'stopReason': 'incomplete',
               'ending': None, 'complete': False, 'initialNewLevel': True,
               'decisions': [{'F': [[0], [1]], 'immediate': [[0], [1]], 'kindContext': [1], 'k': 0, 'tray': 0, 'moves': 0}]}
        schema = {'features': ['one'], 'kindContextFeatures': ['intercept'], 'base': [0]}
        past = {**schema, 'players': {'Dennis': [old], 'Gerda': [{**old, 'aid': 'other-person'}]}}
        current = {**old, 'availableAt': 30, 'stopReason': 'end', 'ending': 'win', 'complete': True,
                   'decisions': old['decisions'] + [{**old['decisions'][0], 'k': 1}]}
        fresh = {**schema, 'players': {'Dennis': [current], 'Gerda': []}}
        return past, fresh

    def test_resumed_attempt_uses_only_its_latest_version_available_before_the_request(self):
        past, fresh = self.fixture()
        bank = build_versions([(past, 'old'), (fresh, 'fresh')])
        earlier = select_prefixes(bank, 'Dennis', 30)
        later = select_prefixes(bank, 'Dennis', 31)
        self.assertEqual(earlier[0]['stopReason'], 'incomplete')
        self.assertEqual(len(earlier[0]['decisions']), 1)
        self.assertEqual(later[0]['ending'], 'win')
        self.assertEqual(len(later[0]['decisions']), 2)
        self.assertNotEqual(training_identity('Dennis', earlier)[0], training_identity('Dennis', later)[0])

    def test_future_completion_or_winning_label_cannot_change_an_earlier_actor(self):
        past, fresh = self.fixture()
        before = copy.deepcopy((past, fresh))
        first = select_prefixes(build_versions([(past, 'old'), (fresh, 'fresh')]), 'Dennis', 20)
        fresh['players']['Dennis'][0]['ending'] = 'stuck'
        fresh['players']['Dennis'][0]['decisions'][1]['k'] = 0
        second = select_prefixes(build_versions([(past, 'old'), (fresh, 'fresh')]), 'Dennis', 20)
        self.assertEqual(first, second)
        self.assertEqual(training_identity('Dennis', first), training_identity('Dennis', second))
        self.assertEqual(before[0], past)

    def test_target_exclusions_and_own_person_scope_apply_before_version_selection(self):
        past, fresh = self.fixture()
        bank = build_versions([(past, 'old'), (fresh, 'fresh')])
        self.assertEqual(select_prefixes(bank, 'Dennis', 100, ['resumed128']), [])
        self.assertEqual([game['aid'] for game in select_prefixes(bank, 'Gerda', 100)], ['other-person'])
        self.assertEqual(select_prefixes(bank, 'Dennis', 9), [])

    def test_same_time_conflicts_and_incompatible_feature_schemas_are_not_silently_merged(self):
        past, fresh = self.fixture()
        fresh['players']['Dennis'][0]['availableAt'] = 9
        self.assertRaises(ValueError, build_versions, [(past, 'old'), (fresh, 'fresh')])
        past, fresh = self.fixture()
        fresh['features'] = ['different']
        self.assertRaises(ValueError, build_versions, [(past, 'old'), (fresh, 'fresh')])

    def test_identical_versions_deduplicate_without_changing_training_identity(self):
        past, _ = self.fixture()
        copy_of_past = copy.deepcopy(past)
        copy_of_past['players']['Dennis'][0]['decisions'][0]['knownPlan'] = [[1], [0]]
        bank = build_versions([(past, 'old'), (copy_of_past, 'another-instrumentation')])
        selected = select_prefixes(bank, 'Dennis', 100)
        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]['sources'], ['old', 'another-instrumentation'])
        original = select_prefixes(build_versions([(past, 'old')]), 'Dennis', 100)
        self.assertEqual(training_identity('Dennis', selected), training_identity('Dennis', original))
        self.assertRaises(ValueError, training_identity, 'Dennis', selected * 2)

    def test_real_snapshot_observation_guard_does_not_treat_queued_client_time_as_server_availability(self):
        past, fresh = self.fixture()
        fresh['players']['Dennis'][0]['availableAt'] = 15
        bank = build_versions([(past, {'id': 'old', 'observedAt': 10}), (fresh, {'id': 'fresh', 'observedAt': 30})])
        self.assertEqual(select_prefixes(bank, 'Dennis', 20)[0]['ending'], 'win')
        self.assertIsNone(select_prefixes(bank, 'Dennis', 20, strict_observed=True)[0]['ending'])
        self.assertEqual(select_prefixes(bank, 'Dennis', 31, strict_observed=True)[0]['ending'], 'win')
        self.assertEqual(select_prefixes(build_versions([(past, 'no-observation-proof')]), 'Dennis', 20, strict_observed=True), [])


if __name__ == '__main__':
    unittest.main()
