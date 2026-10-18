import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import personal_clock_intents as clock
import personal_clock_strategy as clock_context
import personal_tray_intents as tray
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    model_file = ARCHIVE / 'personal-tray-intents-models.json'
    bank = json.loads(model_file.read_bytes())
    data_file = ROOT / bank['dataFile']
    if digest(data_file) != bank['inputHashes'][bank['dataFile']]:
        raise ValueError('Joint intent reference lost its original annotation input')
    for name, expected in bank['sourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Joint intent fitter changed before runtime parity')
    data = json.loads(data_file.read_bytes())
    actor_file = ROOT / bank['staticActorSnapshot'] / 'analysis/archive/personal-bots/personal-fresh-own-models.json'
    if digest(actor_file) != bank['inputHashes'][actor_file.relative_to(ROOT).as_posix()]:
        raise ValueError('Joint intent reference changed its frozen own static actors')
    actors = json.loads(actor_file.read_bytes())['models']
    references = []
    for actor in actors:
        entry = next(entry for entry in bank['models'] if entry['id'] == actor['id'])
        if entry['historicalExploratoryOnly']:
            raise ValueError('Joint numerical reference needs actual future own models')
        for game in data['players'][actor['name']]:
            initial = 0 if game.get('initialNewLevel') else 1
            models = {'clock': entry['clockIntents'], 'tray': entry['trayIntents']}
            posterior = {phase: np.asarray(model['priors'][initial]) for phase, model in models.items()}
            previous, started, decisions = {'clock': None, 'tray': None}, {'clock': False, 'tray': False}, []
            for index, decision in enumerate(game['decisions']):
                if decision['k'] < 0:
                    continue
                phase = 'clock' if decision['kindContext'][11] > 0 else 'tray'
                module = clock if phase == 'clock' else tray
                context_module = clock_context if phase == 'clock' else tray
                model = models[phase]
                active = model['trainingClockChoices' if phase == 'clock' else 'trainingChoices'] > 0 and bool(np.any(
                    decision['knownPlan' if phase == 'clock' else 'trayPlan']))
                prior = posterior[phase]
                if active and started[phase]:
                    context = context_module.context_of(decision, previous[phase])
                    prior = posterior[phase] @ clock.transitions_of(context[None, :], model['switchWeights'])[0]
                values, components = module.predictive(decision, actor, model, prior)
                if active:
                    posterior[phase] = prior * components[decision['k']]
                    posterior[phase] /= posterior[phase].sum()
                    previous[phase] = context_module.observation_of(decision, decision['k'])
                    started[phase] = True
                decisions.append({'index': index, 'phase': phase, 'probabilities': values.tolist(),
                    'posteriorAfter': {name: values.tolist() for name, values in posterior.items()}})
            references.append({'name': actor['name'], 'aid': game['aid'], 'availableAt': game['availableAt'],
                               'modelId': actor['id'], 'decisions': decisions})
    report = {'made': datetime.now(timezone.utc).isoformat(), 'targetMet': False, 'evidence': 'native-joint-intent-reference-only',
        'dataFile': bank['dataFile'], 'dataSha256': digest(data_file), 'actorFile': actor_file.relative_to(ROOT).as_posix(),
        'actorSha256': digest(actor_file), 'modelsSha256': digest(model_file), 'references': references,
        'prefixes': len(references), 'decisions': sum(len(game['decisions']) for game in references),
        'note': 'Training-prefix probabilities and two isolated causal state vectors, not held count accuracy or future forecasts.'}
    (ARCHIVE / 'personal-joint-intents-native.json').write_text(json.dumps(report), encoding='utf8')
    print(json.dumps({key: value for key, value in report.items() if key != 'references'}, indent=2))


if __name__ == '__main__':
    main()
