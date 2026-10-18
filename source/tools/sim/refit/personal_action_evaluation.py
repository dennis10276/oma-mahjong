import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

from personal_full_choice_fit import score, validate
from personal_kind_fit import KINDS
from personal_tray_goal_fit import goal_metrics
import numpy as np


ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / 'analysis/archive/personal-bots'


def evaluate(data, bank, requests):
    models = {model['id']: model for model in bank['models']}
    selections = {(row['name'], row['start']): row['models'] for row in bank['selections']}
    result = {}
    for name, games in data['players'].items():
        held = sorted([game for game in games if game.get('initialNewLevel')], key=lambda game: game['t'])[-20:]
        rows = []
        for game in held:
            campaign = next((row for row in requests['requests'] if row['name'] == name
                             and game['aid'] in row.get('excludedAids', [])), None)
            if campaign is None:
                rows.append({'aid': game['aid'], 'status': 'no-campaign-model'})
                continue
            scores = {}
            for scope, identity in selections[name, campaign['start']].items():
                model = models[identity]
                if model['availableThrough'] is not None and model['availableThrough'] >= campaign['start']:
                    raise ValueError('Action model arrived after opening')
                if set(model['trainedAids']) & set(campaign['excludedAids']):
                    raise ValueError('Action evaluation trained on target campaign')
                encoded = model['kindModel']
                kind = np.asarray([encoded['weights'][kind] for kind in KINDS])
                mode = model.get('retryMemoryMode', 'none')
                observed = next(item for item in data['memoryPlayers'][mode][name] if item['aid'] == game['aid']) if mode != 'none' else game
                if any(source['availableAt'] >= observed['t'] for source in observed.get('memorySources', [])):
                    raise ValueError('Action memory uses a later uploaded observation')
                scores[scope] = score([observed], kind, np.asarray(model['withinWeights']), model.get('jointChoice', False))
                if model.get('trayGoal'):
                    metrics = goal_metrics(observed, kind, np.asarray(model['withinWeights']), model['trayGoal'], model.get('jointChoice', False))
                    opportunities = metrics['opportunities']
                    count = scores[scope]['decisions']
                    scores[scope].update(trayGoalOpportunities=opportunities,
                        trayGoalBaseLogLoss=metrics['baseLoss'] / opportunities if opportunities else None,
                        trayGoalLogLoss=metrics['fittedLoss'] / opportunities if opportunities else None,
                        trayGoalAdjustedJointLogLoss=scores[scope]['jointLogLoss'] + (metrics['fittedLoss'] - metrics['baseLoss']) / count if count else None)
                if model.get('followThrough'):
                    samples = game.get('followThroughSamples', [])
                    probabilities = model['followThrough']['probabilities']
                    loss = sum(-math.log(probabilities[sample['tray']] if sample['followed'] else 1 - probabilities[sample['tray']])
                               for sample in samples)
                    scores[scope].update(followThroughOpportunities=len(samples), followThroughLogLoss=loss / len(samples) if samples else None)
                if model.get('pairFollowThrough'):
                    samples = game.get('pairFollowThroughSamples', [])
                    probabilities = model['pairFollowThrough']['probabilities']
                    loss = sum(-math.log(probabilities[sample['tray']] if sample['followed'] else 1 - probabilities[sample['tray']])
                               for sample in samples)
                    scores[scope].update(pairFollowThroughOpportunities=len(samples), pairFollowThroughLogLoss=loss / len(samples) if samples else None)
            rows.append({'aid': game['aid'], 'level': game['lv'], 'opening': campaign['start'], 'scores': scores})
        summaries = {}
        scopes = list(dict.fromkeys(scope for selection in bank['selections'] for scope in selection['models']))
        for scope in scopes:
            values = [row['scores'][scope] for row in rows if 'scores' in row]
            count = sum(value['decisions'] for value in values)
            summaries[scope] = {'decisions': count, 'prefixes': len(values), **{
                metric: sum(value[metric] * value['decisions'] for value in values if value['decisions']) / count if count else None
                for metric in ['jointLogLoss', 'topActionAccuracy']}}
            opportunities = sum(value.get('followThroughOpportunities', 0) for value in values)
            if any('followThroughOpportunities' in value for value in values):
                summaries[scope].update(followThroughOpportunities=opportunities,
                    followThroughLogLoss=sum(value['followThroughLogLoss'] * value['followThroughOpportunities']
                                             for value in values if value.get('followThroughOpportunities')) / opportunities if opportunities else None)
            pair_opportunities = sum(value.get('pairFollowThroughOpportunities', 0) for value in values)
            if any('pairFollowThroughOpportunities' in value for value in values):
                summaries[scope].update(pairFollowThroughOpportunities=pair_opportunities,
                    pairFollowThroughLogLoss=sum(value['pairFollowThroughLogLoss'] * value['pairFollowThroughOpportunities']
                                                 for value in values if value.get('pairFollowThroughOpportunities')) / pair_opportunities if pair_opportunities else None)
            goal_opportunities = sum(value.get('trayGoalOpportunities', 0) for value in values)
            if any('trayGoalOpportunities' in value for value in values):
                summaries[scope].update(trayGoalOpportunities=goal_opportunities,
                    trayGoalBaseLogLoss=sum(value['trayGoalBaseLogLoss'] * value['trayGoalOpportunities']
                                            for value in values if value.get('trayGoalOpportunities')) / goal_opportunities if goal_opportunities else None,
                    trayGoalLogLoss=sum(value['trayGoalLogLoss'] * value['trayGoalOpportunities']
                                        for value in values if value.get('trayGoalOpportunities')) / goal_opportunities if goal_opportunities else None,
                    trayGoalAdjustedJointLogLoss=sum(value['trayGoalAdjustedJointLogLoss'] * value['decisions']
                                                     for value in values if value['decisions']) / count if count else None)
        result[name] = {'candidatePrefixes': len(held), 'models': summaries, 'rows': rows}
    return result


def main():
    experiment = sys.argv[1] if len(sys.argv) > 1 else 'physical'
    if experiment not in ['physical', 'joint', 'keys', 'single', 'intent', 'relation', 'sequence', 'memory', 'goal']:
        raise ValueError('Unknown action evaluation experiment')
    bank_file = 'physical-' + ('key' if experiment == 'keys' else experiment) + '-policy-bank.json' if experiment != 'physical' else 'physical-policy-bank.json'
    files = {name: ARCHIVE / filename for name, filename in [('prefix', 'policy-' + experiment + '-prefix-data.json' if experiment in ['intent', 'single', 'relation', 'sequence', 'memory', 'goal'] else 'policy-prefix-data.json'),
             ('bank', bank_file), ('requests', 'physical-count-requests.json')]}
    raw = {name: filename.read_bytes() for name, filename in files.items()}
    data, bank, requests = (json.loads(raw[name]) for name in ['prefix', 'bank', 'requests'])
    validate(data)
    if hashlib.sha256(raw['prefix']).hexdigest() != bank['prefixDataSha256']:
        raise ValueError('Action evaluation prefix bank mismatch')
    if hashlib.sha256(raw['requests']).hexdigest() != bank['requestsSha256']:
        raise ValueError('Action evaluation campaign requests mismatch')
    result = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-action-likelihood',
              'inputSha256': {name: hashlib.sha256(value).hexdigest() for name, value in raw.items()},
              'players': evaluate(data, bank, requests),
              'note': 'Latest available new-level first-try natural prefixes, with every actor fitted strictly before campaign opening. Base per-tap action likelihood and optional separate follow-through cue likelihood only: neither is winning-attempt accuracy or evidence of the 80% goal. Missing campaign models remain explicit.'}
    output = 'personal-' + ('key' if experiment == 'keys' else experiment) + '-action-evaluation.json' if experiment != 'physical' else 'personal-action-evaluation.json'
    (ROOT / 'analysis/personal-bots' / output).write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({name: player['models'] for name, player in result['players'].items()}, indent=2))


if __name__ == '__main__':
    main()
