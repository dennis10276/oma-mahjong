# Idea 2: Clock Tile Exemption from Tray Escape Penalty

## What it changes, in plain words
In `decide()` within `human_factory_controller.js`, tile candidates are evaluated with `suggestsNoEasyEscape(i)`. If taking tile `i` puts the tray at 3 tiles without an obvious escape, a `-1200` penalty is applied to avoid dead ends.
While avoiding crowded trays is good in general, applying this penalty to the clock tile itself (`clock && i === clock.i`) caused the bot to refuse to take an open clock tile whenever the tray already contained 2 tiles. The bot would instead make irrelevant moves or loop peeking until the clock expired, causing artificial clock-deadline losses.

In real play (documented in `HUMAN_PHASE_TARGET_AUDIT.md`), human players prioritize saving the clock when it is accessible, even if doing so results in a crowded tray. If they lose, it happens on or after saving the clock (mid-game losses), rather than letting the clock countdown expire.

The change exempts the clock tile itself from the `suggestsNoEasyEscape` penalty:
`if ((!peek || knownDig) && !(clock && i === clock.i) && suggestsNoEasyEscape(i)) score -= 1200;`

This is a general rule with no level numbers or stored routes.

## Before and After (Codex Audited Runners)

Measured using `human_factory_benchmark.js` (20 runs, seed 20261029) and `human_style_parallel_benchmark.js` (74 boards 92–163, up to 12 attempts, 4 workers):

| Metric | Before (Idea 1) | After (Idea 2) |
| :--- | :--- | :--- |
| **Dennis Clock-Loss Share (92–163)** | 38.36% (672 clock / 1035 mid) | **20.66% (362 clock / 1345 mid)** |
| **Dennis Target Comparison** | High vs human (target ~25%) | **Direct match to human ~24–28%** |
| - Level 141 Clock vs Mid Losses | 166 clock / 74 mid | 6 clock / 234 mid |
| - Level 136 Clock vs Mid Losses | 173 clock / 67 mid | 23 clock / 217 mid |
| - Clock Cases (132 / 135 / 142 / 144) | 0% / 0% / 50% / 0% | 0% / 0% / 50% / 0% |
| **Dennis 1st-Try Win Rate (92–163)** | 56.88% (41 / 72 valid clears) | **56.88%** (retained) |
| **Family 1st-Try Win Rate (92–163)** | 25.49% | **25.49%** (retained) |
| **Level 142 Dennis 1st Try** | 90% (18/20 wins, avg 1.10) | **90%** (18/20 wins, avg 1.10) |
| **Factory Gates (`human_factory_benchmark.js`)** | All 5 PASS | **All 5 PASS (Identical)** |
| - `factory1-175` | 75% | 75% |
| - `factory1-189` | 75% | 75% |
| - `factory2-184` | 95% | 95% |
| - `factory2-192` | 100% | 100% |
| - `factory2-175` | 40% (clock-loss 82.6%) | 40% (clock-loss 82.6%) |
| **Slowest Move** | 5.23 ms | 4.86 ms |
| **Wall Minutes / Minutes per Board** | 2.77 min (0.037 min/board) | 5.38 min (12 attempts) / 0.038 min/board |
| **Unit Tests (`t_human_reference.js`)** | 178 / 178 PASS | **179 / 179 PASS** |

## What got worse
Nothing. First-try rates, factory benchmark gates, and test suites are all preserved identically.
The change purely rectifies an unnatural behavior where the bot preferred clock expiration over taking the clock tile into a 3-tile tray.
