import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_full_choice_fit import fit_person, prior_of
from personal_kind_fit import encode
from personal_outcome_styles import fit_styles
from personal_plan_fit import pinned_read
from personal_prefix_versions import select_prefixes, training_identity
from personal_value_fit import ARCHIVE, PINNED, ROOT, digest


def main():
    bank_file = ARCHIVE / 'personal-prefix-versions.json'
    bank_hash = digest(bank_file)
    bank = json.loads(bank_file.read_bytes())
    if bank['type'] != 'personalPrefixVersions-v1' or bank['targetMet']:
        raise ValueError('Fresh own fitting requires the immutable multi-version prefix bank')
    for filename, expected in bank['inputHashes'].items():
        if digest(ROOT / filename) != expected:
            raise ValueError('Fresh own fitting reference source changed')
    for name, expected in bank['sourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Prefix-version builder source changed before own fitting')
    request = int(datetime.now(timezone.utc).timestamp() * 1000)
    sources = {Path(__file__).resolve()}
    for module in sys.modules.values():
        filename = getattr(module, '__file__', None)
        if filename and Path(filename).resolve().parent == Path(__file__).resolve().parent:
            sources.add(Path(filename).resolve())
    source_hashes = {path.name: digest(path) for path in sources}
    old_bank_file = PINNED / 'analysis/archive/personal-bots/physical-memory-policy-bank.json'
    previous = pinned_read(PINNED, old_bank_file.relative_to(PINNED).as_posix())
    old_actors = [actor for actor in previous['models'] if actor['scope'] == 'ownAll']
    models, players = [], {}
    progress = ROOT / 'analysis/personal-bots/personal-fresh-own-fit-progress.jsonl'
    progress.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'request': request, 'players': list(bank['players'])}) + '\n', encoding='utf-8')
    for name in bank['players']:
        games = select_prefixes(bank, name, request, strict_observed=True)
        identity, roster = training_identity(name, games)
        if not games or any(game['availableAt'] >= request or game['observedAt'] >= request for game in games):
            raise ValueError('Fresh own actor used an unavailable current prefix version')
        kind, within, count = fit_person(games, request, prior_of(bank), len(bank['kindContextFeatures']))
        actor = {'id': identity, 'name': name, 'scope': 'ownAll', 'trainingCut': request,
                 'availableThrough': max(game['availableAt'] for game in games),
                 'inputObservedThrough': max(game['observedAt'] for game in games),
                 'trainingGames': {name: count}, 'trainedAids': sorted(game['aid'] for game in games),
                 'trainedVersions': [{'aid': aid, 'availableAt': available, 'versionSha256': version} for aid, available, version in roster],
                 'kindModel': encode(kind), 'withinWeights': within.tolist(), 'jointChoice': False,
                 'retryMemoryMode': 'none', 'physicalSingleStep': False}
        style = fit_styles(games, actor)
        old = max((actor for actor in old_actors if actor['name'] == name), key=lambda actor: actor['trainingGames'][name])
        unchanged_membership = actor['trainedAids'] == sorted(old['trainedAids'])
        maximum_difference = max(np.max(np.abs(np.asarray(actor['withinWeights']) - old['withinWeights'])),
            max(np.max(np.abs(np.asarray(actor['kindModel']['weights'][kind]) - old['kindModel']['weights'][kind]))
                for kind in actor['kindModel']['weights']))
        if unchanged_membership and maximum_difference > 1e-10:
            raise ValueError('An unchanged own-person training set changed its static actor controls')
        players[name] = {'trainingGames': count, 'previousTrainingGames': old['trainingGames'][name],
                         'newOwnAttempts': len(set(actor['trainedAids']) - set(old['trainedAids'])),
                         'availableThrough': actor['availableThrough'], 'inputObservedThrough': actor['inputObservedThrough'],
                         'unchangedMembershipControlMatched': unchanged_membership, 'maximumStaticWeightChange': float(maximum_difference),
                         'naturalOutcomeCounts': {str(label): sum(game['label'] == label for game in style['labelledGames']) for label in [0, 1]},
                         'censoredOutcomePrefixes': style['censoredGames'], 'initialRetryPriors': style['priors']}
        models.append({**actor, 'outcomeStyles': style})
        with progress.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps({'name': name, **players[name]}) + '\n')
    if (digest(bank_file) != bank_hash or any(digest(path) != source_hashes[path.name] for path in sources)
            or any(digest(ROOT / filename) != expected for filename, expected in bank['inputHashes'].items())):
        raise ValueError('Fresh own model inputs or fitting sources changed during fitting')
    model_file = ARCHIVE / 'personal-fresh-own-models.json'
    made = datetime.now(timezone.utc).isoformat()
    output = {'made': made, 'evidence': 'fresh-future-only-own-model-fit', 'targetMet': False, 'personalOnly': True,
              'requestTime': request, 'bankSha256': bank_hash, 'sourceHashes': source_hashes,
              'inputHashes': {bank_file.relative_to(ROOT).as_posix(): bank_hash,
                              old_bank_file.relative_to(ROOT).as_posix(): digest(old_bank_file), **bank['inputHashes']},
              'models': models, 'note': 'Independent own-person fits from latest versions actually observed before this request. '
                  'A later completion never overwrites an earlier version. Replay-local behavior may train the actor; '
                  'new-progression winning-count scoring remains separate. Outcome-associated styles are not guaranteed outcomes. '
                  'The level150 bee correction is preserved as human feedback, not a rewritten action or hidden positive target label. '
                  'No historical target is rescored with these post-target models, and no80% result is claimed.'}
    model_file.write_text(json.dumps(output), encoding='utf-8')
    report = {key: value for key, value in output.items() if key != 'models'} | {
        'modelsSha256': digest(model_file), 'players': players,
        'beeFeedbackUsedAsSyntheticTargetLabel': False,
        'readiness': 'awaiting immutable runtime parity, autonomous counts and genuine future freezes'}
    (ROOT / 'analysis/personal-bots/personal-fresh-own-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(players, indent=2))


if __name__ == '__main__':
    main()
