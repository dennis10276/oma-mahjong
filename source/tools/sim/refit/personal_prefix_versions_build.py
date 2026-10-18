import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_prefix_versions import build_versions, select_prefixes, training_identity
from personal_value_fit import ARCHIVE, ROOT, digest
from public_plan_reference import load_reference


OLD = ARCHIVE / 'experiments/personal-context-actions-2026-10-18T01-55-11-704Z'
DATA_FILE = 'analysis/archive/personal-bots/policy-value-prefix-data.json'


def main(fresh):
    fresh = Path(fresh).resolve()
    if not fresh.is_relative_to((ARCHIVE / 'experiments').resolve()):
        raise ValueError('New prefix versions require an immutable local experiment source')
    old_data, old_reference = load_reference(OLD, DATA_FILE)
    fresh_data, fresh_reference = load_reference(fresh, DATA_FILE)
    references, inputs = [], {}
    for folder, data, reference in [(OLD, old_data, old_reference), (fresh, fresh_data, fresh_reference)]:
        manifest = json.loads((folder / 'manifest.json').read_bytes())
        observed_at = int(datetime.fromisoformat(manifest['made'].replace('Z', '+00:00')).timestamp() * 1000)
        references.append((data, {'id': reference['snapshot'], 'observedAt': observed_at}))
        inputs.update(reference['referenceHashes'])
    sources = [Path(__file__), Path(__file__).with_name('personal_prefix_versions.py'),
               Path(__file__).with_name('public_plan_reference.py')]
    source_hashes = {path.name: digest(path) for path in sources}
    bank = build_versions(references)
    bank.update(made=datetime.now(timezone.utc).isoformat(), evidence='immutable-multi-version-natural-prefixes',
                targetMet=False, referenceProofs=[old_reference, fresh_reference], inputHashes=inputs, sourceHashes=source_hashes,
                note='Immutable old/fresh versions coexist. A request selects one latest available own version perAID. '
                    'Strict prospective selection also requires that a saved source snapshot was actually observed before the request. '
                    'Client chunk t is local queue creation, not verified server upload; historical client-time-only selection '
                    'is explicitly exploratory and cannot establish genuine pre-start availability. '
                    'Earlier actor banks and forecast ledgers remain unchanged.')
    players = {}
    current_time = int(datetime.now(timezone.utc).timestamp() * 1000)
    for name, versions in bank['players'].items():
        selected = select_prefixes(bank, name, current_time, strict_observed=True)
        identity, roster = training_identity(name, selected)
        by_aid = {}
        for version in versions:
            by_aid.setdefault(version['aid'], []).append(version)
        players[name] = {'versions': len(versions), 'attempts': len(by_aid), 'strictProspectiveAttempts': len(selected),
                         'futureActorId': identity, 'availableThrough': max((game['availableAt'] for game in selected), default=None),
                         'inputObservedThrough': max((game['observedAt'] for game in selected), default=None),
                         'updatedAttempts': [{'aid': aid, 'versions': [{'availableAt': game['availableAt'],
                             'observedAt': game['observedAt'], 'ending': game.get('ending'), 'stopReason': game.get('stopReason'),
                             'decisions': len(game['decisions']), 'versionSha256': game['versionSha256']} for game in members]}
                             for aid, members in by_aid.items() if len(members) > 1]}
    if any(digest(ROOT / name) != expected for name, expected in inputs.items()) or any(digest(path) != source_hashes[path.name] for path in sources):
        raise ValueError('Prefix-version sources changed during assembly')
    bank_file = ARCHIVE / 'personal-prefix-versions.json'
    bank_file.write_text(json.dumps(bank, separators=(',', ':')), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': bank['evidence'], 'targetMet': False,
              'bankSha256': digest(bank_file), 'inputHashes': inputs, 'sourceHashes': source_hashes, 'players': players,
              'note': bank['note']}
    (ROOT / 'analysis/personal-bots/personal-prefix-versions-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(players, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('fresh')
    main(parser.parse_args().fresh)
