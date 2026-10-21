import copy
import unittest

from attempt_count_fit import NAMES
from personal_forecast_diagnostics import summarize


def snapshot():
    return {'model': 'test-family', 'frozenAt': 200, 'cohortStartsAfter': 100,
            'progressionStartLevels': {name: 10 for name in NAMES},
            'forecasts': [{'name': name, 'lv': level, 'board': 'a', 'predictedAttempt': 1}
                          for name in NAMES for level in range(10, 30)]}


def episode(name, level, start, actual=1):
    return {'name': name, 'lv': level, 'board': 'a', 'start': start, 'end': start + 1,
            'firstAttempt': 1, 'openingRecorded': True, 'wonOn': actual}


class ForecastDiagnosticsTests(unittest.TestCase):
    def test_uses_frozen_numbers_and_preserves_inputs_and_exclusions(self):
        ledger = [snapshot()]
        rows = [episode(NAMES[0], 10, 300, 3), episode(NAMES[0], 10, 350), episode(NAMES[0], 9, 400)]
        original = copy.deepcopy((ledger, rows))
        result = summarize(ledger, {'episodes': rows})
        self.assertEqual(result['players'][NAMES[0]]['correct'], 0)
        self.assertEqual(result['players'][NAMES[0]]['exclusionsByReason'], {'replayedLevel': 1, 'belowProgressionFrontier': 1})
        self.assertEqual(result['total']['n'], 1)
        self.assertEqual((ledger, rows), original)

    def test_pending_missing_race_opened_and_late_points_stay_in_cohort(self):
        rows = [episode(NAMES[0], 10, 150), episode(NAMES[0], 11, 300, None), episode(NAMES[0], 12, 350)]
        rows[-1]['board'] = 'unforecasted'
        result = summarize([snapshot()], {'episodes': rows})
        cohort = result['players'][NAMES[0]]['cohort']
        self.assertEqual((cohort['opened'], cohort['pending'], cohort['missingForecastsOrOpening']), (3, 1, 2))
        self.assertFalse(result['numericalTarget95Met'])
        self.assertEqual(result['coverage'][0]['status'], 'alreadyOpenedAtFreeze')

    def test_unseen_count_is_dynamic_and_stale_snapshot_is_not_sealed_proof(self):
        result = summarize([snapshot()], {'episodes': [episode(NAMES[0], 10, 300)],
                                           'observedAt': '1970-01-01T00:00:00.100Z'})
        self.assertEqual(sum(row['status'] == 'notObservedOpened' for row in result['coverage']), 79)
        self.assertTrue(result['warnings'])

    def test_all_twenty_per_person_required_and_confidence_is_reported(self):
        rows = [episode(name, 10 + index, 300 + index * 10, 2 if index == 0 else 1)
                for name in NAMES for index in range(20)]
        result = summarize([snapshot()], {'episodes': rows})
        self.assertTrue(result['numericalTarget95Met'])
        self.assertFalse(result['targetMet'])
        self.assertIsNotNone(result['players'][NAMES[0]]['wilson95'])
        self.assertFalse(summarize([snapshot()], {'episodes': rows[:-1]})['numericalTarget95Met'])

    def test_rejects_moved_cohorts_mixed_families_and_nonfinite_freezes(self):
        for field, value in [('model', 'other-family'), ('cohortStartsAfter', 101), ('frozenAt', float('inf'))]:
            changed = copy.deepcopy(snapshot())
            changed[field] = value
            with self.assertRaises(ValueError):
                summarize([snapshot(), changed], {'episodes': []})

    def test_rejects_invalid_or_boolean_point_values(self):
        for value in [True, 0, 9, 1.5]:
            changed = snapshot()
            changed['forecasts'][0]['predictedAttempt'] = value
            with self.assertRaises(ValueError):
                summarize([changed], {'episodes': []})


if __name__ == '__main__':
    unittest.main()
