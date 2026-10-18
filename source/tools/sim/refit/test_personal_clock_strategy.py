import itertools
import unittest

import numpy as np

from personal_clock_strategy import (CONTEXT, FEATURES, context_of, fit_strategy, forward_backward,
                                     observation_of, predictive, score_strategy, strategy_features,
                                     switch_objective, transition_probabilities)


class PersonalClockStrategyTests(unittest.TestCase):
    def setUp(self):
        self.actor = {'name': 'one', 'trainingCut': 10, 'trainedAids': ['earlier'], 'trainingGames': {'one': 1},
                      'withinWeights': [0.0] * 76, 'kindModel': {'weights': {kind: [0.0] * 26
                          for kind in ['flip', 'pair', 'single', 'fatal']}}}
        self.decision = {'F': [[0.0] * 76 for _ in range(2)], 'kindContext': [0.0] * 26, 'tray': 0,
                         'knownPlan': [[0.0] * len(FEATURES) for _ in range(2)], 'k': 0}
        self.decision['knownPlan'][0][7] = 0.25
        self.decision['knownPlan'][1][6] = 1

    def test_forward_backward_matches_exhaustive_latent_paths(self):
        emission = np.asarray([[0.7, 0.2], [0.3, 0.8], [0.6, 0.4]])
        transitions = np.asarray([[[0.8, 0.2], [0.1, 0.9]]] * 3)
        prior = np.asarray([0.6, 0.4])
        likelihood, gamma, xi = forward_backward(np.log(emission), transitions, prior)
        weights = {}
        for states in itertools.product([0, 1], repeat=3):
            value = prior[states[0]] * emission[0, states[0]]
            for index in range(1, 3):
                value *= transitions[index, states[index - 1], states[index]] * emission[index, states[index]]
            weights[states] = value
        total = sum(weights.values())
        self.assertAlmostEqual(np.exp(likelihood), total, places=12)
        for index in range(3):
            for mode in range(2):
                expected = sum(value for states, value in weights.items() if states[index] == mode) / total
                self.assertAlmostEqual(gamma[index, mode], expected, places=12)
        np.testing.assert_allclose(xi[1:].sum(axis=(1, 2)), 1)
        np.testing.assert_allclose(xi[1:].sum(axis=2), gamma[:-1])

    def test_switch_context_has_no_current_or_future_selected_action(self):
        context = context_of(self.decision)
        np.testing.assert_array_equal(context, context_of({**self.decision, 'k': 1}))
        previous = observation_of(self.decision, 0)
        paired = observation_of(self.decision, 1)
        self.assertNotEqual(context_of(self.decision, previous)[7], context_of(self.decision, paired)[7])
        crowded = {**self.decision, 'kindContext': [0, 0, 0, 1] + [0] * 22}
        self.assertEqual(context_of(crowded, previous)[2], 1)
        runtime = {key: value for key, value in crowded.items() if key != 'tray'}
        np.testing.assert_array_equal(context_of(runtime, previous), context_of(crowded, previous))

    def test_personal_switch_can_change_from_digging_to_pairing_when_crowded(self):
        weights = np.zeros((2, len(FEATURES)))
        weights[0, 7], weights[1, 6] = 4, 4
        switches = np.zeros((2, len(CONTEXT)))
        switches[:, 2] = 4
        model = {'weights': weights.tolist(), 'switchWeights': switches.tolist(), 'priors': [[0.99, 0.01], [0.5, 0.5]]}
        prior = np.asarray(model['priors'][0])
        opening, emission = predictive(self.decision, self.actor, model, prior)
        self.assertGreater(opening[0], opening[1])
        posterior = prior * emission[0]
        posterior /= posterior.sum()
        crowded = {**self.decision, 'kindContext': [0, 0, 0, 1] + [0] * 22}
        next_prior = posterior @ transition_probabilities(context_of(crowded, observation_of(self.decision, 0))[None, :], switches)[0]
        adjusted, _ = predictive(crowded, self.actor, model, next_prior)
        self.assertGreater(adjusted[1], adjusted[0])
        zero, _ = predictive(crowded, self.actor, model, next_prior, scale=0)
        np.testing.assert_allclose(zero, [0.5, 0.5])

    def test_only_frozen_own_membership_enters_adaptive_fit(self):
        game = {'aid': 'earlier', 'availableAt': 9, 'initialNewLevel': True,
                'decisions': [self.decision, {**self.decision, 'kindContext': [0, 0, 0, 1] + [0] * 22, 'k': 1}]}
        target = {'aid': 'target', 'availableAt': 11, 'decisions': [{**self.decision, 'k': 1}], 'wonOn': 30}
        fitted = fit_strategy([game, target], self.actor, iterations=3)
        repeated = fit_strategy([game, {**target, 'wonOn': 1}], self.actor, iterations=3)
        self.assertEqual(fitted, repeated)
        self.assertEqual(fitted['trainedAids'], ['earlier'])
        self.assertEqual(fitted['trainingClockChoices'], 2)
        self.assertTrue(all(row[-1] == 0 for row in fitted['weights']))
        self.assertRaises(ValueError, fit_strategy, [{**game, 'availableAt': 10}], self.actor)
        self.assertEqual(score_strategy([game], self.actor, fitted)['decisions'], 2)

    def test_switch_gradient_and_public_feature_validation(self):
        contexts = np.asarray([context_of(self.decision), context_of({**self.decision, 'kindContext': [0, 0, 0, 1] + [0] * 22})])
        weights = np.linspace(-0.1, 0.1, len(CONTEXT))
        arguments = (contexts, np.asarray([0.2, 0.7]), np.asarray([0.8, 0.9]), np.asarray([1, 0.5]), 20)
        _, gradient = switch_objective(weights, *arguments)
        for index in range(len(CONTEXT)):
            plus, minus = weights.copy(), weights.copy()
            plus[index] += 1e-6
            minus[index] -= 1e-6
            numerical = (switch_objective(plus, *arguments)[0] - switch_objective(minus, *arguments)[0]) / 2e-6
            self.assertAlmostEqual(gradient[index], numerical, places=7)
        self.assertRaises(ValueError, strategy_features, {**self.decision, 'knownPlan': [[float('nan')] * len(FEATURES)] * 2})
        self.assertRaises(ValueError, strategy_features, {**self.decision, 'knownPlan': [[0] * 5] * 2})


if __name__ == '__main__':
    unittest.main()
