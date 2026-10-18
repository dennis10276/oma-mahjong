import json
import subprocess
import unittest
from pathlib import Path

import numpy as np

from personal_clock_intents import components_of, transitions_of
from personal_clock_strategy import CONTEXT as CLOCK_CONTEXT, FEATURES as CLOCK_FEATURES, PARAMETERS as CLOCK_PARAMETERS
from personal_tray_intents import (CONTEXT, FEATURES, MODES, PARAMETERS, context_of, fit_tray_intents, masks_of,
                                   observation_of, predictive, score_tray_intents)


class TrayIntentTests(unittest.TestCase):
    def setUp(self):
        self.actor = {'name': 'one', 'trainingCut': 10, 'trainedAids': ['own'], 'trainingGames': {'one': 1},
            'withinWeights': [0.] * 76, 'kindModel': {'weights': {kind: [0.] * 26 for kind in ('flip', 'pair', 'single', 'fatal')}}}
        self.decision = {'F': [[0.] * 76 for index in range(3)], 'immediate': [[0.] * 29 for index in range(3)],
                         'kindContext': [0.] * 26, 'trayPlan': [[0.] * 5 for index in range(3)], 'k': 0}
        self.decision['F'][0][64] = 1
        self.decision['F'][1][19] = 1
        self.decision['trayPlan'][1][3] = 1

    def test_recovery_can_inspect_instead_of_optional_unmatched_pickup(self):
        masks = masks_of(self.decision)
        np.testing.assert_array_equal(masks, [[True, True, True], [True, False, False], [False, True, False]])
        model = {'trainingChoices': 1}
        recovery, components = predictive(self.decision, self.actor, model, np.asarray([0., 0., 1.]))
        np.testing.assert_allclose(recovery, [0, 1, 0])
        ordinary, components = predictive(self.decision, self.actor, model, np.asarray([1., 0., 0.]))
        self.assertGreater(ordinary[2], 0)
        match, components = predictive(self.decision, self.actor, model, np.asarray([0., 1., 0.]))
        np.testing.assert_allclose(match, [1, 0, 0])

    def test_known_clear_and_unresolved_search_are_distinct(self):
        decision = json.loads(json.dumps(self.decision))
        decision['trayPlan'][0][1] = 1
        np.testing.assert_array_equal(masks_of(decision)[2], [True, False, False])
        uncertain = json.loads(json.dumps(self.decision))
        uncertain['trayPlan'][1][-1] = 1
        self.assertTrue(masks_of(uncertain)[2, 1])
        uncertain['trayPlan'][1][2] = 1
        self.assertFalse(masks_of(uncertain)[2, 1])

    def test_recovery_cannot_loop_on_a_known_non_pair_inspection(self):
        decision = json.loads(json.dumps(self.decision))
        decision['F'][1][65] = 1
        self.assertFalse(masks_of(decision)[2, 1])
        decision['trayPlan'][1][1] = 1
        self.assertFalse(masks_of(decision)[2, 1])
        decision['F'][1][67] = 1
        self.assertTrue(masks_of(decision)[2, 1])

    def test_confirmed_bee_at_432_is_optional_not_a_known_escape(self):
        filename = Path(__file__).with_name('fixtures') / 'tray-intent-bee150.json'
        fixture = json.loads(filename.read_text(encoding='utf8'))
        self.assertEqual((fixture['manualTap'], fixture['timeMs'], fixture['tile']), (189, 272415, 28))
        decision = fixture['decision']
        masks = masks_of(decision)
        self.assertFalse(masks[1, decision['k']])
        self.assertFalse(masks[2, decision['k']])
        baseline = np.full(len(decision['F']), 1 / len(decision['F']))
        self.assertGreater(components_of(baseline, masks)[decision['k'], 0], 0)

    def test_fit_retains_own_membership_and_ignores_target_wins(self):
        game = {'aid': 'own', 'availableAt': 9, 'initialNewLevel': True, 'decisions': [self.decision] * 4}
        future = {'aid': 'target', 'availableAt': 11, 'wonOn': 999, 'decisions': [self.decision]}
        model = fit_tray_intents([game, future], self.actor, iterations=3)
        self.assertEqual(model, fit_tray_intents([game, {**future, 'wonOn': 1}], self.actor, iterations=3))
        self.assertEqual(model['trainedAids'], ['own'])
        self.assertEqual(model['trainingChoices'], 4)
        self.assertTrue(all(later <= earlier + 1e-7 for earlier, later in zip(model['trainingObjectives'], model['trainingObjectives'][1:])))
        self.assertEqual(score_tray_intents([game], self.actor, model)['decisions'], 4)
        with self.assertRaisesRegex(ValueError, 'membership'):
            fit_tray_intents([{**game, 'availableAt': 10}], self.actor)

    def test_native_runtime_parity_and_clock_phase_isolation(self):
        random = np.random.default_rng(91)
        model = {'type': 'personalPersistentTrayIntents-v1', 'modes': MODES, 'features': FEATURES, 'context': CONTEXT,
            'parameters': PARAMETERS, 'trainingChoices': 40, 'priors': [[.6, .2, .2], [.3, .3, .4]],
            'switchWeights': random.normal(scale=.2, size=(3, 3, len(CONTEXT))).tolist()}
        decisions = []
        for index in range(10):
            decision = json.loads(json.dumps(self.decision))
            decision['kindContext'][1:4] = [int(index % 3 == 0), int(index % 3 == 1), int(index % 3 == 2)]
            decision['k'] = index % 3
            if index % 4 == 0:
                decision['trayPlan'] = np.zeros((3, 5)).tolist()
            decisions.append(decision)
        expected, posterior, previous, started = [], np.asarray(model['priors'][0]), None, False
        for decision in decisions:
            active = bool(np.any(decision['trayPlan']))
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
        clock_model = {'type': 'personalPersistentClockIntents-v1', 'modes': ['ordinary', 'dig', 'pairFirst'],
            'features': CLOCK_FEATURES, 'context': CLOCK_CONTEXT, 'parameters': CLOCK_PARAMETERS, 'trainingClockChoices': 1,
            'priors': [[.2, .6, .2], [.5, .3, .2]], 'switchWeights': np.zeros((3, 3, 10)).tolist()}
        script = "const fs=require('fs'),assert=require('assert/strict');const {trayIntentFactory}=require('./source/tools/sim/refit/personal_tray_intents_choice.js');const {jointIntentFactory,jointIntentAttemptFactory,splitDecision}=require('./source/tools/sim/refit/personal_joint_intents_choice.js');const {intentFactory}=require('./source/tools/sim/refit/personal_clock_intents_choice.js');const input=JSON.parse(fs.readFileSync(0,'utf8'));const selector=trayIntentFactory(input.actor,input.model);const results=input.decisions.map(decision=>{const values=selector.probabilities(decision);assert.deepEqual(values,selector.probabilities({...decision,k:999,tray:999}));selector.observe(decision,decision.k);return {values,posterior:selector.posterior()};});const joint=jointIntentFactory(input.actor,input.clock,input.model),clock=intentFactory(input.actor,input.clock);const clockDecision={...input.decisions[1],kindContext:input.decisions[1].kindContext.slice(),knownPlan:[[0,0,0,0,0,0,0,.25,0,0,0,0],[0,0,0,0,0,0,0,0,1,0,0,0],new Array(12).fill(0)]};clockDecision.kindContext[11]=1;const combined={...clockDecision,knownPlan:clockDecision.knownPlan.map(row=>[...row,...new Array(5).fill(0)])};for(let index=0;index<3;index++){assert.deepEqual(joint.probabilities(combined),clock.probabilities(clockDecision));joint.observe(combined,index);clock.observe(clockDecision,index);}assert.deepEqual(joint.posterior().tray,input.model.priors[0]);assert.throws(()=>splitDecision({...combined,knownPlan:combined.knownPlan.map(row=>[...row.slice(0,12),1,0,0,0,0])}));const factory=jointIntentAttemptFactory(input.actor,input.clock,input.model);assert.deepEqual(factory({attempt:2}).posterior().tray,input.model.priors[1]);assert.notEqual(factory({attempt:1}),factory({attempt:1}));console.log(JSON.stringify(results));"
        output = subprocess.check_output(['node', '-e', script], input=json.dumps({'actor': self.actor, 'model': model,
            'clock': clock_model, 'decisions': decisions}), text=True, cwd=Path(__file__).resolve().parents[4])
        for actual, reference in zip(json.loads(output), expected):
            np.testing.assert_allclose(actual['values'], reference['values'], rtol=1e-12, atol=1e-12)
            np.testing.assert_allclose(actual['posterior'], reference['posterior'], rtol=1e-12, atol=1e-12)


if __name__ == '__main__':
    unittest.main()
