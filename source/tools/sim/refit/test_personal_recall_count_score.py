import copy
import unittest

from personal_handoff_count_score import evaluate as handoff_evaluate
from personal_recall_count_score import evaluate
from test_personal_handoff_count_score import fixture as parent_fixture


def fixture():
    data = parent_fixture()
    data['originalConfiguredPilotControls'] = 29
    data['firstAttemptRateControls'] = 29
    data['profiles'] = {'configuredControl': {'runs': 2, 'attempts': 3}, 'noInheritedPictures': {'runs': 32, 'attempts': 32}}
    for row in data['rows']:
        row['chains'] = {'noInheritedPictures': row['chains']['handoffZero'], 'configuredControl': {'first': 0, 'within': [0, 0, 0]}}
    data['sourceHashes'] = {name: 'same' for name in ('www/hard.js', 'tools/sim/refit/personal_joint_intents_choice.js',
        'tools/sim/refit/personal_clock_intents_choice.js', 'tools/sim/refit/personal_tray_intents_choice.js',
        'tools/sim/refit/personal_context_choice.js', 'tools/sim/refit/personal_physical_actor.js')}
    return data


class ConsistentRecallCountScoringTests(unittest.TestCase):
    def test_pilot_is_not_scored_or_substituted_as_configured_full(self):
        result = evaluate(fixture())
        self.assertFalse(result['targetMet'])
        self.assertFalse(result['configuredFullComparisonIncluded'])
        self.assertEqual(result['players']['Dennisisdebeste']['consistentZeroEmpirical']['correct'], 29)
        self.assertNotIn('configuredEmpirical', result['scored'][0]['predictions'])
        self.assertEqual(result['players']['PUK']['consistentZeroEmpirical']['n'], 0)

    def test_only_matching_complete_configured_comparison_is_allowed(self):
        data, previous = fixture(), parent_fixture()
        previous['sourceHashes'] = copy.deepcopy(data['sourceHashes'])
        self.assertEqual(handoff_evaluate(previous)['coverage']['scored'], 29)
        self.assertTrue(evaluate(data, previous)['configuredFullComparisonIncluded'])
        for mutation in ('actor', 'first', 'source', 'cap'):
            changed = copy.deepcopy(previous)
            if mutation == 'actor':
                changed['rows'][0]['modelId'] = 'another-person-or-version'
            elif mutation == 'first':
                changed['rows'][0]['chains']['handoffZero']['first'] = 0
            elif mutation == 'source':
                changed['sourceHashes']['www/hard.js'] = 'other'
            else:
                changed['computationCaps'] = 1
            with self.assertRaises(ValueError):
                evaluate(data, changed)

    def test_partial_or_censored_candidate_is_refused(self):
        for key, value in (('runs', 2), ('attempts', 3), ('computationCaps', 1), ('firstAttemptRateControls', 28)):
            data = fixture()
            data[key] = value
            with self.assertRaises(ValueError):
                evaluate(data)
        data = fixture()
        data['profiles']['noInheritedPictures']['runs'] = 2
        with self.assertRaises(ValueError):
            evaluate(data)

    def test_target_outcome_does_not_change_fixed_forecast(self):
        data = fixture()
        before = evaluate(data)['scored'][0]['predictions']
        data['rows'][0]['wonOn'] = 9
        self.assertEqual(evaluate(data)['scored'][0]['predictions'], before)


if __name__ == '__main__':
    unittest.main()
