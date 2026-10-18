import copy
import unittest

from personal_known_plan_count_snapshot import PROFILES, validate_count


class PersonalKnownPlanCountTests(unittest.TestCase):
    def fixture(self):
        row = {'knownPlanStats': {profile: {'contextChoiceLimits': 0} for profile in PROFILES},
               'chains': {profile: {'within': [0.5] * 32} for profile in PROFILES}}
        return {'targetMet': False, 'runs': 32, 'attempts': 32, 'rows': [copy.deepcopy(row) for _ in range(276)],
                'controlChainsMatched': 552, 'comparisonEpisodes': list(range(80)), 'knownPlanComputationCaps': 0,
                'validUncensoredSimulation': True}

    def test_complete_zero_boundary_sampling_passes(self):
        validate_count(self.fixture(), 'scored')

    def test_pilot_cannot_be_scored_as_full_counts(self):
        data = self.fixture()
        data.update(runs=2, attempts=3)
        self.assertRaises(ValueError, validate_count, data, 'scored')

    def test_hidden_per_row_and_mismatched_chain_boundaries_fail(self):
        data = self.fixture()
        data['rows'][0]['knownPlanStats'][PROFILES[0]]['contextChoiceLimits'] = 1
        data['rows'][0]['chains'][PROFILES[0]]['computationCensored'] = 1
        self.assertRaises(ValueError, validate_count, data, 'scored')
        data['knownPlanComputationCaps'] = 1
        data['validUncensoredSimulation'] = False
        self.assertRaises(ValueError, validate_count, data, 'scored')
        validate_count(data, 'censored')
        data['rows'][0]['chains'][PROFILES[0]]['computationCensored'] = 0
        self.assertRaises(ValueError, validate_count, data, 'censored')

    def test_lost_cohort_and_inconsistent_quality_flag_fail(self):
        data = self.fixture()
        data['comparisonEpisodes'].pop()
        self.assertRaises(ValueError, validate_count, data, 'scored')
        data = self.fixture()
        data['validUncensoredSimulation'] = False
        self.assertRaises(ValueError, validate_count, data, 'scored')


if __name__ == '__main__':
    unittest.main()
