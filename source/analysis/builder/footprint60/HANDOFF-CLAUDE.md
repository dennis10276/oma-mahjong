# Claude handoff: compact levels 250–300

Prepared 2026-11-15. Continue the work; do not release.

## What Dennis wants

- Roughly 60 CSS px tiles on the 392 × 730 reference phone, with space between tray and pile.
- No nine-row boards, including the 96-tile boards. Keep the tiles; actively reshape and restack.
- Keep the intended traps and chains and independently prove their effects after reshaping.
- Apply the construction approach to both builder and ideas branches.
- Dennis explicitly stopped the proposed release: **no release, deployment, main merge, or publication is authorized**.

His latest work request was about the whole 250–300 range. This handoff does not mean that range is finished.

## Checkouts and saved work

Workspace root: `C:/Users/den_k/Idea/OmasMahjong`.

| Checkout | Branch | Relevant saved commit |
|---|---|---|
| `cc-builder-loop` | `wip/cc-builder-loop` | `8554ef3d` — range tools, proofs, 46 passing drafts |
| `codex-new-ideas` | `wip/codex-new-ideas` | `c573c844` — same changes cherry-picked into ideas |
| `oma-mahjong-main` | `wip/60px-board-review` | `3b188bcd` — UI review checkout and progress note |

These were clean after the saved work; recheck status before editing. This handoff is an additional documentation commit.
No changes were pushed during this work. Read each checkout's `AGENTS.md` and
`source/analysis/builder/LEVEL-DESIGN-FACTS.md` before continuing.

The frozen comparison baseline is released 1.69, commit **`a99b338e`**. No game table, `placed-all` board,
published root file, or real player save was changed by the range migration. Recheck remote state before any later release.
The held Gemini restack (`f4c0eb04`) helped supply the geometry algorithm; adopting it alone does not establish the 60 px goal.

## Current result: 46 of 51

Start with `source/analysis/builder/footprint60/README.md` and these tracked artifacts in builder or ideas:

- `range-250-300.json`: all 51 frozen originals, 46 passing replacements, certificates, and five held rows.
  Held rows have `draft: null`; they are not approved fallback replacements.
- `browser-range.json`: 46/46 actual browser wins and renderer measurements, with no page errors.
- `level-250-before.png`, `level-250-after.png`: actual phone screenshots with the proposed tray margin.

Passing drafts measure **58.32–63.35 px**, median 61.93, at most eight rows, and at least 11.2 px tray clearance.
The eight below 60 are **256, 273, 277, 278, 279, 286, 287, 298**. The migration explicitly uses a 58 px
review floor for “roughly 60”; ordinary builder and export defaults remain **60**. Do not quietly lower those defaults.
The current pack is therefore a review artifact, not an export-ready or adopted full replacement set.

All six large boards retain **96 tiles**:

| Level | Tile pitch | Tray clearance |
|---|---:|---:|
| 250 | 60.58 | 32.7 |
| 260 | 61.93 | 22.4 |
| 270 | 61.93 | 26.7 |
| 280 | 61.93 | 31.0 |
| 290 | 61.93 | 22.4 |
| 300 | 61.93 | 31.0 |

Level 250 is seven rows. Its original geometry is about 54.1 px in the released UI, or 52.65 px with the proposed
tray margin. The new geometry is 60.58 px with that margin. Tile pitch is nominal width; the face rectangle is 1.5 px narrower.

## Five boards still need constructive repairs

**262, 272, 289, 291, 296**. Searches were bounded and inconclusive, not proofs that compact layouts cannot work.

| Level | Original source | What current attempts break |
|---|---|---|
| 262 | `older factory4-176` | Gate prerequisites between special roles; a compact winning draft exists but fails causality checks |
| 272 | `older factory4-175` | Covered/frozen key links at the right edge, thaw timing, or clock-route dependencies |
| 289 | `older factory2-175` | Links and prerequisites across the many late locks/ice roles |
| 291 | `older factory6-188` | Ice 79 becomes available at a different witness step; other attempts break key/clock or ice links |
| 296 | `older blind1-185` | Particularly ice 2/22/38 prerequisites; a compact winning draft exists but fails the stronger contract |

Additional historical evidence is in `source/analysis/builder/process-v1/e5-boards.json`:
262's recipe is `lockedClock`, 272's `chainReaction`, 291's `dontGrab` + `lockedPartners`, and 296's `iceLockClock`.
289 has no recipe recorded. Relevant original concept descriptions are in `source/tools/factory/design_traps.js`.
Do not assume incidental geometry or a historical recipe label is itself a proof of intended behaviour.

Two successful difficult repairs may help:

- **251:** manually rebuilt its causal access paths as vertical stacks, then repacked filler. 63.35 px,
  shortest winning clock route still 14 and spare still 2. Local scratch reproduction: `source/build/manual251.js`.
- **298:** kept the mechanism and its matching pictures together, repacked filler, shifted the top assembly down
  one coordinate unit, and guarded readable badges and actual rendered bounds during placement. 59.83 px,
  all three authored baits still lose at the same prices. Local scratch: `source/build/repack-mechanism.js`.

## Proof contracts: be precise

`source/tools/builder/compact_footprint.js` remains the ordinary construction stage, using the stronger
`preserve_trap.js` contract. It actively relocates tiles; it is not just a rejection filter. Builder, stories,
mixed traps, and the ideas constructor already call it. Initial implementation was `d06cb9e4`.

The range also uses **`preserve_intent.js`**, a separate explicitly scoped behavioural contract that permits
ordinary filler access patterns to change. Its checks include:

- Same tile count, faces, down/gold flags, obstacles, clock/deadline, and full stored winning route.
- Valid coordinates and no overlap within a layer.
- Authored links, direct special-role links, and order-independent prerequisites between special roles.
- Same gate availability at every stored route state and retention of originally readable special badges.
- Same proven minimum winning clock route and spare; same clock effect when each ice/lock is removed.
- Authored baits independently re-measured on both frozen and compact boards, including losses at the real deadline.
- Same tested role/picture decision outcomes at critical pre-clock stages; declared chain structure where available.
- Unknown searches fail certification; certificates bind both design hashes.

This is **not complete equivalence of every filler move or every possible tail decision**. Older boards without
authored trap cards get a recovered special-role contract from the released board, not recovered undocumented
author intent. Keep that limitation visible. A winning stored route alone is insufficient.

Level 256 is a regression trap for the verifier: historical bait labels used another pricing horizon. Re-measure
the original and new board at the same horizon and actual deadline. Its bait can win with extra budget while
still losing at the real deadline. Do not compare a stale label to a freshly priced candidate.
Physics/preparation caches are content-bound to avoid stale proofs after in-place edits.

## Tools, workspace and reproducible checks

From `cc-builder-loop`:

```powershell
node source/tools/builder/bank/review_range.js source/analysis/builder/footprint60/range-250-300.json
```

Expected: `passed: 46`, `total: 51`, held `[262,272,289,291,296]`, `complete: false`.
**Exit 0 means the audit ran; inspect the counts and `complete`, not just the exit code.**
This also checks originals against `a99b338e` and needs none of the ignored solver scratch files.

Browser check (the explicit app checkout has the proposed 10 px top/bottom pile margin):

```powershell
$env:CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
node source/tools/builder/bank/play_review_range.js source/analysis/builder/footprint60/range-250-300.json ../oma-mahjong-main source/build/range-browser.json
```

It uses `source/tests/lib.js`, fake Firebase and `test-*` identities. No real player writes.
The renderer margin is a held UI change in `oma-mahjong-main`; it is not released or automatically copied into builder/ideas.

Construction/repair entry points are `bank/compact_range.js`, `bank/repair_range.js`, `bank/repair_reflected.js`,
`bank/learn_core.js`, `compact_templates.js`, and optional Python `solve_slots.py`.
`bank/compact_geometry.js` supports different window dimensions, gate/core placement constraints, reflections
through the caller, placement jitter, and an `acceptCandidate` hook for constructive visual/footprint guards.
Its `trimOverhang` and `repairOffsets` options are opt-in; default constructor regressions remain stable.

Local ignored workspace: `source/build/footprint60-250-300/{before,drafts}` plus reports and solver inputs.
**Do not trust old scratch `preservation.ok` values**: some predate stronger causality checks. Always re-certify.
The tracked review pack is the authoritative accepted set. Scratch scripts, failed proposals and experimental
pool/coordinate solvers were not committed; all solver jobs were stopped or completed before handoff.

Optional solver dependency is installed locally, not globally:

```powershell
python -m pip install --target source/build/footprint-solver -r source/tools/builder/requirements-footprint.txt
```

This pins OR-Tools 9.15.6755. Ordinary construction and frozen-pack audit do not require it.
Reserve CPU-heavy jobs using `source/tools/builder/loop/heavy.js --cores N -- <command>`.
The shared limit is 12 cores and under 80% system load. Match test concurrency to the reservation.

Completed checks: **46/46** builder/engine/chain tests, **46/46** browser wins, export regression on both branches,
and the independent frozen-pack audit on both branches. Six new intent tests live in `test_preserve_intent.js`.
Full regression command:

```powershell
node source/tools/builder/loop/heavy.js --cores 2 -- node --test --test-concurrency=2 source/tools/builder/test_preserve_intent.js source/tools/builder/test_compact_footprint.js source/tools/builder/test_chained_v2.js source/tools/builder/test_chained_six_ideas.js source/tools/builder/test_chained_six_review.js source/tools/builder/test_engine.js
node source/tools/builder/bank/test_export_levels.js
```

## Next work

Make compact layouts for the remaining five without weakening the stated trap contract. Use failed prerequisites
to guide physical reconstruction rather than treating failure as impossibility. Keep working in separate drafts.
For each success, re-certify against the frozen original, browser-play the stored route, check actual size/badges/
tray gap, and update both the review pack and browser evidence. Keep builder and ideas changes synchronized
without overwriting their unrelated work. Address the explicitly sub-60 review drafts before claiming a strict
60 px export-ready range. Do not edit released tables, regenerate player boards, or release without Dennis's authorization.
