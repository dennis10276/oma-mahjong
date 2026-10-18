from prospective import score_ledger


def same_model_ledger(progression, earlier):
    model = progression[0]['model']
    if any(snapshot.get('model') != model for snapshot in progression):
        raise ValueError('Different model versions need separate progression cohorts')
    return sorted([snapshot for snapshot in earlier if snapshot.get('model') == model] + progression,
                  key=lambda snapshot: snapshot['frozenAt'])


def classify_episodes(episodes, start_levels):
    primary, diagnostics = [], []
    seen = set()
    for episode in sorted(episodes, key=lambda row: row['start']):
        key = episode['name'], episode['lv']
        reason = 'replayedLevel' if key in seen else 'belowProgressionFrontier' if episode['lv'] < start_levels[episode['name']] else None
        seen.add(key)
        if reason:
            diagnostics.append({**episode, 'progressionExclusion': reason})
        else:
            primary.append(episode)
    return primary, diagnostics


def score_progression(ledger, episodes, start_levels):
    primary, diagnostics = classify_episodes(episodes, start_levels)
    report = score_ledger(ledger, primary)
    anchor = report['cohortStartsAfter']
    report['scope'] = 'first-clear-progression-v1'
    report['progressionStartLevels'] = start_levels
    report['cohortRule'] = 'First 20 newly opened first-clear progression campaigns per person after the freeze, at or above the declared progression frontier; unfinished and missing forecasts remain in the cohort. Replays never contribute to the primary 80% score.'
    report['diagnostics'] = {'excludedEpisodes': diagnostics,
                             'alreadyOpenedCampaigns': [row for row in primary if anchor is not None and row['start'] <= anchor],
                             'note': 'Earlier-opened campaigns may receive useful predictions, but cannot prove a new pre-start forecast. Replay diagnostic results do not contribute to the primary pass gate.'}
    return report
