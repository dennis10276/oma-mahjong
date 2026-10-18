import json
from datetime import datetime, timezone

from attempt_count_fit import SCORING_RULE, is_correct
from personal_value_fit import ARCHIVE, ROOT, digest


BEFORE = ARCHIVE / 'experiments/prospective-score-2026-10-18T11-52-16-715Z'


def main():
    manifest_file = BEFORE / 'manifest.json'
    manifest = json.loads(manifest_file.read_bytes())
    names = ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective']
    comparisons = {}
    source_hashes = {manifest_file.relative_to(ROOT).as_posix(): digest(manifest_file)}
    for name in names:
        ledger_name = 'analysis/personal-bots/' + name + '-forecasts.json'
        report_name = 'analysis/personal-bots/' + name + '-results.json'
        if digest(ROOT / ledger_name) != manifest['files'][ledger_name] or digest(BEFORE / report_name) != manifest['files'][report_name]:
            raise ValueError('A frozen ledger or pre-rule-change report changed')
        before = json.loads((BEFORE / report_name).read_bytes())
        after = json.loads((ROOT / report_name).read_bytes())
        if after['scoringRule'] != SCORING_RULE or before['cohortStartsAfter'] != after['cohortStartsAfter']:
            raise ValueError('Scoring rule/version or original cohort anchor differs')
        if len(before['scored']) != len(after['scored']):
            raise ValueError('Rule change added or removed scored campaigns')
        additions = []
        for old, new in zip(before['scored'], after['scored']):
            if {key: value for key, value in old.items() if key != 'correct'} != {key: value for key, value in new.items() if key != 'correct'}:
                raise ValueError('Rule change modified a frozen prediction or observed campaign')
            predicted, actual = new['predictedAttempt'], new['wonOn']
            tolerance = 0 if actual <= 3 else 1 if actual <= 5 else 2
            if old['correct'] != (abs(predicted - actual) <= tolerance) or new['correct'] != is_correct(predicted, actual):
                raise ValueError('Old/new scored flags do not match the declared rules')
            if old['correct'] and not new['correct']:
                raise ValueError('Shared bucket removed a previously correct prediction')
            if new['correct'] != old['correct']:
                if predicted < 8 or actual < 8:
                    raise ValueError('A rule-change benefit was not an8+ pair')
                additions.append({'name': new['name'], 'lv': new['lv'], 'start': new['start'], 'predictedAttempt': predicted, 'wonOn': actual})
        for player, old in before['cohort'].items():
            new = after['cohort'][player]
            if any(old[field] != new[field] for field in ['opened', 'completed', 'eligibleFrozenForecasts', 'pending', 'missingForecastsOrOpening']):
                raise ValueError('Rule change reset a cohort or removed an unfinished/missing forecast')
            if before['players'][player].get('exactAccuracy') != after['players'][player].get('exactAccuracy'):
                raise ValueError('Rule change altered exact numeric predictions or outcomes')
        for file in [ROOT / ledger_name, ROOT / report_name, BEFORE / report_name]:
            source_hashes[file.relative_to(ROOT).as_posix()] = digest(file)
        comparisons[name] = {'scoredCampaignsUnchanged': len(after['scored']), 'additionalCorrect8plusPairs': additions,
                             'beforeCohort': before['cohort'], 'afterCohort': after['cohort'], 'targetMet': after['targetMet']}
    for name in ['attempt_scoring_change_audit.py', 'attempt_count_fit.py', 'prospective.py', 'progression_score.py', 'progression_forecasts.py']:
        file = ROOT / 'tools/sim/refit' / name
        source_hashes[file.relative_to(ROOT).as_posix()] = digest(file)
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'user-authorized-score-rule-change',
              'scoringRule': SCORING_RULE, 'targetMet': comparisons['progression-prospective']['targetMet'],
              'beforeSnapshot': BEFORE.relative_to(ROOT).as_posix(), 'sourceHashes': source_hashes, 'comparisons': comparisons,
              'note': 'User explicitly added shared8+ success (e.g. prediction9, actual12) after the original forecasts. '
                  'The original reports/rule remain pinned. Numeric forecasts, actual local winning tries, cohort anchors, '
                  'all misses/openings/missing forecasts and every ledger are retained. Only correctness is rescored; '
                  'this is not a retroactive new forecast or a claim that the original metric was8+.'}
    (ROOT / 'analysis/personal-bots/attempt-scoring-change-audit.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {'campaigns': value['scoredCampaignsUnchanged'], 'additional8plusHits': len(value['additionalCorrect8plusPairs']),
                            'targetMet': value['targetMet']} for name, value in comparisons.items()}, indent=2))


if __name__ == '__main__':
    main()
