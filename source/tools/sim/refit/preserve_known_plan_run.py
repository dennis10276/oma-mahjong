import json
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


RUN = ARCHIVE / 'runs/known-plan-2026-10-18T10-47-22-831Z'
NAME = 'personal-known-plan-count-scored-2026-10-18T15-09-37-493Z'


def inside(folder, name):
    resolved = (folder / name).resolve()
    if folder.resolve() not in resolved.parents:
        raise ValueError('Completed-run artifact path escapes its snapshot')
    return resolved


def main():
    source = RUN / 'analysis/archive/personal-bots/experiments' / NAME
    manifest_file = source / 'manifest.json'
    manifest = json.loads(manifest_file.read_bytes())
    if manifest['evidence'] != 'historical-exploratory-known-plan-count-scored' or manifest['targetMet']:
        raise ValueError('Expected completed historical scored evidence, not a success claim')
    for name, expected in manifest['externalPinnedDependencies'].items():
        if digest(inside(ROOT, name)) != expected:
            raise ValueError('Original immutable dependency differs from completed run: ' + name)
    for name, expected in manifest['files'].items():
        if digest(inside(source, name)) != expected:
            raise ValueError('Completed-run snapshot content changed: ' + name)
    destination = ARCHIVE / 'experiments' / NAME
    destination.mkdir()
    for name, expected in manifest['files'].items():
        target = inside(destination, name)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(inside(source, name).read_bytes())
        if digest(target) != expected:
            raise ValueError('Completed-run snapshot copy differs: ' + name)
    (destination / 'manifest.json').write_bytes(manifest_file.read_bytes())
    record = {'runRoot': RUN.relative_to(ROOT).as_posix(), 'sourceSnapshot': source.relative_to(ROOT).as_posix(),
              'snapshot': destination.relative_to(ROOT).as_posix(), 'manifestSha256': digest(manifest_file),
              'files': len(manifest['files']), 'dependencies': len(manifest['externalPinnedDependencies']),
              'originalScoringRule': 'actual-tolerance-v1',
              'note': 'Completed count data/control proof/scored predictions copied without changing any frozen source. '
                  'Legacy metric retained for252 numeric control checks; current8+ rescoring is a separate report, never an overwritten old forecast.'}
    (ROOT / 'analysis/personal-bots/known-plan-full-preservation.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(json.dumps(record, indent=2))


if __name__ == '__main__':
    main()
