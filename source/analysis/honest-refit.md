# The honest test player, re-fitted to real play (2026-10-15)

Branch `wip/honest-observer`. Nothing here is live.

## What was done

1. **Exact boards.** For every real attempt in Firebase (`plays/`), the board the player really got
   was rebuilt. Levels 70+ in versions 1.44–1.52 come from that version's own level table. Classic
   levels use the player's screen shape, found from the tile counts they logged. The result is
   363 attempts on 176 boards (`tools/sim/refit/boards.js`, `dataset.js`). Hints, shuffles, easier
   deals, the daily level, grandma's track and DennisTEST are left out.
2. **Grids.** The honest test player played every board 100 times for each setting (`fit.js`,
   grids 1–4).
3. **Fit.** `analyze.js` computes the likelihood of every win and loss, allowing a retry to be
   easier. `calib_rates.js` compares first-try wins per level band.
4. **Replays.** Recorded tries (`replays/`, version 1.50 only) were followed move by move
   (`replay.js`). After each of the player's moves, the test player plays on from that exact
   position. Where its chance jumps, the player did something it would not do.

## What the test player was missing (in order of discovery)

1. **A game rule.** When 3 tiles wait in the tray, a pair with a face-down tile in it can still be
   taken: turn it over, then tap its twin. They match without needing a slot (`peekPair` in
   `board.js`). The test player gave up at 3 waiting.
2. **Fear of an unseen twin.** It paid a large penalty for putting a tile in the tray when it had
   not seen the twin (`unknown 7`). Every real player fits better without that penalty (`unknown 0`).
3. **Smart guessing (`reveal`).** Dennisisdebeste won level 102 (1.50) on his second try. The test
   player won it 0% of the time, from every position up to his move 30. There, 2 tiles were waiting
   and none of the 13 free tiles made a pair. He took face-down tile 67. That uncovered two tiles
   that fitted free tiles, and he cleared the board from there; from that position the test player
   also wins 100%. The test player had chosen a tile that uncovers nothing new. Uncovering hidden
   tiles is a draw from the pictures still missing. A person can count those (how many of each,
   not where they are), so a move that frees several hidden tiles while a picture is waiting is
   worth a lot. The test player now values this: each tile a move uncovers counts × the chance that
   it fits a waiting tile or a free tile without a partner. With that, it wins 102 from the start
   about 30% of the time and follows his 100 win smoothly.

4. **Fixes found while following Dennisisdebeste's level 105 (1.52, won on the first try).**
   - An alarm-clock rule was wrong in the test player's look-ahead: it counted on taking the clock
     tile after its last move.
   - In a pair with a face-down tile it took the wrong tile first. The tapped tile goes first; that
     matters when it is the clock tile.
   - When the clock cannot wait, a tile that fits a waiting one is no longer taken automatically.
   - **Planning for the clock (`plan`).** With 10 moves or fewer left, it now searches for a way to
     take the clock tile in time, using only what it can see, without filling the tray. From his
     opening, the test player used to lose 9 of 10 games. With planning, it wins about 9 of 10 from
     every position of his game. This also brings Mrs. Doubtfire's fit closer (80–89: real 40%,
     model 31%).

Fit to all tries (log-likelihood, higher is better):

| player | start | + rule & unknown 0 | + smart guessing |
|---|---|---|---|
| Dennisisdebeste (103 tries) | -96.5 | -66.5 | -57.7 → **-56.3** with planning |
| Mrs. Doubtfire (134 tries) | -102.4 | -76.7 | -83.0* → **-73.4** with planning |

\* On all tries Mrs. Doubtfire fits slightly better without smart guessing, and on first tries
equally well (-33.8). On 80–89 she still does better than the model predicts (real 40%,
model 23%, from only 10 tries).

## Personas (`www/hard.js` REF on this branch, `tools/sim/refit/personas.json`)

All three: unknown 0, reveal 8, plan 10, end 12.

| persona | temp | clockFocus | fitted to |
|---|---|---|---|
| strong | 1.5 | 1 | Dennisisdebeste |
| sensible | 3 | 4 | between the two |
| average | 4.5 | 4 | Mrs. Doubtfire |

First tries, real vs. strong, on the boards Dennis played:

| levels | real | strong |
|---|---|---|
| 30–49 | 1.00 | 0.93 |
| 50–74 | 0.82 | 0.94 |
| 75–79 | 0.91 | 0.88 |
| 80–89 | **0.71** | **0.70** |
| 90–104 | 0.53 | 0.61 |

## The live levels (1.52), measured with these players

200 games per level and persona (`analysis/refit-1.52.json`). Average first-try chance:

| levels | strong | sensible | average |
|---|---|---|---|
| 75–79 | 0.88 | 0.73 | 0.58 |
| 80–89 | 0.63 | 0.45 | 0.29 |
| 90–99 | 0.58 | 0.51 | 0.38 |
| 100–119 | 0.53 | 0.41 | 0.30 |
| 120–149 | 0.57 | 0.41 | 0.27 |
| 150–179 | 0.57 | 0.43 | 0.32 |
| 180–209 | 0.53 | 0.42 | 0.30 |
| 210–239 | 0.52 | 0.41 | 0.29 |
| 240–269 | 0.60 | 0.42 | 0.31 |

- After the step at 80, the levels **do not get harder**: strong stays at about 0.55 all the way to 269.
- Level 104: 0.98; 105: 0.87 (Dennis won it first try); 106: 0.60.
- 17 levels are very hard for strong (below 15%): 94 98 108 111 112 132 159 164 195 196 204 205
  209 221 230 256 264.
- 23 levels from 90 on are very easy for strong (above 90%).
- Every 10th level swings from 0.12 (230) to 0.97 (90).

## Proposal (for Dennis to decide; point 4 of the stalled-work list)

Targets in the new measure, strong first-try chance, keeping today's skill level roughly:

- 75–79: about 0.85 (as now)
- 80: 0.70, going down to 0.55 at 100 and 0.45 at 150
- 150–269: plateau at 0.40
- No board below 0.20 for strong. Every 10th level within ±0.10 of the curve.

Doing this means re-making the boards from 106 (so that nobody's finished levels change), or from
90, with the designer on this branch and these players. Measuring the face-down cap (point 3) comes
after that, with the same players.

Also to bring along: the game's own helpers in `layouts.js` (the solver and the "can the level still
be finished" check) also stop at 3 waiting. They do not know the face-down pair rule either. That is
safe (they only underrate), but they should match the game.

## Retries (2026-10-15)

`Hard.rate2` plays a first try and, after a loss, a second try on the same board that remembers
each picture it saw with chance `memP` (`tools/sim/refit/retry_fit.js`, `measure_retry.js`).

- Dennisisdebeste remembers everything: of his 21 tries right after a lost try he won 16; the strong
  player with full memory predicts 16.8 (without memory 14.3).
- Mrs. Doubtfire does not seem to use memory: of 79 such tries she won 22; the average player
  without memory predicts 24.7, with memory 30.
- Won within two tries on the live 1.53 levels (`analysis/retry-1.53.json`): strong 99% (75-79),
  88% (80-89), 94% (90-99), 84-85% (106-149), falling to 72% (240-269). Dennis won 94% of 80-89
  within two tries.
