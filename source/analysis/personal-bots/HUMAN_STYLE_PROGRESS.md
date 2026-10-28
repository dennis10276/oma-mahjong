# Human-like bot: six-experiment development report

**EXPERIMENTAL; calibration and prospective gates are unmet.** Track A stays
frozen. This work follows the replacement goal: human behavior and loss patterns,
not matching a particular historical successful-attempt number.

All trials used the same 74 unchanged boards, 20 seeds per setting and one actual
attempt per seed. The main rate uses only levels92-163 (72 boards). Two additional
boards complete the fixed risk group. These are development screens, not the
required full retry-campaign calibration or prospective validation.

Implementation:8df79c5. Reference freeze:648172a plus portable hash repair
a9e541e. Verification: `.codex-runs/human-style/suite-final-02.log`,
160/160 tests, native exit0; retry validation log also native exit0.

| Trial | Change | Dennis first try | Family first try |
|---|---|---:|---:|
| Baseline | Independent short-sighted policy | 0.28% | 0.35% |
| 1 | Clock attraction and memory calibration | 1.53% | 0.97% |
| 2 | Fix side cycles; local outs | 6.46% | 6.39% |
| 3 | Clock-relevant keys first | 8.89% | 9.44% |
| 4 | Two/three-move tray horizon; visible joker | 11.18% | 14.44% |
| 5 | Short pre-clock foresight; global parameters | 16.25% | 19.38% |
| 6 | Fix locked mates and imaginary unlock rewards | **22.15%** | **18.75%** |

The locked-out bug was reproduced with a failing test: an unrelated move scored
25.8 because a geometrically free **locked** partner was counted as an out.
The corrected score is -6. No level-specific route or parameter was added.

Trial6 Dennis losses: clock42.997%, mid56.913%, late0.089%. Its risk/control
first-attempt loss rates are90%/69.5%, and all four clock cases lose predominantly
before the clock. Thus its risk-pattern screen passes, but first-try and phase
targets fail. Family also fails the strict clock-case screen (135 is exactly50%,
not a majority). Neither setting is calibrated.
Trial6 independently replays517,087 taps; its slowest decision is8.56ms.
The one-attempt screen takes3.62seconds/board for both settings together.

## What is implemented

| Requirement | Evidence/status |
|---|---|
| Freeze strong reference | Policy40 pinned; measure() defaults to3 tries/salts1-3; false never proves impossible |
| Same rules and observer | Original production engine; every physical tap independently replayed |
| Human planning limits | Clock dependency cone<=3; tray horizon<=3 with beam6; stops at unknown information |
| Two global settings | Fixed JSON profiles, no level identity/outcome input to controller |
| Random choices and imperfect memory | Seeded stochastic legal choices; closed-picture decay and retry retention tested |
| Honest retries | Only actual completed physical losses restart; caps produce null rates/means, not losses |
| Pattern calibration | Six trials complete; targets still UNMET |
| Frozen future check | NOT STARTED; blocked by unmet calibration gates |

Retry validation after the final role-reset repair:20 campaigns, up to12 actual
tries, both settings, no computation censoring. On103 Dennis clears20/20 with
mean1 try; family clears20/20 with mean2.3. On132 neither clears within12: means
remain null. This exposes a real remaining limitation in short-route choice and
retry adaptation; it is not evidence of impossibility. Retries retain observed
pictures but do not yet learn a reusable alternative route from their failures.

Dynamic roles reset on retry: a late melted-ice `none` observation cannot certify
an unseen starting role. First-attempt actions still match archived trial6 on
97/103/132 for both settings. All160 offline human-reference tests pass.

## Reproduce and inspect

- API: `require('./source/tools/sim/refit/human_style_measure.js').measureHuman(board,{runs:20,seed:20261028})`.
- Returns both settings, first-try rate, average tries (null if any campaign fails
  to clear within its limit), loss shares, censoring, replay taps and minutes.
- Full campaign benchmark: `node source/tools/sim/refit/human_style_benchmark.js .codex-runs/level-measure/catalog-v4.json .codex-runs/human-style/new-full-run 12`.
- `HUMAN_STYLE_EXPERIMENTS.json` contains exact global profiles and results.
- Raw source snapshots/logs: `.codex-runs/human-style/`. Full import snapshots and
  live byte-change guards begin with trial5; earlier actor versions are archived.
- Board provenance:64 recorded openings and10 historical versionTable boards.
  Controls have zero **observed** losses in incomplete cached human data.
- CPU-only, sequential games. No GPU acceleration or CUDA parity claim.

The next model improvement should fix public short-route/exit choice and learn
from actual failed retry branches. Continue comparing both settings and all
patterns; do not deliberately manufacture losses to match phase percentages.
