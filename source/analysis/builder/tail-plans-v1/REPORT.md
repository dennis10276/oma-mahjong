# Planned construction after G5 — 2026-11-09

The goal remains a builder that constructs a puzzle from a difficulty plan. G5 improved readable output, but did not establish that the builder can reliably hit a requested family/skilled combination. This continuation changes construction and measures its response; it does not relax the requirements or produce a release batch.

## Construction changes

`visible_choice.js` now accepts `targets.tailPairWidth: 1 | 2 | 3`. Width 1 retains G5's adjacent matching. Width 2 plans interleaved pairs (ABAB); width 3 plans ABCABC. The early/middle part after the clock uses the requested pattern, with a prompt-closing final third. Dig holders, keys and authored temptations retain priority. Pictures and covers involved in deliberate interleavings are excluded from face-down placement. The design card records the plan separately from the measured witness; neither is called a bot difficulty guarantee.

The control is explicit and experimental. Default construction remains width 1. Width 3 is not a recommended harder preset: its results include a skilled score above 19, and role/proof retries can select a different construction attempt.

`knobs.clockTile(design, tile, spare)` changes the clock position while preserving geometry, pictures, face-down tiles, gold and obstacles. It proves the game and strict minimum agree, supplies a complete replayable witness, and refuses hidden clocks, unknown minima, peek shortcuts and deadlines above 19. The new position needs its own quality and difficulty checks. This avoids regenerating the matching puzzle simply to experiment with its clock frame.

## Fixed comparisons

All measurements use the pinned fast family ruler and skilled planner. Each scored clock setting has the complete 80-campaign CURVE family measurement (4711 and 18427, both sub-blocks), plus the normal two-style skilled rating at that actual setting. Every arm has zero face-down tiles, isolating the construction response from changes in hidden-tile placement. These are deliberately narrower tests than a normal G5 supply sweep.

The complete schedules and source/profile/ruler bindings were written before rating. Rows, including misses, are retained. No ACCEPT blocks, fresh acceptance seeds, assignments, retries of refused candidates, or production changes were used.

| Experiment | Scheduled attempts | Legal outputs | E5 static pass flags | Settings measured | Settings in both coarse bands |
|---|---:|---:|---:|---:|---:|
| Eight stories, widths 1/2/3 | 24 | 24 | 24 | 72 | 0 |
| Deep-clock confirmation grid, widths 1/2 | 16 | 16 | 16 | 48 | 0 |
| Frozen matching puzzle, seven clock positions including control | 7 | 5 | 5 | 15 | 0 |

The coarse bands here are family 9–14 and skilled 2.5–6 at an eligible spare. They are a diagnostic screen, not per-level acceptance. A level would still need its exact target ±1, independent seed, traces, counterfactuals and five-level-window checks. The two deep-clock controls in the confirmation grid repeat initial measurements; the unchanged-clock control repeats the frozen puzzle. These are not 47 independent puzzles or 135 independent settings. The two failed clock placements were proved too deep for a legal deadline, not silently replaced.

Observed cost: 436.734 CPU seconds across the three experiments, including warm cache controls. This is not a cold throughput benchmark or CPU per finished level; there are no finished levels from these experiments.

## What changed, and what did not

In the first eight-story test, average skilled scores were 1.05, 1.29 and 3.33 for widths 1, 2 and 3. The width-3 mean is dominated by one unusable score of 19.32; it is not evidence of a useful general increase. Most stories remained easy for the skilled bot. One clock-in-sight control already measured family 11.65 / skilled 1.32 at spare 2: difficulty for the family alone is not enough.

The useful initial lead was deepClock/ushape, layout 22, construction seed 1. Width 1 measured family 1.01 / skilled 1.00 at spare 2. Width 2 measured family 3.175 / skilled 2.98. Those two builds used the same geometry, clock, obstacles and construction attempt, with no face-down tiles. This establishes a local construction effect, not a calibrated harder preset.

The preregistered confirmation grid varied clock way (default, 10, 13), tray room (2 or 0), and included construction seed 2 controls. It did not preserve that skilled challenge. For example, way 10 / room 0 / width 2 measured family 8.415 / skilled 1.27 at spare 1. Seed 2 / room 0 / width 1 measured family 18.475 / skilled 1.15 at spare 2. Requested way is also approximate in this constructor; actual minima are recorded. Increasing one structural request does not give a smooth, reliable difficulty response.

The clock-position experiment then froze the successful width-2 matching puzzle exactly. Moving the clock changed what the bots encountered and learned early, so even preserving pictures did not preserve the skilled rating. Tile 21 had exact clock way 16 and measured family 19.29 / skilled 1.07 at spare 1, versus family 3.135 / skilled 1.05 at spare 2. That is a cliff with no usable middle clock setting. The unchanged-clock control reproduced the original 3.175 / 2.98 measurement.

These results do not establish human difficulty or that any board is good. Trace/C1/C2/C4 acceptance was not run: none reached the joint difficulty screen. In particular, the skilled outlier must not be marketed as a successful puzzle. E5 report-only warnings remain report-only; none were hidden or tuned away.

## Next construction bottleneck

We still cannot honestly claim “give the builder any difficulty and it will make that puzzle.” The missing piece is a geometry-aware choice mechanism whose difficulty survives adjustments to the frame and changes gradually enough to hit a target. A stored ABAB/ABCABC order is insufficient: players can often use a simpler order, or a new clock route reveals information that dissolves the challenge.

The next construction work should anchor actual early/mid-board branch choices in tile dependencies, prove an observable winning alternative and consequence for each choice, and vary their count/reach while keeping the shape, special roles and information policy fixed. Use a small frozen difficulty-plan benchmark, including the relevant 10/13/16 family targets and held-out construction seeds. Report unreachable targets explicitly. Do not respond to these misses by raising build volume, lowering the skilled floor, adding luck, inventing easier/peak slots, changing gate thresholds, or flattening the post-275 curve.

The current controls remain useful for that construction work, but are not promoted into the default recipe. The approved curve still starts at 250 and continues after 275 at about +3 family tries per 25 levels.

## Reproduction and validation

Initial construction and runner: commit `c445fd22`; raw evidence is in this directory. The confirmation runner adds `--recipe-file`; its full input is `../tail-plans-confirm-v1/recipes.json`. The clock experiment embeds the frozen source row and geometry-based position schedule in `../clock-plan-v1/manifest.json`. All code fingerprints and meter pins are recorded with the outputs. Preserve existing outputs; use a new directory for any rerun with changed code.

```
node source/tools/builder/loop/heavy.js --label tail-plans -- node source/tools/builder/loop/research/compare_tail_plans.js --out source/build/new-tail-plans
node source/tools/builder/loop/heavy.js --label tail-confirm -- node source/tools/builder/loop/research/compare_tail_plans.js --recipe-file source/analysis/builder/tail-plans-confirm-v1/recipes.json --widths 1,2 --out source/build/new-tail-confirm
node source/tools/builder/loop/heavy.js --label clock-plan -- node source/tools/builder/loop/research/reframe_clock_plan.js --input source/analysis/builder/tail-plans-v1/rows.jsonl --id 45-w2 --out source/build/new-clock-plan
```

169 affected builder, gate, knob, visible-choice, loop and research tests passed. Regression checks cover deterministic builds, actual changes in matching patterns, preservation of roles/clock in the paired fixture, no added hidden information, legal replays, frozen-input preservation, exact clock relocation, refusal of unproved/hidden placements, and serialization of both research jobs. Script syntax checks and `git diff --check` passed.
