import unittest

from personal_clock_route import FEATURES, PARAMETERS
from personal_clock_route_snapshot import validate_clock_data


class PersonalClockRouteSnapshotTests(unittest.TestCase):
    def test_full_requires_all_unchanged_choices(self):
        data = {'targetMet': False, 'evidence': 'public-clock-route-feature-parity', 'pilot': False,
                'prefixes': 398, 'features': FEATURES, 'parameters': PARAMETERS, 'totals': {'calls': 33543}}
        validate_clock_data(data)
        self.assertRaises(ValueError, validate_clock_data, {**data, 'totals': {'calls': 33542}})
        self.assertRaises(ValueError, validate_clock_data, {**data, 'targetMet': True})
        self.assertRaises(ValueError, validate_clock_data, {**data, 'parameters': {'taps': 10, 'nodes': 256}})

    def test_pilot_cannot_be_used_as_full_action_evidence(self):
        data = {'targetMet': False, 'evidence': 'public-clock-route-feature-parity', 'pilot': True,
                'prefixes': 8, 'features': FEATURES, 'parameters': PARAMETERS, 'totals': {'calls': 712}}
        validate_clock_data(data, True)
        self.assertRaises(ValueError, validate_clock_data, data)


if __name__ == '__main__':
    unittest.main()
