import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path

from attempt_count_fit import NAMES, SCORING_RULE, accuracy, best_prediction_with_tail
from personal_count_fit import hazards_of, distribution_of


ROOT = Path(__file__).resolve().parents[3]
PROFILES = ('handoffZero', 'handoff')


def empirical_distribution(chain, runs):
    previous, probabilities = 0., {}
    if not chain['within'] or chain['first'] != chain['within'][0]:
        raise ValueError('Missing or inconsistent initial chain rate')
    for attempt, within in enumerate(chain['within'], 1):
        wins = runs * (within - previous)
        if not previous <= within <= 1 or abs(wins - round(wins)) > 1e-9:
            raise ValueError('Invalid empirical autonomous first-clear counts')
        probabilities[attempt] = within - previous
        previous = within
    return probabilities, 1 - previous


def evaluate(data):
    if (data['runs'] != 32 or data['attempts'] != 32 or data['computationCaps'] != 0
            or not data['validUncensoredSimulation'] or tuple(data['profiles']) != PROFILES
            or data['pairedPilotChainsMatched'] != 58 or data['firstAttemptRateControls'] != 58):
        raise ValueError('Require all29 uncensored paired32x32 chains and58 pilot/initial controls')
    if len(data['rows']) != 29 or len({(row['name'], row['start']) for row in data['rows']}) != 29:
        raise ValueError('Keep every fixed recent target exactly once')
    scored, pending, ineligible = [], [], []
    for row in data['rows']:
        if (row['firstAttempt'] != 1 or not row.get('firstClear') or row.get('assisted')
                or row.get('boardChangedWithinCampaign')):
            ineligible.append({key: row.get(key) for key in ('name', 'lv', 'start', 'wonOn', 'firstAttempt', 'firstClear', 'assisted', 'boardChangedWithinCampaign')})
            continue
        if row.get('wonOn') is None:
            pending.append({key: row.get(key) for key in ('name', 'lv', 'start', 'observedAttempts')})
            continue
        predictions, survival = {'alwaysFirst': 1}, {}
        for profile in PROFILES:
            chain = row['chains'][profile]
            probabilities, tail = empirical_distribution(chain, data['runs'])
            predictions[profile + 'Empirical'] = best_prediction_with_tail(probabilities, tail, 33)
            probabilities, tail = distribution_of(hazards_of(chain, data['runs']))
            predictions[profile + 'Smoothed'] = best_prediction_with_tail(probabilities, tail, 129)
            survival[profile] = {str(bound): chain['within'][bound - 1] for bound in (1, 3, 5, 8, 32)}
        scored.append({**{key: row[key] for key in ('name', 'lv', 'start', 'end', 'wonOn', 'board', 'modelId')},
                       'predictions': predictions, 'survival': survival})
    methods = ('alwaysFirst', *(profile + suffix for profile in PROFILES for suffix in ('Empirical', 'Smoothed')))
    players = {name: {method: accuracy([row for row in scored if row['name'] == name], method) for method in methods} for name in NAMES}
    return {'targetMet': False, 'evidence': 'historical-exploratory-raw-handoff-winning-count-diagnostic',
        'scoringRule': SCORING_RULE, 'personalOnly': True, 'players': players, 'scored': scored,
        'coverage': {'fixedTargets': 29, 'scored': len(scored), 'pending': len(pending), 'ineligibleRetained': len(ineligible)},
        'pending': pending, 'ineligible': ineligible,
        'note': 'Raw empirical and fixed Jeffreys-smoothed32x32 distributions, not a target-fitted count head. '
                'All29 targets remain in coverage; unfinished, replay, assisted or changed-board campaigns are explicitly retained outside completed first-clear accuracy. '
                'No older-controller chain is reused, no current outcome chooses parameters, no held target enters its own action fit. '
                'Client-time historical simulation is exploratory, not pre-opening numeric evidence. '
                'All original prospective misses remain unchanged; no promotion, new numeric forecast or80% success is established.'}


def main():
    filename = ROOT / 'analysis/archive/personal-bots/personal-handoff-count-data.json'
    data_bytes = filename.read_bytes()
    data = json.loads(data_bytes)
    for name, expected in data['sourceHashes'].items():
        if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != expected:
            raise ValueError('Handoff count source/input changed: ' + name)
    report = evaluate(data)
    report.update({'made': datetime.now(timezone.utc).isoformat(), 'dataFile': filename.relative_to(ROOT).as_posix(),
        'dataSha256': hashlib.sha256(data_bytes).hexdigest(),
        'scoringSourceHashes': {name: hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest()
            for name in ('personal_handoff_count_score.py', 'attempt_count_fit.py', 'personal_count_fit.py', 'attempt_hazard.py', 'board_recall_eval.py')}})
    output = ROOT / 'analysis/personal-bots/handoff-count-evaluation.json'
    output.write_text(json.dumps(report, indent=2), encoding='utf8')
    print(json.dumps({key: value for key, value in report.items() if key not in ('scored',)}, indent=2))


if __name__ == '__main__':
    main()
