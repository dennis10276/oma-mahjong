import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_action_evaluation import evaluate
from personal_full_choice_fit import validate
from personal_kind_fit import KINDS
from personal_tray_goal_fit import FEATURES, fit_tray_goal
from physical_policy_bank import scope_players


ROOT = Path(__file__).resolve().parents[3]
PINNED = ROOT / 'analysis/archive/personal-bots/experiments/personal-memory-2026-10-18T00-43-24-647Z'


def main():
    sources = [Path(__file__), *[Path(__file__).with_name(name) for name in [
        'personal_tray_goal_fit.py', 'personal_action_evaluation.py', 'personal_full_choice_fit.py',
        'personal_kind_fit.py', 'personal_policy_fit.py', 'physical_policy_bank.py']]]
    source_hashes = {source.name: hashlib.sha256(source.read_bytes()).hexdigest() for source in sources}
    file = ROOT / 'analysis/archive/personal-bots/policy-goal-prefix-data.json'
    raw = file.read_bytes()
    data = json.loads(raw)
    validate(data)
    if data['trayGoalContextFeatures'] != FEATURES:
        raise ValueError('Goal context differs from fitter')
    manifest = json.loads((PINNED / 'manifest.json').read_bytes())
    files = {key: 'analysis/archive/personal-bots/' + filename for key, filename in [
        ('prefix', 'policy-memory-prefix-data.json'), ('bank', 'physical-memory-policy-bank.json'),
        ('requests', 'physical-count-requests.json')]}
    inputs = {key: (PINNED / value).read_bytes() for key, value in files.items()}
    for key, value in files.items():
        if hashlib.sha256(inputs[key]).hexdigest() != manifest['files'][value]:
            raise ValueError('Pinned personal controls changed')
    previous, bank, requests = (json.loads(inputs[key]) for key in ['prefix', 'bank', 'requests'])
    for name in data['players']:
        pairs = [(data['players'][name], previous['players'][name])]
        pairs += [(data['memoryPlayers'][mode][name], previous['memoryPlayers'][mode][name]) for mode in data['memoryPlayers']]
        for current_games, previous_games in pairs:
            if len(current_games) != len(previous_games):
                raise ValueError('Goal feasibility changed observed prefixes')
            for current, original in zip(current_games, previous_games):
                if {key: value for key, value in current.items() if key != 'trayGoalSamples'} != original:
                    raise ValueError('Goal feasibility changed personal control data')
    for position, model in enumerate(bank['models']):
        games = [game for game in scope_players(data, model['scope'])[model['name']]
                 if game['aid'] in model['trainedAids'] and game['availableAt'] < model['trainingCut']
                 and (model['scope'] != 'ownNovel' or game.get('initialNewLevel', False))]
        if len(games) != model['trainingGames'][model['name']]:
            raise ValueError('Goal feasibility changed pre-opening actor membership')
        kind = np.asarray([model['kindModel']['weights'][name] for name in KINDS])
        model['trayGoal'] = fit_tray_goal(games, kind, np.asarray(model['withinWeights']), model['trainingCut'])
        if (position + 1) % 50 == 0:
            print('Fitted', position + 1, 'own goal residuals against pinned actors', flush=True)
    validate(data)
    if source_hashes != {source.name: hashlib.sha256(source.read_bytes()).hexdigest() for source in sources}:
        raise ValueError('Goal feasibility sources changed during fitting')
    models = {'prefixFingerprint': data['fingerprint'], 'pinnedActorBankSha256': hashlib.sha256(inputs['bank']).hexdigest(),
              'models': [{key: model[key] for key in ['id', 'name', 'scope', 'trainingCut', 'availableThrough',
                         'trainingGames', 'trainedAids', 'retryMemoryMode', 'trayGoal']} for model in bank['models']],
              'note': 'Exploratory per-opening goal residuals tied to unchanged pinned personal actors. These are not new prospective forecasts.'}
    models_file = ROOT / 'analysis/archive/personal-bots/personal-goal-feasibility-models.json'
    models_file.write_text(json.dumps(models), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-goal-feasibility',
              'targetMet': False, 'prefixFingerprint': data['fingerprint'], 'prefixDataSha256': hashlib.sha256(raw).hexdigest(),
              'fitSourceHashes': source_hashes, 'goalModelsSha256': hashlib.sha256(models_file.read_bytes()).hexdigest(),
              'pinnedControlHashes': {key: hashlib.sha256(value).hexdigest() for key, value in inputs.items()},
              'players': evaluate(data, bank, requests),
              'note': 'Pinned personal actors and exact control features/membership are unchanged. Goal residuals fit only their earlier own prefixes; target winning counts are unused. This measures held natural-action likelihood, not winning-try accuracy or prospective success. No forecast is created or overwritten.'}
    (ROOT / 'analysis/personal-bots/personal-goal-feasibility.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: row['models'] for name, row in report['players'].items()}, indent=2))


if __name__ == '__main__':
    main()
