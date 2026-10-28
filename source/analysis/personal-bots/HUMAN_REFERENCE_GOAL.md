# Frozen reference and human-like player calibration

ACTIVE and UNMET. The current goal replaces per-level attempt matching.

## Frozen Track A

- Policy40 is frozen in human_reference_frozen.json, with source/profile hashes.
- measure(board) defaults to three actual tries on salts1,2,3.
- finishable=true means all three clear within3; false is a bounded failure,
  never proof of impossibility; invalid/incomplete coverage returns null.
- Preserve human-visible information, observed retry memory and production replay.
- No new WHEN conditions. Experiments60/61 from the old goal are retired.
- Historical162-board policy40 baseline:155 clear within3 on every salt;
  161 clear within12 on every salt. These are different gates.

## Independent Track B

- Build a human-like controller with short clock planning, limited tray lookahead,
  forgetting of previously seen closed pictures and stochastic legal choices.
- Same production physics and one validated observer; no exact route solver.
- Two global settings: Dennis and weaker family. No per-level settings or routes.
- Fit patterns, never per-level successful attempt counts.
- a: Dennis first-try rate50-55% across92-163; family about30%.
- b: failed attempts55-60% before clock, about40% mid, under10% late.
- c: risk cohort132/144/91/89/99/122/142/96/143/94 must lose clearly more
  than10 fixed levels with no observed human losses;132/135/142/144 lose
  predominantly before clock.
- Predeclare late threshold, tolerances, cohorts and seeds before experiments.
- Report uncertainty, board provenance, actual losses and computational censoring.
- measureHuman(board,{runs:20}) returns first-try rate, average tries,
  phase shares for both settings, censoring and minutes/board.
- Retries require an actual completed physical loss. No free restarts at caps.
- Stop after8 experiments without progress on a-c; honest baseline is only a start.
- Once a-c hold, freeze and check subsequent unopened Dennis progression levels.
- Completion requires that prospective check, with a one-screen summary.

## Boundaries and accounting

- Source-only small commits; raw run artifacts in .codex-runs/.
- No Firebase writes, publication or pushes. Preserve unrelated experiments.
- One game per worker; keep timing and production replay validation.
- User-supplied Claude findings motivate the target patterns; they do not prove
  that all board features lack predictive information.
- Archived canonical91 clears1/1/1, unlike the supplied3-try comparison;
  preserve that discrepancy until the board/version can be reconciled.
