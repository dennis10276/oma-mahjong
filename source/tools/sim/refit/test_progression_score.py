import unittest

from progression_score import classify_episodes, same_model_ledger, score_progression


NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']


def episode(name, level, start, won=1):
    return {'name': name, 'lv': level, 'board': str(level), 'start': start, 'end': start + 1,
            'wonOn': won, 'firstAttempt': 1, 'openingRecorded': True}


class ProgressionTests(unittest.TestCase):
    def test_same_model_scope_clarification_cannot_reset_earlier_new_level_misses(self):
        prediction = {'name': 'Dennisisdebeste', 'lv': 106, 'board': '106', 'predictedAttempt': 1}
        earlier = [{'model': 'v1', 'frozenAt': 10, 'forecasts': [prediction]}]
        later = [{'model': 'v1', 'frozenAt': 100, 'forecasts': []}]
        report = score_progression(same_model_ledger(later, earlier), [episode('Dennisisdebeste', 106, 50, 2)], dict.fromkeys(NAMES, 106))
        self.assertEqual(report['cohortStartsAfter'], 10)
        self.assertEqual(report['cohort']['Dennisisdebeste']['completed'], 1)
        self.assertEqual(report['cohort']['Dennisisdebeste']['correct'], 0)
        self.assertFalse(report['targetMet'])
        with self.assertRaises(ValueError):
            same_model_ledger(later + [{'model': 'v2', 'frozenAt': 101}], earlier)

    def test_recent_replays_do_not_replace_progression(self):
        episodes = [episode('Dennisisdebeste', 53, 1), episode('Dennisisdebeste', 105, 2),
                    episode('Dennisisdebeste', 53, 101), episode('Dennisisdebeste', 54, 102),
                    episode('Dennisisdebeste', 106, 103)]
        primary, excluded = classify_episodes(episodes, {'Dennisisdebeste': 106})
        self.assertEqual([row['lv'] for row in primary], [106])
        self.assertEqual(len(excluded), 4)

    def test_twenty_easy_replays_cannot_pass_the_eighty_percent_gate(self):
        floors = dict.fromkeys(NAMES, 106)
        episodes = [episode(name, 106, 1) for name in NAMES]
        episodes += [episode(name, 106, 101 + index * 2) for name in NAMES for index in range(20)]
        forecasts = [{'name': name, 'lv': 106, 'board': '106', 'predictedAttempt': 1} for name in NAMES]
        report = score_progression([{'frozenAt': 100, 'forecasts': forecasts}], episodes, floors)
        self.assertFalse(report['targetMet'])
        self.assertTrue(all(value['opened'] == 0 for value in report['cohort'].values()))

    def test_new_progression_counts_hard_pending_and_unforecasted_games(self):
        floors = dict.fromkeys(NAMES, 106)
        episodes = [episode(name, 106 + index, 101 + index * 2, None if index == 19 else 1)
                    for name in NAMES for index in range(20)]
        forecasts = [{'name': name, 'lv': 106 + index, 'board': str(106 + index), 'predictedAttempt': 1}
                     for name in NAMES for index in range(19)]
        report = score_progression([{'frozenAt': 100, 'forecasts': forecasts}], episodes, floors)
        self.assertFalse(report['targetMet'])
        for value in report['cohort'].values():
            self.assertEqual(value['opened'], 20)
            self.assertEqual(value['completed'], 19)
            self.assertEqual(value['missingForecastsOrOpening'], 1)

    def test_primary_gate_requires_eighty_percent_for_every_person(self):
        floors = dict.fromkeys(NAMES, 106)
        episodes = [episode(name, 106 + index, 101 + index * 2) for name in NAMES for index in range(20)]
        forecasts = [{'name': name, 'lv': 106 + index, 'board': str(106 + index),
                      'predictedAttempt': 1 if index < 16 else 2}
                     for name in NAMES for index in range(20)]
        ledger = [{'frozenAt': 100, 'forecasts': forecasts}]
        self.assertTrue(score_progression(ledger, episodes, floors)['targetMet'])
        forecasts[15]['predictedAttempt'] = 2
        self.assertFalse(score_progression(ledger, episodes, floors)['targetMet'])


if __name__ == '__main__':
    unittest.main()
