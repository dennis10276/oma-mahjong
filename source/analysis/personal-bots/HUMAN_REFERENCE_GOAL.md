# Frozen reference and human-like difficulty meter

ACTIVE and UNMET. Updated objective: deliver usable milestones for the level factory.
Canonical original: Codex attachment; amended by Dennis on2026-10-29 (audited phases/142).

## Frozen Track A
- Policy40 remains frozen; no new WHEN rules or repairs to reference blind spots.
- measure() works on arbitrary unlabeled boards, salts1/2/3, default3 tries.
- Optional maxTries6 supplies the requested3-6-try check without changing policy.
- A bounded failure never proves impossibility. Invalid/incomplete coverage is null.

## Shared rules
- Only human-visible information and actual earlier-try memory; one observer.
- Accurate production rules, every tap independently replayed, under2 seconds/move.
- General planning only; no per-board settings, routes or successful-try fitting.
- Short clock action planning must still recognize visible side access along rows.
- Limited tray lookahead, forgetting some closed pictures, stochastic choices.

## Milestone1: human-v0 PASSED
- Derive from frozen reference with human limits; Dennis setting only initially.
- d: First-try wins in most runs on factory1-175/factory1-189/factory2-184/factory2-192.
- e: factory2-175 clearly lower first-try rate, losses mostly before clock.
- Predeclared development gates: every easy>.5; hard at least.20 below each;
  hard clock loss share>.5;20 campaigns per board under5 minutes.
- Commit and tag human-v0 only after d/e/timing/public-information checks pass.
- Data: origin/wip/level-factory, source/analysis/factory/dennis-plays.json.
- Snapshot586f970 includes6 factory boards and lab counts/tap histories.

## Milestone2 PASSED: human-v1 18f0348; d/e retained
- Dennis first-try50-55% on92-163; weaker family25-35% (about30%).
- Audited before-clock shares: Dennis20-30% (near25%); family35-45%.
- Per-person audited top10 loss boards: loss rate>=10pp above10 observed-zero controls.
- Report clock-contact separately (on clock removal or within2 subsequent tile removals).
-142 development repair: Dennis>50% first; family>=50% clear within12; report all20.
- Same candidate must satisfy all checks; no metrics combined across versions.

## Milestone3: human-v2; retain all earlier gates
- Lab difficulty roughly ranks as Dennis's tries (Spearman); no per-board fitting.
- Freeze and check later unopened Dennis progression/factory levels for completion.
- Tag only versions preserving every preceding milestone; factory uses newest tag.

## API contract (10-line usage note; human-v1)
1. Repository: personal-bot-review, branch wip/personal-bots.
2. Module: source/tools/sim/refit/human_bot.js.
3. Import: const {measureHuman}=require('./source/tools/sim/refit/human_bot.js').
4. Call: measureHuman(board,{runs:20,setting:'dennis'}).
5. Board accepts the same packed/object format as measure(), including factory boards.
6. Output:firstTryRate,averageTries,lossPhase:{beforeClock,mid,late},lossTiming.
7. Also: runs,slowestMove(milliseconds),minutes,version,valid and replay diagnostics.
8. Optional seed gives reproducible campaigns; omit for independently sampled runs.
9. averageTries=null if any campaign is uncleared; caps never become physical losses.
10. human-v1 passes milestones1/2; lab ranking and future prediction remain unverified.

## Accounting and current evidence
- human-v1 tag=18f0348; source-exact default and candidate outcomes reproduced.
- First54.79/33.96%; before-clock29.66/44.74%; risk gap23.5/11.5pp (Dennis/family).
-142: Dennis19/20 first; both settings20/20 clear within12; repaired without level rules.
- Factory100/100 clear; d/e pass; easy75/70/95/100%; hard10%,clock91.67%.
-183/183 tests;2960 calibration campaigns; slowest8.87ms; max20-campaign.673min.
- Clock-contact disjoint;132 family has93 before,57 contact,13 later losses.
- Lab-v1 baseline:15 boards,300 campaigns;9 means unresolved; primary rank null; M3 unmet.
- M2 anchor family-clock-outs-balance-full; counter0; release verification is not a new trial.
- M3 trial2 retains M1/M2; lab complete means6->7/15; rank null; counter0/8.
- Trial3 typed observed-key memory:b2bc48f;184 tests/factory pass; M2 calibration running.
- M3/future remain unmet; preserve historical contracts and every failed/invalid trial.
- Stop after8 experiments without progress on the current milestone; honest ledger.
-29 real family choices132/144 replay exactly; exact recorded board parity verified.
- Raw logs/snapshots under .codex-runs/human-style/; release note HUMAN_V1_RELEASE.md.
- Small commits on wip/personal-bots; no Firebase writes, publication or pushes.
