# Manual tile placement lab

[Open the placement lab](http://127.0.0.1:8269/).

Dennis requested a place to relocate tiles himself, including boards the automatic
narrowing could not finish, and requested the Sunflower tile theme. This lab has
**40 ordinary levels: the eight remade drafts and all 32 unresolved boards**.
The five already fitting boards and all tenth levels are left out. There are
314 tiles initially at the side, from 1 to 21 per level; no tile is deleted.

## Using it

- Pick a tile at the side, then click a position, or drag it onto the board.
  Auto chooses the lowest supported free layer. The layer selector also permits
  explicit placement. The half-tile grid, tile identities and face-down flags remain.
- Blue dots identify trap tiles. **Move another tile** lets Dennis select any
  existing tile; **Return selected tile to side tray** parks it temporarily.
  This is needed when reconstructing a trap which crossed a removed column/row.
- **View released** is a read-only comparison in the same Sunflower theme.
  **Use narrowed draft** loads the earlier eight drafts; **Show proposed placement**
  on the other boards is explicitly unverified. It is a reference, not a passing board.
  **Back to side tray** restores that level's initial workspace; Undo reverses edits.
- Saving is automatic after changes, and there is an explicit **Save** button.
  An unfinished arrangement and a note can be saved. A green save message means
  the server acknowledged that exact arrangement and note, not merely browser storage.
- **Save & check trap / finish** runs the engine proofs. A changed placement
  invalidates the displayed verdict. A time/node limit is an unknown result, never
  a pass. Failed checks identify problem tiles where available.
- **Play this arrangement** opens the real game with the current positions and
  Sunflower tiles. Once a proof has found a new finish, that proven route travels
  with the playable board. Playing is separate from certification or adoption.

On a phone, layout tools and notes are collapsible. Zoom is available for placement.
The size indicator always measures the 392×730 reference phone, irrespective of
the editor's canvas zoom or desktop window size.

## What the unresolved workspaces mean

Their base is a proposed column/row narrowing. Tiles removed at the seam, collisions,
and tiles losing support are parked at the side. A few upper-edge tiles also need
relocation on the most height-limited outlines. This does **not** mean the remaining
trap is already preserved. Dennis may move additional tiles to repair it. The
complete original trap contract still decides whether the resulting placement passes.

The eight remade workspaces use the previously certified narrowed geometry, with
the relocated tiles parked instead of placed in the builder's caps/towers.
Pictures, specials, face-down flags and clock numbers are fixed by the selected
source board; the editor never changes them or silently re-pairs the finish.

The checker retains a legal released clock prefix, or searches for the clock route
when it no longer plays. It can find a new exact winning tail with the same pictures.
It then runs `narrow_proof.certify`: footprint 58 px review floor / eight rows,
supported grid, cover/thaw/side relationships in the trap, readable badges, no new
visible close twins, clock minimum/spare, special-role prerequisites, lock/ice
ablation effects, authored bait prices and own authored proof/gates where available.
Older boards have the documented recovered special-role contract. This is not
complete equivalence of every possible ordinary endgame decision.

## Actual user files — preserve these

User work is stored **outside the generated lab and outside the worktree**:

`C:/Users/den_k/Idea/OmasMahjong/codex-tasks/results/narrow-251-299/placements/`

- `level-<n>.json`: latest positions (including nulls for tiles at the side), note,
  board hash and immutable catalogue ID.
- `history.jsonl`: every acknowledged save. Resets and later saves do not erase history.
- `catalogues/<hash>.json`: complete immutable source boards and initial workspaces.
  This preserves their meaning even if the generated browser assets are rebuilt later.
- `jobs/<id>.input.json`, `.result.json`, `.log`: exact submitted snapshot and proof
  result, including a proven full board/route when successful.

Read the current human work without changing it:

```powershell
node source/tools/builder/bank/narrow_placement_review.js
```

The reader matches verdicts to the exact current placement, including its source hash.
It does not confuse an earlier passing result with a subsequently edited board.
Do not replace any accepted `narrow/level-*.json` file merely because a manual
arrangement was saved or played. No adoption, level-table change or release is done.

## Running and verification

From `codex-narrow` on `wip/codex-narrow`, after preparing the original Task 19 lab:

```powershell
node source/tools/builder/loop/heavy.js --cores 1 -- node source/tools/builder/bank/narrow_placement_build.js
node source/tools/builder/bank/narrow_placement_server.js 8269
```

Build refreshes only browser assets. It does not delete user files. The server binds
only to 127.0.0.1. Its checks run in a serialized queue through `heavy.js --cores 1`,
with a 45-second worker proof budget after the shared CPU reservation is granted.
There are no production database writes, difficulty bots or released-table edits.

QA uses a separate server on **8270** and a separate ignored edit directory. Its
arrangements, notes and checks are not Dennis's work. Tests cover all 40 side trays,
click and drag placement, undo, disk save/reload, stale verdict invalidation, a live
passing proof, real-game play/win, phone layout and Sunflower faces. Seven focused
tests also cover server restart durability, immutable catalogues, malformed snapshots,
geometry constraints and an actual lower placement that needs a newly proven tail.

```powershell
node source/tools/builder/loop/heavy.js --cores 1 -- node --test source/tools/builder/test_narrow_placement.js
# Separate QA server/data, never the directory above:
node source/tools/builder/bank/narrow_placement_server.js 8270 source/build/task19/placement-qa-edits
# With Playwright available to source/tests/lib.js and CHROME set:
node source/tools/builder/loop/heavy.js --cores 2 -- node source/tools/builder/bank/narrow_placement_browser.js
```

Browser results and screenshots are kept beside this file. The earlier comparison
lab on 8268 and its findings remain separate.
