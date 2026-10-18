import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from attempt_count_fit import NAMES, accuracy, is_correct


ROOT = Path(__file__).resolve().parents[3]
PINNED = ROOT / 'analysis/archive/personal-bots/experiments/personal-single-2026-10-17T15-35-43-809Z'


def mechanics(row):
    return bool(row['physical'][6]), bool(row['physical'][9])


def select_method(scored, target, metadata, match_mechanics=False, limit=20, half_life=10):
    if limit < 1 or half_life <= 0:
        raise ValueError('Positive recent selection window and half-life required')
    past = sorted([row for row in scored if row['name'] == target['name'] and row['end'] < target['start']
                   and metadata[row['name'], row['start']].get('firstClear', False)], key=lambda row: row['end'], reverse=True)
    comparable = [row for row in past if mechanics(metadata[row['name'], row['start']]) == mechanics(target)]
    matched = match_mechanics and len(comparable) >= 6
    past = (comparable if matched else past)[:limit]
    methods = list(target['predictions'])
    if not past:
        return 'alwaysFirst', {'pastEpisodes': 0, 'availableThrough': None, 'matchedMechanics': matched, 'scores': {}}
    scores = {}
    mass = sum(0.5 ** (age / half_life) for age in range(len(past)))
    for method in methods:
        correct = sum(0.5 ** (age / half_life) * is_correct(row['predictions'][method], row['wonOn']) for age, row in enumerate(past))
        scores[method] = (1 + correct) / (2 + mass)
    best = max(methods, key=lambda method: (scores[method], method == 'alwaysFirst'))
    return best, {'pastEpisodes': len(past), 'availableThrough': max(row['end'] for row in past),
                  'matchedMechanics': matched, 'scores': scores}


def evaluate(data, scored, prior_report):
    if not prior_report.get('personalOnly'):
        raise ValueError('Recent personal selection requires own-only source predictions')
    metadata = {(row['name'], row['start']): row for row in data['rows']}
    held_ids = set(data['comparisonEpisodes'])
    results = []
    for row in scored:
        original = metadata[row['name'], row['start']]
        if any(row[key] != original[key] for key in ['end', 'wonOn', 'lv', 'board']):
            raise ValueError('Scored outcomes do not match measured campaigns')
        if row['name'] + '|' + str(row['start']) not in held_ids:
            continue
        target = {**original, 'predictions': row['predictions']}
        recent, recent_availability = select_method(scored, target, metadata)
        matched, matched_availability = select_method(scored, target, metadata, True)
        fixed = prior_report['players'][row['name']]['selectedBeforeTest']
        results.append({key: row[key] for key in ['name', 'lv', 'start', 'end', 'wonOn', 'board']} | {
            'predictions': {'fixedBeforeTest': row['predictions'][fixed], 'recent20': row['predictions'][recent],
                            'mechanicsRecent20': row['predictions'][matched]},
            'selectedMethods': {'fixedBeforeTest': fixed, 'recent20': recent, 'mechanicsRecent20': matched},
            'selectionAvailability': {'recent20': recent_availability, 'mechanicsRecent20': matched_availability}})
    if len(results) != len(held_ids):
        raise ValueError('Recent selection cannot silently omit comparison campaigns')
    methods = ['fixedBeforeTest', 'recent20', 'mechanicsRecent20']
    return {'players': {name: {method: accuracy([row for row in results if row['name'] == name], method) for method in methods}
                        for name in NAMES}, 'heldOut': {method: accuracy(results, method) for method in methods}, 'rows': results}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, default=PINNED / 'analysis/archive/personal-bots/physical-single-count-data.json')
    parser.add_argument('--scored', type=Path, default=PINNED / 'analysis/archive/personal-bots/physical-single-count-scored.json')
    parser.add_argument('--evaluation', type=Path, default=PINNED / 'analysis/personal-bots/physical-single-count-evaluation.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'analysis/personal-bots/personal-recent-selection.json')
    args = parser.parse_args()
    files = {'data': args.data, 'scored': args.scored, 'evaluation': args.evaluation}
    raw = {name: file.read_bytes() for name, file in files.items()}
    data, scored, prior = (json.loads(raw[name]) for name in ['data', 'scored', 'evaluation'])
    if prior['dataSha256'] != hashlib.sha256(raw['data']).hexdigest() or prior['measurementFingerprint'] != data['fingerprint']:
        raise ValueError('Recent selection source count report mismatch')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-prequential', 'targetMet': False,
              'measurementFingerprint': data['fingerprint'], 'inputSha256': {name: hashlib.sha256(value).hexdigest() for name, value in raw.items()},
              'sourceSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), **evaluate(data, scored, prior),
              'note': 'Method selection uses only earlier completed own first-clear games, with a twenty-game window and ten-game half-life. Mechanics matching uses clock/key presence when six earlier comparable games exist. No replay wins, other players, target results or later held-game outcomes select a target method. Historical online selection is not new prospective proof; original numeric ledgers and misses are unchanged.'}
    if any(file.read_bytes() != raw[name] for name, file in files.items()):
        raise ValueError('Recent selection inputs changed')
    args.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'players': report['players'], 'heldOut': report['heldOut']}, indent=2))


if __name__ == '__main__':
    main()
