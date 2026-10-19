import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_attention import AttentionState, adjusted, fit_attention
from personal_fresh_clock_fit import checked_training
from personal_value_fit import ARCHIVE, ROOT, digest


def main(variant='clipped'):
    if variant not in ('clipped', 'log'):
        raise ValueError('Unknown attention feature variant')
    prefix = 'personal-attention' + ('-log' if variant == 'log' else '')
    strength_limit = None if variant == 'log' else 3.
    request = int(datetime.now(timezone.utc).timestamp() * 1000)
    models_file, native_file = ARCHIVE / (prefix + '-models.json'), ARCHIVE / (prefix + '-native.json')
    if models_file.exists() or native_file.exists():
        raise ValueError('Preserve completed attention fits; do not overwrite them')
    inputs = {}
    def read(relative):
        filename = ROOT / relative
        inputs[relative] = digest(filename)
        return json.loads(filename.read_bytes())
    native_path = 'analysis/archive/personal-bots/personal-joint-intents-native.json'
    native = read(native_path)
    data = read(native['dataFile'])
    base_file = 'analysis/archive/personal-bots/personal-tray-intents-models.json'
    base = read(base_file)
    actors = read(native['actorFile'])['models']
    if (inputs[native['dataFile']] != native['dataSha256'] or inputs[base_file] != native['modelsSha256']
            or inputs[native['actorFile']] != native['actorSha256']):
        raise ValueError('Attention must use the verified current-own joint offsets')
    references = {(row['modelId'], row['aid'], row['availableAt']): row for row in native['references']}
    source_files = [Path(__file__), Path(__file__).with_name('personal_attention.py'), Path(__file__).with_name('personal_prefix_versions.py'),
                    Path(__file__).with_name('personal_fresh_clock_fit.py'), Path(__file__).with_name('personal_value_fit.py')]
    source_hashes = {path.name: digest(path) for path in source_files}
    runtime_hashes = {name: digest(Path(__file__).with_name(name)) for name in ('personal_attention_choice.js', 'personal_tempered_choice.js')}
    models, expected = [], []
    for actor in actors:
        if actor.get('historicalExploratoryOnly') or actor['trainingCut'] >= request:
            raise ValueError('Attention fitting is future-only for completed current-own actors')
        games = checked_training(data, actor)
        samples = []
        for age, game in enumerate(reversed(games)):
            state = AttentionState(strength_limit)
            reference = references[actor['id'], game['aid'], game['availableAt']]
            if len(reference['decisions']) != len(game['decisions']) or game['availableAt'] >= request:
                raise ValueError('Attention history is incomplete or unavailable at the actual fit request')
            for decision, cached in zip(game['decisions'], reference['decisions']):
                features = state.features(decision)
                if np.any(features):
                    samples.append((cached['probabilities'], features, decision['k'], .5 ** (age / 20)))
                state.observe(decision, decision['k'])
        attention = fit_attention(samples, strength_limit)
        attention.update(availableThrough=max(game['availableAt'] for game in games), trainedAids=sorted(game['aid'] for game in games),
                         trainingPrefixes=len(games), prefixRecencyHalfLife=20)
        model = {'id': actor['id'], 'name': actor['name'], 'historicalExploratoryOnly': False, 'attention': attention}
        models.append(model)
        for game in games:
            state = AttentionState(strength_limit)
            reference = references[actor['id'], game['aid'], game['availableAt']]
            decisions = []
            for index, (decision, cached) in enumerate(zip(game['decisions'], reference['decisions'])):
                features = state.features(decision)
                probabilities = adjusted(cached['probabilities'], features, attention['weights'])
                decisions.append({'index': index, 'strengths': features[:, 0].tolist(), 'probabilities': probabilities.tolist()})
                state.observe(decision, decision['k'])
            expected.append({key: reference[key] for key in ('name', 'aid', 'availableAt', 'modelId')} | {'decisions': decisions})
        print(json.dumps({'name': actor['name'], 'weights': attention['weights'], 'opportunities': attention['trainingOpportunities'],
                          'regularizedNllGain': attention['regularizedLossBefore'] - attention['regularizedLossAfter']}), flush=True)
    if sum(len(row['decisions']) for row in expected) != 39268 or len(expected) != 445:
        raise ValueError('Attention fitting lost frozen own training membership')
    for relative, expected_hash in inputs.items():
        if digest(ROOT / relative) != expected_hash:
            raise ValueError('Attention fitting input changed')
    for filename, expected_hash in {**source_hashes, **runtime_hashes}.items():
        if digest(Path(__file__).with_name(filename)) != expected_hash:
            raise ValueError('Attention fitting source changed')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'actualFitRequest': request,
              'evidence': 'own-future-inspection-attention-fit-action-training-only', 'variant': variant, 'targetMet': False, 'personalOnly': True,
              'baseFile': base_file, 'dataFile': native['dataFile'], 'actorFile': native['actorFile'], 'baseNativeFile': native_path,
              'inputHashes': inputs, 'sourceHashes': source_hashes, 'runtimeSourceHashes': runtime_hashes, 'models': models,
              'note': 'Each person independently learns a soft repeated-known-inspection cost from their own exact prior prefixes. '
                      'No human winning labels, family pooling, forced matches or banned necessary blocker reopening. '
                      'The counter resets after physical progress; first inspection within that window, novel pictures and immediately matching '
                      'tray/peek actions receive zero cost. Actual action-likelihood fit is not first-clear-count accuracy. '
                      'Native runtime parity, whole autonomous counts and new genuine pre-opening forecasts remain required. '
                      'Existing temperature calibration measures a DIFFERENT controller and cannot calibrate this changed policy.'}
    models_file.write_text(json.dumps(report), encoding='utf-8')
    native_file.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'targetMet': False,
        'modelsSha256': digest(models_file), 'references': expected}), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--variant', choices=('clipped', 'log'), default='clipped')
    main(parser.parse_args().variant)
