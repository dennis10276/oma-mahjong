import json
from pathlib import Path

from personal_count_fit import main as fit_counts
from personal_outcome_styles_snapshot import PARENT, validate_count, verify_fingerprint
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    data_file = ARCHIVE / 'physical-outcome-styles-count-data.json'
    data = json.loads(data_file.read_bytes())
    validate_count(data)
    verify_fingerprint(data)
    sources = [Path(__file__), *[Path(__file__).with_name(name) for name in [
        'personal_outcome_styles_snapshot.py', 'personal_count_fit.py', 'attempt_count_fit.py',
        'attempt_hazard.py', 'board_recall_eval.py']]]
    source_hashes = {path.name: digest(path) for path in sources}
    data_hash = digest(data_file)
    report_file = ROOT / 'analysis/personal-bots/physical-outcome-styles-count-evaluation.json'
    scored_file = ARCHIVE / 'physical-outcome-styles-count-scored.json'
    fit_counts(data_file, report_file, scored_file, own_only=True)
    if data_hash != digest(data_file) or any(digest(path) != source_hashes[path.name] for path in sources):
        raise ValueError('Outcome-style count scoring inputs changed')
    verify_fingerprint(data)
    scored = json.loads(scored_file.read_bytes())
    parent_file = PARENT / 'analysis/archive/personal-bots/physical-known-plan-count-scored.json'
    manifest = json.loads((PARENT / 'manifest.json').read_bytes())
    if digest(parent_file) != manifest['files'][parent_file.relative_to(PARENT).as_posix()]:
        raise ValueError('Immutable prior numeric control forecasts changed')
    original = {(row['name'], row['start']): row for row in json.loads(parent_file.read_bytes())}
    if len(scored) != 252 or {(row['name'], row['start']) for row in scored} != set(original):
        raise ValueError('Outcome-style count scoring changed original campaign coverage')
    differences = []
    for row in scored:
        previous = original[row['name'], row['start']]
        if row['wonOn'] != previous['wonOn'] or row['board'] != previous['board']:
            raise ValueError('Outcome-style scoring changed a label or board')
        if row['predictions']['controlForest'] != previous['predictions']['controlForest']:
            differences.append({'name': row['name'], 'start': row['start'],
                                'legacy': previous['predictions']['controlForest'], 'v2': row['predictions']['controlForest']})
    report = json.loads(report_file.read_bytes())
    report.update(controlChainsMatched=276, computationCaps=0, scoringSourceHashes=source_hashes,
                  originalNumericControlPredictionsRetained=252, v2ReoptimizedControlDifferences=differences,
                  note=report['note'] + ' Earlier legacy numeric predictions remain in their immutable parent. '
                      'This new historical fit optimizes the authorized8+ v2 rule; changed numeric control choices '
                      'are reported explicitly, never misrepresented as unchanged old forecasts. All252 campaign labels/boards are fixed.')
    report_file.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {'selected': player['selectedBeforeTest'], 'score': player['selectedScore']}
                      for name, player in report['players'].items()}, indent=2))


if __name__ == '__main__':
    main()
