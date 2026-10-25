# Human-information reference: fixed re-deal benchmark

ACTIVE and UNMET. Work on wip/personal-bots in personal-bot-review.
Authoritative objective: attachment9080077f-6d85-47b8-9094-9b6b12fc0345.
Theme: sunflower. User correction2026-10-25: re-deals must be certified winnable.

## Information and rules

- One small visibility gate: only face-up visible pictures and ice/lock/key roles.
  Covered clock badges are public. A rejected free tap means ice or lock, not which.
- Retry memory contains only actual observations from the same level/re-deal.
  Hidden fillings remain guesses. Every real level being winnable is an allowed prior.
- Policy never reads hidden pictures, deck, seed or future reveals. General planning
  only: no per-level routes/settings. Every accepted tap replays original production.
- Anytime, single-thread games, under2s per move; report the slowest move.

## Cohort and targets

- Every recorded natural first clear17-156, plus later clears.
- User clarified labs: all recorded Dennis clears in source/analysis/lab-clears.json,
  excluding10031; unrecorded IDs are not test boards. New lab clears join later.
- Current catalog:140 natural plus15 labs, all available; preserve board provenance.
  Historical boards without recordings use explicitly labeled authorized definitions.
- Human1 requires bot1; humanN>=2 requires bot<=N-1. Every restart counts.

## Development benchmark and adoption

- Publish fixed disjoint draw streams first; select10 development and50 luck re-deals.
- Preserve opening face-up visible facts; shuffle only hidden picture positions.
  Preserve picture multiset/pairs, roles, clock and geometry. Retries keep that re-deal.
- Benchmark-only full-information exact solver may inspect all facts. Accept only
  production-replayed winning routes; discard exhaustive losses and capped draws.
  Report draws/accepts/exhaustive losses/caps separately per board. No oracle data
  reaches the human-information bot. Selection never depends on its performance.
- Re-run frozen baseline on certified re-deals and real boards; show141/155 sanity
  reference. Report a large gap before experimenting (predeclared>10 points).
- Classify every target miss automatically. Only propose mechanisms targeting a
  loss class covering>=10% of losses. No mechanism from one board or trace.
- Compare identical re-deals. Adopt only if overall paired improvement is>2SE and
  no board's rate drops by>10 percentage points. Up to12 independent workers.
- After8 consecutive experiments without adoption, stop and report the table,
  loss types and prospective luck flags; the user decides continuation.
- Fresh batch authorized after solvability audit and baseline sanity. Up to8
  experiments; twelve old salt screens do NOT count toward this stop rule.
- Small commits on this branch. This file<=80 lines. One short table per experiment.
  New raw inputs/checkpoints/logs live in ignored .codex-runs/, not source/analysis.

## Luck and finish

- A flag requires final frozen-bot target rate<50% on50 fixed re-deals AND a real-board
  position showing loss shares for EVERY possible action over consistent fillings.
  Bounded search failure is unresolved, not proof. Report shares honestly.
- At most10% of boards may be flagged. More means improve the planner, not excuse it.
  Recompute flags for the final version; improved boards lose their flags.
- Salt1 real boards must meet target on every unflagged board. List each flagged
  board with Dennis/bot tries and target rate; user acceptance is required.
- Freeze and run the next20 progression levels ONCE unchanged; compare when played.
- Final one-screen summary: level|Dennis|bot|flag, separate lab block, overall
  re-deal rate, planner changes, slowest move and any user decision needed.

## Immediate work

Unconditioned v1 baseline332/1550 is archived. Old12 salt screens are excluded.
Protocolf7773f5; oracle3956ee5; rangesf89abbf; dispatcherb5c3578;106/106 tests pass.
Certified1550 ordered wins:82859 draws,77920 exhaustive losses,3389 discarded caps.
All selected routes freshly replay production. Original prefixes and tail evidence kept.
Manifestda3d05314eb24d6f8068e3eef40ec2f576a8c69aec4fc66690ffa901a4e87efc.
Frozen certified baseline657/1550(42.4%), complete/valid; all12 workers exited0.
Same bot real sanity141/155(91.0%);48.6-point material gap reported before experiments.
Code/profile/try budgets/public context match; slowest certified move1.535s.
Eligible losses: unseen twins634/893(71.0%,139 boards); safe-match misses200(22.4%).
Fresh batch<=8 authorized; no-gain counter1. Fit pressure management first.
Experiment01:658/1550,+0.06points versus2SE0.89;board35-20points;not adopted.
Eight public diagnostic boards reproduced misses; inspect earlier pressure choices.
Experiment02(54ffbbc):balancedTrayRecovery=true;full1550-case paired run active.
No planner change or luck flag adopted. Raw outputs remain in .codex-runs/.
