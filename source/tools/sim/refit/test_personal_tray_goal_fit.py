import unittest

import numpy as np

from personal_tray_goal_fit import FEATURES, fit_tray_goal, goal_metrics


class PersonalTrayGoalFitTests(unittest.TestCase):
    def actors(self):
        return np.zeros((4, 1)), np.zeros(21)

    def game(self, available=1, followed=True):
        return {'availableAt': available, 'decisions': [{'F': [[0] * 21, [0] * 21],
                'k': 0 if followed else 1, 'kindContext': [1]}], 'trayGoalSamples': [
                    {'decision': 0, 'selected': 0 if followed else 1, 'allowed': [True, False],
                     'followed': followed, 'context': [1, 0, 0, 0, 0, 0.125, 0, 0.5]}]}

    def test_empty_history_has_zero_residual_not_a_forced_greedy_prior(self):
        kind, within = self.actors()
        model = fit_tray_goal([], kind, within, 10)
        self.assertEqual(model['weights'], [0.0] * len(FEATURES))
        values = goal_metrics(self.game(), kind, within, model)
        self.assertAlmostEqual(values['baseLoss'], values['fittedLoss'])

    def test_later_actions_cannot_enter_a_personal_commitment_fit(self):
        kind, within = self.actors()
        earlier = self.game()
        reference = fit_tray_goal([earlier], kind, within, 10)
        with_future = fit_tray_goal([earlier, self.game(10, False), self.game(11, False)], kind, within, 10)
        self.assertEqual(reference, with_future)
        self.assertGreater(reference['weights'][0], 0)

    def test_unavailable_source_and_invalid_choice_label_are_rejected(self):
        kind, within = self.actors()
        invalid = self.game()
        invalid['memorySources'] = [{'aid': 'future', 'availableAt': 10}]
        with self.assertRaises(ValueError):
            fit_tray_goal([invalid], kind, within, 10)
        invalid = self.game()
        invalid['trayGoalSamples'][0]['followed'] = False
        with self.assertRaises(ValueError):
            fit_tray_goal([invalid], kind, within, 10)


if __name__ == '__main__':
    unittest.main()
