# Human-information reference: fixed re-deal benchmark

ACTIVE and UNMET. Work on wip/personal-bots in personal-bot-review.
Authoritative objective: attachment9080077f-6d85-47b8-9094-9b6b12fc0345.
Theme: sunflower. No planner changes before the current-bot re-deal baseline.

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

- Publish fixed disjoint seeds first:10 development re-deals and50 luck re-deals.
- Preserve opening face-up visible facts; shuffle only hidden picture positions.
  Preserve picture multiset/pairs, roles, clock and geometry. Retries keep that re-deal.
- First freeze the last accepted141/155 profile and current source; run all development
  cases. One table: overall target rate and the rate of each failing board.
- Classify every target miss automatically. Only propose mechanisms targeting a
  loss class covering>=10% of losses. No mechanism from one board or trace.
- Compare identical re-deals. Adopt only if overall paired improvement is>2SE and
  no board's rate drops by>10 percentage points. Up to12 independent workers.
- After8 consecutive experiments without adoption, stop and report the table,
  loss types and prospective luck flags; the user decides continuation.
- Keep an explicit experiment ledger. Historical salt-screen results are rejected
  evidence under the previous measure, not gains under this benchmark.
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

Superseded workers stopped and queues cleared. Sunflower has36 distinct identities.
Live catalog refreshed; newest natural clear156. Build and test the re-deal harness,
freeze seeds/profile/input, then run the1550 development cases with automatic losses.
No new planner mechanism or luck flag has been adopted under this objective.
