import unittest

from personal_recent_selection import select_method


class RecentSelectionTests(unittest.TestCase):
    def row(self, start, end, won=2, clock=True, **changes):
        return {'name': 'Dennis', 'start': start, 'end': end, 'wonOn': won, 'firstClear': True,
                'physical': [0] * 6 + [int(clock), 0, 0, 2],
                'predictions': {'alwaysFirst': 1, 'personal': 2}, **changes}

    def test_selection_ignores_other_people_replays_equal_time_and_future_results(self):
        past, target = self.row(1, 2), self.row(100, 200)
        rows = [past, self.row(3, 4, name='Gerda', won=1), self.row(5, 6, firstClear=False, won=1),
                self.row(7, 100, won=1), target, self.row(201, 202, won=1)]
        metadata = {(row['name'], row['start']): row for row in rows}
        selected, available = select_method(rows, target, metadata)
        self.assertEqual(selected, 'personal')
        self.assertEqual(available['pastEpisodes'], 1)
        self.assertEqual(available['availableThrough'], 2)
        target['wonOn'] = 50
        self.assertEqual(select_method(rows, target, metadata), (selected, available))

    def test_mechanics_match_stops_old_easy_nonclock_games_dominating_a_clock_target(self):
        rows = [self.row(index, index + 0.1, won=1, clock=False) for index in range(30)]
        rows += [self.row(index, index + 0.1) for index in range(30, 36)]
        target = self.row(100, 200)
        metadata = {(row['name'], row['start']): row for row in rows}
        selected, available = select_method(rows, target, metadata, True)
        self.assertEqual(selected, 'personal')
        self.assertTrue(available['matchedMechanics'])
        self.assertEqual(available['pastEpisodes'], 6)

    def test_empty_history_declares_baseline_without_using_future_predictions(self):
        target = self.row(100, 200)
        self.assertEqual(select_method([], target, {})[0], 'alwaysFirst')


if __name__ == '__main__':
    unittest.main()
