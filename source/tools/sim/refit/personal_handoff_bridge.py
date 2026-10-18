import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_handoff import HandoffState
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    model_file = ARCHIVE / 'personal-handoff-models.json'
    bank = json.loads(model_file.read_bytes())
    for name, expected in bank['sourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Actual handoff fitting source changed before runtime parity')
    sources = [ROOT / bank[name] for name in ('dataFile', 'baseFile', 'futureActorFile')]
    for source in sources:
        if digest(source) != bank['inputHashes'][source.relative_to(ROOT).as_posix()]:
            raise ValueError('Handoff native reference changed an actual fitted input')
    data, base_bank, actor_bank = [json.loads(source.read_bytes()) for source in sources]
    references, cues = [], 0
    for actor in actor_bank['models']:
        entry = next(entry for entry in bank['models'] if entry['id'] == actor['id'])
        if entry['historicalExploratoryOnly']:
            raise ValueError('Native handoff reference needs actual future own models')
        base_model = next(entry for entry in base_bank['models'] if entry['id'] == actor['id'])
        for game in data['players'][actor['name']]:
            state = HandoffState(actor, base_model, entry['handoff'], bool(game.get('initialNewLevel')))
            decisions = []
            for index, decision in enumerate(game['decisions']):
                if decision['k'] < 0:
                    state.previous = None
                    continue
                evaluated = state.evaluate(decision)
                cues += evaluated['cue'] is not None
                state.observe(decision, decision['k'], evaluated)
                decisions.append({'index': index, 'probabilities': evaluated['values'].tolist(),
                    'cueType': evaluated['cue']['type'] if evaluated['cue'] else None,
                    'posteriorAfter': {phase: values.tolist() for phase, values in state.posterior().items()},
                    'previousAfter': state.previous})
            references.append({'name': actor['name'], 'aid': game['aid'], 'availableAt': game['availableAt'], 'modelId': actor['id'], 'decisions': decisions})
    report = {'made': datetime.now(timezone.utc).isoformat(), 'targetMet': False, 'evidence': 'native-personal-handoff-reference-only',
        'dataFile': bank['dataFile'], 'baseFile': bank['baseFile'], 'actorFile': bank['futureActorFile'],
        'dataSha256': digest(sources[0]), 'baseSha256': digest(sources[1]), 'actorSha256': digest(sources[2]),
        'modelsSha256': digest(model_file), 'references': references, 'prefixes': len(references),
        'decisions': sum(len(reference['decisions']) for reference in references), 'cueOpportunities': cues,
        'note': 'Training-prefix numerical probabilities only. previousAfter stores the last action’s pre-action public descriptor. '
                'No hidden target or future winning label enters autonomous history; this does not prove80% winning-count accuracy.'}
    filename = ARCHIVE / 'personal-handoff-native.json'
    filename.write_text(json.dumps(report), encoding='utf8')
    print(json.dumps({key: value for key, value in report.items() if key != 'references'}, indent=2))


if __name__ == '__main__':
    main()
