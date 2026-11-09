# Matching choices and their context, 2026-11-09

Proof-audit follow-up: the offline four-copy matching correction rechecked the
136 completed designs across these two reports, with no changed recorded
minima/choice outcomes, unknowns or invalid strict witnesses. See
[the correction report](../four-copy-correctness-v1/REPORT.md). Historical raw
observations below remain unchanged.

The builder now places a proven row-choice pattern in nine catalogue layouts.
A small-subgame certificate resolves seven proofs that previously exhausted
200,000 search nodes. However, isolated transfers remain too easy for the
skilled player. The strongest new clock frame reaches family 8.35 / skilled
3.75, below the opening target-10 band. **No new levels were accepted.**

The successful board's challenge depends on the interaction of its matching
choices with the surrounding puzzle. A count of proven traps, or isolated
repetition of one locally difficult pattern, is insufficient. This work changes
construction and exact offline proofs. Bots, thresholds, skilled floor, curve,
main, game levels and Firebase are unchanged. No fallback or ACCEPT seeds were
used; all heavy jobs were serialized and no agents were used.

## Construct the choice deliberately

`extraction.json` starts with the known U-board decision before tile 55 and
greedily deletes matching pairs while independently proving the state wins and
the selected move loses. The ten-tile result has a held picture, a tempting
side tile, and a roof whose match cannot yet leave its row. The winning route
reserves tray space before removing the roof. After the synthetic entry is
taken, the side choice loses and two alternatives win. This is locally
irreducible in one deletion order, not a globally minimal puzzle or an identical
bot challenge. The reduced loss shows sooner than the full board's observed loss.

`row_choice.js` matches the geometry, assigns those pictures, and pairs the
outside tiles around a legal exposure plan. It proves a concrete prefix with
one waiting picture, all nine core pictures visible, a winning continuation and
a losing side choice. The full stored strict witness replays. Explicit controls
are catalogue layout, motif index, outside removal order, outside pair width
1–2, and 0–2 earlier pairs that reuse row pictures. `control:true` changes just
two row pictures so the previously bad choice wins, preserving geometry and
prefix. Seeds relabel pictures. These are construction controls, **not calibrated
difficulty presets**.

The first `pilot/` had a mistaken geometric completion order: all 18 attempts
failed before rating. Source and failures are retained. The corrected
`transfer/` built all nine easier controls but completed only two of nine trap
proofs within budget; the other seven remained unknown.

## Prove a closed matching subgame

`row_cut.js` finds five local pictures with two copies each around the geometry.
It removes outside blockers and waiting pictures, obstacles and the clock.
That relaxation can only make the game easier: a local loss certifies a whole
board loss. Every local picture must be face-up. For four-copy pictures, all
copies outside the local ten tiles must already be gone; a live matching escape
disables that certificate. Actual geometry and pictures, not a design card,
determine the proof. Each memoized local table has at most 1,024 alive masks ×
32 waiting masks. Geometry lookup is cached with a 256-layout limit.

In `proof-audit.json`, all nine frozen trap states now prove lost. The unpruned
reference still exhausts 200,000 nodes on seven and independently proves the
other two lost. The optimized outer search checks the certificate at its first
node. That count excludes work inside the bounded local table: this is **not**
a claimed 200,000-fold CPU improvement. Unknown reference results stay unknown.

`E.game(d,{rowCuts:false})` disables this certificate alone.
`E.game(d,{reserveCuts:false})` remains the unpruned reference, disabling both
certificate families. Strict and peek clock searches use the proof too.

## Transfer results

The fixed `weave/` schedule crosses nine layouts, three proposed pair widths
and the two-picture control. Widths 1–2 build all 36 cases, but skilled stays
1.00–1.20. Width 3 cannot preserve the reserved tray place: all 18 failures
remain recorded, and the final API rejects that width up front. Family rating
is skipped after a failed skilled screen. Earlier picture copies (`echo/`)
raise the highest skilled result only to 1.40.

The layouts cover cross, ridged hourglass, U, frame, arch, bowtie, vase and two
other hourglasses. All existing catalogue coordinates and sizes are preserved.
These are experimental matching plans, not nine qualified levels.

## Test what supplies the original challenge

The fixed `context/` controls keep geometry. Outside reconstruction uses adjacent
pairs and also relocates which pictures have four copies; that limitation matters.

| Surrounding matching | Row matching | Family | Skilled |
|---|---|---:|---:|
| Original | Original choice | 3.175 | 2.98 |
| Original | Two-picture easier control | 1.885 | 1.27 |
| Reconstructed adjacent pairs | Original choice | 3.800 | 1.13 |
| Reconstructed adjacent pairs | Easier control | 1.060 | 1.00 |

The two changed pictures also participate earlier in the board. This proves
their matching structure matters in context; it does not localize all skilled
losses to one recorded state. This is one board and diagnostic campaigns, not a
generalization estimate or significance claim.

Two narrower `phases/` controls preserve every picture count and core tile.
Re-pairing only already removed outside pictures gives D3.005/S3.13; re-pairing
only surviving outside pictures gives D3.140/S2.98. Neither reproduces the wider
reconstruction's large drop, so neither phase alone is established as its cause.

`copy-context/` moves only already removed duplicate pairs onto other already
removed pictures. All surviving pictures, geometry and the checkpoint tray stay
identical. Making row picture B unique gives D3.065/S2.73; making D unique gives
D5.500/S3.77; making both unique gives D4.715/S3.67. Simply restoring extra row
picture copies in transferred templates did not recreate the skilled challenge.

`labels/` checks identity, first-occurrence canonical names, reversed names and
a rotation of names, preserving every pairwise match. Both skilled styles give
exactly 2.98 for all four original versions and exactly 1.27 for all four easier
controls. No picture-name sensitivity was observed in these checks.

## Try the new contexts with clock controls

The two higher-family copy variants were fixed before applying the earlier
visible key/cover-lock prelude, picture repair and 0–2 free-pair detours. Every
build re-proves reachability of the protected later choice and measures spares
separately. All six recipes build and pass calibrated static checks. Across
their 18 settings skilled stays in the normal band, while family stays below 9.

A declared staged three-pair recipe on the D-unique body reaches
**D8.350/S3.75 at spare 2**, with exact clock minimum 14. Its other spares give
D7.785/S3.92 and D6.850/S3.73. This is still irregular and below the opening
family band, not a qualified target-10 candidate. A proposed thaw of tile 51
cannot prove its minimum within the aggregate budget. Its three scheduled
variants remain `minimumUnproven` and are not bot-rated.

The real pipeline CLI smoke builds the new mode, passes static checks and
correctly rejects at family screening (`tooEasyAtSpare1`), leaving zero entries
in its isolated library. Full trace/ACCEPT/C4 work is not run on proposals
already outside the requested band.

## Verification and continuation

All **239 builder, engine, loop and research tests pass**. New independent checks
cover 12,554 reachable states in 60 alternative matchings (34 dead projections)
and 3,918 four-copy states (27 dead projections), plus live matching escapes,
outside blockers, hidden pictures, exact clock minima and strict/peek witnesses.
The existing random-engine and 1,989-design replay checks still pass. The frozen
data audit replays all 77 stored full witnesses.

Stages retain schedules, designs, misses, ratings and prototype source snapshots.
Fingerprinted snapshots preserve exact bytes in Git. `summary.json` separates
stages and missing CPU accounting; label probes did not record CPU. Warm caches
and adaptive stage choices prevent a clean overall yield/cost benchmark. With
no newly accepted level, finite CPU per finished level remains unmeasured.

Next construction work should plan **coupled matching choices and the states
leading into them**, using the local certificates for fast proof. The row
template is now a verified reusable component. Its isolated repetition and
simple outside interleaving are demonstrated misses for the skilled target.
The useful matching contexts still share one U geometry; broader skilled puzzle
supply and gradual joint family/skilled control remain open.
