import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from attempt_count_fit import NAMES, accuracy, best_prediction, completed_before


ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / 'analysis/archive/personal-bots'
OUTPUT = ROOT / 'analysis/personal-bots'


def recalled_prediction(rows, target, fallback):
    own = sorted([row for row in completed_before(rows, target['start']) if row['name'] == target['name']],
                 key=lambda row: row['end'])
    distribution = {}
    matches = []
    for age, row in enumerate(reversed(own)):
        if row['board'] != target['board'] or row.get('assisted', False):
            continue
        distribution[row['wonOn']] = distribution.get(row['wonOn'], 0) + 0.5 ** (age / 20)
        matches.append({'start': row['start'], 'end': row['end'], 'lv': row['lv'], 'wonOn': row['wonOn']})
    return (best_prediction(distribution) if distribution else fallback), matches


def main():
    data_file = ARCHIVE / 'inspection-count-data.json'
    scores_file = ARCHIVE / 'inspection-count-scored.json'
    data = json.loads(data_file.read_text(encoding='utf-8'))
    previous_scores = json.loads(scores_file.read_text(encoding='utf-8'))
    measured = {(row['name'], row['start']): row for row in data['rows']}
    comparisons = set(data['comparisonEpisodes'])
    scored = []
    for row in previous_scores:
        target = measured[row['name'], row['start']]
        predictions = {method: row['predictions'][method] for method in ['alwaysFirst', 'controlForest']}
        for method, fallback in list(predictions.items()):
            predictions['boardRecall_' + method], matches = recalled_prediction(data['rows'], target, fallback)
        scored.append({**row, 'predictions': predictions, 'earlierOwnBoard': matches})
    methods = list(scored[0]['predictions'])
    held = [row for row in scored if row['name'] + '|' + str(row['start']) in comparisons]
    players = {}
    for name in NAMES:
        testing = [row for row in held if row['name'] == name]
        cutoff = min(row['start'] for row in testing)
        development = [row for row in scored if row['name'] == name and row['end'] < cutoff]
        chosen = max(methods, key=lambda method: accuracy(development, method)['accuracy']) if development else 'alwaysFirst'
        players[name] = {'methods': {method: accuracy(testing, method) for method in methods},
                         'ownBoardAvailable': sum(bool(row['earlierOwnBoard']) for row in testing),
                         'selectedBeforeTest': chosen, 'selectedScore': accuracy(testing, chosen)}
    report = {'evaluatedAt': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory',
              'measurementFingerprint': data['fingerprint'],
              'dataSha256': hashlib.sha256(data_file.read_bytes()).hexdigest(),
              'baselineScoresSha256': hashlib.sha256(scores_file.read_bytes()).hexdigest(),
              'heldOut': {method: accuracy(held, method) for method in methods}, 'players': players,
              'recalledEpisodes': [row for row in held if row['earlierOwnBoard']], 'targetMet': False,
              'note': 'Explicit personal effort retrieval on exactly matching complete board hashes, across reordered level numbers. '
                      'Uses only earlier completed unassisted own episodes and local winning counts, with twenty-game decay. '
                      'No target outcome, other person, retained displayed counter or future episode may enter retrieval. '
                      'These repeatedly inspected historical games do not prove the frozen prospective goal; no cohort forecasts change.'}
    (OUTPUT / 'board-recall-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
