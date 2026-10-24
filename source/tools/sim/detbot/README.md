# detbot: a "fill in the hidden pictures" bot (Claude, prototype, 2026-10-24)

An experiment for Codex's human-information goal (`HUMAN_REFERENCE_GOAL.md` on `wip/personal-bots`).
Not wired into anything. It needs Codex's files from `wip/personal-bots` in `source/tools/sim/refit/`.

## What it does

- **What it sees:** only what Codex's `observeBoard` shows, plus memory of earlier tries of the same level.
  That means pictures and specials it has seen, the tray, the clock, and which free tiles the game refuses
  (those have ice or a lock).
- **How it plays:** every game goes through Codex's production session around the unmodified `www/hard.js`.
- **How it chooses a move:**
  1. Turn over free face-down tiles first. Looking costs no move, so this is free unless the clock is
     still on the board; then the bot weighs looking against other moves, because the game takes a looked-at
     tile at once if it fits the tray.
  2. Fill in the unseen pictures in 16 ways that fit what it saw. Every picture appears an even number of
     times, and a missing key is placed at random.
  3. For each possible action (take a tile, or a face-down tile together with its twin), and in every
     filled-in board, do two things:
     - solve exactly (`solver2.js`): win, or how far it gets;
     - play on honestly (`rollout.js`): a simple policy that only uses tiles as they come into view.
  4. Choose the action with the best total. The honest play-out counts less as more of the board is known,
     because the filled-in boards know where everything is and a person does not.
- **Speed:** about 1–2 s per move.

## Results

12 tries max per level. Pass means the same as Codex's goal.

| Set | Codex's bot | detbot |
|---|---|---|
| Regular levels, all 140 | 132/140 | 106/140 |
| The 8 regular levels Codex's bot fails | 0/8 | 4/8 (81, 93, 99, 137) |
| Lab levels (15) | 7/15 | 9/15 (12, 15, 32, 33, 41, 42, 46, 47, 52) |

What this shows:

- **Strong on retries.** Memory of earlier tries plus exact solving clears hard boards in fewer tries than
  Dennis: lab 12, 15, 32, 33, 41, and 137.
- **Weak on first tries.** It wins only 67 of the 92 levels Dennis won first time. The filled-in boards are
  too optimistic, because the solver "knows" where twins are. Codex's safety checks are much better there.
- **The two bots complement each other.** Together they would fail only 102, 107, 112 and 125, and lab 11,
  45 and 49.

## Suggested next step

Use Codex's bot as the play-out policy inside detbot, in place of `rollout.js`. Each move is then chosen
by "which action, followed by Codex's play, wins most often across the filled-in boards". This is standard
improvement-by-play-outs. It keeps Codex's first-try strength and adds look-ahead and memory. The cost is
CPU per move, so it needs a fast mode of Codex's policy.

## Run

```
node source/tools/sim/detbot/det_bot.js <catalog.json> [level ...]
```

The catalog uses the `lab-clears.json` row format (`lv`, `wonOn`, `game` encoded with `encodeGame`).
