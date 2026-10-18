import copy
import unittest

from personal_fresh_count_fit import PROFILES, eligible, evaluate, features_of, past_of, predict, select_method, target_eligible


def campaign(start=10, end=15, won_on=2, name='Dennisisdebeste', **extra):
    return {'name': name, 'start': start, 'end': end, 'wonOn': won_on, 'firstAttempt': 1, 'firstClear': True,
            'assisted': False, 'lv': 150, 'board': 'board', 'physical': [72, .5, 3, 20, 2, .1, 1, 0, 0, 0, 36],
            'reference': {'strong': .8, 'average': .5},
            'chains': {profile: {'within': [.25, .5, .75] + [.75] * 29} for profile in PROFILES}, **extra}


class FreshCountTests(unittest.TestCase):
    def test_changed_board_target_is_retained_but_cannot_train(self):
        target = campaign(boardChangedWithinCampaign=True)
        self.assertFalse(eligible(target))
        self.assertTrue(target_eligible(target))

    def test_past_is_own_strictly_earlier_first_clear(self):
        target = campaign(start=100)
        earlier = campaign()
        rows = [earlier, campaign(name='Gerda'), campaign(end=100), campaign(firstClear=False),
                campaign(assisted=True), campaign(boardChangedWithinCampaign=True), campaign(won_on=None)]
        self.assertEqual(past_of(rows, target), [earlier])

    def test_features_do_not_read_target_outcomes(self):
        target = campaign(start=100)
        changed = {**target, 'wonOn': 900, 'end': -100, 'assisted': True}
        self.assertEqual(features_of([campaign()], target, 32), features_of([campaign()], changed, 32))

    def test_prediction_ignores_other_person_and_future_completion(self):
        target = campaign(start=100)
        before = [campaign()]
        polluted = before + [campaign(name='Gerda', won_on=32), campaign(end=100, won_on=32)]
        first = predict(before, target, 32, {}, {})
        second = predict(polluted, target, 32, {}, {})
        self.assertEqual(first, second)

    def test_selector_does_not_use_target_or_other_person_result(self):
        target = campaign(start=100)
        predictions = {method: 1 for method in select_method([], target)[1]['selectionScores']}
        predictions['ownBotForest'] = 3
        earlier = {**campaign(won_on=3), 'predictions': predictions}
        invalid = [{**earlier, 'end': 100}, {**earlier, 'name': 'Gerda'}]
        self.assertEqual(select_method(invalid, target)[0], 'alwaysFirst')
        self.assertEqual(select_method([earlier, *invalid], target)[0], 'ownBotForest')

    def test_evaluator_rejects_pilot_caps_and_target_labels(self):
        data = {'runs': 32, 'attempts': 32, 'computationCaps': 0, 'validUncensoredSimulation': True,
                'profiles': dict.fromkeys(PROFILES), 'rows': [], 'future': [campaign(kind='future')],
                'comparisonEpisodes': [], 'additionalRecentIds': []}
        with self.assertRaisesRegex(ValueError, 'target outcomes'):
            evaluate(data)
        for field, value in [('runs', 2), ('attempts', 3), ('computationCaps', 1)]:
            invalid = copy.deepcopy(data)
            invalid[field] = value
            with self.assertRaisesRegex(ValueError, 'uncensored'):
                evaluate(invalid)


if __name__ == '__main__':
    unittest.main()
