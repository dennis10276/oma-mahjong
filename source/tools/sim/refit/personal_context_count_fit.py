import hashlib
import json
from pathlib import Path

from personal_count_fit import main as fit_counts
from personal_value_fit import ARCHIVE, PINNED, ROOT, digest


def validate_count(data):
    fingerprint = hashlib.sha256()
    for name in data['fingerprintFiles']:
        fingerprint.update((ROOT / name).read_bytes())
    if fingerprint.hexdigest() != data['fingerprint']:
        raise ValueError('Context simulation sources changed before scoring')
    if not data.get('validUncensoredSimulation') or data.get('contextComputationCaps') != 0:
        raise ValueError('Computation boundaries are censored, not observed human failed tries')
    if data['controlChainsMatched'] != 2 * len(data['rows']) or len(data['comparisonEpisodes']) != 80:
        raise ValueError('Context evaluation lost fixed controls or new-level coverage')


def main():
    path = ARCHIVE / 'physical-context-count-data.json'
    raw_hash = digest(path)
    data = json.loads(path.read_bytes())
    validate_count(data)
    report_file = ROOT / 'analysis/personal-bots/physical-context-count-evaluation.json'
    scored_file = ARCHIVE / 'physical-context-count-scored.json'
    fit_counts(path, report_file, scored_file, True)
    originals = json.loads((PINNED / 'analysis/archive/personal-bots/physical-memory-count-scored.json').read_bytes())
    scored = json.loads(scored_file.read_bytes())
    controls = {(row['name'], row['start']): row['predictions']['controlForest'] for row in originals}
    measured = {(row['name'], row['start']): row['predictions']['controlForest'] for row in scored}
    if controls != measured:
        raise ValueError('Context count evaluation changed pinned control predictions or scored coverage')
    validate_count(data)
    if digest(path) != raw_hash:
        raise ValueError('Context count measurements changed during scoring')
    report = json.loads(report_file.read_bytes())
    report.update(controlPredictionsMatched=len(controls), controlChainsMatched=data['controlChainsMatched'],
                  contextComputationCaps=0, runtimeAuditSha256=data['runtimeAuditSha256'], actionModelSha256=data['actionModelSha256'])
    report_file.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {'selected': row['selectedBeforeTest'], 'score': row['selectedScore'], 'methods': row['methods']}
                      for name, row in report['players'].items()}, indent=2))


if __name__ == '__main__':
    main()
