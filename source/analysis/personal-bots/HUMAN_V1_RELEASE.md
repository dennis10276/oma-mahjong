# human-v1 release

Committed and tagged **18f0348** on `wip/personal-bots`. Milestones 1/2 pass. The goal remains active pending lab ranking and frozen validation on future games. Track A policy40 stays frozen.

| Gate | Dennis | Family |
|---|---:|---:|
| First try on 92–163 | 54.79% | 33.96% |
| Before-clock share of losses | 29.66% | 44.74% |
| Difficult minus easy loss rate | 23.50pp | 11.50pp |
| Level 142 first try | 19/20 | 2/20 |
| Level 142 clear within 12 | 20/20 | 20/20 |

Factory d/e pass: easy first rates 75/70/95/100%, hard 10%, hard before-clock loss share 91.67%; all 100 campaigns clear. The final default API reproduces all 2,960 calibration and 100 factory campaigns from the selected candidate. All 183 offline tests pass. Slowest decision: 8.87ms; longest 20-campaign measurement: 0.673 minutes.

```js
const { measureHuman } = require('./source/tools/sim/refit/human_bot.js');
const result = measureHuman(board, { runs: 20, setting: 'dennis' });
// 'family' uses the calibrated Mrs. Doubtfire reference.
```

The call accepts arbitrary boards. An optional seed reproduces campaigns. Defaults are versioned in `human_release_profiles.json`; frozen v0 `PROFILES` remain counterfactual test controls. No per-board routes or settings enter the actor. `averageTries` is null if a campaign is uncleared; individual results retain that uncertainty.

Use `lossTiming.counts/shares` for four disjoint classes: `beforeClock`, `clockContact`, `mid`, `late`. Contact means losing on clock removal or within two subsequent tile removals. The compatible older `lossPhase.mid` includes contact; do not add it to contact. On 132 the family has 93 before-clock, 57 contact and 13 later losses. On 144 it has 6 before-clock and 26 contact losses.

The actor reuses public clock/ice prerequisites, checks optional clock-mate route budgets within its planning horizon, preserves matching exits and learns from actual retries. The family has shorter planning and a stronger clock-completion preference, supported by recorded clock-rush/contact behavior. All 29 recorded choices from four family attempts on 132/144 independently match production. Hidden-picture invariance tests pass.

This is historical behavioral calibration. It does not establish 80% or 95% future attempt-count accuracy. The first 15-board lab test is complete: nine means are unresolved, so its ranking gate is unmet. Future frozen validation remains required.

Evidence: `HUMAN_PHASE_V2_RESULTS.json.releaseVerification`; raw `.codex-runs/human-style/phase-v2/human-v1-release-{full,factory}`, `human-v1-release-proof.json`, and `suite10-release.log`. Full experiment history is retained. No pushes, Firebase writes or publication were performed.
