# human-v0: factory milestone

Milestone1 passes. Family calibration, lab ranking and prospective validation remain UNMET.

The controller adapts238f5ec on the shared frozen-reference foundation: public
visibility, physical sessions and proven-match memory. It uses short behavioral
planning rather than the reference's complete route search. Policy40 is unchanged.
The failed constrained-reference candidates22-24 remain archived for comparison.

```js
const {measureHuman}=require('./source/tools/sim/refit/human_bot.js');
const result=measureHuman(board,{runs:20,setting:'dennis'});
```

The board format is the same as measure(), including packed factory boards.
Output includes firstTryRate, averageTries, lossPhase:{beforeClock,mid,late},
runs (a count), slowestMove (ms), minutes, version, valid, and replay diagnostics.
Use an explicit seed for reproduction; omission draws a fresh campaign seed.
A capped/uncleared campaign makes averageTries null. Computation limits cannot
become physical losses, retry learning, or free restarts. Family is experimental.

## Fixed factory validation

Source data: origin/wip/level-factory586f970ba01a4f75a65a17b98e4c7864e683d1b2,
source/analysis/factory/dennis-plays.json. Twenty campaigns/board, seed20261029,
up to12 actual attempts. Thresholds were declared before candidate testing:
each easy board>.50; hard at least.20 below every easy board; hard clock-loss
share>.50;20 campaigns<5min/board; every decision<2000ms.

| Board | First-try wins | Mean tries |
|---|---:|---:|
|factory1-175|15/20 (75%)|1.25|
|factory1-189|15/20 (75%)|1.30|
|factory2-184|19/20 (95%)|1.05|
|factory2-192|20/20 (100%)|1.00|
|factory2-175|8/20 (40%)|2.15|

The hard board has19/23 physical losses before clock (82.61%). All100 campaigns
clear within their actual-attempt limit. Development run takes0.024-0.071min/board
(~1.4-4.3s), slowest decision5.60ms; release-check timings are saved separately.
All accepted taps independently replay through original production physics.
171/171 offline tests pass; the earlier loaded run's isolated reference-test
failure was preserved and independently rerun successfully.

These are development boards, not prospective forecasts. With20 samples,
75% has a roughly53-89% Wilson95% interval;40% roughly22-61%. This establishes
the declared milestone, not precise difficulty for every unseen board.

## Corrections required before adopting238f5ec

- A known closed picture still requires its physical peek before removal.
- The shared audited runner supplies exact independent production replay.
- Average tries stays null when any campaign remains uncleared.
- Computation caps do not become physical losses or permit retry learning.
- Loss shares and loss counts are separate; runs is a number.
- The greedy escape aversion is explicitly a heuristic, not a death proof.
- Fixed model profiles are immutable; the product README is preserved.

Raw logs/source snapshots: .codex-runs/human-style/gemini238f5ec-adoption01/,
human-v0-release-check/, and continuation-suite-04.log. The source-only tag
human-v0 is created after release verification. Next: retain d/e while measuring
milestone2 on92-163, then lab ranking and a frozen future check.
