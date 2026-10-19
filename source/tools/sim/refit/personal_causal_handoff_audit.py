import argparse
import hashlib
import json
import math
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from attempt_count_fit import NAMES
from personal_known_plan_run import contained
from personal_value_fit import ARCHIVE, ROOT, digest
from progression_score import score_progression


PROTOCOL = 'causal-3bucket-physical-factor-v1'
LEDGER = 'analysis/personal-bots/personal-causal-factor-forecasts.jsonl'
FEATURES = 'analysis/personal-bots/personal-causal-factor-features.json'
EVALUATION = 'analysis/personal-bots/personal-causal-factor-evaluation.json'
PIDS = {
    'Dennisisdebeste': 'pmuy78xu6tsths9',
    'Mrs. Doubtfire': 'pmv16kj3jr35750',
    'PUK': 'pmv2gaa0g00eq3q',
    'Gerda': 'pmv6yhzz3x9oxs8',
}


def sha256_bytes(payload):
    return hashlib.sha256(payload).hexdigest()


def read_ledger(payload):
    snapshots = [json.loads(line) for line in payload.decode('utf-8').splitlines() if line.strip()]
    if not snapshots:
        raise ValueError('Missing original causal-factor numeric freeze')
    for snapshot in snapshots:
        frozen = snapshot.get('frozenAt')
        if (snapshot.get('model') != PROTOCOL or not isinstance(frozen, int) or isinstance(frozen, bool)
                or frozen <= 0 or snapshot.get('scope') != 'first-clear-progression-v1'):
            raise ValueError('Use one declared progression model with a real numeric freeze')
        seen = set()
        for forecast in snapshot['forecasts']:
            key = forecast['name'], forecast['lv'], forecast['board']
            prediction = forecast['predictedAttempt']
            if (key in seen or key[0] not in NAMES or not isinstance(key[1], int) or key[1] < 1
                    or not isinstance(key[2], str) or not key[2]
                    or not isinstance(prediction, int) or isinstance(prediction, bool) or prediction < 1):
                raise ValueError('Duplicate, unknown or invalid frozen numeric forecast')
            seen.add(key)
    return sorted(snapshots, key=lambda snapshot: snapshot['frozenAt'])


def progression_frontiers(plays, frozen_at):
    frontiers = {}
    for name, pid in PIDS.items():
        starts = [event for event in (plays.get(pid) or {}).values()
                  if event.get('k') == 'start' and event.get('m') != 'd' and not event.get('tk')]
        if (not starts or any(not isinstance(event.get('t'), (int, float)) or not math.isfinite(event['t'])
                              or event['t'] > frozen_at or not isinstance(event.get('lv'), int)
                              or event['lv'] < 1 for event in starts)):
            raise ValueError('Original live snapshot must establish each person\'s pre-freeze progression')
        frontiers[name] = max(event['lv'] for event in starts) + 1
    return frontiers


def score_frozen(snapshots, frozen_plays, outcomes, current_evaluation=None):
    anchor = min(snapshots, key=lambda snapshot: snapshot['frozenAt'])
    if outcomes.get('evidence') != 'separate-live-completed-and-pending-outcomes':
        raise ValueError('Independent causal scoring needs explicit completed and pending live outcomes')
    frontiers = progression_frontiers(frozen_plays, anchor['frozenAt'])
    report = score_progression(snapshots, outcomes['episodes'], frontiers)
    current = {(row['name'], row['lv'], row['board']): row['predictedAttempt']
               for row in (current_evaluation or {}).get('frozenFutureForecasts', [])}
    drift = []
    for forecast in anchor['forecasts']:
        key = forecast['name'], forecast['lv'], forecast['board']
        if key in current and current[key] != forecast['predictedAttempt']:
            drift.append({name: forecast[name] for name in ('name', 'lv', 'board', 'predictedAttempt')}
                         | {'currentRecomputedAttempt': current[key]})
    recomputed = (current_evaluation or {}).get('prospectiveCompletedEpisodes', [])
    report.update({
        'model': PROTOCOL,
        'observedAt': outcomes['observedAt'],
        'originalFrozenForecasts': len(anchor['forecasts']),
        'currentRecomputationDrift': drift,
        'recomputedEpisodesOpenedBeforeOriginalFreeze': [
            {key: row[key] for key in ('name', 'lv', 'start', 'end', 'wonOn')}
            for row in recomputed if row['start'] <= anchor['frozenAt']
        ],
        'originalModelSourceBoundInLedger': bool(anchor.get('sourceHashes')),
        'note': 'Scores only original numeric forecasts strictly before actual openings. Current-code predictions '
                'and retrospective held scores are diagnostic only. Frontiers derive from original frozen plays, '
                'not later outcomes or minimum forecasted levels. First20 includes pending, missing forecasts and '
                'unresolved boards; replays remain excluded. No existing numeric forecast is rewritten.',
    })
    return report


def preserve(source, destination):
    source = source.resolve()
    source_commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source.parent, text=True).strip()
    ledger_bytes = (source / LEDGER).read_bytes()
    snapshots = read_ledger(ledger_bytes)
    selected = {LEDGER, FEATURES, EVALUATION, 'analysis/personal-bots/CODEX_HANDOFF.md'}
    selected.update('tools/sim/refit/' + filename for filename in (
        'personal_causal_factor_head.py', 'personal_causal_factor_data.py', 'personal_causal_factor_sim.js'))
    for snapshot in snapshots:
        live_folder = contained(source, snapshot['liveSnapshot'])
        manifest_file = live_folder / 'manifest.json'
        if digest(manifest_file) != snapshot['liveManifestSha256']:
            raise ValueError('Original pre-freeze live manifest changed')
        manifest = json.loads(manifest_file.read_bytes())
        observed = datetime.fromisoformat(manifest['made'].replace('Z', '+00:00')).timestamp() * 1000
        if manifest.get('evidence') != 'read-only-live-opening-check' or observed >= snapshot['frozenAt']:
            raise ValueError('Original opening check must precede its numeric freeze')
        plays_file = live_folder / 'plays.json'
        if digest(plays_file) != manifest['files']['plays.json']:
            raise ValueError('Original frozen opening data changed')
        if digest(source / FEATURES) != snapshot['featureArchiveSha256']:
            raise ValueError('Causal feature archive differs from its original numeric freeze')
        selected.update(path.relative_to(source).as_posix() for path in (manifest_file, plays_file))
    files = {relative: digest(contained(source, relative)) for relative in sorted(selected)}
    if files[LEDGER] != sha256_bytes(ledger_bytes) or any(files[FEATURES] != snapshot['featureArchiveSha256'] for snapshot in snapshots):
        raise ValueError('Frozen ledger or feature table changed during audit setup')
    destination.mkdir(parents=True, exist_ok=False)
    for relative, expected in files.items():
        original, target = contained(source, relative), contained(destination, relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original, target)
        if digest(target) != expected or digest(original) != expected:
            raise ValueError('Handoff changed while being independently preserved')
    if subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source.parent, text=True).strip() != source_commit:
        raise ValueError('Handoff commit changed during preservation')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'independent-causal-handoff-audit-inputs',
                'sourceRoot': str(source), 'sourceCommit': source_commit, 'files': files, 'targetMet': False,
                'note': 'Immutable audit copy made now; does not backdate model-source provenance into the old ledger.'}
    (destination / 'audit-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    return manifest


def evaluate_snapshot(snapshot, outcomes_file):
    manifest_file = snapshot / 'audit-manifest.json'
    manifest = json.loads(manifest_file.read_bytes())
    if manifest.get('evidence') != 'independent-causal-handoff-audit-inputs':
        raise ValueError('Use an independently preserved audit bundle')
    for relative, expected in manifest['files'].items():
        if digest(contained(snapshot, relative)) != expected:
            raise ValueError('Preserved handoff audit input changed: ' + relative)
    snapshots = read_ledger((snapshot / LEDGER).read_bytes())
    anchor = snapshots[0]
    plays = json.loads((contained(snapshot, anchor['liveSnapshot']) / 'plays.json').read_bytes())
    outcomes = json.loads(outcomes_file.read_bytes())
    live_folder = outcomes_file.parent
    live_manifest = live_folder / 'manifest.json'
    current_manifest = json.loads(live_manifest.read_bytes())
    if (digest(live_manifest) != outcomes['liveManifestSha256']
            or digest(live_folder / 'plays.json') != outcomes['playsSha256']
            or outcomes['playsSha256'] != current_manifest['files']['plays.json']
            or current_manifest['made'] != outcomes['observedAt']):
        raise ValueError('Outcome export does not match its separate read-only live snapshot')
    observed = datetime.fromisoformat(outcomes['observedAt'].replace('Z', '+00:00')).timestamp() * 1000
    if current_manifest.get('evidence') != 'read-only-live-opening-check' or observed <= anchor['frozenAt']:
        raise ValueError('Scoring needs a separate live observation after the original freeze')
    report = score_frozen(snapshots, plays, outcomes, json.loads((snapshot / EVALUATION).read_bytes()))
    report.update({'evaluatedAt': datetime.now(timezone.utc).isoformat(), 'sourceCommit': manifest['sourceCommit'],
                   'auditSnapshot': str(snapshot.resolve()), 'auditManifestSha256': digest(manifest_file),
                   'ledgerSha256': digest(snapshot / LEDGER), 'outcomesSha256': digest(outcomes_file),
                   'scoringSourceHashes': {filename: digest(Path(__file__).parent / filename) for filename in (
                       Path(__file__).name, 'progression_score.py', 'prospective.py', 'attempt_count_fit.py')}})
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('outcomes', type=Path)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--source', type=Path)
    group.add_argument('--snapshot', type=Path)
    args = parser.parse_args()
    snapshot = args.snapshot
    if args.source:
        stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
        snapshot = ARCHIVE / ('gemini-handoff-audit-' + stamp)
        preserve(args.source, snapshot)
    report = evaluate_snapshot(snapshot.resolve(), args.outcomes.resolve())
    output = ROOT / 'analysis/personal-bots/gemini-frozen-prospective-results.json'
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'targetMet': report['targetMet'], 'snapshot': str(snapshot),
                      'observedAt': report['observedAt'], 'cohort': report['cohort'],
                      'drift': report['currentRecomputationDrift']}, indent=2))


if __name__ == '__main__':
    main()
