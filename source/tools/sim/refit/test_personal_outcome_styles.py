import copy
import json
import subprocess
import unittest
from pathlib import Path

import numpy as np

from personal_outcome_styles import FEATURES, components, fit_styles, score_styles, style_features


class PersonalOutcomeStyleTests(unittest.TestCase):
    def fixture(self):
        features = [[0.0] * 76 for _ in range(3)]
        features[0][19] = 1
        features[1][64] = 1
        features[2][18] = 1
        immediate = [[0.0] * 29 for _ in range(3)]
        immediate[0][19] = 1
        decision = {'F': features, 'immediate': immediate, 'kindContext': [1, 0, 0, 1] + [0] * 22, 'k': 1}
        games = [{'aid': 'good', 't': 1, 'availableAt': 2, 'initialNewLevel': True,
                  'stopReason': 'auto', 'complete': False, 'decisions': [decision] * 4},
                 {'aid': 'bad', 't': 3, 'availableAt': 4, 'initialNewLevel': False,
                  'stopReason': 'end', 'complete': True, 'ending': 'stuck',
                  'decisions': [{**decision, 'k': 2}] * 4}]
        actor = {'name': 'one', 'trainingCut': 10, 'trainedAids': ['good', 'bad'], 'trainingGames': {'one': 2},
                 'withinWeights': [0.0] * 76,
                 'kindModel': {'weights': {kind: [0.0] * 26 for kind in ['flip', 'pair', 'single', 'fatal']}}}
        return games, actor

    def test_only_past_own_outcomes_can_anchor_styles(self):
        games, actor = self.fixture()
        expected = fit_styles(games, actor)
        future = {**games[0], 'aid': 'future', 'availableAt': 11, 'ending': 'win'}
        other = {**games[1], 'aid': 'someone-else', 'availableAt': 1}
        self.assertEqual(expected, fit_styles(games + [future, other], actor))
        self.assertEqual(expected, fit_styles(games + [{**future, 'ending': 'stuck'}], actor))
        self.assertRaises(ValueError, fit_styles, [{**games[0], 'availableAt': 10}, games[1]], actor)

    def test_censored_prefixes_are_not_failures_and_priors_are_personal(self):
        games, actor = self.fixture()
        censored = {**games[1], 'stopReason': 'shuffle'}
        model = fit_styles([games[0], censored], actor)
        self.assertEqual(model['censoredGames'], 1)
        self.assertEqual([row['aid'] for row in model['labelledGames']], ['good'])
        self.assertEqual(model['labelledGames'][0]['label'], 1)
        np.testing.assert_array_equal(model['weights'][0], np.zeros(len(FEATURES)))
        self.assertGreater(model['priors'][0][1], model['priors'][1][1])
        self.assertEqual(model['trainedAids'], ['bad', 'good'])

    def test_both_experts_are_fitted_with_bounded_non_greedy_residuals(self):
        games, actor = self.fixture()
        model = fit_styles(games, actor)
        self.assertEqual(len(model['labelledGames']), 2)
        for objective in model['objectives']:
            self.assertLess(objective['after'], objective['before'])
        self.assertTrue(np.all(np.abs(model['weights']) <= 4))
        values = components(games[0]['decisions'][0], actor, model)
        self.assertGreater(values[0, 2], values[1, 2])
        self.assertGreater(values[1, 1], values[0, 1])
        self.assertRaises(ValueError, fit_styles, games, actor, 0)

    def test_current_outcomes_and_future_choices_do_not_determine_current_prediction(self):
        games, actor = self.fixture()
        model = fit_styles(games, actor)
        game = copy.deepcopy(games[0])
        baseline = score_styles(game, actor, model)
        game.update(ending='stuck', complete=True, stopReason='end', wonOn=100)
        self.assertEqual(baseline, score_styles(game, actor, model))
        np.testing.assert_array_equal(components(game['decisions'][0], actor, model),
                                      components({**game['decisions'][0], 'k': 2}, actor, model))
        control = components(game['decisions'][0], actor, model, enabled=False)
        np.testing.assert_array_equal(control[0], control[1])

    def test_native_javascript_features_scores_and_isolated_attempt_sampling_match(self):
        games, actor = self.fixture()
        model = fit_styles(games, actor)
        script = "const fs=require('fs'),assert=require('assert/strict');const {styleFeatures,styleEvaluator,styleAttemptFactory,scoreStyles}=require('./source/tools/sim/refit/personal_outcome_styles_choice.js');const input=JSON.parse(fs.readFileSync(0,'utf8')),evaluator=styleEvaluator(input.actor,input.model);const scores=input.games.map(game=>scoreStyles(game,evaluator,input.model.priors));const exact={...input.model,priors:[[1-1e-12,1e-12],[1e-12,1-1e-12]]},factory=styleAttemptFactory(input.actor,exact);const metadata={run:0,attempt:1,seed:123};const first=factory(metadata),retry=factory({...metadata,attempt:2});assert.equal(first.component,0);assert.equal(retry.component,1);assert.notEqual(first,factory(metadata));assert.equal(factory({...metadata,wonOn:100,previousFailure:'tray'}).component,first.component);assert.deepEqual(first.probabilities(input.games[0].decisions[0]),first.probabilities(input.games[0].decisions[0]));assert.equal(first.component,0);assert.throws(()=>factory({...metadata,attempt:0}));console.log(JSON.stringify({features:styleFeatures(input.games[0].decisions[0]),scores}));"
        result = subprocess.check_output(['node', '-e', script], text=True, cwd=Path(__file__).resolve().parents[4],
                                         input=json.dumps({'actor': actor, 'model': model, 'games': games}))
        actual = json.loads(result)
        np.testing.assert_allclose(actual['features'], style_features(games[0]['decisions'][0]), atol=1e-12)
        for game, result in zip(games, actual['scores']):
            expected = score_styles(game, actor, model)
            self.assertEqual(expected['decisions'], result['decisions'])
            self.assertAlmostEqual(expected['jointLogLoss'], result['jointLogLoss'], places=12)
            self.assertAlmostEqual(expected['topActionAccuracy'], result['topActionAccuracy'], places=12)
            np.testing.assert_allclose(expected['posterior'], result['posterior'], atol=1e-12)


if __name__ == '__main__':
    unittest.main()
