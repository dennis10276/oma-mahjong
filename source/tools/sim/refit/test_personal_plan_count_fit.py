import hashlib
import unittest

from personal_plan_count_fit import validate_plan_count


class PersonalPlanCountTests(unittest.TestCase):
    def data(self, **changes):
        return {'fingerprintFiles': [], 'fingerprint': hashlib.sha256().hexdigest(), 'runs': 32, 'attempts': 32,
                'validUncensoredSimulation': True, 'planComputationCaps': 0, 'controlChainsMatched': 828,
                'comparisonEpisodes': list(range(80)), 'rows': [{'planComputationCaps': {str(index): 0 for index in range(5)},
                    'chains': {str(index): {} for index in range(5)}} for row in range(276)], **changes}

    def test_pilots_missing_controls_and_hidden_individual_boundaries_cannot_pass(self):
        validate_plan_count(self.data())
        for changed in [{'runs': 2}, {'attempts': 3}, {'controlChainsMatched': 827}, {'planComputationCaps': 1},
                        {'validUncensoredSimulation': False}, {'comparisonEpisodes': list(range(79))}]:
            self.assertRaises(ValueError, validate_plan_count, self.data(**changed))
        hidden = self.data()
        hidden['rows'][0]['planComputationCaps']['0'] = 1
        hidden['rows'][0]['chains']['0']['computationCensored'] = 1
        self.assertRaises(ValueError, validate_plan_count, hidden)

    def test_boundary_telemetry_and_rate_chain_censoring_must_agree(self):
        invalid = self.data()
        invalid['rows'][0]['chains']['0']['computationCensored'] = 1
        self.assertRaises(ValueError, validate_plan_count, invalid)
        invalid = self.data()
        invalid['rows'][0]['planComputationCaps'] = {}
        self.assertRaises(ValueError, validate_plan_count, invalid)


if __name__ == '__main__':
    unittest.main()
