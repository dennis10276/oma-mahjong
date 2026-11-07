# Why built boards are 3 or 20 tries: hidden keys (Claude, 2026-11-07)

Task 10 found that difficulty on builder boards jumps: most boards rate 2–6 family tries, a large group hits the
20-try cap, and few land in between. This note looks at Task 10's 484 rated boards
(`knobs-v1/boards.json`). Scripts: `tools/builder/research/` (why.js, kinds.js, calm.js, vis.js, tempt.js);
the method is described below.

## 1. How the family bot loses on a 20-try board
Board `keysFarSide-w14-t5-l0-x0-s1` (family 18–20): a locked clock, a 13-move way, 1 spare move.
- **Losses:** in 6 campaigns of 20 tries, 99% of the losses are the clock. The bot spends 14–19 moves and never
  takes the clock.
- **The bot's moves, scored with the engine:** at the start, 5 of the 20 legal moves still win. The bot's first
  losing move comes after 1–6 moves.
  - Of its 105 first losing moves, 99 are a free pair off the way, taken when the way needed a single.
- **Remove every off-way pair it could see** (same tiles, specials, clock and way): the rating stays at 17–18.
  - The bot then wanders off the way with single tiles instead: 81 of 90 first losing moves.
- **So the bot does not know where to go.** The clock is locked, and both keys lie under 2–4 tiles.

## 2. Key visibility decides it
In the game a role (key, lock, ice) shows only when its tile's overlay area is uncovered (the same rule as
`human_board_visibility.js`).

For the 260 rated boards with keys:

| keys whose role shows at the start | boards | family median | share at 18+ |
|---|---:|---:|---:|
| 0 | 88 | 19.8 | 88% |
| 1 | 29 | 13.0 | 38% |
| 2 | 143 | 6.3 | 36% |

| moves along the way until both keys show | boards | family median |
|---|---:|---:|
| 0 (at the start) | 143 | 6.3 |
| 4–6 | 47 | 19.3 |
| 7 or more | 44 | 20.0 |

**Stories, with both keys showing:**
- keysFarSide 3.3, roomInTrayLocked 3.2 and lockBeside 4.8: easy.
- iceLockClock 9.6 (43% at 18+).
- frozenGuards 18.6 and chainReaction 20. There the keys are frozen, and a frozen key shows the ice, not the key
  (this matches Codex's frozen-key finding).

**Way length and spare** barely matter once the keys show: way 15–17 gives a median of 5.3 tries, and 18+ gives
5.8.

## 3. What it means
- **The jump is the moment the objective disappears from view.** When the bot can see what to dig for, built
  boards are easy. When it cannot, it almost never wins within 20 tries.
- **Hidden keys:** a person probably also struggles with them on the first tries. But a person remembers where a
  key turned up and goes straight there on the next try. 20 tries looks like the bot not remembering (or not
  using) where the keys were, which would be a blind spot, not real difficulty. Codex Task 11 checks this
  (`retryKeyIdentityMemory`).
- **One key showing gives a median of 13 tries,** right on the curve. A real level needs that middle ground: what
  to look for is clear, part of the way is not.
- **Dennis's readability rule** ("visible intent: the clock and locks are in sight at the start") and difficulty
  are the same question here.

## 4. For builder v3
- **A new control, `targets.keysShown`:** 2, 1 or 0 keys visible at the start, plus how many way moves until the
  hidden key shows. This replaces the picture-level knobs, which did nothing.
- **Frozen keys are out.** A visible guard (ice on a tile in front of the key) replaces them.
- **Spare stays the fine control.**
- **Still open:** what spreads the "both keys showing" boards from 3 to 20 (iceLockClock, lockBeside), and whether
  the 20s are the bot or real. That is Codex Task 11.

## 5. The causal check: change only how many keys show (2026-11-07)
Builder v3 `targets.keysShown` on 6 story/layout pairs, at seed 1 with spare 1 and a readable way. Ratings are
10 campaigns at seed 4711 (`keys-ladder-v1.jsonl`, `research/ladder.js`).

| pair | 2 keys show | 1 key shows | 0 keys show |
|---|---|---|---|
| keysFarSide, layout 7 | 2.0 | 3.7 | **20** |
| keysFarSide, layout 20 | **20** | 2.0 | 16.4 |
| lockBeside, layout 7 | 5.2 | 1.7 | 7.2 |
| lockBeside, layout 20 | 3.5 | 11.1 | 9.2 |
| iceLockClock, layout 7 | 20 | 20 | 20 |
| iceLockClock, layout 20 | 1.9 | 9.1 | 20 |

**Hidden keys** push the rating up in 5 of 6 pairs. But the change is not one step: each request builds a new
puzzle (other keys, another way).

**Two boards are brutal with both keys in sight:** keysFarSide on layout 20, and iceLockClock on layout 7.
- On keysFarSide L20, only 1 of 16 legal moves at the start still wins. The tray is forced to 3 and the order is
  unique: the right first tile is an unremarkable one, not the visible key.
- So the second cause of the jump is a unique order under forced pressure, where the right move does not look
  right.

**Narrowness along the whole way** (winning share per step) does not explain the 297 boards on its own: rank
correlation −0.32 for the narrowest step.

That is Task 11's question: what does the bot get wrong.
