import json

from personal_value_fit import ARCHIVE, ROOT, digest
from preserve_known_plan_run import inside


RUN = ARCHIVE / 'runs/known-plan-2026-10-18T15-26-08-976Z'
NAME = 'personal-outcome-styles-scored-2026-10-18T15-48-20-154Z'


def main():
    source = RUN / 'analysis/archive/personal-bots/experiments' / NAME
    manifest_file = source / 'manifest.json'
    manifest = json.loads(manifest_file.read_bytes())
    if manifest['evidence'] != 'historical-exploratory-outcome-styles-scored' or manifest['targetMet']:
        raise ValueError('Expected completed exploratory outcome-style scored evidence')
    for name, expected in manifest['externalPinnedDependencies'].items():
        if digest(inside(ROOT, name)) != expected:
            raise ValueError('Outcome-style immutable dependency differs from the completed run')
    for name, expected in manifest['files'].items():
        if digest(inside(source, name)) != expected:
            raise ValueError('Completed outcome-style snapshot content changed')
    destination = ARCHIVE / 'experiments' / NAME
    destination.mkdir()
    for name, expected in manifest['files'].items():
        target = inside(destination, name)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(inside(source, name).read_bytes())
        if digest(target) != expected:
            raise ValueError('Completed outcome-style snapshot copy differs')
    (destination / 'manifest.json').write_bytes(manifest_file.read_bytes())
    report = json.loads((destination / 'analysis/personal-bots/physical-outcome-styles-count-evaluation.json').read_bytes())
    record = {'runRoot': RUN.relative_to(ROOT).as_posix(), 'sourceSnapshot': source.relative_to(ROOT).as_posix(),
              'snapshot': destination.relative_to(ROOT).as_posix(), 'manifestSha256': digest(manifest_file),
              'files': len(manifest['files']), 'dependencies': len(manifest['externalPinnedDependencies']),
              'scoringRule': report['scoringRule'], 'controlChainsMatched': report['controlChainsMatched'],
              'unchangedLegacyNumericControlPredictions': 252 - len(report['v2ReoptimizedControlDifferences']),
              'selectedCorrectOf20': {name: player['selectedScore']['correct'] for name, player in report['players'].items()},
              'targetMet': False, 'note': 'Completed276-board/80-ID full32-run/32-try paired outcome-style counts, '
                  'zero caps and scored evidence copied without mutating frozen sources. No selected forecaster reaches80%; '
                  'all252 original legacy numeric controls also remain identical under the v2 rule. No prospective promotion.'}
    (ROOT / 'analysis/personal-bots/outcome-styles-full-preservation.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(json.dumps(record, indent=2))


if __name__ == '__main__':
    main()
