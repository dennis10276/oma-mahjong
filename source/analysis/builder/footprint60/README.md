# 60 px construction and preservation — 2026-11-15

Dennis: make the builder and ideas work on a 60 px footprint, keep the traps/chains, prove their intended effect,
and actively make a smaller layout work rather than merely rejecting it. No release is authorized.

`footprint.js` measures the rendered pile on a 392 x 730 reference phone. It reserves 10 px above/below the pile,
uses the ordinary/compact board heights, and includes layer offsets and tile depth. The minimum is 60 px for
regular and 96-tile boards alike, with at most eight rows. This is nominal tile pitch, consistent with earlier
measurements; the face rectangle is 1.5 px narrower. It models the proposed tray spacing, not a released UI change.

`compact_footprint.js` actively repacks into six-column, seven-row windows, trying different windows, placement
seeds and additional surrounding tiles to relocate. It adapts Gemini's geometry placement (f4c0eb04), not its old
53.4 px acceptance or its source-specific proof shortcuts. It keeps tile count, faces, face-down positions,
specials, clock and winning route. A failed candidate leads to the next placement; construction entry points
also try further role placements. Search failures are bounded/inconclusive and include the binding dependencies.

The ordinary builder, visible-choice builder, trap stories and composed/new-idea constructor call this stage.
The declarative idea/chain definitions are unchanged. The export gate uses the same 60 px profile; `--minpx`
is still available for explicit historical dry runs but cannot be used with `--write`.

The separate `preserve_trap.js` check never calls a constructor's story proof. It compares core blocking
expressions (an empty side is always free), cover/thaw links, every copy of a core picture, and initial visibility.
It replays both wins, independently proves equal shortest clock routes/spare, reprices each authored bait via
engine searches, and checks the declared chain against its specification. Unknowns fail certification. For
unannotated old boards it requires the full physical blocker graph to stay identical. Certificates bind both
design hashes and include the before/after bait results. Export/playtesting is still separate from adoption.

Initial drafts, measured in the actual browser renderer at 392 x 730 with the proposed tray margin:

| Level | Tiles retained | Tile pitch | Tray gap |
|---|---:|---:|---:|
| 266 | 76 | 63.35 px | 16 px |
| 281 | 80 | 61.93 px | 26.7 px |
| 300 | 96 | 61.93 px | 31 px |

Images: `level-266.png`, `level-281.png`, `level-300.png`. Frozen input records are in
`tools/builder/fixtures/footprint60-<level>.json`; regenerate the drafts with `compact` in the test below.
These three are initial evidence, not a claim that every placed board has been migrated. The initial 250/251/258
attempts still need repairs to core dependencies or thaw links. Their traps were not weakened to obtain a pass.

Validation: `node --test source/tools/builder/test_compact_footprint.js source/tools/builder/test_chained_v2.js
source/tools/builder/test_chained_six_ideas.js source/tools/builder/test_chained_six_review.js
source/tools/builder/test_engine.js` passed 40/40; `node source/tools/builder/bank/test_export_levels.js` passed.
The footprint tests include actual construction on a formerly undersized host, certified compaction of the three
boards, source immutability, and refusal of changed clocks, faces, routes, thaw relations and unproven searches.
All three stored routes also won through the real browser game, with no page errors.

CLI: `node source/tools/builder/compact_footprint.js input-record.json separate-output.json`.
Independent recheck: `node source/tools/builder/preserve_trap.js before-record.json after-record.json`.
Keep full authored records (card/roles/brief), rather than a design-only table row, for the intended trap proof.
