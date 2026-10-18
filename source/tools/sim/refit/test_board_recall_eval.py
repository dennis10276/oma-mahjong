import unittest

from board_recall_eval import recalled_prediction


class BoardRecallTests(unittest.TestCase):
    def test_exact_board_retrieval_transfers_across_level_numbers_not_people_or_futures(self):
        previous = {'name': 'Gerda', 'lv': 92, 'board': 'exact', 'start': 10, 'end': 20,
                    'firstAttempt': 1, 'wonOn': 5, 'loggedWonOn': 10, 'assisted': False}
        target = {**previous, 'lv': 91, 'start': 100, 'end': 200, 'wonOn': 1}
        predicted, matched = recalled_prediction([previous, target, {**previous, 'name': 'PUK', 'wonOn': 1},
                                                  {**previous, 'end': 100, 'wonOn': 1},
                                                  {**previous, 'end': 21, 'board': 'different', 'wonOn': 1},
                                                  {**previous, 'end': 22, 'assisted': True, 'wonOn': 1},
                                                  {**previous, 'end': 23, 'firstAttempt': 2, 'wonOn': 1}], target, 1)
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0]['wonOn'], 5)
        self.assertEqual(predicted, 4)
        target['wonOn'] = 20
        self.assertEqual(recalled_prediction([previous], target, 1)[0], predicted)

    def test_unknown_board_keeps_the_predeclared_fallback(self):
        target = {'name': 'Gerda', 'start': 100, 'board': 'new'}
        self.assertEqual(recalled_prediction([], target, 2), (2, []))


if __name__ == '__main__':
    unittest.main()
