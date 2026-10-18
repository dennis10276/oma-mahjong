import json
from datetime import datetime, timezone

from attempt_count_fit import SCORING_RULE, accuracy, is_correct
from personal_value_fit import ARCHIVE, ROOT, digest


SNAPSHOT = ARCHIVE / 'experiments/personal-known-plan-count-scored-2026-10-18T15-09-37-493Z'


def main():
    manifest_file = SNAPSHOT / 'manifest.json'
    manifest = json.loads(manifest_file.read_bytes())
    names = ['analysis/archive/personal-bots/physical-known-plan-count-data.json',
             'analysis/archive/personal-bots/physical-known-plan-count-scored.json',
             'analysis/personal-bots/physical-known-plan-count-evaluation.json']
    for name in names:
        if digest(SNAPSHOT / name) != manifest['files'][name]:
            raise ValueError('Completed known-plan data or original predictions changed')
    data, scored, before = [json.loads((SNAPSHOT / name).read_bytes()) for name in names]
    if (data['knownPlanComputationCaps'] or before['controlPredictionsMatched'] != 252
            or before['controlChainsMatched'] != 552 or len(scored) != 252):
        raise ValueError('Completed known-plan fixed prediction controls are missing or censored')
    held_ids = set(data['comparisonEpisodes'])
    held = [row for row in scored if row['name'] + '|' + str(row['start']) in held_ids]
    if len(held) != 80 or len({row['name'] + '|' + str(row['start']) for row in held}) != 80:
        raise ValueError('Fixed8+ rescoring changed the original held new-level cohort')
    players, additions = {}, []
    for player, previous in before['players'].items():
        rows = [row for row in held if row['name'] == player]
        if len(rows) != 20:
            raise ValueError('Fixed8+ rescoring lost a person\'s20 held games')
        methods = {}
        for method, old_score in previous['methods'].items():
            legacy_correct = sum(abs(row['predictions'][method] - row['wonOn'])
                                 <= (0 if row['wonOn'] <= 3 else 1 if row['wonOn'] <= 5 else 2) for row in rows)
            if old_score['n'] != 20 or old_score['correct'] != legacy_correct:
                raise ValueError('Original fixed count-control scores differ from preserved predictions')
            methods[method] = accuracy(rows, method)
            if methods[method]['exactAccuracy'] != old_score['exactAccuracy'] or methods[method]['meanAbsoluteError'] != old_score['meanAbsoluteError']:
                raise ValueError('Fixed8+ rescoring changed a numeric forecast or outcome')
            for row in rows:
                predicted, actual = row['predictions'][method], row['wonOn']
                tolerance = 0 if actual <= 3 else 1 if actual <= 5 else 2
                if is_correct(predicted, actual) and abs(predicted - actual) > tolerance:
                    if predicted < 8 or actual < 8:
                        raise ValueError('Non-bucket benefit appeared during fixed8+ rescoring')
                    additions.append({'name': player, 'lv': row['lv'], 'start': row['start'], 'method': method,
                                      'predictedAttempt': predicted, 'wonOn': actual})
        selected = previous['selectedBeforeTest']
        players[player] = {'selectedBeforeTestUnchanged': selected, 'selectedScore': methods[selected], 'methods': methods}
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-fixed-predictions-rescored',
              'targetMet': False, 'scoringRule': SCORING_RULE, 'originalScoringRule': 'actual-tolerance-v1',
              'sourceSnapshot': SNAPSHOT.relative_to(ROOT).as_posix(), 'manifestSha256': digest(manifest_file),
              'sourceHashes': {(SNAPSHOT / name).relative_to(ROOT).as_posix(): digest(SNAPSHOT / name) for name in names},
              'heldIds': data['comparisonEpisodes'], 'players': players, 'additional8plusHits': additions,
              'historicalSelectedThresholdMet': all(value['selectedScore']['accuracy'] >= 0.8 for value in players.values()),
              'controlPredictionsMatched': 252, 'controlChainsMatched': 552, 'computationCaps': 0,
              'note': 'Original numeric predictions, labels,80 held IDs and pre-held method choices remain unchanged. '
                  'Only the user-authorized8+ correctness rule is reapplied. No forecaster is reoptimized or reselected on target labels. '
                  'This is historical development evidence, not genuinely frozen future80% success.'}
    (ROOT / 'analysis/personal-bots/physical-known-plan-count-8plus-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {'selected': value['selectedBeforeTestUnchanged'], 'score': value['selectedScore']}
                      for name, value in players.items()}, indent=2))


if __name__ == '__main__':
    main()
