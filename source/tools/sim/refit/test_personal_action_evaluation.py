import unittest
import math

from personal_action_evaluation import evaluate
from personal_tray_goal_fit import FEATURES


class PersonalActionEvaluationTests(unittest.TestCase):
    def inputs(self):
        data = {'players': {'Dennis': [{'aid': 'target', 'lv': 106, 't': 10,
                                       'initialNewLevel': True, 'decisions': []}]}}
        model = {'id': 'actor', 'availableThrough': 9, 'trainedAids': ['past'],
                 'kindModel': {'weights': {kind: [0] for kind in ['flip', 'pair', 'single', 'fatal']}},
                 'withinWeights': [0]}
        bank = {'models': [model], 'selections': [{'name': 'Dennis', 'start': 10,
                                                 'models': {scope: 'actor' for scope in ['all', 'novel', 'ownAll', 'ownNovel']}}]}
        requests = {'requests': [{'name': 'Dennis', 'start': 10, 'excludedAids': ['target', 'resumed']}]}
        return data, bank, requests

    def test_missing_preopening_model_is_explicit_not_replaced_by_a_future_actor(self):
        data, bank, _ = self.inputs()
        result = evaluate(data, bank, {'requests': []})
        self.assertEqual(result['Dennis']['rows'][0]['status'], 'no-campaign-model')
        self.assertEqual(result['Dennis']['models']['ownAll']['prefixes'], 0)

    def test_target_campaign_prefix_and_equal_time_availability_are_rejected(self):
        data, bank, requests = self.inputs()
        bank['models'][0]['trainedAids'] = ['resumed']
        with self.assertRaises(ValueError):
            evaluate(data, bank, requests)
        bank['models'][0]['trainedAids'] = []
        bank['models'][0]['availableThrough'] = 10
        with self.assertRaises(ValueError):
            evaluate(data, bank, requests)

    def test_replay_prefixes_do_not_enter_new_level_action_evaluation(self):
        data, bank, requests = self.inputs()
        data['players']['Dennis'][0]['initialNewLevel'] = False
        result = evaluate(data, bank, requests)
        self.assertEqual(result['Dennis']['candidatePrefixes'], 0)

    def test_pair_cue_likelihood_is_separate_from_per_tap_action_accuracy(self):
        data, bank, requests = self.inputs()
        data['players']['Dennis'][0]['pairFollowThroughSamples'] = [{'tray': 0, 'followed': True}]
        bank['models'][0]['pairFollowThrough'] = {'probabilities': [0.8, 0.5, 0.5, 0.5]}
        result = evaluate(data, bank, requests)['Dennis']['models']['ownAll']
        self.assertEqual(result['decisions'], 0)
        self.assertEqual(result['pairFollowThroughOpportunities'], 1)
        self.assertAlmostEqual(result['pairFollowThroughLogLoss'], -math.log(0.8))

    def test_memory_actor_is_evaluated_on_its_matching_observation_variant(self):
        data, bank, requests = self.inputs()
        model = bank['models'][0]
        model['withinWeights'] = [0] * 21
        model['retryMemoryMode'] = 'configured'
        game = {**data['players']['Dennis'][0], 'availableAt': 11,
                'decisions': [{'F': [[0] * 21], 'k': 0, 'kindContext': [1]}],
                'memorySources': [{'aid': 'prior', 'availableAt': 9}]}
        data['memoryPlayers'] = {'configured': {'Dennis': [game]}}
        result = evaluate(data, bank, requests)['Dennis']['models']['ownAll']
        self.assertEqual(result['decisions'], 1)
        game['memorySources'][0]['availableAt'] = 10
        with self.assertRaises(ValueError):
            evaluate(data, bank, requests)

    def test_goal_likelihood_adjustment_is_not_reported_as_winning_try_accuracy(self):
        data, bank, requests = self.inputs()
        game = data['players']['Dennis'][0]
        game['decisions'] = [{'F': [[0] * 21, [0] * 21], 'k': 0, 'kindContext': [1]}]
        game['trayGoalSamples'] = [{'decision': 0, 'selected': 0, 'allowed': [True, False],
                                   'followed': True, 'context': [1, 0, 0, 0, 0, 0, 0, 0]}]
        bank['models'][0]['withinWeights'] = [0] * 21
        bank['models'][0]['trayGoal'] = {'features': FEATURES, 'weights': [0.5] + [0] * 7}
        result = evaluate(data, bank, requests)['Dennis']['models']['ownAll']
        self.assertEqual(result['trayGoalOpportunities'], 1)
        self.assertLess(result['trayGoalAdjustedJointLogLoss'], result['jointLogLoss'])
        self.assertAlmostEqual(result['trayGoalAdjustedJointLogLoss'], result['trayGoalLogLoss'])
        self.assertNotIn('winningTryAccuracy', result)


if __name__ == '__main__':
    unittest.main()
