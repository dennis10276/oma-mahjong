import json
import subprocess
import unittest
from pathlib import Path

import numpy as np

from personal_clock_strategy import (CONTEXT, FEATURES, PARAMETERS, context_of, observation_of,
                                     predictive, transition_probabilities)


class PersonalClockStrategyBridgeTests(unittest.TestCase):
    def test_runtime_forward_filter_matches_native_without_logged_tray_or_future_actions(self):
        random = np.random.default_rng(20261020)
        kind, within = random.normal(0, 0.2, (4, 26)), random.normal(0, 0.2, 76)
        actor = {'withinWeights': within.tolist(), 'kindModel': {'weights': dict(zip(['flip', 'pair', 'single', 'fatal'], kind.tolist()))}}
        weights = random.normal(0, 0.2, (2, len(FEATURES)))
        weights[:, -1] = 0
        model = {'type': 'personalAdaptiveClock-v1', 'features': FEATURES, 'parameters': PARAMETERS, 'context': CONTEXT,
                 'weights': weights.tolist(), 'switchWeights': random.normal(0, 0.2, (2, len(CONTEXT))).tolist(),
                 'priors': [[0.7, 0.3], [0.4, 0.6]]}
        decisions = []
        for position in range(12):
            features = random.random((8, 76))
            features[:, [14, 18, 19]] = 0
            features[:2, 19] = 1
            features[2:4, 14] = 1
            features[6:, 18] = 1
            context = random.random(26)
            context[2:4] = [position % 3 == 1, position % 3 == 2]
            plans = random.random((8, len(FEATURES))) if position % 4 else np.zeros((8, len(FEATURES)))
            decisions.append({'F': features.tolist(), 'immediate': random.random((8, 29)).tolist(),
                              'kindContext': context.tolist(), 'knownPlan': plans.tolist(), 'k': position % 8})
        expected = []
        posterior, previous, started = np.asarray(model['priors'][0]), None, False
        for decision in decisions:
            active = bool(np.any(decision['knownPlan']))
            prior = posterior
            if active and started:
                prior = posterior @ transition_probabilities(context_of(decision, previous)[None, :], model['switchWeights'])[0]
            values, emission = predictive(decision, actor, model, prior)
            if active:
                posterior = prior * emission[decision['k']]
                posterior /= posterior.sum()
                previous = observation_of(decision, decision['k'])
                started = True
            expected.append({'values': values.tolist(), 'posterior': posterior.tolist()})
        script = "const fs=require('fs'),assert=require('assert/strict');const {strategyFactory,strategyAttemptFactory}=require('./source/tools/sim/refit/personal_clock_strategy_choice.js');const input=JSON.parse(fs.readFileSync(0,'utf8'));const choose=strategyFactory(input.actor,input.model);const output=input.decisions.map(decision=>{const values=choose.probabilities(decision);assert.deepEqual(choose.probabilities(decision),values);choose.observe(decision,decision.k);return {values,posterior:choose.posterior()};});const factory=strategyAttemptFactory(input.actor,input.model),first=factory({attempt:1}),retry=factory({attempt:2}),independent=factory({attempt:1});assert.equal(typeof first,'function');assert.equal(typeof factory.physicalTrayPlanning,'function');assert.notEqual(first,independent);assert.deepEqual(first.posterior(),input.model.priors[0]);assert.deepEqual(retry.posterior(),input.model.priors[1]);first.observe(input.decisions[1],0);assert.deepEqual(independent.posterior(),input.model.priors[0]);console.log(JSON.stringify(output));"
        output = subprocess.check_output(['node', '-e', script], input=json.dumps({'actor': actor, 'model': model, 'decisions': decisions}),
                                         text=True, cwd=Path(__file__).resolve().parents[4])
        for actual, reference in zip(json.loads(output), expected):
            np.testing.assert_allclose(actual['values'], reference['values'], rtol=1e-12, atol=1e-12)
            np.testing.assert_allclose(actual['posterior'], reference['posterior'], rtol=1e-12, atol=1e-12)


if __name__ == '__main__':
    unittest.main()
