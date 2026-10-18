import unittest

from attempt_count_fit import NAMES
from personal_value_fit import count_before, select_before_test, validate_controls


class PersonalValueFitTests(unittest.TestCase):
    def row(self, **changes):
        return {'name': NAMES[0], 'start': 10, 'end': 20, 'firstAttempt': 1, 'firstClear': True,
                'wonOn': 1, 'predictions': {'alwaysFirst': 1, 'valueForest': 2}, **changes}

    def test_own_count_head_cannot_train_on_family_future_or_replays(self):
        earlier = self.row()
        target = self.row(start=100, end=200)
        pollution = [self.row(name=NAMES[1]), self.row(end=100), self.row(firstClear=False),
                     self.row(firstAttempt=2), self.row(wonOn=None), target]
        self.assertEqual(count_before([earlier, *pollution], target), [earlier])

    def test_personal_selection_cannot_use_held_results(self):
        development = [self.row(name=name) for name in NAMES]
        held = [self.row(name=name, start=100, end=200, wonOn=2) for name in NAMES]
        selected = select_before_test(development + held, held, ['alwaysFirst', 'valueForest'])
        for name in NAMES:
            self.assertEqual(selected[name]['selectedBeforeTest'], 'alwaysFirst')
            self.assertEqual(selected[name]['developmentEpisodes'], 1)
            self.assertEqual(selected[name]['selectedScore']['correct'], 0)
        for row in held:
            row['wonOn'] = 1
        again = select_before_test(development + held, held, ['alwaysFirst', 'valueForest'])
        self.assertEqual([again[name]['selectedBeforeTest'] for name in NAMES],
                         [selected[name]['selectedBeforeTest'] for name in NAMES])

    def test_instrumentation_may_only_add_immediate_features(self):
        game = {'aid': 'old', 'decisions': [{'F': [[1, 2]], 'k': 0}]}
        old = {'players': {NAMES[0]: [game]}, 'memoryPlayers': {'configured': {NAMES[0]: [game]}}}
        new_game = {**game, 'decisions': [{**game['decisions'][0], 'immediate': [[3, 4]]}]}
        new = {'players': {NAMES[0]: [new_game]}, 'memoryPlayers': {'configured': {NAMES[0]: [new_game]}}}
        self.assertEqual(validate_controls(new, old), 2)
        new_game['decisions'][0]['k'] = 1
        self.assertRaises(ValueError, validate_controls, new, old)


if __name__ == '__main__':
    unittest.main()
