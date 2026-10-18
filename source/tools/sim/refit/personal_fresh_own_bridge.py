import json
from datetime import datetime, timezone
from pathlib import Path

from personal_outcome_styles import score_styles
from personal_prefix_versions import select_prefixes, training_identity
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    model_file = ARCHIVE / 'personal-fresh-own-models.json'
    bank_file = ARCHIVE / 'personal-prefix-versions.json'
    fitted, bank = [json.loads(path.read_bytes()) for path in [model_file, bank_file]]
    if fitted['bankSha256'] != digest(bank_file) or len(fitted['models']) != 4 or fitted['targetMet']:
        raise ValueError('Fresh runtime bridge lost its fitted personal inputs')
    sources = [Path(__file__), Path(__file__).with_name('personal_outcome_styles.py'),
               Path(__file__).with_name('personal_prefix_versions.py'), Path(__file__).with_name('personal_full_choice_fit.py')]
    source_hashes = {path.name: digest(path) for path in sources}
    input_hashes = {path.relative_to(ROOT).as_posix(): digest(path) for path in [model_file, bank_file]}
    players = {}
    for actor in fitted['models']:
        games = select_prefixes(bank, actor['name'], fitted['requestTime'], strict_observed=True)
        identity, roster = training_identity(actor['name'], games)
        if identity != actor['id'] or len(games) != actor['trainingGames'][actor['name']]:
            raise ValueError('Fresh runtime bridge changed own version membership')
        rows = [{'aid': game['aid'], 'versionSha256': game['versionSha256'],
                 'scores': {method: score_styles(game, actor, actor['outcomeStyles'], enabled)
                            for method, enabled in [('control', False), ('outcomeStyles', True)]}} for game in games]
        players[actor['name']] = {'id': identity, 'rows': rows}
    if (any(digest(path) != source_hashes[path.name] for path in sources)
            or any(digest(ROOT / name) != expected for name, expected in input_hashes.items())):
        raise ValueError('Fresh native bridge sources or inputs changed')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'fresh-personal-native-runtime-reference-only',
              'targetMet': False, 'sourceHashes': source_hashes, 'inputHashes': input_hashes, 'players': players,
              'prefixes': sum(len(player['rows']) for player in players.values()),
              'probabilityDecisions': sum(score['decisions'] for player in players.values() for row in player['rows'] for score in row['scores'].values()),
              'note': 'Numerical runtime reference on own fitting prefixes, NOT held action accuracy or winning-count evidence. '
                  'Four separate current own models; every prefix version was actually observed before the fitting request. '
                  'Original actor banks and numeric forecasts remain unchanged.'}
    (ROOT / 'analysis/personal-bots/personal-fresh-own-native-bridge.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({key: report[key] for key in ['prefixes', 'probabilityDecisions']}, indent=2))


if __name__ == '__main__':
    main()
