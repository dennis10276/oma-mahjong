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

## Milestone2: human-v1; retain d/e
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

## API contract (10-line usage note; human-v0)
1. Repository: personal-bot-review, branch wip/personal-bots.
2. Module: source/tools/sim/refit/human_bot.js.
3. Import: const {measureHuman}=require('./source/tools/sim/refit/human_bot.js').
4. Call: measureHuman(board,{runs:20,setting:'dennis'}).
5. Board accepts the same packed/object format as measure(), including factory boards.
6. Output: firstTryRate,averageTries,lossPhase:{beforeClock,mid,late}.
7. Also: runs,slowestMove(milliseconds),minutes,version,valid and replay diagnostics.
8. Optional seed gives reproducible campaigns; omit for independently sampled runs.
9. averageTries=null if any campaign is uncleared; caps never become physical losses.
10. human-v0 passes factory milestone1 only; family and later milestones remain experimental.

## Accounting and current evidence
- Milestone1 release human-v0=bcac396; unchanged default profiles; factory100/100.
- Current approved-v2 research: family-balanced-outs-full; all100 factory campaigns clear.
- First 54.79/32.29%; before-clock 29.66/43.28% (Dennis/family).
- Risk/control gap 23.50/5.50pp; required10pp per person.
-142 repair: Dennis 19/20first,20/20clear; family 2/20first,20/20clear.
-183/183 tests; clock-contact disjoint; production replay and concealed-picture tests pass.
- Public mate-budget9801bf5; personal clock strategy6932e2e; boundary fix74f6f15.
-29 real family action choices132/144 independently replayed; exact board parity.
- Approved-v2 score anchor key-priority-refinement-full; counter 2/8.
- Historical contract1 scores and invalid trials retained; no metric/counter relabeling.
- Lab15 protocol prepared;0 model measurements; M2 unmet, no v1/v2 tag or prospective claim.
- Stop after8 experiments without progress on current milestone; no hidden exclusions.
- Small commits on wip/personal-bots; raw .codex-runs/human-style/; no pushes or Firebase writes.
