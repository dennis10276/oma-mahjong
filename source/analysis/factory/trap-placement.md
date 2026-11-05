# Trap placement and composition

2026-11-05 — factory preparation for Claude’s next task.

New construction now explores several placements on a fresh whole board, preserves earlier authored roles, and checks that supporting traps matter individually. No level batch was generated or published by this work.

## Concrete changes

- A bounded beam explores seeded candidate locations/key pairs. Four intents favour linked dependencies, crossing the board, staged unlocks/thaws, or keeping a tray escape.
- Later recipes retain the original clock, waiting clock partner, keys, locks, ice and authored picture/hidden-tile relationships. An incompatible overwrite or no-op is a rejected construction, with a reason.
- Supporting motifs extend the actual clock/key dig: `keyGuardIce`, `partnerRelay`, and `thawRelay`. Existing frozen-guard, ice-chain and partner-lock combinations can also extend earlier roles instead of replacing them.
- Every construction records its intent and actual cover/unlock/thaw/partner edges in `trapPlan`. Arrangement signatures discourage repeated placements within one creation. Whole-layout originality and the minimum 72 tiles remain enforced.
- Only matching composer proofs count towards a new constructor quota. Historical warm deals and bot measurements stay available; old rows are not silently labelled as newly composed.
- Added support components get their own full family ablation before skilled planning. Idle, missing or unresolved supports fail. A versioned role manifest prevents stale group-only quality records from qualifying these rows.

## Measured authoring trial

36 layout/recipe cases, 9 legal construction candidates across five recipe combinations, including all three new motifs. Total placement time 17.829s; maximum 1.286s. These are structural candidates, not curve-qualified levels.

On 16 matched older-recipe cases, legacy placement took 44.608s and produced 4 legal boards; 1 of those erased an earlier role. The bounded composer took 10.278s and produced 4 legal boards with preserved roles. This small construction-only comparison excludes whole-layout generation, fresh dealing, bot qualification and final assignment; it does not establish an end-to-end production speedup.

The shared 1,200ms composition deadline and 400ms probe budget stop legacy inner searches from consuming several seconds per unsuccessful placement. Each recipe step receives a share of the budget. Exact proofs are reused within a composition; unresolved routes never become accepted clocks. Some valid slow designs are deliberately skipped. Budgets remain plan options.

## What the bot probes taught us

Three sample additions were measured with and without only their own added ice: family, 20 runs × 2 seeds, seed 4711 (40 campaigns each). The main trap, pictures, hidden tiles and clock limit were kept. The independent acceptance seed 29717 was not used.

| Added motif | Without: tries / first-try probability | With: tries / first-try probability | Actual quality result |
|---|---|---|---|
| partnerRelay | 1.18 / 0.9 | 1.18 / 0.9 | idleSupport |
| keyGuardIce | 1.6 / 0.45 | 1.38 / 0.7 | fails skilled minimum |
| thawRelay | 1.27 / 0.85 | 1.27 / 0.85 | idleSupport |

Two first examples were structurally connected but idle for this family bot. The useful key-guard example made the board easier, and still failed the skilled minimum. Those findings led to the component ablation gate; none of these examples is being offered as a qualified level. A support matters when its removal changes expected tries by at least 0.3 or first-try probability by at least 0.15. Its effect may point in either direction.

The new gate was exercised on these actual samples: the two idle supports were rejected before planner work. Family/planner code, game physics, curve tolerances, seed rules and the other acceptance limits were unchanged. The calibrated bot fingerprint remains cae3bc38f7b01e627e288330d5ba0cf210383e39e864ab35976e29faff64f83d.

## Validation and use

51 factory tests pass, including role preservation, actual key/partner/thaw placements, seeded diversity and reproducibility on the same whole board, deadline restoration, exact-route cache isolation, component removal and stale quality-manifest rejection. All five diagnostic examples passed 390×820 tile-bounds checks and their stored winning routes in the real game. Visual inspection covered the three new motif examples. Example 607 exposes an existing right-edge clock-badge clipping issue; tile bounds pass, but it remains a diagnostic prototype.

`trap-placement-study.json` contains case timings, failure reasons, paired bot probes and full quality results. `trap-placement-examples.jsonl` contains the five unqualified prototypes (IDs 600+), separate from the 200–225 deliverables. Preview PNGs and detailed logs remain in `source/build/trap-placement-preview` and `source/build/trap-placement-*.log` on the PC.

Run new production in a new output directory, since authoring code is part of the checkpoint fingerprint. `construct_original.js` and `build.js` use the composer. Slot `placementIntent` and plan `placementProbes`, `placementBeam`, `placementMilliseconds`, `placementProbeMilliseconds` control the search. See the factory README for the motif preconditions and metadata contract. After steering, `authored(row)` detects a stale original placement snapshot; `analyze(row.design)` explains the current board, and component checks measure surviving roles on that actual board.

Claude’s Task 05 arrived while this preparation was being finished. Its player-feedback placement score, next skilled bot and v11 batch are the next work. The measurements above used the Task 04 bot. The existing Task 03/04 handback remains unchanged.
