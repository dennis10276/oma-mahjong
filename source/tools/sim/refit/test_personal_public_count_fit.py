import copy
import json
import unittest

import numpy as np

from attempt_count_fit import NAMES, is_correct
from personal_public_count_fit import FEATURES, METHODS, fit_development, metric_label, own_before, predict, regime_features, select_method


def row(name, index):
    features = dict(zip(FEATURES, (64 + index * 2, index % 3, .5, index % 4, 2, .25, index % 2, 8, 4)))
    return {'name': name, 'lv': index + 1, 'start': index * 10, 'end': index * 10 + 1,
            'wonOn': 1 + index % 3, 'firstAttempt': 1, 'firstClear': True,
            'boardChangedWithinCampaign': False, 'assisted': False, 'features': features}


def fixture():
    rows = [row(name, index) for name in NAMES for index in range(12)]
    target = row(NAMES[0], 20)
    target.pop('wonOn')
    target.pop('end')
    return rows, target


class PublicPersonalCountTests(unittest.TestCase):
    def test_tenplus_classes_preserve_the_full_user_metric_not_false_eight_tail_overlap(self):
        for actual in range(1, 101):
            for predicted in range(1, 9):
                self.assertEqual(is_correct(predicted, actual), is_correct(predicted, metric_label(actual)))
        self.assertTrue(is_correct(6, 8))
        self.assertFalse(is_correct(6, metric_label(12)))
        for invalid in (True, 0, -1, 1.5, None):
            with self.assertRaises(ValueError):
                metric_label(invalid)

    def test_other_people_and_target_outcomes_cannot_change_own_prediction(self):
        rows, target = fixture()
        expected = predict(rows, target)
        for historical in rows:
            if historical['name'] != target['name']:
                historical['wonOn'] = 99
                historical['features']['n'] = 10000
        changed_target = {**target, 'wonOn': 999, 'end': 5000}
        self.assertEqual(predict(rows, changed_target), expected)
        predictions, distributions, availability = expected
        self.assertEqual(set(predictions), set(METHODS))
        for distribution in distributions.values():
            self.assertAlmostEqual(sum(distribution.values()), 1)
            self.assertTrue(all(value > 0 for value in distribution.values()))
        self.assertLess(availability['availableThrough'], target['start'])

    def test_same_clock_normalization_uses_only_strictly_earlier_own_regime(self):
        rows = [row(NAMES[0], index) for index in range(6)]
        for index, historical in enumerate(rows):
            historical['features']['hasClock'] = int(index >= 3)
            historical['features']['n'] = (2, 4, 6, 200, 400, 600)[index]
        target = row(NAMES[0], 10)
        target['features']['hasClock'] = 0
        target['features']['n'] = 8
        vector, availability = regime_features(rows, target)
        self.assertAlmostEqual(vector[len(FEATURES)], (8 - 4) / np.std([2, 4, 6]))
        self.assertEqual(availability['normalizationHistory'], 3)
        self.assertEqual(availability['normalizationRegime'], 'same-clock')
        future = copy.deepcopy(rows[0])
        future.update(start=101, end=102, wonOn=100)
        future['features']['n'] = 100000
        self.assertTrue(np.array_equal(regime_features(rows + [future], target)[0], vector))
        rows[0]['end'] = target['start']
        self.assertEqual(len(own_before(rows, target)), 5)
        self.assertEqual(regime_features(rows, target)[1]['normalizationRegime'], 'recent-own')

    def test_missing_firstclear_or_board_binding_is_not_defaulted_to_clean_history(self):
        rows, target = fixture()
        own = [historical for historical in rows if historical['name'] == target['name']]
        del own[0]['firstClear']
        del own[1]['boardChangedWithinCampaign']
        own[2]['assisted'] = True
        self.assertEqual(len(own_before(rows, target)), 9)
        own[3]['lv'] = own[4]['lv']
        with self.assertRaises(ValueError):
            predict(rows, target)

    def test_selection_uses_own_prior_count_likelihood_and_survives_json_roundtrip(self):
        rows, target = fixture()
        distributions = {method: {label: .1 for label in range(1, 11)} for method in METHODS}
        scored = [{**historical, 'distributions': copy.deepcopy(distributions)} for historical in rows]
        expected = select_method(scored, target)
        self.assertEqual(select_method(json.loads(json.dumps(scored)), target), expected)
        for historical in scored:
            if historical['name'] != target['name']:
                historical['wonOn'] = 99
        future = {**scored[0], 'end': target['start'], 'wonOn': 99}
        self.assertEqual(select_method(scored + [future], target), expected)

    def test_coldstart_and_assisted_targets_remain_scored_but_do_not_train_normal_habits(self):
        rows = [row(NAMES[0], index) for index in range(4)]
        rows[1]['assisted'] = True
        rows[2]['boardChangedWithinCampaign'] = True
        data = {'evidence': 'exact-public-opening-own-count-training-data', 'rows': rows}
        scored = fit_development(data)
        self.assertEqual(len(scored), 4)
        self.assertEqual([historical['ownHistory'] for historical in scored], [0, 1, 1, 1])
        self.assertEqual(scored[-1]['selectionEpisodes'], 1)


if __name__ == '__main__':
    unittest.main()
