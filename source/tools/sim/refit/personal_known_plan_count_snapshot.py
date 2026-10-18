import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


PROFILES = ['ownKnownZeroPlan8', 'ownKnownPlan8']


def validate_count(data, mode):
    pilot = mode == 'pilot'
    if data['targetMet'] or data['runs'] != (2 if pilot else 32) or data['attempts'] != (3 if pilot else 32):
        raise ValueError('Known-plan count snapshot has unsupported accuracy or sampling scope')
    if len(data['rows']) != 276 or data['controlChainsMatched'] != 552 or len(data['comparisonEpisodes']) != 80:
        raise ValueError('Known-plan count snapshot changed fixed cohort or old-engine control coverage')
    if pilot and data.get('optimizedCurrentChainsMatched') != 552:
        raise ValueError('Optimized pilot must preserve both preregistered current-engine chains on every board')
    caps = 0
    for row in data['rows']:
        statistics = row['stats'] if pilot else row['knownPlanStats']
        if set(statistics) != set(PROFILES):
            raise ValueError('Known-plan count snapshot lost paired policy statistics')
        for profile in PROFILES:
            value = statistics[profile]['contextChoiceLimits']
            if type(value) is not int or value < 0 or row['chains'][profile].get('computationCensored', 0) != value:
                raise ValueError('Known-plan computation censoring is missing or inconsistent')
            caps += value
    aggregate = data['computationCaps'] if pilot else data['knownPlanComputationCaps']
    if caps != aggregate or mode != 'censored' and caps:
        raise ValueError('Known-plan computation boundaries cannot be hidden or scored as human failures')
    if not pilot and data['validUncensoredSimulation'] != (caps == 0):
        raise ValueError('Known-plan simulation quality flag differs from per-row boundaries')
    if mode == 'censored' and not caps:
        raise ValueError('Censored snapshot requires an actual computation boundary')


def main(mode):
    feature_mode = mode in ['fast', 'bits', 'fast-failed']
    name = ('analysis/personal-bots/personal-known-plan-fast-failed-audit.json' if mode == 'fast-failed' else
            'analysis/personal-bots/personal-known-plan-' + mode + '-runtime-audit.json' if mode in ['fast', 'bits'] else
            'analysis/personal-bots/personal-known-plan-count-throughput-audit.json' if mode == 'pilot' else
            'analysis/archive/personal-bots/physical-known-plan-' + ('censored-' if mode == 'censored' else '') + 'count-data.json')
    data = json.loads((ROOT / name).read_bytes())
    if mode == 'fast-failed':
        if data['targetMet'] or data['evidence'] != 'verified-worker-import-assertion-failure':
            raise ValueError('Failed feature snapshot cannot claim successful parity')
    elif mode in ['fast', 'bits']:
        if data['targetMet'] or data['prefixes'] != 398 or data['totals']['calls'] != 33543:
            raise ValueError('Optimized planning snapshot lost exact feature/physics coverage')
    else:
        validate_count(data, mode)
    fingerprint = hashlib.sha256()
    for filename in data['fingerprintFiles']:
        if feature_mode:
            fingerprint.update(filename.encode())
        fingerprint.update((ROOT / filename).read_bytes())
    if fingerprint.hexdigest() != data['fingerprint']:
        raise ValueError('Known-plan count sources or raw inputs changed before preservation')
    files = set(data['fingerprintFiles'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ['.js', '.py', '.md'])
    files.update([name, 'tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/known-plan-tests-output.txt', 'analysis/personal-bots/progression-prospective-results.json',
                  *([] if feature_mode else ['analysis/personal-bots/personal-known-plan-runtime-audit.json',
                                              'analysis/personal-bots/personal-known-plan-runtime-output.txt']),
                  *(['analysis/personal-bots/personal-known-plan-' + mode + '-progress.jsonl',
                     'analysis/personal-bots/personal-known-plan-' + mode + '-output.txt',
                     'analysis/personal-bots/known-plan-fast-tests-output.txt'] if feature_mode else
                    ['analysis/personal-bots/personal-known-plan-count-' + ('pilot' if mode == 'pilot' else 'full') + '-progress.jsonl',
                     'analysis/personal-bots/personal-known-plan-count-' + ('pilot' if mode == 'pilot' else 'full') + '-output.txt'])])
    files.update('analysis/personal-bots/' + name + '-forecasts.json' for name in
                 ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective'])
    if mode == 'scored':
        report_file = ROOT / 'analysis/personal-bots/physical-known-plan-count-evaluation.json'
        report = json.loads(report_file.read_bytes())
        if report['targetMet'] or report['dataSha256'] != digest(ROOT / name) or report['controlPredictionsMatched'] != 252:
            raise ValueError('Known-plan scored report differs from completed paired measurement')
        files.update([report_file.relative_to(ROOT).as_posix(), 'analysis/archive/personal-bots/physical-known-plan-count-scored.json',
                      'analysis/personal-bots/personal-known-plan-count-fit-output.txt'])
    dependencies = {}
    for filename in list(files):
        if '/experiments/' in filename:
            dependencies[filename] = digest(ROOT / filename)
            files.remove(filename)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-known-plan-count-' + mode + '-' + stamp)
    folder.mkdir()
    hashes = {}
    for filename in sorted(files):
        destination = folder / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / filename).read_bytes())
        hashes[filename] = digest(destination)
        if hashes[filename] != digest(ROOT / filename):
            raise ValueError('Known-plan count source changed during snapshot')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-known-plan-count-' + mode,
                'targetMet': False, 'winningCountMeasurement': 'historical-only' if mode == 'scored' else 'not-scored',
                'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': 'Paired repaired-engine own-person planning and zero-residual policies; retained old forecasts are explicitly old-engine controls. '
                        'All276 boards and80 held new-level IDs remain unchanged, with552 exact immutable old-engine chains. '
                        'Planning unknowns are not losses; computation-censored chains cannot establish accuracy. '
                        'Pilot and historical retuning cannot satisfy the genuinely pre-opening frozen future80% goal. '
                        'All original forecast numbers and failed prospective cohort clocks remain unchanged.'}
    if mode in ['fast', 'bits']:
        manifest['note'] = ('Exact runtime equivalence on398 unchanged prefixes and33,543 planning vectors/physical frames. '
                            'Node counts and bounded uncertainty remain identical. No new winning-count measurement, cohort selection or forecast is claimed. '
                            'This feature-only snapshot is not a complete runnable count input closure.')
    if mode == 'fast-failed':
        manifest['note'] = 'Verified worker-import assertion failure; matching sources and failed progress are preserved, not claimed as feature parity or winning-count evidence.'
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(folder, len(files), 'pinned files,', len(dependencies), 'explicit immutable dependencies')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['pilot', 'counts', 'scored', 'censored', 'fast', 'bits', 'fast-failed'])
    main(parser.parse_args().mode)
