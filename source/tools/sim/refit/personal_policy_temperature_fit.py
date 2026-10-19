import json
import math
from datetime import datetime, timezone
from pathlib import Path

from attempt_count_fit import NAMES
from personal_value_fit import ARCHIVE, ROOT, digest


TEMPERATURES = (.25, .5, 1., 1.5)


def count_loss(chain, runs, actual, alpha=.125):
    if (not isinstance(actual, int) or actual < 1 or not isinstance(runs, int) or runs < 1
            or not math.isfinite(alpha) or alpha <= 0 or len(chain['within']) < 7
            or chain.get('computationCensored', 0)):
        raise ValueError('Count calibration requires valid observed first-clear and uncensored sampled first-seven hazards')
    counts, previous = [], 0.
    for within in chain['within'][:7]:
        count = runs * (within - previous)
        if not previous <= within <= 1 or abs(count - round(count)) > 1e-9:
            raise ValueError('Invalid sampled first-clear distribution')
        counts.append(round(count))
        previous = within
    if chain['first'] != chain['within'][0]:
        raise ValueError('Initial first-clear rate is inconsistent')
    counts.append(round(runs * (1 - previous)))
    probability = (counts[min(actual, 8) - 1] + alpha) / (runs + 8 * alpha)
    return -math.log(probability)


def select_temperatures(data, cutoff):
    if not math.isfinite(cutoff) or data['evidence'] != 'own-future-policy-count-calibration-training-only':
        raise ValueError('Direct policy calibration requires explicitly labeled own prior training simulations')
    profiles = data['profiles']
    if (len(profiles) != len(TEMPERATURES) or data['runs'] != 8 or data['attempts'] != 8
            or set(profile['temperature'] for profile in profiles.values()) != set(TEMPERATURES)):
        raise ValueError('Retain the predeclared confidence grid including the exact1 control')
    output = {}
    for name in NAMES:
        actor = data['actors'][name]
        if actor['name'] != name or not actor['id']:
            raise ValueError('Policy count calibration needs its own bound current actor')
        eligible = sorted([row for row in data['rows'] if row['name'] == name and row['end'] < cutoff
            and row['wonOn'] is not None and row['firstAttempt'] == 1 and row['firstClear']
            and not row.get('assisted') and not row.get('boardChangedWithinCampaign')], key=lambda row: row['end'])[-20:]
        if len(eligible) != 20 or len({row['start'] for row in eligible}) != 20:
            raise ValueError('Require20 distinct own earlier unassisted first-clear calibration boards per person')
        if any(row['modelId'] != actor['id'] for row in eligible):
            raise ValueError('Do not reuse different historical/current-actor chains as policy calibration')
        losses, rejected = {}, []
        for profile, settings in profiles.items():
            if any(row['computationCaps'][profile] or row['chains'][profile].get('computationCensored', 0) for row in eligible):
                rejected.append(profile)
                continue
            weights = [.5 ** ((len(eligible) - position - 1) / 20) for position in range(len(eligible))]
            total = sum(weight * count_loss(row['chains'][profile], data['runs'], row['wonOn']) for row, weight in zip(eligible, weights))
            losses[profile] = total / sum(weights)
        if not losses:
            raise ValueError('No uncensored own policy candidate; never turn computation caps into human failures')
        selected = min(losses, key=lambda profile: (losses[profile], abs(math.log(profiles[profile]['temperature']))))
        output[name] = {'actorId': actor['id'], 'selectedProfile': selected, 'temperature': profiles[selected]['temperature'],
            'calibrationEpisodes': len(eligible), 'calibrationAvailableThrough': max(row['end'] for row in eligible),
            'calibrationAids': sorted({aid for row in eligible for aid in row['campaignAids']}),
            'weightedCountLogLoss': losses, 'computationCensoredCandidates': rejected}
    return output


def main():
    filename = ARCHIVE / 'personal-policy-temperature-data.json'
    data = json.loads(filename.read_bytes())
    for name, expected in data['sourceHashes'].items():
        if digest(ROOT / name) != expected:
            raise ValueError('Direct policy-calibration source/input changed: ' + name)
    cutoff = int(datetime.now(timezone.utc).timestamp() * 1000)
    if datetime.fromisoformat(data['made'].replace('Z', '+00:00')).timestamp() * 1000 >= cutoff:
        raise ValueError('Count calibration computation must finish before fitting request')
    selected = select_temperatures(data, cutoff)
    report = {'made': datetime.now(timezone.utc).isoformat(), 'actualFitRequest': cutoff, 'targetMet': False,
        'evidence': 'own-future-policy-confidence-fit-to-first-clear-counts-training-only', 'personalOnly': True,
        'dataSha256': digest(filename), 'sourceHashes': {Path(__file__).name: digest(Path(__file__))}, 'selected': selected,
        'note': 'Own last20 unassisted first-clear boards only; no family fit or universal greedy finish. '
                'Temperature adjusts confidence in that person’s learned preferences, preserving option order and impossible-action support. '
                'Objective is proper first-clear bucket likelihood1..7/8+, with Dirichlet.125 smoothing and20-episode recency half-life, not maximized win rate or action likelihood. '
                'Current actors may have seen these prior training recordings; this is future-only simulation calibration, not held/pre-opening accuracy. '
                'Any censored candidate is explicitly rejected, never scored as a human loss. Selected policy requires fresh full-count prediction, '
                'real opening checks and numeric freezes after this actual new readiness. No existing forecast/miss changes; no80% success is established.'}
    output = ARCHIVE / 'personal-policy-temperature-models.json'
    output.write_text(json.dumps(report, indent=2), encoding='utf8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
