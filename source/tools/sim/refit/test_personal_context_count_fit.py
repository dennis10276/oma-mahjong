import hashlib
import unittest

from personal_context_count_fit import validate_count


class PersonalContextCountTests(unittest.TestCase):
    def data(self, **changes):
        return {'fingerprintFiles': [], 'fingerprint': hashlib.sha256().hexdigest(),
                'validUncensoredSimulation': True, 'contextComputationCaps': 0,
                'rows': [{}] * 276, 'controlChainsMatched': 552, 'comparisonEpisodes': list(range(80)), **changes}

    def test_censored_computation_and_pilots_cannot_be_scored_as_human_losses(self):
        validate_count(self.data())
        self.assertRaises(ValueError, validate_count, self.data(contextComputationCaps=1))
        self.assertRaises(ValueError, validate_count, self.data(validUncensoredSimulation=False))

    def test_all_original_controls_and_held_campaigns_are_required(self):
        self.assertRaises(ValueError, validate_count, self.data(controlChainsMatched=551))
        self.assertRaises(ValueError, validate_count, self.data(comparisonEpisodes=list(range(79))))
        self.assertRaises(ValueError, validate_count, self.data(fingerprint='changed'))


if __name__ == '__main__':
    unittest.main()
