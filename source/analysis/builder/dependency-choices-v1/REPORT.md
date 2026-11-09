# Construction bottlenecks, 2026-11-09

The builder now has explicit geometry-aware dependency choices and clock-prelude
controls that preserve an existing puzzle's later decision. The latter kept
skilled difficulty near 3 while changing family difficulty substantially.
**There are no newly accepted levels from this experiment.** The response is
still too abrupt, and repeated known errors inflate the hardest family ratings.
This is progress toward constructing puzzles from a plan, not a demonstration
that the builder can reliably meet arbitrary difficulty targets.

Dennis's requirements remain those in [LEVEL-DESIGN-FACTS.md](../LEVEL-DESIGN-FACTS.md):
new work starts at 250, a steadily rising curve continues after 275, normal
skilled 2.5–6. No fallback was used here. Bots, measurement seeds, policy
thresholds and the level curve were not changed. All work was offline on the
WIP branch, with one heavy job at a time and no agents.

## What changed in construction

`dependency_choice.js` constructs a clover rather than hoping for difficult
matching after a random deal. Each active lobe has four exposed upper tiles
whose lower partners depend on two other uppers. An exhaustive local relaxation
proves that the first lower partner needs three tray places. A loose bait
picture's partner lies below this dependency, so prematurely parking that
picture makes the dependency impossible. Links swap specified partners across
lobes without moving geometry or specials. Optional known inspection pairs
and pair rewards test less immediately readable choices without face-down tiles.

The first prototype incorrectly stacked ice and a lock on the same tile. The
game displays one overlay, and two intended loose bait tiles were blocked.
The seven completed rows are retained in `pilot/`, explicitly stopped before
the eighth row. Their high ratings are **invalid evidence of a useful puzzle**.
The corrected constructor separates the roles and frees every bait tile.
Generic A2 now rejects stacked ice/lock/key roles even on exposed geometry.

`reserve_cuts.js` makes proofs of these cyclic dependencies practical. It derives
closed groups from unique face-up matching pairs and geometry, excludes hidden
and four-copy escapes, and requires that no lower partner has been removed.
It prunes a proven dead state when an outside held picture cannot be closed
before this intact group is cleared. A separate admissible clock bound guides
search without changing `toClock`'s meaning. The engine also has an aggregate
node limit for the clock frontier and all finishing proofs together. Earlier
exploratory proofs were stopped when per-goal finishing budgets multiplied;
these stops are not completed experiments or proven misses.

The corrected clover is sound but too easy for the skilled player:

| Fixed probe | Recipes attempted / built | Skilled range | Family range |
|---|---:|---:|---:|
| Corrected lobe counts and two thaw settings | 8 / 8 | 1.00–1.13 | 1.26–4.47 |
| 0–3 links across four lobes | 4 / 4 | 1.05–1.10 | 3.77–4.85 |
| Known inspection caps | 5 / 5 | 1.07–1.13 | Not run after skilled screen |
| Reward after premature single | 2 / 2 | 1.10 | Not run after skilled screen |
| Stem clock placement | 4 / 2 | 20 | 20 |

The other two stem recipes could not prove their clock minimum within budget.
Increasing logical dependency size alone did not create skilled challenge.

## Preserve the part that actually challenges the skilled player

The earlier `tail-plans-v1` experiment contains one useful body: the face-up
76-tile U board `45-w2`, with skilled 2.98 at spare 2. Two diagnostic skilled
campaigns identify a real choice: before removal 48, tile 55 is a known losing
option with known winning alternatives. Its observed loss is delayed four
removals. `diagnostic.json` records the state and full capture.

Rather than destroying that body when changing its clock, the new controls:

1. Put keys on an existing unique, initially visible matching pair and a visible
   lock on the clock or one of its covers. The lock must increase the exact
   clock minimum, and strict/game minima must agree.
2. Preserve a declared continuation: the clock and all edited prelude pictures
   are gone, every surviving picture is identical, and the tray has the same
   pictures. The runner proves a route to that exact state from the new clock
   prefix and rechecks the winning state / losing tile-55 choice.
3. Measure skilled and family difficulty afresh. A preserved physical
   continuation does not guarantee that a bot arrives with the same knowledge
   or makes the same choices.

All six early key-pair frames reached that state and retained skilled 2.77–3.33;
family remained 3.02–4.91. Later key pairs and explicit choices of locked cover
raised family difficulty. Every attempted recipe, including unresolved minima,
idle ice and overshoots, is in the manifests and `rows.jsonl` files.

One frozen coarse target-13 proposal (`prelude-order/k5-9-lock42`, spare 2)
measured family 13.69 / skilled 3.48. It passed static checks, curve, C1 and C2,
but failed trace B2 and its declared second-act B6 check. B7 was 0.730, limiting
the puzzle to target 10. **It was not qualified or sent to ACCEPT.**

Two fixed family diagnostic campaigns found 28 of 37 first errors on tile 50,
including 21 repeated known errors: it prematurely parks the picture whose
partner is locked. Swapping only two removed prelude pictures, 50 and 26,
repairs that incidental trap while preserving the later decision. The repaired
frame measures family 5.335 / skilled 2.70 at spare 2, with exact clock minimum
14. That is a construction repair, but it overshoots toward easy family play.
The other three attempted picture repairs could not prove their minimum.

## Explicit matching relief and clock detours

`frame_detours.js` adds up to three declared matching pairs inside the original
rendered footprint. Every original tile, picture, neighbour relationship and
iced-neighbour set stays unchanged. Existing non-key pictures are extended
from two to four copies; pairs may follow a declared uncovering order. The
exact clock minimum must remain unchanged, and the full strict witness replays.
The runner extends the protected state by explicitly removing the extra tiles
and verifies the same later decision.

| Recipe | Spare | Family | Skilled | Result |
|---|---:|---:|---:|---|
| Picture-repaired frame | 2 | 5.335 | 2.70 | Below family band |
| Repaired frame + 0–2 free detours | 1–3 | 5.14–6.96 | 2.70–3.13 | Below family band |
| Original frame + visible picture-23 matching relief | 2 | 7.475 | 2.98 | Below opening family band |
| Matching relief + another free pair | 3 | 8.710 | 3.35 | Below target-10 tolerance |
| Relief behind known pair + separate free pair | 3 | 13.200 | 3.10 | Fixed quality check below |
| Staged relief without the separate pair | 1–3 | 15.39–15.91 | 2.90–2.92 | Too hard |
| One relief tile covered, partner free | 1–3 | 16.66–20 | 2.95–3.13 | Too hard / censored |

These are adaptive construction diagnostics on **one underlying body**, not a
held-out yield benchmark. The non-monotone response is part of the finding.
We did not widen target bands, lower the skilled floor, retry acceptance seeds,
or hide misses to call one of these usable.

The staged-relief proposal was frozen before its 80-campaign quality capture:
target 13, spare 3, with clock-focused pacing (`secondAct:false`). A protected
late skilled choice alone does not establish substantial later family pressure.
This is a new board and declared plan, not a changed verdict for the previous
two-act proposal.

It passes calibrated static gates with no unresolved proofs, curve, trace
B1–B6, C1 and C2. B2 improves from 0.012 on the earlier board to 0.691; post-clock
loss share is 0.486 and median post-clock error position 0.427. However, B7 is
0.567: 376 of 663 losses on tries 6–20 repeat a known losing choice. Its maximum
allowed target is 10. Thus **family 13.2 / skilled 3.1 still does not qualify
for target 13**. Fresh primary/independent ACCEPT and C4 were not run on a
proposal already disqualified for its intended target.

## Evidence, verification and next work

Each probe directory preserves its schedule/recipes, exact designs, all misses,
ratings, fingerprints and per-run CPU. Constructor/knob/runner snapshots are
included where those changed during the experiments; the frame-detour helper
is also archived for its probes. The pilot is explicitly incomplete. Historical
source recovery was checked against the recorded fingerprints. Raw results
were not rewritten when the code was fixed. Stopped exploratory proof CPU is
not fully accounted for, and timings can benefit from warm caches: there is no
exhaustive cost claim or finite CPU-per-finished-level estimate.
The local attributes disable newline conversion for fingerprinted source
snapshots so their exact contents survive a Git checkout.

Validation: 231 distinct builder, engine, loop and research tests passed after
fixing two new test fixtures (one accidentally reused its deduplicated library;
the other expected a losing return for a physically illegal move, which throws).
The reserve proof was independently checked over 11,748 reachable tiny states
across 120 matching/hidden-tile variants, including 66 certified dead states.
Its clock bound was checked against exhaustive physical paths at 1,010
finishable clock states, with 606 positive bounds. Existing tests also cover
600 random engine boards and strict replay parity on 1,989 training designs.
The final audit also re-proved all 59 completed, non-pilot, non-failed frozen
designs under the aggregate node limit: strict and game minima agree, and every
stored strict witness reaches that minimum. See `strict-proof-audit.json`.
Explicit total budgets now use the accounted search in strict games as well;
the legacy strict solver is retained only when that budget is not requested.

The next construction bottleneck is **gradual family difficulty from authored
choices that do not depend on repeated known mistakes**, together with a supply
of newly built bodies that challenge the skilled player. The clover proof shows
that a real logical trap can still be obvious to the skilled bot. The protected
U body shows that clock controls can preserve a useful challenge, but it is only
one body. Next work should construct choices resembling its delayed fork in
additional geometries and retain explicit matching relief, then run fixed
comparisons. Larger random sweeps, more acceptance plumbing or calling these
raw bands finished levels will not resolve that bottleneck.
