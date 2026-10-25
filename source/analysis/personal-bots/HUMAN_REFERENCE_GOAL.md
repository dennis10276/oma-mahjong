# Human-information level-design measuring bot

ACTIVE and UNMET. Branch wip/personal-bots; checkout personal-bot-review.
Goal replaced by Dennis2026-10-25: clear every level and measure difficulty like him.
Use sunflower tiles. Deliver a label-free measuring tool for new levels and lessons.

## Rules

- ONE visibility function supplies visible pictures/roles and covered clock badges.
- A rejected free tap establishes ice OR lock; never inspect hidden legality first.
- Retry memory stays within the same board and salt, using actual observations.
- Dennis permits certain picture deductions: retain a proof valid for EVERY hidden
  board consistent with observations and rules. Sample agreement is not certainty.
  Proven deductions may join trusted memory; sampled guesses never do.
- Every level being winnable is an allowed prior. Never read true hidden pictures,
  the deck, board seed or future reveals. General planning; no per-level settings.
- Every attempt independently replays original production. Single-thread games,
  anytime and under2s/move. Up to12 concurrent game workers; report slowest move.

## Test set and finish gates

- Every recorded Dennis natural first clear17-156 and later; all15 recorded labs
  in source/analysis/lab-clears.json, excluding10031. Keep historical provenance.
- Real boards unchanged; public policy salts1,2,3; at most12 actual tries per salt.
- 3a: every board clears on every salt. Never clearing is a hard failure.
- 3b: each salt needs at most Dennis+1 tries, including2 when Dennis needed1.
- 3c: sum of per-board mean bot tries<=sum of Dennis tries. Show all salt totals.
- 3d: Spearman>=0.6 on levels with Dennis>=2 or mean bot tries>1; average ranks
  for ties. Censored attempts do not become invented successful counts.
- List10 largest mismatches; underestimating difficulty counts double.
- No Dennis label enters measure() or the playing policy. Labels evaluate afterward.

## Target API (implementation in progress): ten-line builder contract

1. Module: source/tools/sim/refit/human_level_measure.js(CommonJS).
2. Call: measure(board,{salts:[1,2,3],maxTries:12}).
3. Board is production game format, including lab and unreleased candidates.
4. Salts vary public policy choices; pictures, roles, clock and board stay unchanged.
5. triesPerSalt follows salts order; null means no verified clear within the limit.
6. firstTryWinRate includes every salt; averageTries is null if any salt is censored.
7. lossTypes counts failed attempts; slowestMove is milliseconds.
8. minutesPerBoard reports total measurement time; valid requires replay and timing.
9. CLI: node source/tools/sim/refit/human_level_measure.js board.json --salts 1,2,3 --max-tries 12.
10. CLI returns JSON; --out .codex-runs/result.json saves it. No Dennis label needed.

## Development and completion

- Start with current 3a/3b failures, especially labs10011,10032,10033,10041,10052.
- Audit origin/wip/det-bot at2513920; adopt useful retry memory/replanning ideas
  through the existing public observer and independent production replay.
- First run failing levels plus20 fixed guard levels on salts1-3, then full cohort.
- Adopt only a change that fixes a failing level without breaking a passing level.
- After8 consecutive trials without adoption, stop and report table/open failures;
  Dennis decides continuation. Preserve old trial histories under their old gates.
- Certified re-deal and luck measurements are STOPPED; code/evidence kept archived.
- Small commits. This file<=80 lines. One short table/run; raw data in .codex-runs/.
- Completion requires3a-3d plus working documented measure() on an unseen lab board.
- Then freeze the bot; run next20 progression levels ONCE when Dennis has played
  them; report actual tries alongside Dennis and difficulty correlation.
- Final one-screen table: level|Dennis|bot salts1-3; separate lab block; bot/Dennis
  totals, correlation, slowest move, minutes/board and decisions for Dennis.

## Current evidence

- Old pipeline, runner and12 workers verified stopped; native session99870 exited1.
- Seven old re-deal trials completed without adoption; trial08 cancelled incomplete
  and timing-invalid. These are not results under the new real-board gate.
- detbot prototype reports complementary retry clears; audit and integration pending.
- measure(), real three-salt baseline, new-gate trials and final freeze are incomplete.
