# Trap placement and composition

2026-11-05 — factory preparation for Claude’s next task.

The initial preparation snapshot below predates Task 05. Its completed follow-up
and current limitations are recorded in the addendum at the end.

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

## Task 05 addendum — completed experiments, partial batch

The shared `3201e1e` skilled revision was adopted, fingerprint
`f32859281c746f4277ab5ef4c0006d43c76dddcc342741af8b0ff45a1b63d561`.
Family decisions and game physics were unchanged. All 60 factory regressions pass.

The composer is now `connected-traps-v3`. It adds a fourth motif,
`midgameRelay`: a matching single must remain in the tray when the clock is
taken, its partner must still be frozen, the physical dependency lower bound
must require at least three more takes, and that partner must become legally
available before 60% of the witness. The entire phase route participates in the
one-hidden-tile limit. A frozen tile that melts just by removing its covers does
not count as a second phase. Every newly authored ice/lock collection is recorded
and ablated separately, including the primary collection. Unchecked components
are explicit when an earlier failure stops further probes. Removing an idle
collection rebuilds the recipe and exact fair clock rather than retaining an
obsolete frozen/locked label.

`placement_score.js` ranks placements before bot work using Dennis's timing,
visible signposts, readable objective route, fair clock, temptation and shape
preferences. It is a hand-authored 0–100 preference, not a fitted fun or difficulty
predictor. Unlock and thaw events determine timing; a solver-tail take is not
mistaken for the decisive moment. New feedback-mode variants and steering retain
the visibility requirement. Approved old boards retain their exact pictures and
hidden tiles. Mandatory board IDs, reserved loved-board patterns and output-slot
restrictions are enforced again during assignment and verification.

The first production made 132 deals on 34 of 35 whole layouts in 439 attempts,
with mean placement score 86.1. Many nevertheless failed the skilled or
meaningful-component gates. Ten further legal midgame overlays from 22 bases
also failed full output qualification. A bounded additional palette produced two
new whole layouts and ten deals; eighteen unsuitable layout proposals were
skipped, never cropped. Eleven focused repairs plus one final relay repair did
not add a qualifying output. These trials improved authoring controls and
failure evidence, but did not demonstrate improved final batch yield.

One connected combination is demonstrably meaningful: diagnostic example 600
(`19e6fe21eb1a2b92`, hourglass, 88 tiles) has family 13.55 on the full 4711
campaigns. Removing only its original frozen guards gives 16.07; removing only
the waiting-partner ice gives 12.1. Both collections matter, in different
directions. Its two-seed family mean is 12.865 and skilled rating 2.98. It is
still unqualified: it is above the available regular slots, and the loved 225
pattern is reserved. A useful combination cannot override the curve.

The saved catalogue `batch-200-225-smart-piles.json` has 48 whole layouts,
including the earlier twenty extras and the new hourglass (700, 74 tiles) and
pyramid (704, 96). No block shapes were added. `smart-trap-examples.jsonl` saves
three explicitly unqualified examples: the meaningful partner combination,
the new hourglass with a midgame relay, and the large pyramid with a key guard.
All three passed 390×820 phone bounds and their full stored winning routes in
the actual game. Visual inspection checked both new silhouettes and their
clock badges. Their display IDs 600–602 are prototype labels, not batch slots.

Layout comparison now reuses fixed masks and D4 views. On 96 matched comparisons,
decisions were identical: 536.35ms rebuilding masks versus 84.38ms reusing them
(6.36× for that step only). There is no end-to-end speed claim. Fresh palette
plans default to four layout trials per shape, configurable with
`layoutAttempts`; the final additional search used two.

The current Task 05 handback is **9/26**, all nine approved old boards retained
exactly. All pass the current gates, portable verification with zero new bot
calls, and phone/actual-route checks. The 183-board skilled recheck produced
18 quality passes before placement constraints. Four previously delivered boards
now fail the skilled floor: 210, 217, 220 and 225. Tightening 217 to spare 1 gave
family 20. The best minimal 225 repair still failed skilled and seed agreement.
The extra star candidate also missed the independent-seed tolerance at 220.
The complete 26-level objective remains unachieved; no acceptance gate was relaxed.

The all-face-up diagnostic is not monotonic: retained 201 changes from current
skilled 5.42 to 19.93 when hidden tiles are cleared. Other boards mostly become
easier. This is a policy comparison with different observations and decisions,
not a clean causal estimate of blind-information difficulty. The actual signed
and absolute gaps are reported without changing the calibrated bot or inventing
a new numeric definition of “small”. Most retained legacy boards also have
substantial positive gaps; the new visibility preference is not claimed to have
been achieved across that unchanged legacy set.

The local `codex-tasks/results/200-225-v11/RESULT.md` handback includes scores for
every selected board, exact family/quality/fresh records, same-board old/new
planner measurements, all-face-up gaps, diagnostics for the seventeen missing
slots, the actual measured-change journal and learned priors, and preview PNGs.
No main, game files, level tables, Firebase, player records or release were changed.
