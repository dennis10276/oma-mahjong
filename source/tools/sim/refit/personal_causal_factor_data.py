import argparse
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from attempt_count_fit import NAMES, SCORING_RULE, accuracy, is_correct
from personal_causal_factor_head import (
    FACTOR_NAMES,
    FEATURE_ARCHIVE,
    RAW_FEATURE_NAMES,
    ROOT,
    choose_bucket3_action,
    feature_dict_of,
    is_severe_trap,
    predict_causal_3bucket,
    regime_zscore,
    z_to_factors,
)
from personal_fresh_count_fit import eligible, past_of, target_eligible


FRESH_DATA = ROOT / 'analysis/archive/personal-bots/physical-fresh-count-data.json'
EVAL_OUTPUT = ROOT / 'analysis/personal-bots/personal-causal-factor-evaluation.json'
FORECAST_LEDGER = ROOT / 'analysis/personal-bots/personal-causal-factor-forecasts.jsonl'
PIDS = {
    'Dennisisdebeste': 'pmuy78xu6tsths9',
    'Mrs. Doubtfire': 'pmv16kj3jr35750',
    'PUK': 'pmv2gaa0g00eq3q',
    'Gerda': 'pmv6yhzz3x9oxs8',
}


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _matches_expected_hash(path, expected):
    raw = Path(path).read_bytes()
    return (
        hashlib.sha256(raw).hexdigest() == expected
        or hashlib.sha256(raw.replace(b'\r\n', b'\n')).hexdigest() == expected
    )


def verify_unchanged_prior_ledgers():
    tail_audit = json.loads((ROOT / 'analysis/personal-bots/predictive-tail-audit.json').read_text(encoding='utf-8'))
    verified = {}
    for name, expected in tail_audit['ledgerHashesUnchanged'].items():
        rel = f'analysis/personal-bots/{name}-forecasts.json'
        if not _matches_expected_hash(ROOT / rel, expected):
            raise ValueError(f'Prior forecast ledger changed: {rel}')
        verified[rel] = expected
    fresh_ledger_rel = 'analysis/personal-bots/personal-fresh-forecasts.jsonl'
    fresh_manifest = ROOT / 'analysis/archive/personal-bots/experiments/personal-fresh-count-scored-2026-10-18T16-19-59-198Z/manifest.json'
    if fresh_manifest.exists():
        expected_fresh = json.loads(fresh_manifest.read_text(encoding='utf-8'))['files'][fresh_ledger_rel]
        if not _matches_expected_hash(ROOT / fresh_ledger_rel, expected_fresh):
            raise ValueError(f'Prior experimental jsonl ledger changed: {fresh_ledger_rel}')
        verified[fresh_ledger_rel] = expected_fresh
    return verified


def validate_feature_archive(archive_path=FEATURE_ARCHIVE, fresh_path=FRESH_DATA):
    fresh_bytes = fresh_path.read_bytes()
    fresh = json.loads(fresh_bytes)
    payload = json.loads(archive_path.read_text(encoding='utf-8'))
    if payload.get('protocol') != 'causal-3bucket-physical-factor-v1':
        raise ValueError('Unexpected causal factor feature protocol')
    if not payload.get('personalOnly') or not payload.get('publicOpeningOnly'):
        raise ValueError('Causal factor features must be personalOnly and publicOpeningOnly')
    if payload.get('parentDataSha256') != hashlib.sha256(fresh_bytes).hexdigest():
        raise ValueError('Causal factor feature archive does not match physical-fresh-count-data.json SHA-256')
    if tuple(payload.get('rawFeatureNames', ())) != RAW_FEATURE_NAMES:
        raise ValueError('Causal factor feature names do not match RAW_FEATURE_NAMES')
    by_start = payload.get('byStart', {})
    by_level_board = payload.get('byLevelBoard', {})
    for row in fresh['rows']:
        key = f"{row['name']}|{row['start']}|{row['board']}"
        if key not in by_start:
            raise ValueError(f'Missing historical/recent causal factor entry: {key}')
        entry = by_start[key]
        if set(entry['features'].keys()) != set(RAW_FEATURE_NAMES):
            raise ValueError(f'Incomplete feature set for {key}')
    for row in fresh['future']:
        key = f"{row['name']}|lv={row['lv']}|{row['board']}"
        if key not in by_level_board:
            raise ValueError(f'Missing future causal factor entry: {key}')
        entry = by_level_board[key]
        if set(entry['features'].keys()) != set(RAW_FEATURE_NAMES):
            raise ValueError(f'Incomplete feature set for {key}')
    return {
        'archiveSha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(),
        'parentDataSha256': payload['parentDataSha256'],
        'byStartCount': len(by_start),
        'byLevelBoardCount': len(by_level_board),
        'rawFeatureCount': len(RAW_FEATURE_NAMES),
    }


def evaluate_causal_factor_head(fresh_path=FRESH_DATA, output_path=EVAL_OUTPUT):
    summary = validate_feature_archive(FEATURE_ARCHIVE, fresh_path)
    unchanged_ledgers = verify_unchanged_prior_ledgers()
    fresh = json.loads(fresh_path.read_text(encoding='utf-8'))
    rows = fresh['rows']
    held_ids = set(fresh['comparisonEpisodes'])
    recent_ids = set(fresh['additionalRecentIds'])
    scored_rows = [
        r for r in rows if target_eligible(r) and r.get('wonOn') is not None and len(past_of(rows, r)) >= 6
    ]

    dev_cohort, held_cohort, recent_cohort = [], [], []
    for name in NAMES:
        p_rows = sorted([r for r in scored_rows if r['name'] == name], key=lambda r: r['start'])
        p_held = [r for r in p_rows if f"{r['name']}|{r['start']}" in held_ids]
        p_dev = [r for r in p_rows if r['start'] < p_held[0]['start']][-25:]
        p_rec = [r for r in p_rows if f"{r['name']}|{r['start']}" in recent_ids]
        for cohort_list, subset in ((dev_cohort, p_dev), (held_cohort, p_held), (recent_cohort, p_rec)):
            for r in subset:
                bef = past_of(rows, r)
                pred = predict_causal_3bucket(bef, r)
                cohort_list.append({
                    'name': r['name'],
                    'lv': r['lv'],
                    'start': r['start'],
                    'end': r['end'],
                    'board': r['board'],
                    'wonOn': r['wonOn'],
                    'predictions': {'ownCausalFactor3Bucket': pred, 'alwaysFirst': 1},
                    'correct': bool(is_correct(pred, r['wonOn'])),
                })

    prosp_res = json.loads((ROOT / 'analysis/personal-bots/personal-fresh-prospective-results.json').read_text(encoding='utf-8'))
    all_rows_plus = list(rows)
    future_by_key = {(r['name'], r['lv'], r['board']): r for r in fresh['future']}
    prosp_scored = []
    for ep in sorted(prosp_res['scored'], key=lambda x: x['start']):
        if ep.get('wonOn') is None:
            continue
        base = future_by_key[ep['name'], ep['lv'], ep['board']]
        row = {
            **base,
            'start': ep['start'],
            'end': ep['end'],
            'wonOn': ep['wonOn'],
            'firstAttempt': 1,
            'firstClear': True,
            'assisted': bool(ep.get('assisted', False)),
            'kind': 'prospective',
        }
        all_rows_plus.append(row)
        bef = past_of(all_rows_plus, row)
        pred = predict_causal_3bucket(bef, row)
        prosp_scored.append({
            'name': ep['name'],
            'lv': ep['lv'],
            'start': ep['start'],
            'end': ep['end'],
            'board': ep['board'],
            'wonOn': ep['wonOn'],
            'predictions': {'ownCausalFactor3Bucket': pred, 'alwaysFirst': 1},
            'correct': bool(is_correct(pred, ep['wonOn'])),
        })

    completed_keys = {(ep['name'], ep['lv']) for ep in prosp_scored}
    frozen_future = []
    for f_row in sorted(fresh['future'], key=lambda x: (x['name'], x['lv'])):
        bef = past_of(all_rows_plus, {**f_row, 'start': float('inf')})
        pred = predict_causal_3bucket(bef, {**f_row, 'start': float('inf')})
        clean_bef = [r for r in bef if not is_severe_trap(feature_dict_of(r))]
        z_t = regime_zscore(clean_bef, f_row, win_size=25)
        f_t = z_to_factors(z_t)
        frozen_future.append({
            'name': f_row['name'],
            'lv': f_row['lv'],
            'version': f_row['version'],
            'board': f_row['board'],
            'modelId': f_row['modelId'],
            'alreadyCompletedInProspective': (f_row['name'], f_row['lv']) in completed_keys,
            'predictedAttempt': int(pred),
            'bucket3Action': int(choose_bucket3_action(bef, f_row)),
            'severeTrap': bool(is_severe_trap(feature_dict_of(f_row))),
            'factors': {fn: round(float(f_t[i]), 4) for i, fn in enumerate(FACTOR_NAMES)},
        })

    cohort_metrics = lambda items: {
        name: {
            method: accuracy([r for r in items if r['name'] == name], method)
            for method in ('ownCausalFactor3Bucket', 'alwaysFirst')
        }
        for name in NAMES
    }

    held_players = cohort_metrics(held_cohort)
    held_target_met = all(
        held_players[name]['ownCausalFactor3Bucket']['n'] == 20
        and held_players[name]['ownCausalFactor3Bucket']['accuracy'] >= 0.80
        for name in NAMES
    )

    report = {
        'made': datetime.now(timezone.utc).isoformat(),
        'protocol': 'causal-3bucket-physical-factor-v1',
        'scoringRule': SCORING_RULE,
        'personalOnly': True,
        'publicOpeningOnly': True,
        'heldBenchmarkTargetMet': held_target_met,
        'archiveValidation': summary,
        'unchangedPriorLedgers': unchanged_ledgers,
        'devPlayers': cohort_metrics(dev_cohort),
        'heldPlayers': held_players,
        'recentPlayers': cohort_metrics(recent_cohort),
        'prospectiveCompletedPlayers': cohort_metrics(prosp_scored),
        'heldEpisodes': held_cohort,
        'recentEpisodes': recent_cohort,
        'prospectiveCompletedEpisodes': prosp_scored,
        'frozenFutureForecasts': frozen_future,
    }
    output_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


def freeze_live_forecasts(live_dir, eval_report=None, ledger_path=FORECAST_LEDGER):
    live_dir = Path(live_dir).resolve()
    manifest = json.loads((live_dir / 'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('evidence') != 'read-only-live-opening-check':
        raise ValueError('Live snapshot must be a read-only-live-opening-check')
    plays_bytes = (live_dir / 'plays.json').read_bytes()
    if hashlib.sha256(plays_bytes).hexdigest() != manifest['files']['plays.json']:
        raise ValueError('Live plays.json hash mismatch')
    plays = json.loads(plays_bytes)
    if eval_report is None:
        eval_report = evaluate_causal_factor_head()
    unchanged_ledgers = verify_unchanged_prior_ledgers()

    opened_by_player = {}
    for name, pid in PIDS.items():
        events = list((plays.get(pid) or {}).values())
        opened_lvs = {
            int(ev['lv'])
            for ev in events
            if ev.get('k') == 'start' and ev.get('m') != 'd' and not ev.get('tk') and 'lv' in ev
        }
        opened_by_player[name] = opened_lvs

    unopened_forecasts = []
    omitted_opened = []
    for item in eval_report['frozenFutureForecasts']:
        if item['lv'] in opened_by_player[item['name']]:
            omitted_opened.append({'name': item['name'], 'lv': item['lv'], 'reason': 'already-opened-in-live-check'})
        else:
            unopened_forecasts.append({**item, 'upcoming': True, 'numericForecastFrozen': True})

    frozen_at = int(time.time() * 1000)
    snapshot = {
        'frozenAt': frozen_at,
        'made': datetime.now(timezone.utc).isoformat(),
        'model': 'causal-3bucket-physical-factor-v1',
        'scope': 'first-clear-progression-v1',
        'personalOnly': True,
        'publicOpeningOnly': True,
        'heldBenchmarkTargetMet': eval_report['heldBenchmarkTargetMet'],
        'liveSnapshot': live_dir.relative_to(ROOT).as_posix(),
        'liveManifestSha256': sha256_file(live_dir / 'manifest.json'),
        'featureArchiveSha256': sha256_file(FEATURE_ARCHIVE),
        'unchangedPriorLedgers': unchanged_ledgers,
        'unopenedForecastCount': len(unopened_forecasts),
        'omittedAlreadyOpened': omitted_opened,
        'forecasts': unopened_forecasts,
    }
    ledger_path.write_text(json.dumps(snapshot) + '\n', encoding='utf-8')
    return snapshot


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, default=FEATURE_ARCHIVE)
    parser.add_argument('--data', type=Path, default=FRESH_DATA)
    parser.add_argument('--evaluate', action='store_true')
    parser.add_argument('--freeze-live', type=Path, default=None)
    args = parser.parse_args()
    if args.evaluate or args.freeze_live:
        rep = evaluate_causal_factor_head(args.data, EVAL_OUTPUT)
        if args.freeze_live:
            snap = freeze_live_forecasts(args.freeze_live, rep, FORECAST_LEDGER)
            print(json.dumps({'frozenAt': snap['frozenAt'], 'unopenedForecastCount': snap['unopenedForecastCount']}, indent=2))
        else:
            print(json.dumps({
                'heldBenchmarkTargetMet': rep['heldBenchmarkTargetMet'],
                'heldPlayers': {n: rep['heldPlayers'][n]['ownCausalFactor3Bucket'] for n in NAMES},
                'recentPlayers': {n: rep['recentPlayers'][n]['ownCausalFactor3Bucket'] for n in NAMES},
                'prospectiveCompletedPlayers': {n: rep['prospectiveCompletedPlayers'][n]['ownCausalFactor3Bucket'] for n in NAMES},
            }, indent=2))
    else:
        print(json.dumps(validate_feature_archive(args.archive, args.data), indent=2))
