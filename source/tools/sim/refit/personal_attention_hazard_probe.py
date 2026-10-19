import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.special import expit, logit

from attempt_count_fit import best_prediction, is_correct
from personal_value_fit import ARCHIVE, ROOT, digest


def hazards_of(chain):
    if chain.get('computationCensored', 0) or len(chain['within']) != 8:
        raise ValueError('Own count calibration probe needs uncensored8-try training chains')
    previous, last, result = 0., .5, []
    for within in chain['within']:
        if not previous <= within <= 1:
            raise ValueError('Invalid own cumulative first-clear probabilities')
        if previous < 1:
            last = (within - previous) / (1 - previous)
        result.append(min(15 / 16, max(1 / 16, last)))
        previous = within
    return np.array(result)


def fit(rows, profile):
    design, offsets, targets, importance = [], [], [], []
    for age, row in enumerate(reversed(rows)):
        actual = row['wonOn']
        for index, hazard in enumerate(hazards_of(row['chains'][profile])[:7]):
            attempt = index + 1
            if attempt > actual:
                break
            design.append([1, math.log(attempt)])
            offsets.append(logit(hazard))
            targets.append(float(attempt == actual))
            importance.append(.5 ** (age / 20))
    design, offsets, targets, importance = [np.array(values) for values in (design, offsets, targets, importance)]
    def objective(weights):
        scores = offsets + design @ weights
        loss = np.sum(importance * (np.logaddexp(0, scores) - targets * scores)) + .125 * (weights @ weights)
        gradient = design.T @ (importance * (expit(scores) - targets)) + .25 * weights
        return loss, gradient
    result = minimize(objective, np.zeros(2), jac=True, method='L-BFGS-B', bounds=[(-6, 6), (-3, 3)])
    if not result.success:
        raise ValueError('Own hazard calibration did not converge')
    return result.x


def evaluate(row, profile, weights):
    base = hazards_of(row['chains'][profile])
    adjusted = expit(logit(base) + weights[0] + weights[1] * np.log(np.arange(1, 9)))
    actual = row['wonOn']
    loss = 0.
    for attempt, hazard in enumerate(adjusted[:7], 1):
        if attempt > actual:
            break
        loss -= math.log(hazard if attempt == actual else 1 - hazard)
    remaining, distribution = 1., {}
    for attempt, hazard in enumerate(adjusted, 1):
        distribution[attempt] = remaining * hazard
        remaining *= 1 - hazard
    distribution[10] = remaining
    predicted = best_prediction(distribution)
    return loss, predicted


def main():
    model_file = ARCHIVE / 'personal-attention-log-temperature-models.json'
    model = json.loads(model_file.read_bytes())
    data_file = Path(model['dataFile'])
    if digest(data_file) != model['dataSha256']:
        raise ValueError('Own count probe lost its completed training measurement')
    data = json.loads(data_file.read_bytes())
    players = {}
    for name, selection in model['selected'].items():
        rows = sorted([row for row in data['rows'] if row['name'] == name], key=lambda row: row['end'])
        if len(rows) != 20 or any(row['modelId'] != selection['actorId'] or row['end'] >= model['actualFitRequest']
                                  or row.get('firstAttempt') != 1 or row.get('firstClear') is not True
                                  or row.get('assisted', False) or row.get('boardChangedWithinCampaign', False) for row in rows):
            raise ValueError('Each count probe must retain20 observations from the same own controller')
        profile = selection['selectedProfile']
        weights = fit(rows, profile)
        comparisons = []
        for index, row in enumerate(rows):
            training = rows[:index] + rows[index + 1:]
            omitted = fit(training, profile)
            base_loss, base_predicted = evaluate(row, profile, np.zeros(2))
            own_loss, own_predicted = evaluate(row, profile, omitted)
            comparisons.append({'lv': row['lv'], 'actual': row['wonOn'], 'base': base_predicted, 'own': own_predicted,
                                'baseLoss': base_loss, 'ownLoss': own_loss})
        players[name] = {'weights': weights.tolist(), 'rows': 20,
            'baseCensoredCountLoss': sum(row['baseLoss'] for row in comparisons) / 20,
            'leaveOneLevelOutCensoredCountLoss': sum(row['ownLoss'] for row in comparisons) / 20,
            'baseConservative8TryPointCorrect': sum(is_correct(row['base'], row['actual']) for row in comparisons),
            'leaveOneLevelOutConservative8TryPointCorrect': sum(is_correct(row['own'], row['actual']) for row in comparisons),
            'comparisons': comparisons}
    report = {'made': datetime.now(timezone.utc).isoformat(), 'targetMet': False,
              'evidence': 'own-prior-count-hazard-calibration-probe-development-only', 'players': players,
              'modelSha256': digest(model_file), 'dataSha256': digest(data_file), 'sourceSha256': digest(Path(__file__)),
              'sourceHashes': {name: digest(Path(__file__).with_name(name)) for name in (
                  Path(__file__).name, 'attempt_count_fit.py', 'personal_value_fit.py')},
              'parameters': {'l2': .25, 'interceptBound': 6, 'logAttemptSlopeBound': 3,
                             'hazardClip': [1 / 16, 15 / 16], 'prefixRecencyHalfLife': 20},
              'note': 'Proper first-seven-event/8+ censored likelihood; intercept and retry slope are fitted independently per person. '
                      'LOO is reused prior-training model-selection evidence, NOT independent held/pre-opening accuracy: '
                      'the confidence policy itself was selected from these20 known outcomes. Eight-try conservative point '
                      'diagnostics do not replace required exact1..9/10+ future measurement or any original frozen forecast.'}
    (ROOT / 'analysis/personal-bots/attention-hazard-probe.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {key: value for key, value in result.items() if key != 'comparisons'} for name, result in players.items()}, indent=2))


if __name__ == '__main__':
    main()
