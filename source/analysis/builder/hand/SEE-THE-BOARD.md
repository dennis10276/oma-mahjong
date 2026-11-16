---
name: oma-see-board
description: See and hand-design Oma's Mahjong trap boards like a player - exact game rules, draw a layout or board by layer, print every tile's relations, prove a hand design, study Dennis's recorded lab moves. Use whenever designing, checking or explaining a level/trap for Oma's Mahjong (levels 250+), or when Dennis rates a lab.
---

# Seeing an Oma's Mahjong board (Dennis 2026-11-16: "Really understand the game yourself and pick a layout and everything and design it all smartly" ... "Make a skill off this for you to see the game")

Work in the `cc-builder-loop` worktree (`C:\Users\den_k\Idea\OmasMahjong\cc-builder-loop`, branch `wip/cc-builder-loop`). Never edit main,
Firebase plays/scores/replays, or Codex/Gemini folders. Heavy runs through `source/tools/builder/loop/heavy.js`.

Playwright for pictures and labs:
`NODE_PATH=C:/Users/den_k/Idea/OmasMahjong/oma-mahjong-main/source/tests/node_modules`,
`CHROME=C:/Users/den_k/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe`.

## The rules, exactly (from www/layouts.js, www/js/board.js, www/js/specials.js)
- Coordinates: x, y in half tiles, z layer. A tile is **covered** by any higher tile with |dx| < 2 and |dy| < 2 (any layer above,
  not only the next). It is **free** when nothing covers it and its left OR right side (same layer, x +- 2, |dy| < 2) is empty.
- **Tray**: at most 3 tiles wait. A 4th tile without its partner ends the level (stuck). A tile whose twin waits matches at once.
- **Face-down**: the first tap only turns it over (free, no move, one at a time; turning another turns the first back); the second
  tap takes it. A turned-over tile and a free tile with the same picture go together **without a tray slot** - the way on with 3
  waiting. Both face-down: turn one, remember it, turn the other back... needs memory. Each tile still counts one clock move.
- **Ice h**: frozen until h of its ice neighbours have gone. Ice neighbours = same layer |dx| <= 2, |dy| <= 2 and (|dx| < 2 or
  |dy| < 2), plus tiles one layer up or down overlapping it (|dx| < 2, |dy| < 2). So the tile ON it melts it too; tiles UNDER it
  count but can never go first.
- **Locks**: gold locks open when both gold keys are gone; **silver** (`keys2`/`locks2`, branch `wip/second-key`) the same for
  the silver pair. A key may carry the other colour's lock (it shows both signs). A lock blocks everything under it.
- **Clock n**: the clock tile must be taken within n moves (tiles taken; a face-down pair is 2). Tap its number to see it
  through the pile (wip/second-key).

## Commands (all in `source/tools/builder/bank/`)
- `node hand.js info <layout|board.json>` - every tile: xyz, FREE, what lies on it, left/right, ice neighbours (and picture).
- `node hand_draw.js <layout|board.json> <out.png> [--state 1,2,3]` - the layers side by side; grey = covered, green frame =
  free now, `C` clock, `I`/`II` ice, `L`/`K` gold, `l`/`k` silver, `F` face-down, `p12` picture. `--state` = tiles already taken.
  Then Read the png. Use it before every design decision.
- `node hand.js design|prove <spec.js>` - a hand design (spec format in the hand.js header; motifs in
  `source/analysis/builder/hand/*.js`). `exact: true` uses the route as written; route items `[a, b]` are face-down pairs
  (`peek: true`, `downTiles`, `peekNeeded`). Proves the exact clock minimum, each intended wrong move, all tempting moves.
- `node hand_lab.js <ideas.js> <names...>` then `node ../../lab/build_lab.js <dir> <ideas.js>` (from a copy with the
  wip/second-key www), served with `MECH=1 node lab_server.js <dir> <port>` (saves ratings and every tap).
- `node replay_study.js <lab-dir>` - Dennis's tries: taps, where he left the route, the move after which the clock was lost,
  thinking pauses. Read his moves before changing a design.

## What Dennis wants (labs 2026-11-12 .. 16; notes in `source/analysis/builder/hand/NOTES.md`, taste memory)
- AHA = a wrong idea he has not met in that form, inside a chain of 3-4 specials. More wrong ideas is not the way;
  originality is. No idea reused often in a range. Lookalike and early key are worn out.
- The wrong move must be **goal-directed** (a move toward the clock, a key, an ice), not a random free pair: "You're focused on
  the locks and clock anyway, not on random free pairs."
- Hard ones: long route (10-18 to the clock), spare 1, tray full on every route (2+ waiting most moves, 3 often), the mistake
  shows late. Mix in tray-pressure digging and face-down pairs at a full tray.
- Shape: 3 layers readable from above, no towers, no tile hanging over air, twins not side by side, >= 58 px (tens 53.5).
- Design by understanding: draw the layout, print the relations, plan the player's natural plan and why it fails, then place
  every trap tile yourself. Automate only a pattern that proved itself in a lab.
