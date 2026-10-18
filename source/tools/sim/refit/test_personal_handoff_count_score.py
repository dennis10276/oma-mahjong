import copy
import unittest

from personal_handoff_count_score import empirical_distribution, evaluate


def fixture():
    rows = [{'name': 'Dennisisdebeste', 'lv': 128 + index, 'start': index, 'end': index + .5,
        'firstAttempt': 1, 'firstClear': True, 'wonOn': 1, 'board': str(index), 'modelId': 'earlier-' + str(index),
        'chains': {profile: {'first': 1., 'within': [1.] * 32, 'cond': [1.] + [None] * 31}
                   for profile in ('handoffZero', 'handoff')}} for index in range(29)]
    return {'runs': 32, 'attempts': 32, 'computationCaps': 0, 'validUncensoredSimulation': True,
        'pairedPilotChainsMatched': 58, 'firstAttemptRateControls': 58,
        'profiles': {'handoffZero': False, 'handoff': True}, 'rows': rows}


class HandoffCountScoringTests(unittest.TestCase):
    def test_empirical_tail_and_integer_counts(self):
        probabilities, tail = empirical_distribution({'first': .5, 'within': [.5, .75]}, 32)
        self.assertEqual(probabilities, {1: .5, 2: .25})
        self.assertEqual(tail, .25)
        with self.assertRaises(ValueError):
            empirical_distribution({'first': .5, 'within': [.5, .74]}, 32)
        with self.assertRaises(ValueError):
            empirical_distribution({'first': .4, 'within': [.5]}, 32)

    def test_no_claim_or_person_pooling_and_fixed_prediction(self):
        result = evaluate(fixture())
        self.assertFalse(result['targetMet'])
        self.assertEqual(result['players']['Dennisisdebeste']['handoffEmpirical']['correct'], 29)
        self.assertEqual(result['players']['PUK']['handoffEmpirical']['n'], 0)
        changed = fixture()
        changed['rows'][0]['wonOn'] = 9
        self.assertEqual(evaluate(changed)['scored'][0]['predictions'], result['scored'][0]['predictions'])

    def test_pending_and_ineligible_are_retained(self):
        data = fixture()
        data['rows'][0]['wonOn'] = None
        data['rows'][1]['boardChangedWithinCampaign'] = True
        data['rows'][2]['assisted'] = True
        data['rows'][3]['firstClear'] = False
        result = evaluate(data)
        self.assertEqual(result['coverage'], {'fixedTargets': 29, 'scored': 25, 'pending': 1, 'ineligibleRetained': 3})

    def test_caps_partial_pilots_and_missing_targets_refused(self):
        for key, value in (('computationCaps', 1), ('runs', 2), ('attempts', 3),
                           ('pairedPilotChainsMatched', 57), ('firstAttemptRateControls', 57)):
            data = fixture()
            data[key] = value
            with self.assertRaises(ValueError):
                evaluate(data)
        data = fixture()
        data['rows'][1] = copy.deepcopy(data['rows'][0])
        with self.assertRaises(ValueError):
            evaluate(data)


if __name__ == '__main__':
    unittest.main()
