import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_clock_intents import predictive, transitions_of
from personal_clock_strategy import context_of, observation_of, strategy_features
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    model_file = ARCHIVE / 'personal-clock-intents-models.json'
    bank = json.loads(model_file.read_bytes())
    data_file = ROOT / bank['annotationSnapshot'] / 'analysis/archive/personal-bots/personal-fresh-clock-prefixes.json'
    actor_file = ROOT / bank['staticActorSnapshot'] / 'analysis/archive/personal-bots/personal-fresh-own-models.json'
    for filename in (data_file, actor_file):
        if digest(filename) != bank['inputHashes'][filename.relative_to(ROOT).as_posix()]:
            raise ValueError('Clock intent native reference lost a pinned fitting input')
    for name, expected in bank['sourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Clock intent fitting source changed before numerical parity')
    data = json.loads(data_file.read_bytes())
    actors = json.loads(actor_file.read_bytes())['models']
    references = []
    for actor in actors:
        entry = next(entry for entry in bank['models'] if entry['id'] == actor['id'])
        if entry['historicalExploratoryOnly']:
            raise ValueError('Native intent reference requires actual future models')
        model = entry['clockIntents']
        for game in data['players'][actor['name']]:
            posterior = np.asarray(model['priors'][0 if game.get('initialNewLevel') else 1])
            previous, started, decisions = None, False, []
            for index, decision in enumerate(game['decisions']):
                if decision['k'] < 0:
                    continue
                active = model['trainingClockChoices'] > 0 and bool(np.any(strategy_features(decision)))
                prior = posterior
                if active and started:
                    prior = posterior @ transitions_of(context_of(decision, previous)[None, :], model['switchWeights'])[0]
                values, components = predictive(decision, actor, model, prior)
                if active:
                    posterior = prior * components[decision['k']]
                    posterior /= posterior.sum()
                    previous = observation_of(decision, decision['k'])
                    started = True
                decisions.append({'index': index, 'probabilities': values.tolist(), 'posteriorAfter': posterior.tolist()})
            references.append({'name': actor['name'], 'aid': game['aid'], 'availableAt': game['availableAt'],
                               'modelId': actor['id'], 'decisions': decisions})
    report = {'made': datetime.now(timezone.utc).isoformat(), 'targetMet': False, 'evidence': 'native-persistent-intent-reference-only',
        'dataSha256': digest(data_file), 'modelsSha256': digest(model_file), 'dataFile': data_file.relative_to(ROOT).as_posix(),
        'actorFile': actor_file.relative_to(ROOT).as_posix(), 'actorSha256': digest(actor_file), 'references': references,
        'prefixes': len(references), 'decisions': sum(len(game['decisions']) for game in references),
        'note': 'Training-prefix forward-filter references only, not winning-count accuracy or actual past forecast evidence.'}
    (ARCHIVE / 'personal-clock-intents-native.json').write_text(json.dumps(report), encoding='utf8')
    print(json.dumps({key: value for key, value in report.items() if key != 'references'}, indent=2))


if __name__ == '__main__':
    main()
