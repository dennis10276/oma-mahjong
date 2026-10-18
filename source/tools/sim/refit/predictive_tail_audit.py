import json
from datetime import datetime, timezone
from pathlib import Path

from attempt_count_fit import accuracy, best_prediction, best_prediction_with_tail
from attempt_hazard import contextual_distribution
from personal_count_fit import conditional_of, distribution_of, hazards_of, profile_weights
from personal_value_fit import ARCHIVE, ROOT, digest


PARENT = ARCHIVE / 'experiments/personal-outcome-styles-scored-2026-10-18T15-48-20-154Z'


def main():
    manifest_file = PARENT / 'manifest.json'
    manifest = json.loads(manifest_file.read_bytes())
    names = ['analysis/archive/personal-bots/physical-outcome-styles-count-data.json',
             'analysis/archive/personal-bots/physical-outcome-styles-count-scored.json',
             'analysis/personal-bots/physical-outcome-styles-count-evaluation.json']
    for name in names:
        if digest(PARENT / name) != manifest['files'][name]:
            raise ValueError('Tail correction changed its immutable numeric-prediction parent')
    data, scored, previous = [json.loads((PARENT / name).read_bytes()) for name in names]
    frozen = {(row['name'], row['start']): row for row in scored}
    profiles = previous['strategyCandidates']
    prepared, cached = [], {}
    for row in data['rows']:
        key = row['name'], row['start']
        components = {profile: distribution_of(hazards_of(row['chains'][profile], data['runs'])) for profile in profiles}
        weights = frozen[key]['profileWeights'] if key in frozen else profile_weights(data['rows'], row, profiles, data['runs'], True)[0]
        mixture = {attempt: sum(weights[profile] * components[profile][0][attempt] for profile in profiles) for attempt in range(1, 129)}
        tail = sum(weights[profile] * components[profile][1] for profile in profiles)
        conditional = [conditional_of(mixture, attempt, tail) for attempt in range(1, 129)]
        survival, within = 1.0, []
        for probability in conditional:
            survival *= 1 - probability; within.append(1 - survival)
        prepared.append({**row, 'chain': {'cond': conditional, 'within': within}})
        cached[key] = (components, mixture, tail)
    methods = ['ownActorSmoothed', 'personalMixture', 'personalBest', 'mixtureCalibrated']
    output, changes, controls = [], [], 0
    for row in prepared:
        key = row['name'], row['start']
        if key not in frozen:
            continue
        old = frozen[key]
        components, mixture, tail = cached[key]
        calibrated, calibrated_tail = contextual_distribution([candidate for candidate in prepared if candidate['name'] == row['name']], row, limit=128)
        distributions = {'ownActorSmoothed': components['ownAll'], 'personalMixture': (mixture, tail),
                         'personalBest': components[old['selectedProfile']], 'mixtureCalibrated': (calibrated, calibrated_tail)}
        predictions = dict(old['predictions'])
        for method, (distribution, remaining) in distributions.items():
            if best_prediction(distribution) != old['predictions'][method]:
                raise ValueError('Tail audit did not reproduce an old analytic numeric forecast: ' + method)
            controls += 1
            prediction = best_prediction_with_tail(distribution, remaining, 129)
            predictions[method] = prediction
            if prediction != old['predictions'][method]:
                if prediction != 8:
                    raise ValueError('A wholly8+ tail changed a lower prediction unexpectedly')
                changes.append({'name': row['name'], 'lv': row['lv'], 'start': row['start'], 'method': method,
                                'before': old['predictions'][method], 'after': prediction, 'modelBeyond128': remaining})
        output.append({key: old[key] for key in ['name', 'lv', 'start', 'end', 'board', 'wonOn']} | {'predictions': predictions})
    if controls != 1008 or len(output) != 252:
        raise ValueError('Tail audit changed the original252-campaign coverage')
    held_ids = set(data['comparisonEpisodes'])
    held = [row for row in output if row['name'] + '|' + str(row['start']) in held_ids]
    if len(held) != 80:
        raise ValueError('Tail audit changed original held progression IDs')
    ledgers = ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective']
    source_hashes = {path.relative_to(ROOT).as_posix(): digest(path) for path in [manifest_file, *[PARENT / name for name in names],
        *[Path(__file__).with_name(name) for name in ['predictive_tail_audit.py', 'attempt_count_fit.py', 'personal_count_fit.py', 'attempt_hazard.py']]]}
    ledger_hashes = {name: digest(ROOT / 'analysis/personal-bots' / (name + '-forecasts.json')) for name in ledgers}
    reference = ARCHIVE / 'experiments/prospective-score-2026-10-18T15-36-53-741Z/manifest.json'
    frozen_manifest = json.loads(reference.read_bytes())
    for name, expected in ledger_hashes.items():
        if expected != frozen_manifest['ledgerHashes'][name]:
            raise ValueError('The predictive tail audit must not rewrite old frozen forecasts')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-predictive-tail-correction-audit',
              'targetMet': False, 'sourceHashes': source_hashes, 'ledgerHashesUnchanged': ledger_hashes,
              'analyticNumericControlsMatched': controls, 'campaigns': len(output), 'heldIds': data['comparisonEpisodes'],
              'changes': changes,
              'players': {name: {'selectedBeforeTestUnchanged': player['selectedBeforeTest'],
                  'selectedScore': accuracy([row for row in held if row['name'] == name], player['selectedBeforeTest']),
                  'analyticMethods': {method: accuracy([row for row in held if row['name'] == name], method) for method in methods}}
                  for name, player in previous['players'].items()},
              'note': 'Original1008 analytic numeric controls reproduce before including ignored model tail mass. '
                  'Probability beyond128 belongs to the shared8+ success bucket, but is not an invented observed winning attempt. '
                  'The corrected candidate points are diagnostic only; all old forecasts, labels, held IDs and selected methods stay immutable. '
                  'No model is reselected on held labels and no genuinely frozen prospective80% claim follows.'}
    (ROOT / 'analysis/personal-bots/predictive-tail-audit.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'analyticNumericControlsMatched': controls, 'changes': len(changes),
                      'selectedCorrectOf20': {name: player['selectedScore']['correct'] for name, player in report['players'].items()}}, indent=2))


if __name__ == '__main__':
    main()
