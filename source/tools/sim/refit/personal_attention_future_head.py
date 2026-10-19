import math

from attempt_count_fit import best_prediction


PROTOCOL = 'own-log-attention-count-forecast-v1'
RUNS = 32
ATTEMPTS = 9
ALPHA = .125


def count_distribution(chain, runs=RUNS):
    if (runs != RUNS or len(chain['within']) != ATTEMPTS or chain.get('computationCensored', 0)
            or chain['first'] != chain['within'][0]):
        raise ValueError('Future count points need new uncensored32x9 chains; pilot/capped/old horizons cannot substitute')
    counts, previous = {}, 0.
    for attempt, within in enumerate(chain['within'], 1):
        if not math.isfinite(within) or not previous <= within <= 1:
            raise ValueError('Invalid future first-clear cumulative probabilities')
        sampled = runs * (within - previous)
        if abs(sampled - round(sampled)) > 1e-9:
            raise ValueError('Future first-clear masses must reflect the declared32 actual simulations')
        counts[attempt] = round(sampled)
        previous = within
    counts[10] = runs - sum(counts.values())
    denominator = runs + 10 * ALPHA
    return {attempt: (count + ALPHA) / denominator for attempt, count in counts.items()}


def forecast(chain, runs=RUNS):
    distribution = count_distribution(chain, runs)
    return {'predictedAttempt': best_prediction(distribution), 'distribution1to9And10plus': distribution,
            'sampledRuns': runs, 'sampledAttempts': ATTEMPTS,
            'note': 'Actual1..9 retain separate mass; not cleared by9 is an unresolved10+ tail, not an invented win on10. '
                    'For point predictions1..8 every actual10+ has identical user scoring. This preserves the full requested '
                    'metric without simulating unnecessary later retries or wrongly crediting6/7 for an8+ tail. '
                    'Numerical forecasts still require an actual source-bound pre-opening freeze; this function alone is not prospective evidence.'}
