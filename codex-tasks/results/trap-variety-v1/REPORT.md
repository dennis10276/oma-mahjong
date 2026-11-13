# TASK 14 — trap variety

**In progress: 2 finished boards; 1 families have at least two. The requested thirty-board delivery is not complete.**

Branch: `wip/codex-trap-variety`, based on local `wip/cc-builder-loop` at `a9c67e90`. Only new builder helpers, analysis artifacts and this results folder are changed. No game levels, published files, main, Firebase, or game mechanics were changed. No family/skilled ratings were run.

Task 13 was already completed separately on `wip/codex-ui-markers` (`1244e794`); its report and screenshots are in that branch. Frozen-key and frozen-lock cards retain `needsUi: TASK-13` because the display change must accompany any later game integration. It is not cherry-picked here, in accordance with this task’s file ownership rule.

## Delivered families

| Family | What the player has to see | Recipe | Current observed sweep hosts | Raw builds / jobs | Example layouts |
|---|---|---|---|---:|---|
| keyRoofMeltFork | Thaw the key roof through its own neighbour before collecting the two keys together. | A staged melt on the key side rather than the clock side. | 1, 6, 12, 13, 18, 21, 24, 31, 33, 36, 43, 46 | 12/48 | 12, 46 |

Every family has its own `place()` and `prove()`, unique `mix:<name>` ledger type, see sentence and easier/harder dials. The common easier dial is spare 2; harder is spare 1, additional wrong neighbours where supported, and tail weave width 3. These are construction dials, not guarantees that every setting yields a board.

A raw build proves the route, bait, openings and special effects. It is not a finished example: separation and tail tuning can still reject it. Host sets are observed lower bounds from the bounded full-catalogue sweeps; a failure is not a proof that a layout cannot host a family. Each sweep JSON records its seed, spare, attempts, hard wall and failures. Final examples can demonstrate additional hosts.

## Thirty examples and their cards

See [the example table](../../../source/analysis/builder/bank/variety-v1/examples/CARDS.md), [selection order](../../../source/analysis/builder/bank/variety-v1/selection.json), [family metadata](../../../source/analysis/builder/bank/variety-v1/families.json) and [independent audit](../../../source/analysis/builder/bank/variety-v1/audit-final.json). Each individual Markdown card includes the see sentence, bait prices, dearest unrelated price, winning openings, tray facts, tail measure, face-down share and a labelled schematic. The JSON beside it contains the complete board and strict winning solution.

| Example card | Family | Layout | Tiles | k + spare | Winning starts | Tail greedy win | Face down |
|---|---|---:|---:|---|---:|---:|---:|
| [keyRoofMeltFork-L12-s1-p1](../../../source/analysis/builder/bank/variety-v1/examples/keyRoofMeltFork-L12-s1-p1.md) | keyRoofMeltFork | 12 | 88 | 11 + 1 | 3 | 0.2625 | 19.3% |
| [keyRoofMeltFork-L46-s1-p1](../../../source/analysis/builder/bank/variety-v1/examples/keyRoofMeltFork-L46-s1-p1.md) | keyRoofMeltFork | 46 | 74 | 9 + 1 | 4 | 0.2137 | 20.3% |

Two-opening exceptions: 0/2. They have two proven alternatives and are not single-opening needles; selection prefers three or more as requested. All unresolved opening classifications are explicit and never counted as wins.

## Proof and independent check

- Strict replay uses both `Hard.validSolution` from the game and the builder engine. The stored clock move is k; the independent checker proves the board lost at deadline k−1, including the real peek-pair rules, and checks the strict witness at k. The actual clock is exactly k + spare, at most 19.
- Every ice/lock/key/clock role is face-up with its overlay visible at move zero. Face down is at most 30%. Keys remain a real matching pair. Pictures occur twice or four times.
- Each authored bait is priced against deadlines through min(k+3,19). “Loss” on a card means lost throughout that horizon; it is not silently claimed to be an irreversible loss. Free-clock baits are tested after the clock is taken, so their loss is a genuine completion failure.
- The control is the complete, uncapped set of `detour.temptingMoves` face-up pairs and single-twin candidates outside the mechanism (roles, thaw neighbours and covers). It is not a claim about every arbitrary blind single. Cards explicitly say when a bait is no dearer than that control.
- Each lock and ice has its own ablation: a shorter exact clock route, a bait rescued at the shipped deadline, an exact post-clock losing fork rescued, or a tail greedy gain of at least 0.10. Key participation follows the actual two-key unlock rule and their matching picture; no invalid one-key counterfactual is used.
- A post-clock obstacle is not excused by the old clock-only idle gate: it must pass the tail effect proof. Tail forks include the exact stored prefix and bait. Statistical tail effects store the seed, runs and both measured values.
- Twins use `bank/separate.js`: zero close visible twins, zero close copies within a four-copy group, at most 5% close pairs overall. The tail is tuned with `bank/tail.js` to 0.15–0.40 and reported at seed 977 with 800 playouts.
- `verify_trap_mixes.js` does not import either story module and never calls a story proof, `clockShortest`, or `D.priceMove`. Fresh workers replay and independently re-price every delivered board, check every factual claim and replay the ledger order against the stored 18-entry history. Failed examples are deleted by the audit and recorded with their reasons.

## What failed and what is weak

The first pilot accidentally fixed the locked-melt clock at depth 2 while the existing placement expects an uncovered clock by default. That adapter restriction was removed. Fixed key/bait twins that are physically close cannot be repaired by changing unrelated pictures, so these placements are now rejected before tuning. Separation may also shorten k or defuse the bait; those proposals are rejected. A frozen obstacle that thaws for free is rejected as idle. Budget exhaustion remains unknown, never loss.

The all-four-copies-free post-clock idea is weak: after choosing two copies the other two remain free and can be cleared immediately. The delivered repeated-key recipes instead use an ordinary lookalike and a still-gated actual key; choosing the wrong matching pair has an explicit engine price.

My strongest ideas are the free-clock families (the goal tile is itself the wrong first move), the repeated frozen-key choice (matching pictures are not interchangeable roles), and a second-act keyed gate that still matters after the clock. The roof-key variants are weaker for variety: they extend a familiar key-first lesson and should be used sparingly. These are design judgments, not human playtest results.

| Experimental recipe outside the selected delivery | Bounded raw yield | Outcome |
|---|---:|---|
| doubleFalseStart | 1/48 | Prototype only; not counted among the twelve delivered families |
| twoLonelyMelts | 1/48 | Prototype only; not counted among the twelve delivered families |
| sharedRoofLocks | 1/48 | Prototype only; not counted among the twelve delivered families |
| splitThawLocks | 5/48 | Prototype only; not counted among the twelve delivered families |
| frozenExitFork | 0/48 | No proved host in the recorded bounded sweep; not claimed impossible |
| nestedMeltFork | 1/48 | Prototype only; not counted among the twelve delivered families |
| freeClockIce | 3/48 | Prototype only; not counted among the twelve delivered families |
| freeClockKeys | 21/48 | Prototype only; not counted among the twelve delivered families |
| freeClockShared | 2/48 | Prototype only; not counted among the twelve delivered families |
| frozenKeyShared | 6/48 | Prototype only; not counted among the twelve delivered families |
| frozenRoofShared | 0/48 | No proved host in the recorded bounded sweep; not claimed impossible |
| secondActIce | 15/48 | Prototype only; not counted among the twelve delivered families |
| secondActKeys | 10/48 | Prototype only; not counted among the twelve delivered families |
| roofKeyMelt | 2/48 | Prototype only; not counted among the twelve delivered families |
| roofKeyGuard | 12/48 | Prototype only; not counted among the twelve delivered families |
| roofKeySharedMelt | 0/48 | No proved host in the recorded bounded sweep; not claimed impossible |
| repeatedKeyChoice | 17/48 | Prototype only; not counted among the twelve delivered families |
| repeatedFrozenKey | 22/48 | Prototype only; not counted among the twelve delivered families |

## Other existing specials

`specials.js` supports gold tiles and joker face 101. Gold changes score and celebration, not matching, takeability or the clock route, so it cannot support an engine route trap on its own. Jokers can remove a waiting picture together with its partner elsewhere on the board; the current design engine does not model that wildcard action. No joker trap is claimed, and no new mechanic was added. Repeated key pictures use the existing tile-index unlock rule.

## Integration and changes needed in Claude’s files

No edits were made to `trap_stories.js`, `bank/*` or `builder-next/construct.js`. This companion builder reuses their placement hooks, exported picture/down planners, geometry, separation, tail tuner and ledger. Use `trap_mixes.build()` / the pipeline for these recipes. It does not claim that the unchanged `traps-v1` static gate profile passed: that profile rejects frozen role combinations and post-clock specials. All claims above have their own explicit checks.

For integration into the shared constructor, add a scoped way for a proved post-clock effect to satisfy the clock-only idle rule, and update combined-marker visibility once Task 13 is merged. The shared ledger should also include labs 4 and 5: this branch stores their actual played board signatures separately instead of editing Claude’s ledger. Before placement at 290+, the lead must include the final 250–289 batch and its last twelve layouts in the ledger. No placement or release is performed here.

## Reproduce and limits

All heavy runs use `loop/heavy.js`, four reserved cores per job. At most two of this task’s four-core jobs overlapped; the shared 12-core budget was respected. Worker termination provides an outer wall even for reused helper calls: bounded builds, 65-second combined generation jobs, and 90-second finishing/audit jobs. The pipeline’s 30-minute limit is for collection; the final bounded host sweep and audit follow under the same reservation.

```powershell
node source/tools/builder/loop/heavy.js --label trap-variety --cores 4 -- node source/tools/builder/pipeline_trap_mixes.js --workers 4 --minutes 30 --history-checkout ../cc-builder-loop
node source/tools/builder/loop/heavy.js --label trap-variety-audit --cores 4 -- node source/tools/builder/run_trap_mixes.js --mode verify --workers 4 --wall-ms 90000 --tag audit-rerun
$env:TRAP_MIXES_DELIVERABLES='1'
node --test source/tools/builder/test_trap_mixes.js
```

Final tests: pending final delivery checks; [test log](tests-final.log). Independent final audit: 0/30 completed, 0 passed. Solvability is an engine proof. The tail measure and my fun judgments are not guarantees about a particular human’s difficulty.
