import hashlib
import json
from pathlib import Path

from personal_count_fit import main as fit_counts
from personal_value_fit import ARCHIVE, ROOT, digest


PARENT = ARCHIVE / 'experiments/personal-context-full-2026-10-18T05-17-41-214Z'


def validate_plan_count(data):
    fingerprint = hashlib.sha256()
    for name in data['fingerprintFiles']:
        fingerprint.update((ROOT / name).read_bytes())
    if fingerprint.hexdigest() != data['fingerprint']:
        raise ValueError('Episode simulation sources changed before scoring')
    if data.get('runs') != 32 or data.get('attempts') != 32 or not data.get('validUncensoredSimulation') or data.get('planComputationCaps') != 0:
        raise ValueError('Pilot or censored episode simulations cannot be treated as human winning tries')
    if len(data['rows']) != 276 or data['controlChainsMatched'] != 828 or len(data['comparisonEpisodes']) != 80:
        raise ValueError('Episode evaluation lost fixed controls or new-level coverage')
    total = 0
    for row in data['rows']:
        caps = row.get('planComputationCaps')
        if not isinstance(caps, dict) or len(caps) != 5 or any(type(value) is not int or value < 0 for value in caps.values()):
            raise ValueError('Missing or invalid episode computation boundary counters')
        total += sum(caps.values())
        for profile in caps:
            if row['chains'][profile].get('computationCensored', 0) != caps[profile]:
                raise ValueError('Episode trace censoring differs from boundary counters')
    if total:
        raise ValueError('Individual episode computation boundaries cannot be hidden by an aggregate flag')


def main():
    path = ARCHIVE / 'physical-plan-count-data.json'
    raw_hash = digest(path)
    data = json.loads(path.read_bytes())
    validate_plan_count(data)
    parent_path = PARENT / 'analysis/archive/personal-bots/physical-context-count-data.json'
    manifest = json.loads((PARENT / 'manifest.json').read_bytes())
    if digest(parent_path) != manifest['files'][parent_path.relative_to(PARENT).as_posix()]:
        raise ValueError('Immutable episode count controls changed')
    parent = json.loads(parent_path.read_bytes())
    if data['comparisonEpisodes'] != parent['comparisonEpisodes']:
        raise ValueError('Episode evaluation changed the held new-level cohort')
    before = {(row['name'], row['start']): row for row in parent['rows']}
    if len(before) != len(data['rows']):
        raise ValueError('Episode evaluation changed campaign coverage')
    for row in data['rows']:
        original = before[row['name'], row['start']]
        for field in ['lv', 'board', 'end', 'wonOn', 'firstAttempt', 'firstClear', 'physical', 'reference', 'assisted', 'openingRecorded', 'source']:
            if row[field] != original[field]:
                raise ValueError('Episode evaluation changed old labels or covariates')
        for profile in parent['profiles']:
            if row['chains'][profile] != original['chains'][profile]:
                raise ValueError('Episode evaluation changed a retained old control chain')
    report_file = ROOT / 'analysis/personal-bots/physical-plan-count-evaluation.json'
    scored_file = ARCHIVE / 'physical-plan-count-scored.json'
    fit_counts(path, report_file, scored_file, True)
    scored_path = PARENT / 'analysis/archive/personal-bots/physical-context-count-scored.json'
    if digest(scored_path) != manifest['files'][scored_path.relative_to(PARENT).as_posix()]:
        raise ValueError('Immutable episode count-control points changed')
    controls = {(row['name'], row['start']): row['predictions']['controlForest'] for row in json.loads(scored_path.read_bytes())}
    measured = {(row['name'], row['start']): row['predictions']['controlForest'] for row in json.loads(scored_file.read_bytes())}
    if controls != measured:
        raise ValueError('Episode count scoring changed pinned control predictions/coverage')
    validate_plan_count(data)
    if digest(path) != raw_hash:
        raise ValueError('Episode measurements changed during count scoring')
    report = json.loads(report_file.read_bytes())
    report.update(controlPredictionsMatched=len(controls), controlChainsMatched=828, planComputationCaps=0,
                  planModelsSha256=data['planModelsSha256'], planRuntimeAuditSha256=data['planRuntimeAuditSha256'])
    report_file.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {'selected': row['selectedBeforeTest'], 'score': row['selectedScore'], 'methods': row['methods']}
                      for name, row in report['players'].items()}, indent=2))


if __name__ == '__main__':
    main()
