# Physical clock planning: still below the count target

Measured 17 October 2026 at 09:48:34 UTC. Historical development evidence only.
The same latest 20 distinct first-clear levels per person are scored; replays are not successes.

## Winning-attempt accuracy

| Player | Earlier-selected predictor | Correct |
| --- | --- | --- |
| Dennis | Legacy simulated baseline | 11/20 (55%) |
| Mrs. Doubtfire | Legacy simulated baseline | 7/20 (35%) |
| PUK | Always first try | 14/20 (70%) |
| Gerda | Profile forest | 9/20 (45%) |

These selected scores are unchanged. No person reaches 16/20. The profile forest scores 39/80
versus 37/80 before physical clock planning, but the forest without physical-profile features
still scores 41/80. Added duplicate features can perturb the forest even on no-clock boards;
the two-point increase is not proof of a causal improvement on hard levels.

## What improved, and what did not

The optional planner uses actual single taps, known reopenings, mandatory automatic matches,
ice, locks and clock deadlines. It freezes knowledge during search and stops at unknown reveals.
Known legal routes persist until actual knowledge changes, avoiding a verified reopening loop
on remembered level 105. Macro planners remain disabled for physical actors.

In a separate 16-run-per-level first-attempt diagnostic (320 simulations each):

| Player / novel physical actor | Clock losses | Tray losses | Wins |
| --- | --- | --- | --- |
| Dennis, no planning | 226 | 86 | 8 |
| Dennis, horizon 14 | 0 | 284 | 36 |
| Mrs., no planning | 202 | 95 | 23 |
| Mrs., horizon 14 | 0 | 270 | 50 |

Saving the clock mostly exposes later tray mistakes. The horizon-14 physical actor's direct
winning-count score is only 4/20 Dennis and 5/20 Mrs., worse than the older predictor. Next work
must address finish-focused sequential tray choices, not declare success from clock survival.
Joker planning remains unsupported; it falls back to the ordinary physical actor on those boards.

## Evidence safeguards

- All 1,250 original-profile chains and all comparison memberships match the prior experiment.
- Planner flags have no effect on no-clock boards; target recordings never train their own policy.
- The initial looping experiment was explicitly aborted and archived, not silently counted or lost.
- 58 focused JavaScript tests, 57 Python tests and the existing observer-honesty test pass.
- No frozen numeric forecast changes, new model promotion, release or Firebase write occurred.

The unchanged v1 prospective cohort still includes Mrs.'s four new-level misses. Historical
development results do not establish prospective accuracy. Dennis's next progression is still
106; its existing try-1 point remains provisional, not an 80% confidence claim.

197 matching input/source/result files and the immutable ledgers are pinned in ignored
`experiments/physical-clock-2026-10-17T09-52-02-603Z` with a SHA-256 manifest.
