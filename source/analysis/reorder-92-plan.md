# Reorder from level 92 — unpublished work

Requested by Dennis on 2026-10-16. This explicitly supersedes the earlier decision to keep
92–105 fixed. Levels 1–91 remain fixed. No publication, APK build, database writes, player
resets or changes to completed stars/history are authorized by this task.

## Plan

1. Freeze the current live 1.53 table and the calibrated honest simulator at commit `316f3b1`.
   That is the simulator used for the personal predictions, before experimental behaviour
   cloning. Keep it in offline tooling, separate from the game's runtime simulator.
2. Measure every existing board from 92–269, plus level 91 as a boundary reference, with
   Dennisisdebeste's and Mrs. Doubtfire's fitted personas. Run 1,200 four-attempt chains per
   board/persona; use each person's fitted retry memory. No hints, shuffles or easier deals.
3. For each person, weight first-try success 50%, success within two attempts 25%, and within
   four 25%. Give the two people equal weight. Group that combined ease into five-percentage-
   point bands, easiest first. Start with old order inside each band; smooth both people's
   difficulty paths by swapping only within the same size/band group (primary samples only,
   deterministic seed; exact ties retain original order). This is a practical
   compromise between two different players, not a promise of exact difficulty for either.
4. Sort large boards separately into every tenth slot; sort regular boards into other slots.
   Preserve every complete packed board exactly, including its stored legacy measurement,
   clock, face-down tiles, special tiles and solution. Use each board once. No redesign.
5. Validate with 600 additional chains per board/persona using an independent seed. Report
   both players separately, the 91/92 boundary, difficulty jumps, and hardest boards. Do not
   claim tiny differences or perfectly smooth progression around large-board slots.
6. Apply the permutation only to source. Give the changed range a new design generation so
   old saved boards cannot be resumed against a different level; preserve saves through 91.
   Keep historical release tests against the frozen table, and add current permutation,
   solution and saved-game migration tests. Run the complete offline suite.
7. Prepare draft predictions for the new numbering, without replacing current 1.53 predictions.
   Leave a local review report and old-to-new mapping on `wip/reorder-levels-92`. Leave main,
   the generated published site, the current dashboard predictions and Firebase unchanged.

## Release considerations

The user explicitly requested renumbering 92 and up, including some boards Dennis has already
played. Future attempts will use the new numbers; historical logs and recordings must retain
their original app version and board. No existing scores or stars should be rewritten.

Before a later publication, regenerate the dashboard predictions for the new table and retain
version-specific predictions for old clients. The current 1.53 predictions must not be silently
relabelled as predictions for the reordered boards. No new game release version is reserved
until publication is requested. The first 91 levels are outside this reorder, so level 91's
current difficulty remains unchanged. Reordering cannot make the hardest boards easier.

## Completed

Implemented locally on `wip/reorder-levels-92`. The full offline suite passed 125/125;
the three reorder checks also passed after normalizing input fingerprints across platforms.
See `reorder-92-review.md` for validation, caveats and the first placements, and
`reorder-92-mapping.csv` for the complete permutation. Updated predictions are prepared
separately in `reorder-92-predictions.json`. Nothing was published.
