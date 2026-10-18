import hashlib
import json
from pathlib import Path

from personal_count_fit import main as fit_counts
from personal_known_plan_count_snapshot import validate_count
from personal_value_fit import ARCHIVE, ROOT, digest


PARENT = ARCHIVE / 'experiments/personal-episode-full-2026-10-18T06-19-34-227Z'


def validate_sources(data):
    fingerprint = hashlib.sha256()
    for filename in data['fingerprintFiles']:
        fingerprint.update((ROOT / filename).read_bytes())
    if fingerprint.hexdigest() != data['fingerprint']:
        raise ValueError('Known-plan count sources changed before scoring')
    run_manifest = ROOT / 'run-manifest.json'
    if run_manifest.exists():
        manifest = json.loads(run_manifest.read_bytes())
        for filename, expected in manifest['sourceInputs'].items():
            if digest(ROOT / filename) != expected:
                raise ValueError('A copied frozen-run source input changed')


def main():
    data_file = ARCHIVE / 'physical-known-plan-count-data.json'
    data_hash = digest(data_file)
    data = json.loads(data_file.read_bytes())
    validate_count(data, 'scored')
    validate_sources(data)
    manifest = json.loads((PARENT / 'manifest.json').read_bytes())
    parent_file = PARENT / 'analysis/archive/personal-bots/physical-plan-count-data.json'
    scored_parent = PARENT / 'analysis/archive/personal-bots/physical-plan-count-scored.json'
    for path in [parent_file, scored_parent]:
        if digest(path) != manifest['files'][path.relative_to(PARENT).as_posix()]:
            raise ValueError('Known-plan immutable count-control parent changed')
    parent = json.loads(parent_file.read_bytes())
    if data['comparisonEpisodes'] != parent['comparisonEpisodes']:
        raise ValueError('Known-plan evaluation changed held new-level identities')
    before = {(row['name'], row['start']): row for row in parent['rows']}
    if len(before) != len(data['rows']) or len({(row['name'], row['start']) for row in data['rows']}) != len(before):
        raise ValueError('Known-plan evaluation lost or duplicated campaign coverage')
    for row in data['rows']:
        original = before[row['name'], row['start']]
        for field in ['lv', 'board', 'end', 'wonOn', 'firstAttempt', 'firstClear', 'physical', 'reference', 'assisted', 'openingRecorded', 'source']:
            if row[field] != original[field]:
                raise ValueError('Known-plan evaluation changed an old label or covariate')
        for profile in parent['profiles']:
            if row['chains'][profile] != original['chains'][profile]:
                raise ValueError('Known-plan evaluation changed a retained old-engine forecast feature')
    report_file = ROOT / 'analysis/personal-bots/physical-known-plan-count-evaluation.json'
    scored_file = ARCHIVE / 'physical-known-plan-count-scored.json'
    scoring_hashes = {path.name: digest(path) for path in [Path(__file__), Path(__file__).with_name('personal_known_plan_count_snapshot.py')]}
    fit_counts(data_file, report_file, scored_file, True)
    controls = {(row['name'], row['start']): row['predictions']['controlForest'] for row in json.loads(scored_parent.read_bytes())}
    measured = {(row['name'], row['start']): row['predictions']['controlForest'] for row in json.loads(scored_file.read_bytes())}
    if controls != measured or len(controls) != 252:
        raise ValueError('Known-plan scoring changed an immutable count-control prediction')
    validate_count(data, 'scored')
    validate_sources(data)
    if digest(data_file) != data_hash or any(digest(Path(__file__).with_name(name)) != expected for name, expected in scoring_hashes.items()):
        raise ValueError('Known-plan count data or scoring sources changed during scoring')
    report = json.loads(report_file.read_bytes())
    report.update(controlPredictionsMatched=len(controls), controlChainsMatched=552, knownPlanComputationCaps=0,
                  knownPlanModelsSha256=data['knownPlanModelsSha256'], knownPlanRuntimeAuditSha256=data['knownPlanRuntimeAuditSha256'],
                  retainedControlEngineSha256=data['retainedControlEngineSha256'], currentEngineSha256=data['currentEngineSha256'],
                  scoringSourceHashes=scoring_hashes,
                  pairedCurrentProfiles=['ownKnownZeroPlan8', 'ownKnownPlan8'])
    report_file.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {'selected': player['selectedBeforeTest'], 'score': player['selectedScore'], 'methods': player['methods']}
                      for name, player in report['players'].items()}, indent=2))


if __name__ == '__main__':
    main()
