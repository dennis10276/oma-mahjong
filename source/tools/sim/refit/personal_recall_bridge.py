import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_full_choice_fit import probabilities
from personal_recall_fit import MODES, materialize
from personal_prefix_versions import select_prefixes, training_identity
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    model_file = ARCHIVE / 'personal-recall-models.json'
    bank = json.loads(model_file.read_bytes())
    for name, expected in bank['sourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Actual consistent-recall fitting source changed')
    for name, expected in bank['inputHashes'].items():
        if digest(ROOT / name) != expected:
            raise ValueError('Consistent-recall fitted input changed')
    prepared_file, base_file = ROOT / bank['preparedFile'], ROOT / bank['baseFile']
    prepared, base = [json.loads(path.read_bytes()) for path in (prepared_file, base_file)]
    references, future_prefixes, blocked_prefixes, decisions = [], 0, 0, 0
    for mode in MODES:
        data = materialize(base, prepared, mode)
        for actor in [actor for actor in bank['models'] if actor['retryMemoryMode'] == mode]:
            name = actor['name']
            diagnostic = bank['ownBlockedCalibration'][name][mode]
            excluded = diagnostic['excludedAids'] if actor['historicalExploratoryOnly'] else []
            training = select_prefixes(data, name, actor['trainingCut'], excluded, strict_observed=not actor['historicalExploratoryOnly'])
            identity, roster = training_identity(name, training)
            tagged = hashlib.sha256(json.dumps(['ownConsistentRecall-v1', mode, identity], separators=(',', ':')).encode()).hexdigest()
            if tagged != actor['id'] or sorted(game['aid'] for game in training) != actor['trainedAids']:
                raise ValueError('Recall bridge changed exact own training membership')
            if roster != sorted((row['aid'], row['availableAt'], row['versionSha256']) for row in actor['trainedVersions']):
                raise ValueError('Recall bridge changed an actual learned feature version')
            games = [game for game in data['players'][name] if game['aid'] in diagnostic['heldAids']] if actor['historicalExploratoryOnly'] else training
            kind = np.asarray([actor['kindModel']['weights'][kind] for kind in ('flip', 'pair', 'single', 'fatal')])
            within = np.asarray(actor['withinWeights'])
            for game in games:
                rows, loss, hits = [], 0., 0.
                for index, decision in enumerate(game['decisions']):
                    if decision['k'] < 0:
                        continue
                    values = probabilities(decision, kind, within)
                    ties = np.isclose(values, values.max(), rtol=1e-8, atol=1e-12)
                    loss -= math.log(max(1e-300, values[decision['k']]))
                    hits += float(ties[decision['k']]) / ties.sum()
                    rows.append({'index': index, 'probabilities': values.tolist()})
                count = len(rows)
                references.append({'name': name, 'mode': mode, 'modelId': actor['id'], 'aid': game['aid'],
                    'versionSha256': game['versionSha256'], 'historicalExploratoryOnly': actor['historicalExploratoryOnly'],
                    'scores': {'decisions': count, 'jointLogLoss': loss / count if count else None, 'topActionAccuracy': hits / count if count else None},
                    'decisions': rows})
                decisions += count
                if actor['historicalExploratoryOnly']:
                    blocked_prefixes += 1
                else:
                    future_prefixes += 1
    if future_prefixes != 1335 or blocked_prefixes != 240:
        raise ValueError('Recall native bridge lost a future training or blocked calibration prefix')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'targetMet': False,
        'evidence': 'own-consistent-recall-native-numerical-reference-only',
        'modelsSha256': digest(model_file), 'preparedSha256': digest(prepared_file), 'baseSha256': digest(base_file),
        'preparedFile': bank['preparedFile'], 'baseFile': bank['baseFile'], 'futureTrainingPrefixes': future_prefixes,
        'blockedCalibrationPrefixes': blocked_prefixes, 'probabilityDecisions': decisions, 'references': references,
        'note': 'Actual own model/version memberships and every native static probability vector. '
                'Training and blocked calibration scopes remain distinct. This is numerical implementation evidence, not whole winning-try accuracy.'}
    output = ARCHIVE / 'personal-recall-native.json'
    output.write_text(json.dumps(report), encoding='utf8')
    print(json.dumps({key: value for key, value in report.items() if key != 'references'}, indent=2))


if __name__ == '__main__':
    main()
