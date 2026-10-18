import json
import subprocess
import unittest
from pathlib import Path

import numpy as np

from personal_clock_intents import CONTEXT as CLOCK_CONTEXT, FEATURES as CLOCK_FEATURES, MODES as CLOCK_MODES, PARAMETERS as CLOCK_PARAMETERS
from personal_handoff import (CONTEXT, HandoffState, context_of, cue_of, descriptor_of, fit_handoff,
                              objective, shift_group)
from personal_joint_sequence import JointState
from personal_tray_intents import CONTEXT as TRAY_CONTEXT, FEATURES as TRAY_FEATURES, MODES as TRAY_MODES, PARAMETERS as TRAY_PARAMETERS


def feature(picture, position, flags=None):
    values = [0.] * 76
    for part, value in zip((21, 22, 26), position):
        values[part] = value
    values[27 + picture] = 1
    for part, value in (flags or {}).items():
        values[part] = value
    return values


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.actor = {'id': 'actor', 'name': 'one', 'trainingCut': 10, 'trainedAids': ['own'], 'trainingGames': {'one': 1},
            'withinWeights': [0.] * 76, 'kindModel': {'weights': {kind: [0.] * 26 for kind in ('flip', 'pair', 'single', 'fatal')}}}
        self.base = {'clockIntents': {'type': 'personalPersistentClockIntents-v1', 'modes': CLOCK_MODES, 'features': CLOCK_FEATURES,
            'context': CLOCK_CONTEXT, 'parameters': CLOCK_PARAMETERS, 'priors': [[1/3]*3]*2,
            'switchWeights': np.zeros((3, 3, 10)).tolist(), 'trainingClockChoices': 0},
            'trayIntents': {'type': 'personalPersistentTrayIntents-v1', 'modes': TRAY_MODES, 'features': TRAY_FEATURES,
            'context': TRAY_CONTEXT, 'parameters': TRAY_PARAMETERS, 'priors': [[1/3]*3]*2,
            'switchWeights': np.zeros((3, 3, 10)).tolist(), 'trainingChoices': 0}}
        self.before = {'F': [feature(5, [.1, .2, 0]), feature(6, [.4, .2, 0]), feature(7, [.7, .2, 0])],
            'kindContext': [0.] * 26, 'immediate': np.zeros((3, 29)).tolist(),
            'knownPlan': np.zeros((3, 12)).tolist(), 'trayPlan': np.zeros((3, 5)).tolist(), 'k': 0}
        self.after = json.loads(json.dumps(self.before))
        self.after['kindContext'][1] = 1
        self.after['F'][0][64] = 1

    def model(self, weights=None):
        return {'type': 'personalConditionalHandoff-v1', 'actorId': 'actor', 'name': 'one', 'features': CONTEXT,
                'weights': [0.] * len(CONTEXT) if weights is None else weights, 'trainingSamples': 10, 'trainingClockSamples': 0}

    def test_cue_is_public_and_does_not_read_current_label(self):
        previous = descriptor_of(self.before, 0)
        cue = cue_of(self.after, previous)
        self.assertEqual(cue['indices'], [0])
        self.assertEqual(cue, cue_of({**self.after, 'k': 999}, previous))
        np.testing.assert_array_equal(context_of(self.after, cue), context_of({**self.after, 'k': 999}, cue))
        bee = json.loads((Path(__file__).with_name('fixtures') / 'handoff-bee150.json').read_bytes())
        self.assertIsNone(cue_of(bee['next'], bee['previous']))

    def test_probability_transfer_can_favor_or_oppose_without_force(self):
        values = [.2, .3, .5]
        raised, lowered = shift_group(values, [1], 2), shift_group(values, [1], -2)
        self.assertGreater(raised[1], .3)
        self.assertLess(lowered[1], .3)
        self.assertAlmostEqual(raised.sum(), 1)
        self.assertAlmostEqual(raised[0] / raised[2], .4)
        np.testing.assert_array_equal(shift_group(values, [1], 0), values)
        np.testing.assert_array_equal(shift_group([1, 0], [0], 4), [1, 0])
        with self.assertRaises(ValueError):
            shift_group(values, [1, 1], 1)

    def test_gradient_and_own_temporal_membership(self):
        random = np.random.default_rng(19)
        contexts = random.normal(size=(8, len(CONTEXT)))
        offsets, labels, importance = random.normal(size=8), random.integers(0, 2, 8), random.random(8)
        weights = random.normal(scale=.1, size=len(CONTEXT))
        arguments = (contexts, offsets, labels, importance, 10)
        loss, gradient = objective(weights, *arguments)
        for index in range(len(weights)):
            before, after = weights.copy(), weights.copy()
            before[index] -= 1e-6
            after[index] += 1e-6
            expected = (objective(after, *arguments)[0] - objective(before, *arguments)[0]) / 2e-6
            self.assertAlmostEqual(gradient[index], expected, places=7)
        game = {'aid': 'own', 'availableAt': 9, 'initialNewLevel': True, 'decisions': [self.before, self.after] * 40}
        target = {'aid': 'target', 'availableAt': 11, 'wonOn': 999, 'decisions': [self.before, self.after]}
        model = fit_handoff([game, target], self.actor, self.base)
        self.assertEqual(model, fit_handoff([game, {**target, 'wonOn': 1}], self.actor, self.base))
        self.assertEqual(model['trainingSamples'], 40)
        state = HandoffState(self.actor, self.base, model)
        evaluated = state.evaluate(self.before)
        state.observe(self.before, 0, evaluated)
        self.assertGreater(state.evaluate(self.after)['values'][0], 1/3)
        with self.assertRaisesRegex(ValueError, 'membership'):
            fit_handoff([{**game, 'availableAt': 10}], self.actor, self.base)

    def test_native_runtime_state_and_zero_control(self):
        weights = [0.] * len(CONTEXT)
        weights[0], weights[1] = -.2, 2
        model = self.model(weights)
        decisions = [self.before, self.after] * 5
        state, references = HandoffState(self.actor, self.base, model), []
        baseline, zero = JointState(self.actor, self.base), HandoffState(self.actor, self.base, self.model())
        for decision in decisions:
            evaluated = state.evaluate(decision)
            state.observe(decision, decision['k'], evaluated)
            references.append({'values': evaluated['values'].tolist(), 'posterior': {phase: values.tolist() for phase, values in state.posterior().items()}})
            control, unchanged = baseline.evaluate(decision), zero.evaluate(decision)
            np.testing.assert_array_equal(control['values'], unchanged['values'])
            baseline.observe(decision, decision['k'], control)
            zero.observe(decision, decision['k'], unchanged)
        script = "const fs=require('fs'),assert=require('assert/strict');const {handoffFactory,handoffAttemptFactory}=require('./source/tools/sim/refit/personal_handoff_choice.js');const {jointIntentFactory}=require('./source/tools/sim/refit/personal_joint_intents_choice.js');const input=JSON.parse(fs.readFileSync(0,'utf8'));const selector=handoffFactory(input.actor,input.base,input.model);const decisions=input.decisions.map(decision=>({...decision,knownPlan:decision.knownPlan.map((row,index)=>[...row,...decision.trayPlan[index]])}));const result=decisions.map(decision=>{const values=selector.probabilities(decision);assert.deepEqual(values,selector.probabilities({...decision,k:999}));selector.observe(decision,decision.k);return {values,posterior:selector.posterior()};});const base=jointIntentFactory(input.actor,input.base.clockIntents,input.base.trayIntents),zero=handoffFactory(input.actor,input.base,{...input.model,weights:input.model.weights.map(()=>0)});for(const decision of decisions){assert.deepEqual(base.probabilities(decision),zero.probabilities(decision));base.observe(decision,decision.k);zero.observe(decision,decision.k);}const factory=handoffAttemptFactory(input.actor,input.base,input.model);const first=factory({attempt:1}),other=factory({attempt:1});first.observe(decisions[0],0);assert.equal(other.previous(),null);assert.throws(()=>handoffFactory({...input.actor,id:'other'},input.base,input.model));assert.throws(()=>first(decisions[1],NaN));console.log(JSON.stringify(result));"
        output = subprocess.check_output(['node', '-e', script], input=json.dumps({'actor': self.actor, 'base': self.base,
            'model': model, 'decisions': decisions}), text=True, cwd=Path(__file__).resolve().parents[4])
        for actual, expected in zip(json.loads(output), references):
            np.testing.assert_allclose(actual['values'], expected['values'], atol=1e-12, rtol=1e-12)
            for phase in ('clock', 'tray'):
                np.testing.assert_allclose(actual['posterior'][phase], expected['posterior'][phase], atol=1e-12, rtol=1e-12)


if __name__ == '__main__':
    unittest.main()
