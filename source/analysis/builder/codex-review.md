# Builder v2 independent review, 2026-11-06

Branch: `wip/codex-level-builder`, based on the preserved Task09 work and merged
with Claude's `wip/level-builder` at `2e66156`. No release or game/bot change.

## Phase 2

The final independent gate (`gate/summary-codex-final.md`) passes on the original,
unchanged fifty briefs and seeds 1, 2, 3:

- 135/150 builds (90%); 46/50 briefs build for at least one seed (92%).
- Successful builds: median 17 ms, p90 542 ms, maximum 3,813 ms.
- Every attempt, including failures, under five seconds; maximum 4,512 ms.
- All 135 returned boards meet their requested tray cap and minimum hidden dig
  count. All intents proven; no idle specials; every independent check clean.
- 156 builder/factory tests pass, with zero failures, skips or TODOs.

The earlier 148/150 result (`codex-review-1`) used the inherited permissive brief
contract. It is retained as history, not as the final gate. Requiring the actual
requested design is more useful than increasing the reported build rate.

Corrections:

1. The engine now uses the real game's clock timing: a peek pair removes both
   tiles before the alarm is checked. Per-tile timing remains an explicit
   diagnostic option. The regression proves that a last-action peeked clock is
   a winning choice rather than a false decision trap. Flat replay and the
   descriptor expectations follow the same rule.
2. Cached games compare board contents, not just object identity. Changing a
   clock, picture or obstacle cannot reuse the previous board's physics/proofs.
3. A requested tray cap is exact. The constructor no longer silently raises a
   calm cap from one to two. Incompatible covered-partner stories fail clearly.
4. Hidden luck tiles outside the dig no longer count towards `hiddenOnWay`.
   Minimum hidden dig count, maximum total hidden share and explicit trap count
   are required intents. Impossible hidden placements are rejected before
   expensive proofs. Unimplemented `frame.share`/`trapDepth` targets fail clearly.
5. The gate remeasures targets from the board, rejects unresolved clock minima,
   and replays the clock solver's complete winning route instead of redundantly
   solving it again. The resolved holder test is now mandatory, not a TODO.

Remaining failures are explicit: two briefs ask for one waiting tile in stories
that need at least two; several chain-reaction placements cannot meet the exact
pressure/luck targets. Those requests were retained in the denominator.

## Phase 1 handoff

`codex-tasks/results/pools-export/measured-pools.jsonl` contains 2,607 distinct
measured physical boards: 2,607 family ratings, 1,055 skilled ratings (527 on the
current bot), 554 current quality records. Missing skilled ratings remain null.
Historical bot fingerprints and historical/control observation kinds are kept;
this selected/tuned collection is not a random experiment. The manifest records
the content hash and source folders. `tools/builder/export_pools.js` reproduces it
without a bot call. The original fifty briefs were exported too: all ten stories
and all forty-eight source layouts are covered.

## Phase 3

`tools/builder/knobs.js` changes exact clock spare while preserving geometry,
pictures, face-down flags, specials, gold and the complete stored witness.
`knob_study.js` fixes twenty boards (two layouts per story), compares spare one
with three, and checkpoints frozen family/planner measurements. Both variants
get the same forty seeded campaigns per profile. Derived trap outcomes can
change with the clock; no additional physical parameter changes.

The first pilot was stopped when its control test exposed stale engine caching.
Its partial output is marked ABORTED and is not acceptance evidence. The fixed
study is `source/build/builder-knobs-clock-2`; its final results will be recorded
separately. The strict criterion was fixed before this run: at least sixteen of
twenty improve, per profile, with no missing or invalid pairs. Ties are reported
separately. This is a local direction check, not a calibrated retry predictor.

## Production checkpoint

Old Task09 production is stopped, with 20/26 qualified levels preserved in the
external v14 handback. Missing: 208, 210 (big), 215, 216, 217, 221. Every original
sixteen design, including gold, was rechecked identical. No old brute-force loop
is running. Builder-v2 controls are experiments, not qualified replacement levels.
Production still needs global originality, curve/seed checks, readable goals and
phone previews. Blocks remain discouraged. Phase 4 has not started.
