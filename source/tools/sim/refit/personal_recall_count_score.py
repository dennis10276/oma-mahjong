import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from attempt_count_fit import NAMES, SCORING_RULE, accuracy, best_prediction_with_tail
from personal_count_fit import hazards_of, distribution_of
from personal_handoff_count_score import empirical_distribution


ROOT = Path(__file__).resolve().parents[3]


def predictions_of(chain, runs):
    probabilities, tail = empirical_distribution(chain, runs)
    empirical = best_prediction_with_tail(probabilities, tail, 33)
    probabilities, tail = distribution_of(hazards_of(chain, runs))
    return empirical, best_prediction_with_tail(probabilities, tail, 129)


def evaluate(data, baseline=None):
    if (data['runs'] != 32 or data['attempts'] != 32 or data['computationCaps'] != 0
            or not data['validUncensoredSimulation'] or data['originalConfiguredPilotControls'] != 29
            or data['pairedPilotChainsMatched'] != 58 or data['firstAttemptRateControls'] != 29):
        raise ValueError('Require complete uncensored consistent-recall32x32 candidate and all paired/initial controls')
    for profile, expected in (('configuredControl', (2, 3)), ('noInheritedPictures', (32, 32))):
        if (data['profiles'][profile]['runs'], data['profiles'][profile]['attempts']) != expected:
            raise ValueError('Keep configured pilot and full candidate sample scopes distinct')
    if len(data['rows']) != 29 or len({(row['name'], row['start']) for row in data['rows']}) != 29:
        raise ValueError('Keep all29 fixed recent targets exactly once')
    comparisons = {}
    if baseline is not None:
        if (baseline['runs'] != 32 or baseline['attempts'] != 32 or baseline['computationCaps'] != 0
                or not baseline['validUncensoredSimulation'] or baseline['pairedPilotChainsMatched'] != 58
                or baseline['firstAttemptRateControls'] != 58 or len(baseline['rows']) != 29):
            raise ValueError('Configured comparison requires its independently completed uncensored full chain')
        for name in ('www/hard.js', 'tools/sim/refit/personal_joint_intents_choice.js',
                     'tools/sim/refit/personal_clock_intents_choice.js', 'tools/sim/refit/personal_tray_intents_choice.js',
                     'tools/sim/refit/personal_context_choice.js', 'tools/sim/refit/personal_physical_actor.js'):
            if baseline['sourceHashes'][name] != data['sourceHashes'][name]:
                raise ValueError('Configured baseline is a different actor or physical runtime')
        comparisons = {(row['name'], row['start']): row for row in baseline['rows']}
        if len(comparisons) != 29:
            raise ValueError('Configured baseline duplicated a target')
    scored, pending, ineligible = [], [], []
    for row in data['rows']:
        previous = comparisons.get((row['name'], row['start']))
        if baseline is not None:
            if previous is None or any(previous.get(key) != row.get(key) for key in ('board', 'modelId', 'wonOn', 'firstAttempt', 'firstClear')):
                raise ValueError('Configured full comparison changed an exact board, own actor or outcome')
            if previous['chains']['handoffZero']['first'] != row['chains']['noInheritedPictures']['first']:
                raise ValueError('Incoming recall changed an initial attempt')
        if (row['firstAttempt'] != 1 or not row.get('firstClear') or row.get('assisted')
                or row.get('boardChangedWithinCampaign')):
            ineligible.append({key: row.get(key) for key in ('name', 'lv', 'start', 'wonOn', 'firstAttempt', 'firstClear', 'assisted', 'boardChangedWithinCampaign')})
            continue
        if row.get('wonOn') is None:
            pending.append({key: row.get(key) for key in ('name', 'lv', 'start', 'observedAttempts')})
            continue
        predictions, survival = {'alwaysFirst': 1}, {}
        candidate = row['chains']['noInheritedPictures']
        predictions['consistentZeroEmpirical'], predictions['consistentZeroSmoothed'] = predictions_of(candidate, 32)
        survival['consistentZero'] = {str(bound): candidate['within'][bound - 1] for bound in (1, 3, 5, 8, 32)}
        if previous is not None:
            chain = previous['chains']['handoffZero']
            predictions['configuredEmpirical'], predictions['configuredSmoothed'] = predictions_of(chain, 32)
            survival['configured'] = {str(bound): chain['within'][bound - 1] for bound in (1, 3, 5, 8, 32)}
        scored.append({**{key: row[key] for key in ('name', 'lv', 'start', 'end', 'wonOn', 'board', 'modelId')},
            'predictions': predictions, 'survival': survival})
    methods = ('alwaysFirst', 'consistentZeroEmpirical', 'consistentZeroSmoothed') + (('configuredEmpirical', 'configuredSmoothed') if baseline is not None else ())
    return {'targetMet': False, 'evidence': 'posthoc-historical-exploratory-consistent-recall-count-diagnostic',
        'scoringRule': SCORING_RULE, 'personalOnly': True,
        'players': {name: {method: accuracy([row for row in scored if row['name'] == name], method) for method in methods} for name in NAMES},
        'configuredFullComparisonIncluded': baseline is not None,
        'coverage': {'fixedTargets': 29, 'scored': len(scored), 'pending': len(pending), 'ineligibleRetained': len(ineligible)},
        'scored': scored, 'pending': pending, 'ineligible': ineligible,
        'note': 'Fixed raw empirical/Jeffreys-smoothed first-clear distributions, not a target-fitted count head. '
                'The configured2x3 pilot is never scored as a full count distribution. A configured full comparison is included only when its separate completed32x32 '
                'run has zero caps, identical own actor/board/outcomes, matching runtime source hashes and unchanged initial rates. '
                'All29 targets remain in coverage; incomplete/ineligible campaigns are explicit. '
                'Recall choice was calibrated using later recent data, so these raw historical counts remain post-hoc exploratory rather than independently held accuracy. '
                'No numeric forecast/miss changes, human-zero-memory conclusion, promotion or80% success follows.'}


def main(baseline_file):
    filename = ROOT / 'analysis/archive/personal-bots/personal-recall-count-data.json'
    data_bytes = filename.read_bytes()
    data = json.loads(data_bytes)
    for name, expected in data['sourceHashes'].items():
        if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != expected:
            raise ValueError('Recall count source/input changed: ' + name)
    baseline_bytes = baseline_file.read_bytes() if baseline_file is not None else None
    report = evaluate(data, json.loads(baseline_bytes) if baseline_bytes is not None else None)
    report.update({'made': datetime.now(timezone.utc).isoformat(), 'dataFile': filename.relative_to(ROOT).as_posix(),
        'dataSha256': hashlib.sha256(data_bytes).hexdigest(), 'baselineFile': str(baseline_file) if baseline_file is not None else None,
        'baselineSha256': hashlib.sha256(baseline_bytes).hexdigest() if baseline_bytes is not None else None,
        'scoringSourceHashes': {name: hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest()
            for name in ('personal_recall_count_score.py', 'personal_handoff_count_score.py', 'attempt_count_fit.py', 'personal_count_fit.py', 'attempt_hazard.py', 'board_recall_eval.py')}})
    output = ROOT / 'analysis/personal-bots/recall-count-evaluation.json'
    output.write_text(json.dumps(report, indent=2), encoding='utf8')
    print(json.dumps({key: value for key, value in report.items() if key != 'scored'}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline', type=Path)
    main(parser.parse_args().baseline)
