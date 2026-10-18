import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_clock_strategy import context_of, observation_of, predictive, strategy_features, transition_probabilities
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    data_file = ARCHIVE / 'personal-fresh-clock-prefixes.json'
    model_file = ARCHIVE / 'personal-fresh-clock-models.json'
    data, bank = [json.loads(filename.read_bytes()) for filename in (data_file, model_file)]
    if digest(data_file) != bank['dataSha256']:
        raise ValueError('Native clock bridge lost its fitted public annotation source')
    for name, expected in bank['sourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Actual clock fitting source changed before native/runtime parity')
    fits = ARCHIVE / 'experiments/personal-fresh-own-fits-2026-10-18T15-59-12-900Z'
    actors = json.loads((fits / 'analysis/archive/personal-bots/personal-fresh-own-models.json').read_bytes())['models']
    references = []
    for actor in actors:
        entry = next(model for model in bank['models'] if model['id'] == actor['id'])
        if entry['historicalExploratoryOnly']:
            raise ValueError('Native bridge requires the actually available future clock models')
        model = entry['clockStrategy']
        for game in data['players'][actor['name']]:
            posterior = np.asarray(model['priors'][0 if game.get('initialNewLevel') else 1])
            previous, started, decisions = None, False, []
            for index, decision in enumerate(game['decisions']):
                if decision['k'] < 0:
                    continue
                active = bool(np.any(strategy_features(decision)))
                prior = posterior
                if active and started:
                    prior = posterior @ transition_probabilities(context_of(decision, previous)[None, :], model['switchWeights'])[0]
                values, emission = predictive(decision, actor, model, prior)
                if active:
                    posterior = prior * emission[decision['k']]
                    posterior /= posterior.sum()
                    previous = observation_of(decision, decision['k'])
                    started = True
                decisions.append({'index': index, 'probabilities': values.tolist(), 'posteriorAfter': posterior.tolist()})
            references.append({'name': actor['name'], 'aid': game['aid'], 'availableAt': game['availableAt'],
                               'modelId': actor['id'], 'decisions': decisions})
    output = {'made': datetime.now(timezone.utc).isoformat(), 'targetMet': False, 'evidence': 'native-clock-numerical-reference-only',
              'dataSha256': digest(data_file), 'modelsSha256': digest(model_file), 'references': references,
              'prefixes': len(references), 'decisions': sum(len(game['decisions']) for game in references),
              'note': 'Training-prefix numerical references only; no held count accuracy or future outcome is inferred.'}
    filename = ARCHIVE / 'personal-fresh-clock-native.json'
    filename.write_text(json.dumps(output), encoding='utf8')
    print(json.dumps({key: value for key, value in output.items() if key != 'references'}, indent=2))


if __name__ == '__main__':
    main()
