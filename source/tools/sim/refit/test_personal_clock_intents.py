import itertools
import json
import subprocess
import unittest
from pathlib import Path

import numpy as np

from personal_clock_intents import (MODES, components_of, fit_intents, forward_backward, masks_of, predictive,
                                    score_intents, switch_objective, transitions_of)
from personal_clock_strategy import CONTEXT, FEATURES, PARAMETERS, context_of, observation_of


class ClockIntentTests(unittest.TestCase):
    def setUp(self):
        self.actor = {'name': 'one', 'trainingCut': 10, 'trainingGames': {'one': 1}, 'trainedAids': ['own'],
            'withinWeights': [0.] * 76, 'kindModel': {'weights': {kind: [0.] * 26 for kind in ('flip', 'pair', 'single', 'fatal')}}}
        self.decision = {'F': [[0.] * 76 for index in range(3)], 'kindContext': [0.] * 26,
                         'immediate': [[0.] * 29 for index in range(3)],
                         'knownPlan': [[0.] * len(FEATURES) for index in range(3)], 'k': 0}
        self.decision['knownPlan'][0][8] = 1
        self.decision['knownPlan'][1][6] = 1
        self.decision['F'][1][64] = 1

    def test_optional_masks_preserve_ordinary_and_unknown_fallback(self):
        masks = masks_of(self.decision)
        np.testing.assert_array_equal(masks, [[True, True, True], [True, False, False], [False, True, False]])
        components = components_of([.2, .3, .5], masks)
        np.testing.assert_allclose(components[:, 0], [.2, .3, .5])
        np.testing.assert_allclose(components[:, 1], [1, 0, 0])
        np.testing.assert_allclose(components[:, 2], [0, 1, 0])
        np.testing.assert_allclose(components_of([.2, .3, .5], np.zeros((3, 3))), np.tile([.2, .3, .5], (3, 1)).T)
        unsafe = json.loads(json.dumps(self.decision))
        unsafe['knownPlan'][0][4] = 1
        self.assertFalse(np.any(masks_of(unsafe)[1]))
        unknown = json.loads(json.dumps(self.decision))
        unknown['knownPlan'][0][-1] = 1
        self.assertTrue(masks_of(unknown)[1, 0])

    def test_supported_exit_can_defer_digging_for_pair_preparation(self):
        decision = json.loads(json.dumps(self.decision))
        decision['knownPlan'][1][1] = 1
        self.assertFalse(np.any(masks_of(decision)[1]))
        self.assertTrue(masks_of(decision)[2, 1])

    def test_individual_intents_can_disagree_without_forcing_a_pair(self):
        model = {'trainingClockChoices': 1}
        dig, components = predictive(self.decision, self.actor, model, np.asarray([0., 1., 0.]))
        pair, components = predictive(self.decision, self.actor, model, np.asarray([0., 0., 1.]))
        ordinary, components = predictive(self.decision, self.actor, model, np.asarray([1., 0., 0.]))
        np.testing.assert_allclose(dig, [1, 0, 0])
        np.testing.assert_allclose(pair, [0, 1, 0])
        self.assertGreater(ordinary[2], 0)
        unsupported, components = predictive(self.decision, self.actor, {'trainingClockChoices': 0}, np.asarray([0., 0., 1.]))
        np.testing.assert_allclose(unsupported, ordinary)

    def test_three_state_forward_backward_matches_exhaustive_paths(self):
        emission = np.asarray([[.7, .2, .3], [.3, .8, .1], [.6, .4, .2]])
        transitions = np.asarray([[[.8, .1, .1], [.2, .7, .1], [.1, .2, .7]]] * 3)
        prior = np.asarray([.5, .3, .2])
        likelihood, gamma, xi = forward_backward(np.log(emission), transitions, prior)
        weights = {}
        for states in itertools.product(range(3), repeat=3):
            probability = prior[states[0]] * emission[0, states[0]]
            for index in range(1, 3):
                probability *= transitions[index, states[index - 1], states[index]] * emission[index, states[index]]
            weights[states] = probability
        total = sum(weights.values())
        self.assertAlmostEqual(np.exp(likelihood), total, places=12)
        for index in range(3):
            for mode in range(3):
                expected = sum(value for states, value in weights.items() if states[index] == mode) / total
                self.assertAlmostEqual(gamma[index, mode], expected, places=12)
        np.testing.assert_allclose(xi[1:].sum(axis=2), gamma[:-1])

    def test_transition_gradient(self):
        random = np.random.default_rng(77)
        contexts = random.normal(size=(4, len(CONTEXT)))
        counts = random.random((4, len(MODES)))
        importance = random.random(4)
        prior = np.zeros((len(MODES), len(CONTEXT)))
        weights = random.normal(scale=.1, size=prior.size)
        arguments = (contexts, counts, importance, prior, 5)
        loss, gradient = switch_objective(weights, *arguments)
        for index in range(len(weights)):
            after, before = weights.copy(), weights.copy()
            after[index] += 1e-6
            before[index] -= 1e-6
            numerical = (switch_objective(after, *arguments)[0] - switch_objective(before, *arguments)[0]) / 2e-6
            self.assertAlmostEqual(gradient[index], numerical, places=7)

    def test_own_fitting_ignores_unavailable_target_outcomes(self):
        game = {'aid': 'own', 'availableAt': 9, 'initialNewLevel': True, 'decisions': [self.decision] * 4}
        future = {'aid': 'future', 'availableAt': 11, 'wonOn': 900, 'decisions': [self.decision]}
        model = fit_intents([game, future], self.actor, iterations=3)
        self.assertEqual(model, fit_intents([game, {**future, 'wonOn': 1}], self.actor, iterations=3))
        self.assertEqual(model['trainedAids'], ['own'])
        self.assertEqual(model['trainingClockChoices'], 4)
        self.assertTrue(all(later <= earlier + 1e-7 for earlier, later in zip(model['trainingObjectives'], model['trainingObjectives'][1:])))
        self.assertEqual(score_intents([game], self.actor, model)['decisions'], 4)
        with self.assertRaisesRegex(ValueError, 'membership'):
            fit_intents([{**game, 'availableAt': 10}], self.actor)

    def test_native_runtime_filter_parity_and_isolated_attempts(self):
        random = np.random.default_rng(88)
        model = {'type': 'personalPersistentClockIntents-v1', 'modes': MODES, 'features': FEATURES, 'context': CONTEXT,
            'parameters': PARAMETERS, 'trainingClockChoices': 30, 'priors': [[.6, .3, .1], [.5, .2, .3]],
            'switchWeights': random.normal(scale=.2, size=(3, 3, len(CONTEXT))).tolist()}
        decisions = []
        for index in range(12):
            decision = json.loads(json.dumps(self.decision))
            decision['kindContext'][2:4] = [int(index % 3 == 1), int(index % 3 == 2)]
            decision['k'] = index % 3
            if index % 4 == 0:
                decision['knownPlan'] = np.zeros((3, len(FEATURES))).tolist()
            decisions.append(decision)
        expected, posterior, previous, started = [], np.asarray(model['priors'][0]), None, False
        for decision in decisions:
            active = bool(np.any(decision['knownPlan']))
            prior = posterior
            if active and started:
                prior = posterior @ transitions_of(context_of(decision, previous)[None, :], model['switchWeights'])[0]
            values, components = predictive(decision, self.actor, model, prior)
            if active:
                posterior = prior * components[decision['k']]
                posterior /= posterior.sum()
                previous = observation_of(decision, decision['k'])
                started = True
            expected.append({'values': values.tolist(), 'posterior': posterior.tolist()})
        script = "const fs=require('fs'),assert=require('assert/strict');const {intentFactory,intentAttemptFactory}=require('./source/tools/sim/refit/personal_clock_intents_choice.js');const input=JSON.parse(fs.readFileSync(0,'utf8'));const selector=intentFactory(input.actor,input.model);const result=input.decisions.map(decision=>{const values=selector.probabilities(decision);assert.deepEqual(values,selector.probabilities({...decision,k:100,tray:999}));selector.observe(decision,decision.k);return {values,posterior:selector.posterior()};});const factory=intentAttemptFactory(input.actor,input.model);const first=factory({attempt:1}),retry=factory({attempt:2}),other=factory({attempt:1});assert.deepEqual(first.posterior(),input.model.priors[0]);assert.deepEqual(retry.posterior(),input.model.priors[1]);first.observe(input.decisions[1],0);assert.deepEqual(other.posterior(),input.model.priors[0]);assert.throws(()=>first(input.decisions[1],NaN));const disabled=intentFactory(input.actor,input.model,true,false),unsupported=intentFactory(input.actor,{...input.model,trainingClockChoices:0});for(const decision of input.decisions)assert.deepEqual(disabled.probabilities(decision),unsupported.probabilities(decision));console.log(JSON.stringify(result));"
        output = subprocess.check_output(['node', '-e', script], input=json.dumps({'actor': self.actor, 'model': model, 'decisions': decisions}),
                                         text=True, cwd=Path(__file__).resolve().parents[4])
        for actual, reference in zip(json.loads(output), expected):
            np.testing.assert_allclose(actual['values'], reference['values'], rtol=1e-12, atol=1e-12)
            np.testing.assert_allclose(actual['posterior'], reference['posterior'], rtol=1e-12, atol=1e-12)


if __name__ == '__main__':
    unittest.main()
