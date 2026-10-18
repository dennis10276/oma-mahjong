import hashlib
import json
import math


FIELDS = ['aid', 'lv', 'at', 't', 'availableAt', 'stopReason', 'ending', 'complete',
          'initialNewLevel', 'reconstructed', 'memorySources']
DECISION_FIELDS = ['F', 'immediate', 'kindContext', 'k', 'tray', 'moves']


def semantic_prefix(game):
    prefix = {key: game[key] for key in FIELDS if key in game}
    if (not isinstance(game.get('aid'), str) or not game['aid'] or not math.isfinite(game['t'])
            or not math.isfinite(game['availableAt']) or not 0 < game['t'] <= game['availableAt']):
        raise ValueError('Invalid prefix version identity or availability')
    prefix['decisions'] = [{key: decision[key] for key in DECISION_FIELDS if key in decision}
                           for decision in game['decisions']]
    encoded = json.dumps(prefix, sort_keys=True, separators=(',', ':'), allow_nan=False)
    return json.loads(encoded), hashlib.sha256(encoded.encode()).hexdigest()


def build_versions(references):
    schema, players, provenance = None, {}, []
    for data, source in references:
        source_id = source['id'] if isinstance(source, dict) else source
        observed_at = source.get('observedAt') if isinstance(source, dict) else None
        if observed_at is not None and (not math.isfinite(observed_at) or observed_at <= 0):
            raise ValueError('Invalid real snapshot observation timestamp')
        current_schema = {key: data[key] for key in ['features', 'kindContextFeatures', 'base']}
        if schema is None:
            schema = current_schema
        elif schema != current_schema:
            raise ValueError('Prefix versions cannot mix different policy feature/prior schemas')
        provenance.append(source)
        for name, games in data['players'].items():
            versions = players.setdefault(name, {})
            for game in games:
                prefix, identity = semantic_prefix(game)
                key = (prefix['aid'], prefix['availableAt'])
                if key in versions and versions[key]['versionSha256'] != identity:
                    raise ValueError('Conflicting same-availability prefix versions: ' + name + '/' + prefix['aid'])
                if key not in versions:
                    versions[key] = {**prefix, 'versionSha256': identity, 'sources': [], 'observedAt': observed_at}
                elif observed_at is not None:
                    previous_observed = versions[key]['observedAt']
                    versions[key]['observedAt'] = min(observed_at, previous_observed) if previous_observed is not None else observed_at
                if source_id not in versions[key]['sources']:
                    versions[key]['sources'].append(source_id)
    if schema is None:
        raise ValueError('A prefix-version bank requires immutable source data')
    return {**schema, 'type': 'personalPrefixVersions-v1', 'references': provenance,
            'players': {name: sorted(versions.values(), key=lambda game: (game['availableAt'], game['aid']))
                        for name, versions in players.items()}}


def select_prefixes(bank, name, cutoff, excluded=(), strict_observed=False):
    if bank['type'] != 'personalPrefixVersions-v1' or name not in bank['players'] or not math.isfinite(cutoff):
        raise ValueError('Invalid own-person prefix-version request')
    excluded = set(excluded)
    selected = {}
    for game in bank['players'][name]:
        if game['aid'] in excluded or game['availableAt'] >= cutoff:
            continue
        if strict_observed and (game.get('observedAt') is None or game['observedAt'] >= cutoff):
            continue
        if any(source['aid'] in excluded or source['availableAt'] >= cutoff or source['availableAt'] >= game['t']
               for source in game.get('memorySources', [])):
            continue
        previous = selected.get(game['aid'])
        if previous is None or game['availableAt'] > previous['availableAt']:
            selected[game['aid']] = game
        elif game['availableAt'] == previous['availableAt'] and game['versionSha256'] != previous['versionSha256']:
            raise ValueError('Ambiguous same-time prefix version at selection')
    return sorted(selected.values(), key=lambda game: (game['availableAt'], game['aid']))


def training_identity(name, games):
    roster = sorted((game['aid'], game['availableAt'], game['versionSha256']) for game in games)
    if len({entry[0] for entry in roster}) != len(roster):
        raise ValueError('A person cannot train on multiple versions of one attempt at once')
    encoded = json.dumps(['ownAll-prefixVersions-v1', name, roster], separators=(',', ':'))
    return hashlib.sha256(encoded.encode()).hexdigest(), roster
