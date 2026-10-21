"""Read-only per-person diagnostics for frozen forecast numbers and coverage."""
import argparse
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path

from attempt_count_fit import NAMES
from progression_score import score_progression


def summarize(ledger, outcomes):
    if not ledger:
        raise ValueError('An existing frozen ledger is required')
    anchor = ledger[0]
    for snapshot in ledger:
        if snapshot['model'] != anchor['model']:
            raise ValueError('Different model families must be evaluated separately')
        if type(snapshot['frozenAt']) not in (int, float) or not math.isfinite(snapshot['frozenAt']) or snapshot['frozenAt'] <= 0:
            raise ValueError('A real finite freeze timestamp is required')
        if snapshot['cohortStartsAfter'] != anchor['cohortStartsAfter'] or snapshot['progressionStartLevels'] != anchor['progressionStartLevels']:
            raise ValueError('The declared cohort cannot move between snapshots')
        for forecast in snapshot['forecasts']:
            prediction = forecast['predictedAttempt']
            if type(prediction) is not int or not 1 <= prediction <= 8:
                raise ValueError('Expected an immutable integer attempt forecast in1..8')
    episodes = outcomes['episodes']
    empty = {'frozenAt': anchor['cohortStartsAfter'], 'model': anchor['model'], 'forecasts': []}
    report = score_progression([empty, *ledger], episodes, anchor['progressionStartLevels'])
    players = {}
    for name in NAMES:
        exclusions = [row for row in report['diagnostics']['excludedEpisodes'] if row['name'] == name]
        reasons = {}
        for row in exclusions:
            reason = row['progressionExclusion']
            reasons[reason] = reasons.get(reason, 0) + 1
        players[name] = {**report['players'][name], 'cohort': report['cohort'][name],
                         'excluded': len(exclusions), 'exclusionsByReason': reasons}
    coverage = []
    for snapshot in ledger:
        for forecast in snapshot['forecasts']:
            openings = [episode['start'] for episode in episodes
                        if episode['name'] == forecast['name'] and episode['lv'] == forecast['lv']]
            first = min(openings) if openings else None
            status = ('notObservedOpened' if first is None else 'alreadyOpenedAtFreeze'
                      if first <= snapshot['frozenAt'] else 'openedAfterFreeze')
            coverage.append({'name': forecast['name'], 'lv': forecast['lv'], 'board': forecast['board'],
                             'frozenAt': snapshot['frozenAt'], 'firstObservedOpening': first, 'status': status})
    observed_at = outcomes.get('observedAt')
    observed_date = datetime.fromisoformat(observed_at.replace('Z', '+00:00')) if observed_at else None
    if observed_date is not None and observed_date.tzinfo is None:
        raise ValueError('Snapshot availability requires an explicit timezone')
    snapshot_time = observed_date.timestamp() * 1000 if observed_date else None
    warnings = []
    if snapshot_time is None or any(snapshot['frozenAt'] > snapshot_time for snapshot in ledger):
        warnings.append('Outcome snapshot cannot establish unopened status at the newer freeze; notObservedOpened is not a verified sealed forecast.')
    count = sum(row['n'] for row in players.values())
    correct = sum(row['correct'] for row in players.values())
    stretch = all(row['opened'] == 20 and row['completed'] == 20 and row['eligibleFrozenForecasts'] == 20
                  and row['accuracy'] is not None and row['accuracy'] >= 0.95 for row in report['cohort'].values())
    return {'model': anchor['model'], 'targetMet': False,
            'evidence': 'frozen-numerical-ledger-diagnostics-not-source-authentication',
            'numericalTarget80Met': report['targetMet'], 'numericalTarget95Met': stretch,
            'players': players, 'total': {'n': count, 'correct': correct, 'accuracy': correct / count if count else None},
            'coverage': coverage, 'warnings': warnings, 'progression': report,
            'note': 'No model is called and no ledger is written. Uses the original numbers and fixed progression cohort. '
                    'The normal source-bound evaluator must separately authenticate model/input/forecast provenance. '
                    'Coverage means observed records, not proof that a level is unopened in a stale or incomplete snapshot.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ledger', type=Path)
    parser.add_argument('outcomes', type=Path)
    parser.add_argument('--output', type=Path)
    arguments = parser.parse_args()
    ledger_bytes = arguments.ledger.read_bytes()
    outcomes_bytes = arguments.outcomes.read_bytes()
    ledger = [json.loads(line) for line in ledger_bytes.decode('utf-8-sig').splitlines() if line.strip()]
    report = summarize(ledger, json.loads(outcomes_bytes))
    report['ledgerSha256'] = hashlib.sha256(ledger_bytes).hexdigest()
    report['outcomesSha256'] = hashlib.sha256(outcomes_bytes).hexdigest()
    report['sourceSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    if arguments.output:
        with arguments.output.open('x', encoding='utf-8') as stream:
            json.dump(report, stream, indent=2)
    print(json.dumps({key: report[key] for key in ('model', 'total', 'players', 'warnings', 'numericalTarget80Met', 'numericalTarget95Met')}, indent=2))


if __name__ == '__main__':
    main()
