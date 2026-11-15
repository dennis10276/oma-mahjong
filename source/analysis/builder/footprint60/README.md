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
These three were the initial evidence. The range migration below now includes 250, 251 and 258.

Validation: `node --test source/tools/builder/test_compact_footprint.js source/tools/builder/test_chained_v2.js
source/tools/builder/test_chained_six_ideas.js source/tools/builder/test_chained_six_review.js
source/tools/builder/test_engine.js` passed 40/40; `node source/tools/builder/bank/test_export_levels.js` passed.
The footprint tests include actual construction on a formerly undersized host, certified compaction of the three
boards, source immutability, and refusal of changed clocks, faces, routes, thaw relations and unproven searches.
All three stored routes also won through the real browser game, with no page errors.

CLI: `node source/tools/builder/compact_footprint.js input-record.json separate-output.json`.
Independent recheck: `node source/tools/builder/preserve_trap.js before-record.json after-record.json`.
Keep full authored records (card/roles/brief), rather than a design-only table row, for the intended trap proof.

## Levels 250–300 review

The frozen review pack is `range-250-300.json`, against released 1.69 commit `a99b338e`.
**46 of 51 drafts pass; 262, 272, 289, 291 and 296 still need repairs. Nothing is adopted or released.**
The pack contains every original board and only passing replacements; held rows have no replacement.
`browser-range.json` records real-game wins and renderer measurements for all 46 passing drafts.

The migration targets roughly 60 px: an explicit 58 px review floor permits compact eight-row alternatives
when necessary to retain the mechanism. This does not lower the ordinary builder/export default of 60 px.
The passing drafts measure 58.32–63.35 px (median 61.93), with at most eight rows and at least 11.2 px of
tray clearance on the reference phone. Eight drafts fall below 60: 256, 273, 277, 278, 279, 286, 287 and 298.
These figures include the proposed 10 px tray margin; other phone dimensions still fit responsively.

| Large board | Tiles retained | Browser tile pitch | Tray gap |
|---|---:|---:|---:|
| 250 | 96 | 60.58 px | 32.7 px |
| 260 | 96 | 61.93 px | 22.4 px |
| 270 | 96 | 61.93 px | 26.7 px |
| 280 | 96 | 61.93 px | 31.0 px |
| 290 | 96 | 61.93 px | 22.4 px |
| 300 | 96 | 61.93 px | 31.0 px |

`level-250-before.png` and `level-250-after.png` show the actual browser, both with the proposed tray margin.
The original geometry measures 52.65 px with that margin, versus 60.58 px after compaction; the released UI
without the new margin renders the original at about 54.1 px. No tiles were removed.

`preserve_intent.js` supplies a separate, scoped behavioural contract for layouts whose ordinary filler changes.
It checks identical pictures, down/gold flags, specials, clock deadline and stored route; all authored and direct
special-role links; order-independent prerequisites between special roles; gate availability at every stored
route state; readable original badges; equal proven shortest winning clock routes and spare; and equal clock
effects when each ice or lock is removed. It independently reprices authored baits on both boards, proves they
still lose at the actual deadline, and compares role/picture decisions at critical pre-clock stages.
Declared chain specifications are checked separately. Unknown search results fail certification.

This contract does **not** claim every ordinary filler access pattern or every possible tail decision is identical.
For older boards lacking an authored card, it recovers measurable special-role dependencies from the released
board; it cannot recover an undocumented author's intention. Those rows retain the same special-role contract
and winning-route tray pressure, with this limitation explicit. The stronger original `preserve_trap.js` contract
remains the ordinary builder's default. In particular, successful route replay alone never approves a restack:
the rejected 262 and 296 drafts fit the footprint and win, but change gate prerequisites.

Historical bait cards can use different measurement horizons. Level 256's old label is not trusted as a new
measurement: both frozen and compact boards are searched afresh at the same budgets, including the real deadline.
The regression fixture proves its bait may win with extra clock budget while still losing at the actual deadline.
Level 298 keeps its mechanism together while its filler is rebuilt; lowering the top canopy and guarding readable
badges during placement makes 59.83 px work without changing any of its three losing baits.

Recheck the frozen pack without the ignored solver workspace:

```powershell
node source/tools/builder/bank/review_range.js source/analysis/builder/footprint60/range-250-300.json
```

Browser replay against the separate UI review checkout (whose board renderer has the proposed tray margin):

```powershell
$env:CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
node source/tools/builder/bank/play_review_range.js source/analysis/builder/footprint60/range-250-300.json ../oma-mahjong-main source/build/range-browser.json
```

The phone harness intercepts Firebase and uses test identities. It never writes real player data.
The range audit always reports `released: false`; incomplete packs remain `complete: false`.
No migration command writes `placed-all`, `www/levels-hard.js`, published files or player saves.

Offline repairs are in `bank/repair_range.js`, `bank/repair_reflected.js` and `bank/learn_core.js`.
They try alternate windows, reflected outlines, additional relocation, gate constraints and slot assignments;
the independent contract alone accepts a result. OR-Tools is optional and used only by offline slot repair:

```powershell
python -m pip install --target source/build/footprint-solver -r source/tools/builder/requirements-footprint.txt
```

Range validation: 46/46 actual-game winning routes, matching measured bounds, retained tile counts, no nine-row
accepted drafts, and no page errors. Builder/engine/chain regressions pass 46/46, including the six new intent
tests; the export regression also passes. The untouched released table and all levels below 250 remain unchanged.
