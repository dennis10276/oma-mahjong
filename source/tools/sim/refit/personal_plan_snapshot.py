import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    report_file = ROOT / 'analysis/personal-bots/personal-plan-action-evaluation.json'
    report = json.loads(report_file.read_bytes())
    if report['targetMet'] or report['evidence'] != 'historical-exploratory-personal-episode-actions' or not report['personalOnly']:
        raise ValueError('Episode action snapshot must preserve exploratory scope')
    model_file = ARCHIVE / 'personal-plan-models.json'
    if digest(model_file) != report['modelsSha256'] or report['models'] != 276:
        raise ValueError('Episode model bank changed before snapshot')
    dependencies = {}
    for name, expected in report['inputHashes'].items():
        if digest(ROOT / name) != expected:
            raise ValueError('Episode input changed before snapshot')
        base, remainder = name.split('/experiments/', 1)
        experiment, relative = remainder.split('/', 1)
        parent = ROOT / base / 'experiments' / experiment
        manifest_file = parent / 'manifest.json'
        manifest = json.loads(manifest_file.read_bytes())
        if manifest['files'][relative] != expected:
            raise ValueError('Episode input differs from immutable parent manifest')
        dependencies[name] = expected
        dependencies[manifest_file.relative_to(ROOT).as_posix()] = digest(manifest_file)
    for name, expected in report['fitSourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Episode fit source changed before snapshot')
    context = ARCHIVE / 'experiments/personal-context-full-2026-10-18T05-17-41-214Z'
    context_manifest = json.loads((context / 'manifest.json').read_bytes())
    runtime_name = 'analysis/personal-bots/personal-context-runtime-audit.json'
    if digest(ROOT / runtime_name) != context_manifest['files'][runtime_name]:
        raise ValueError('Referenced runtime parity differs from the immutable context experiment')
    dependencies[(context / runtime_name).relative_to(ROOT).as_posix()] = digest(context / runtime_name)
    dependencies[(context / 'manifest.json').relative_to(ROOT).as_posix()] = digest(context / 'manifest.json')
    files = {path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ['.js', '.py', '.md']}
    files.update([report_file.relative_to(ROOT).as_posix(), model_file.relative_to(ROOT).as_posix(),
                  'www/hard.js', 'www/layouts.js', 'tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/personal-plan-fit-output.txt', 'analysis/personal-bots/personal-plan-fit-progress.jsonl',
                  'analysis/personal-bots/personal-context-runtime-audit.json',
                  'analysis/personal-bots/progression-prospective-results.json'])
    files.update('analysis/personal-bots/' + name + '-forecasts.json' for name in
                 ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective'])
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-episode-actions-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        source = ROOT / name
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(source):
            raise ValueError('Episode source changed during snapshot')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': report['evidence'], 'targetMet': False,
                'winningCountMeasurement': 'not-run', 'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': 'Independent own-person whole-attempt preference mixtures and earlier observed failure-conditioned retry transitions. '
                        'Held supplied-action likelihood and retry filtering are behavioral diagnostics, not autonomous new-level forecasts. '
                        'Original control summaries and numeric ledgers remain unchanged. No episode runtime/count test, release or future80% success is established.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(folder, len(files), 'pinned files,', len(dependencies), 'explicit immutable dependencies')


if __name__ == '__main__':
    main()
