import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from attempt_count_fit import NAMES, SCORING_RULE
from personal_attention_future_head import ATTEMPTS, PROTOCOL, RUNS, forecast
from personal_known_plan_run import contained
from personal_value_fit import ARCHIVE, ROOT, digest
from progression_score import score_progression


LEDGER = ROOT / 'analysis/personal-bots/personal-attention-forecasts.jsonl'
INPUT = 'analysis/archive/personal-bots/personal-attention-future-input.json'
DATA = 'analysis/archive/personal-bots/personal-attention-future-data.json'
PREDICTIONS = 'analysis/personal-bots/personal-attention-future-predictions.json'
QUANTITATIVE_SOURCES = ('personal_attention_future_head.py', 'attempt_count_fit.py')
PIDS = {'Dennisisdebeste': 'pmuy78xu6tsths9', 'Mrs. Doubtfire': 'pmv16kj3jr35750',
        'PUK': 'pmv2gaa0g00eq3q', 'Gerda': 'pmv6yhzz3x9oxs8'}


def millis(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp() * 1000


def predict_data(data):
    rows = data['rows']
    if (data.get('evidence') != 'own-log-attention-future-counts-not-frozen'
            or data['runs'] != RUNS or data['attempts'] != ATTEMPTS or data['computationCaps']
            or not data['validUncensoredSimulation'] or data['pairedPilotControls'] != len(rows)
            or data['exactZeroPilotControls'] != len(rows) or set(data['controllers']) != set(NAMES)):
        raise ValueError('Numeric future points need complete fresh32x9 own-policy chains and all lifecycle controls')
    if any(sum(row['name'] == name for row in rows) < 20 for name in NAMES):
        raise ValueError('Retain at least20 prepared future boards per person, not a filtered easy subset')
    identities, predictions = set(), []
    for row in rows:
        if any(key in row for key in ('wonOn', 'end', 'observedAttempts', 'assisted')):
            raise ValueError('Future measurement must not contain human target outcomes')
        key = row['name'], row['lv']
        if key in identities or row['name'] not in NAMES:
            raise ValueError('Duplicate or unknown future target')
        identities.add(key)
        controller, selected = data['controllers'][row['name']], data['selected'][row['name']]
        if (row['modelId'] != controller['id'] or row['staticActorId'] != controller['staticActorId']
                or row['modelId'] != selected['actorId'] or row['temperature'] != selected['temperature']
                or row['selectedProfile'] != selected['selectedProfile'] or row['computationCaps']
                or row.get('firstAttempt') != 1 or row.get('firstClear') is not True):
            raise ValueError('Future point is not from its exact selected own controller on a fresh target')
        point = forecast(row['chain'], data['runs'])
        predictions.append({key: row[key] for key in (
            'name', 'lv', 'version', 'board', 'modelId', 'staticActorId', 'temperature', 'selectedProfile')}
            | {'predictedAttempt': point['predictedAttempt'],
               'distribution1to9And10plus': point['distribution1to9And10plus'],
               'rawFirstWinProbability': row['chain']['first']})
    return predictions


def load_run(argument):
    folder = argument.resolve()
    if not folder.is_relative_to((ARCHIVE / 'runs').resolve()):
        raise ValueError('Use a source-pinned future measurement run in this workspace')
    manifest_file = folder / 'attention-future-run-manifest.json'
    manifest = json.loads(manifest_file.read_bytes())
    if manifest.get('evidence') != 'immutable-own-log-attention-future-measurement-run':
        raise ValueError('Not a declared immutable future run')
    data_file = folder / DATA
    data = json.loads(data_file.read_bytes())
    if Path(data['sourceRoot']).resolve() != folder:
        raise ValueError('Future report is not from this immutable runtime')
    if any(data['sourceHashes'].get(relative) != expected for relative, expected in manifest['sourceHashes'].items()):
        raise ValueError('Future report omitted or changed its runtime closure')
    for relative, expected in data['sourceHashes'].items():
        if digest(contained(folder, relative)) != expected:
            raise ValueError('Future measurement source/input changed: ' + relative)
    if digest(folder / INPUT) != manifest['inputSha256'] or data['inputSha256'] != manifest['inputSha256']:
        raise ValueError('Future measurement no longer matches its prepared own input')
    inputs = json.loads((folder / INPUT).read_bytes())
    if (inputs.get('evidence') != 'own-log-attention-unopened-future-input-not-numeric-forecasts'
            or any(inputs[key] != data[key] for key in ('controllers', 'selected', 'confidenceReadyAt', 'confidenceSha256', 'calibrationSha256'))):
        raise ValueError('Future measurement changed its source-bound own model selection')
    fields = ('name', 'lv', 'version', 'board', 'modelId', 'staticActorId', 'temperature', 'selectedProfile')
    prepared = sorted(tuple(row[key] for key in fields) for row in inputs['entries'])
    measured = sorted(tuple(row[key] for key in fields) for row in data['rows'])
    if prepared != measured:
        raise ValueError('Every prepared future target must retain its exact board/controller measurement')
    for filename in QUANTITATIVE_SOURCES:
        relative = 'tools/sim/refit/' + filename
        if digest(Path(__file__).with_name(filename)) != data['sourceHashes'][relative]:
            raise ValueError('Declared quantitative point rule changed after future measurement')
    return folder, data, inputs


def predict(argument):
    folder, data, inputs = load_run(argument)
    now = time.time() * 1000
    if not millis(data['confidenceReadyAt']) < millis(data['started']) <= millis(data['made']) < now:
        raise ValueError('Future model, measurement and numeric prediction readiness must be chronological')
    points = predict_data(data)
    report = {'made': datetime.now(timezone.utc).isoformat(), 'model': PROTOCOL, 'targetMet': False,
              'evidence': 'own-selected-policy-numeric-predictions-not-yet-frozen', 'scope': 'first-clear-progression-v1',
              'attemptMetric': 'episode-relative', 'scoringRule': SCORING_RULE,
              'confidenceReadyAt': data['confidenceReadyAt'], 'confidenceSha256': data['confidenceSha256'],
              'calibrationSha256': data['calibrationSha256'], 'dataSha256': digest(folder / DATA),
              'runManifestSha256': digest(folder / 'attention-future-run-manifest.json'), 'inputSha256': data['inputSha256'],
              'controllers': data['controllers'], 'targetsAtPreparation': inputs['targets'], 'forecasts': points,
              'quantitativeSourceHashes': {name: digest(Path(__file__).with_name(name)) for name in QUANTITATIVE_SOURCES},
              'pointGeneratorSourceSha256': digest(Path(__file__)),
              'note': 'Uncensored new32x9 trajectories under each person’s own count-selected controller. '
                      'Exact1..9 and unresolved10+ retain the entire requested scoring utility. This is a numeric draft, '
                      'not a pre-start freeze, historical recomputation score, promotion or80% success claim.'}
    output = folder / PREDICTIONS
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
    print(json.dumps({'predictions': len(points), 'file': str(output), 'targetMet': False}, indent=2))


def current_targets(plays, scores):
    targets, starts = {}, {}
    aliases = {'1.54', '1.55', '1.56', '1.57', '1.58'}
    for name, pid in PIDS.items():
        all_events = list((plays.get(pid) or {}).values())
        versions = sorted([event for event in all_events if event.get('v')], key=lambda event: event['t'])
        events = sorted([event for event in all_events if event.get('k') in ('start', 'end')
                         and event.get('m') != 'd' and not event.get('tk') and type(event.get('lv')) is int],
                        key=lambda event: event['t'])
        if not events or not versions or versions[-1]['v'] not in aliases or events[-1].get('v') not in aliases:
            raise ValueError('Current version needs verified fixed boards; never guess an unsupported new app table')
        highest = max([0] + [event['lv'] for event in events if event['k'] == 'end' and event.get('r') == 'win'])
        score = scores.get(pid)
        saved = score.get('level', 1) if isinstance(score, dict) else 1
        saved = saved if type(saved) is int and saved > 0 else 1
        targets[name] = {'first': max(saved, highest + 1), 'version': '1.55'}
        starts[name] = {event['lv'] for event in events if event['k'] == 'start'}
    return targets, starts


def validate_snapshot(snapshot):
    if (snapshot.get('model') != PROTOCOL or snapshot.get('scope') != 'first-clear-progression-v1'
            or type(snapshot.get('frozenAt')) is not int or snapshot['frozenAt'] <= 0
            or set(snapshot.get('progressionStartLevels', {})) != set(NAMES)
            or any(type(value) is not int or value < 1 for value in snapshot['progressionStartLevels'].values())):
        raise ValueError('Invalid same-family numeric freeze or progression frontier')
    identities = set()
    for point in snapshot['forecasts']:
        key = point['name'], point['lv']
        if (key in identities or key[0] not in NAMES or type(key[1]) is not int or key[1] < 1
                or type(point.get('predictedAttempt')) is not int or not 1 <= point['predictedAttempt'] <= 8
                or not isinstance(point.get('board'), str) or not point['board']):
            raise ValueError('Duplicate or invalid original numeric forecast')
        identities.add(key)


def read_ledger(path):
    ledger = [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()] if path.exists() else []
    seen = set()
    for snapshot in ledger:
        validate_snapshot(snapshot)
        for point in snapshot['forecasts']:
            key = point['name'], point['lv']
            if key in seen:
                raise ValueError('A repeated level would rewrite its earliest same-family numeric value')
            seen.add(key)
    if ledger:
        anchor = min(ledger, key=lambda snapshot: snapshot['frozenAt'])
        if any(snapshot['progressionStartLevels'] != anchor['progressionStartLevels'] for snapshot in ledger):
            raise ValueError('Same-family updates cannot reset first-freeze progression frontiers')
    return ledger


def eligible_points(points, plays, scores, ledger):
    targets, started = current_targets(plays, scores)
    frontiers = (min(ledger, key=lambda snapshot: snapshot['frozenAt'])['progressionStartLevels'] if ledger else
                 {name: target['first'] for name, target in targets.items()})
    covered = {(point['name'], point['lv']) for snapshot in ledger for point in snapshot['forecasts']}
    selected = []
    for point in points:
        name, level = point['name'], point['lv']
        if point['version'] != targets[name]['version']:
            raise ValueError('Prepared board version differs from current verified progression')
        if (level >= max(frontiers[name], targets[name]['first']) and level not in started[name]
                and (name, level) not in covered):
            selected.append(point)
    for name in NAMES:
        retained = [point for snapshot in ledger for point in snapshot['forecasts'] if point['name'] == name
                    and point['lv'] >= max(frontiers[name], targets[name]['first']) and point['lv'] not in started[name]]
        coverage = {point['lv'] for point in retained + selected if point['name'] == name}
        if len(coverage) < 20:
            raise ValueError('Need20 distinct still-unopened predictions per person, including the actual next new levels')
    if not selected:
        raise ValueError('No new numeric points; never refreeze old levels or replace earlier values')
    return selected, frontiers, targets


def append_snapshot(path, snapshot):
    validate_snapshot(snapshot)
    if not snapshot['forecasts']:
        raise ValueError('No new numeric points to append')
    lock_path = path.with_suffix('.lock')
    lock = lock_path.open('x', encoding='utf-8')
    try:
        original = path.read_bytes() if path.exists() else b''
        ledger = read_ledger(path)
        if ledger:
            anchor = min(ledger, key=lambda item: item['frozenAt'])
            if (snapshot['progressionStartLevels'] != anchor['progressionStartLevels']
                    or snapshot['frozenAt'] <= max(item['frozenAt'] for item in ledger)):
                raise ValueError('Append cannot move the original cohort frontier')
        covered = {(point['name'], point['lv']) for item in ledger for point in item['forecasts']}
        if snapshot['model'] != PROTOCOL or any((point['name'], point['lv']) in covered for point in snapshot['forecasts']):
            raise ValueError('Append cannot replace any earlier numeric prediction')
        current = path.read_bytes() if path.exists() else b''
        if current != original:
            raise ValueError('Forecast ledger changed during append validation')
        with path.open('ab') as stream:
            stream.write((json.dumps(snapshot, separators=(',', ':')) + '\n').encode('utf-8'))
            stream.flush()
            os.fsync(stream.fileno())
        if not path.read_bytes().startswith(original):
            raise ValueError('Existing forecast bytes changed')
    finally:
        lock.close()
        lock_path.unlink()


def freeze(argument, live_argument):
    folder, data, unused_inputs = load_run(argument)
    prediction_file = folder / PREDICTIONS
    draft = json.loads(prediction_file.read_bytes())
    if draft['model'] != PROTOCOL or draft['dataSha256'] != digest(folder / DATA):
        raise ValueError('Numeric draft differs from its actual completed own trajectories')
    if draft['forecasts'] != json.loads(json.dumps(predict_data(data))):
        raise ValueError('Numeric draft has changed since the declared quantitative rule')
    for name, expected in draft['quantitativeSourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Numeric point rule changed after predictions were made')
    live = live_argument.resolve()
    if not live.is_relative_to(ARCHIVE.resolve()) or not live.name.startswith('live-openings-'):
        raise ValueError('Supply a separate read-only live opening snapshot')
    manifest_file = live / 'manifest.json'
    manifest = json.loads(manifest_file.read_bytes())
    now = int(time.time() * 1000)
    if (manifest.get('evidence') != 'read-only-live-opening-check' or not millis(draft['made']) < millis(manifest['made']) <= now
            or now - millis(manifest['made']) >= 120000):
        raise ValueError('Freeze needs a fresh opening check after the actual numeric predictions')
    for name in ('plays.json', 'scores.json'):
        if digest(live / name) != manifest['files'][name]:
            raise ValueError('Fresh live snapshot changed')
    plays, scores = [json.loads((live / name).read_bytes()) for name in ('plays.json', 'scores.json')]
    ledger = read_ledger(LEDGER)
    points, frontiers, targets = eligible_points(draft['forecasts'], plays, scores, ledger)
    snapshot = {'frozenAt': int(time.time() * 1000), 'model': PROTOCOL, 'scope': 'first-clear-progression-v1',
                'targetMet': False, 'progressionStartLevels': frontiers, 'targetsAtFreeze': targets,
                'forecasts': points, 'predictionFile': str(prediction_file), 'predictionSha256': digest(prediction_file),
                'dataSha256': digest(folder / DATA), 'run': str(folder), 'confidenceReadyAt': data['confidenceReadyAt'],
                'controllers': data['controllers'], 'sourceHashes': data['sourceHashes'],
                'quantitativeSourceHashes': draft['quantitativeSourceHashes'], 'freezeSourceSha256': digest(Path(__file__)),
                'liveSnapshot': str(live), 'liveManifestSha256': digest(manifest_file),
                'note': 'New own log-attention/count-selected policy family, not a rewrite or promotion of older failed forecasts. '
                        'Only unopened levels receive numeric points. All same-family updates retain the earliest freeze, '
                        'frontiers, numeric values and misses. Replay-local counts apply; replays never prove the primary80% gate. '
                        'Actual future openings must independently confirm eligibility; no accuracy success is established by freezing.'}
    if snapshot['frozenAt'] < millis(manifest['made']):
        raise ValueError('A clock change cannot backdate readiness before the live check')
    append_snapshot(LEDGER, snapshot)
    print(json.dumps({'frozenAt': snapshot['frozenAt'], 'forecasts': len(points), 'next': {
        name: [{'lv': point['lv'], 'predictedAttempt': point['predictedAttempt']} for point in sorted(
            [point for point in points if point['name'] == name], key=lambda point: point['lv'])[:3]] for name in NAMES}}, indent=2))


def score(outcomes_file):
    ledger = read_ledger(LEDGER)
    if not ledger:
        raise ValueError('No numeric frozen attention forecasts exist')
    outcomes = json.loads(outcomes_file.read_bytes())
    if outcomes.get('evidence') != 'separate-live-completed-and-pending-outcomes':
        raise ValueError('Attention scoring requires separate real completed/pending outcomes')
    live_manifest = outcomes_file.parent / 'manifest.json'
    if digest(live_manifest) != outcomes['liveManifestSha256'] or digest(outcomes_file.parent / 'plays.json') != outcomes['playsSha256']:
        raise ValueError('Outcome export does not match its live source')
    anchor = min(ledger, key=lambda item: item['frozenAt'])
    report = score_progression(ledger, outcomes['episodes'], anchor['progressionStartLevels'])
    report.update({'evaluatedAt': datetime.now(timezone.utc).isoformat(), 'observedAt': outcomes['observedAt'],
                   'model': PROTOCOL, 'ledgerSha256': digest(LEDGER), 'outcomesSha256': digest(outcomes_file),
                   'scoringSourceHashes': {name: digest(Path(__file__).with_name(name)) for name in (
                       Path(__file__).name, 'prospective.py', 'progression_score.py', 'attempt_count_fit.py')},
                   'note': 'Only original numeric pre-opening points score. All first20 new progression episodes/person remain, '
                           'including unfinished, hard, unknown-board and unforecasted games. No replay or recomputed prediction can replace a miss.'})
    output = ROOT / 'analysis/personal-bots/personal-attention-prospective-results.json'
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'targetMet': report['targetMet'], 'cohort': report['cohort']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest='mode', required=True)
    subparsers.add_parser('predict').add_argument('run', type=Path)
    freezer = subparsers.add_parser('freeze')
    freezer.add_argument('run', type=Path)
    freezer.add_argument('live', type=Path)
    subparsers.add_parser('score').add_argument('outcomes', type=Path)
    args = parser.parse_args()
    if args.mode == 'predict':
        predict(args.run)
    elif args.mode == 'freeze':
        freeze(args.run, args.live)
    else:
        score(args.outcomes)
