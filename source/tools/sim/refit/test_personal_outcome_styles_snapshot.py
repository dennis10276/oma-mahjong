import copy
import unittest

from personal_outcome_styles_snapshot import PROFILES, validate_count


class OutcomeStyleSnapshotTests(unittest.TestCase):
    def fixture(self, pilot=False):
        return {'targetMet': False, 'runs': 2 if pilot else 32, 'attempts': 3 if pilot else 32,
                'controlChainsMatched': 276, 'comparisonEpisodes': [str(index) for index in range(80)],
                'computationCaps': 0, 'validUncensoredSimulation': True,
                'rows': [{'name': 'one', 'start': index, 'chains': {profile: {} for profile in PROFILES},
                          'computationCaps' if pilot else 'outcomeStyleComputationCaps': {profile: 0 for profile in PROFILES}}
                         for index in range(276)]}

    def test_pilot_cannot_masquerade_as_full_counts_or_change_held_ids(self):
        validate_count(self.fixture())
        pilot = self.fixture(True)
        validate_count(pilot, True)
        self.assertRaises(ValueError, validate_count, pilot)
        changed = self.fixture()
        changed['comparisonEpisodes'][-1] = changed['comparisonEpisodes'][0]
        self.assertRaises(ValueError, validate_count, changed)
        changed = self.fixture()
        changed['rows'][-1] = copy.deepcopy(changed['rows'][0])
        self.assertRaises(ValueError, validate_count, changed)

    def test_missing_or_censored_chains_cannot_be_scored_as_human_failures(self):
        changed = self.fixture()
        changed['rows'][0]['outcomeStyleComputationCaps'][PROFILES[0]] = 1
        self.assertRaises(ValueError, validate_count, changed)
        changed['rows'][0]['chains'][PROFILES[0]]['computationCensored'] = 1
        changed['computationCaps'] = 1
        changed['validUncensoredSimulation'] = False
        self.assertRaises(ValueError, validate_count, changed)
        changed = self.fixture()
        del changed['rows'][0]['outcomeStyleComputationCaps'][PROFILES[0]]
        self.assertRaises(ValueError, validate_count, changed)


if __name__ == '__main__':
    unittest.main()
