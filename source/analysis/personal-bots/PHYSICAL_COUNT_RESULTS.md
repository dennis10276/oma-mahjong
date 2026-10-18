# New-level winning-attempt comparison

Evaluated 17 October 2026, 09:21 UTC. Historical development evidence, **not an 80% pass**.
The latest 20 distinct completed first-clear levels per person define this comparison; replays
cannot increase the score. Actual tries 1–3 require exact predictions, 4–5 allow ±1, 6+ allow ±2.

| Player | New levels | Earlier-selected method | Correct |
| --- | --- | --- | --- |
| Dennis | 86–105 | Legacy simulated baseline | 11/20 (55%) |
| Mrs. Doubtfire | 77–96 | Legacy simulated baseline | 7/20 (35%) |
| PUK | 33–52 | Always first try | 14/20 (70%) |
| Gerda | 42–61 | Profile forest | 9/20 (45%) |

No person reaches 16/20. Physical-policy features score 37/80 in the count forest, versus 41/80
without them. The five predeclared simulated profiles include novel first-try habits, all-prefix
habits, mistake avoidance and switching habits on retries. They use only earlier available
recordings, excluding all target-campaign attempts. The natural corpus has 25,750 physical choices.

## What failed

The new physical actors overpredict retries, despite obeying actual single-tap rules. In a separate
16-run-per-level mechanism audit, the all-prefix actor has 223/320 clock losses for Dennis and
214/320 for Mrs. The older macro-planning actor has 16/320 and 0/320. Mrs.'s usable natural recorded
failures are mostly tray losses after clearing the clock (26 cases), not clock losses (seven).
These are different samples, not matched human/bot win-rate denominators.

PUK/Gerda's lower levels have no clocks, but the physical actor has 283/320 and 291/320 tray losses.
Planning and sequential tray management need work; fitting isolated tap likelihood is insufficient.
Do not weaken tap rules or enable an incompatible macro solver to disguise the failure.

## Forecast status

Dennis's progression remains 106, not the replayed 53/54. The existing provisional points remain
106: try 1, 107: try 1, 108: try 2. These are not 80% confidence claims. No physical-model promotion
or numeric forecast replacement occurred. The original v1 prospective new-level cohort still
contains Mrs.'s four misses; changing scope or adding coverage cannot reset an unchanged model.

The full comparison, exact inputs, fitted policies and all four immutable ledgers are pinned in
ignored `experiments/physical-count-2026-10-17T09-23-06-644Z` with a SHA-256 manifest.
