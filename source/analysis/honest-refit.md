# The honest test player, re-fitted to real play (2026-10-15)

Branch `wip/honest-observer`. Nothing here is live.

## What was done

1. **Exact boards.** For every real attempt in Firebase (`plays/`), the board the player really got
   was rebuilt. Levels 70+ in versions 1.44–1.52 come from that version's own level table. Classic
   levels use the player's screen shape, found from the tile counts they logged. The result is
   363 attempts on 176 boards (`tools/sim/refit/boards.js`, `dataset.js`). Hints, shuffles, easier
   deals, the daily level, grandma's track and DennisTEST are left out.
2. **Grid.** The honest test player (it uses no pictures that a move would uncover) played every
   board 100 times for each setting (`fit.js`).
3. **Fit.** The likelihood of every real win or loss was computed (`analyze.js`). A later try on the
   same board is allowed to be easier, because the player has seen it before (term `b`).

## Findings

- **A game rule the test player did not know.** When 3 tiles wait in the tray, a pair with a
  face-down tile in it can still be taken: turn it over, then tap its twin. They match without
  needing a slot (`peekPair` in `board.js`). The test player gave up at 3 waiting. On boards with
  35–40% face-down tiles this cost it most of its wins. It now knows the rule.
- **Real players are not afraid of an unseen twin.** The old player paid a large penalty for
  putting a tile in the tray when it had not seen the twin (`unknown 7`). Every real player fits
  better without that penalty (`unknown 0`). This is the "smart guessing" Dennis expected.
- Together these two changes improve the fit a lot (log-likelihood, higher is better):

  | player | old honest | + unknown 0 | + face-down pair rule |
  |---|---|---|---|
  | Dennisisdebeste (103 tries) | -96.5 | -68.7 | **-66.5** |
  | Mrs. Doubtfire (134 tries) | -102.4 | -83.8 | **-76.7** |

- **Fitted personas** (`www/hard.js` REF on this branch, `tools/sim/refit/personas.json`):
  - strong ≈ Dennisisdebeste: temp 1 (0.7–1 fit equally well), clockFocus 4. A retry is clearly
    easier for him (b 0.75).
  - average ≈ Mrs. Doubtfire: temp 4.5 (3 on 75+, 6 on the classic levels), clockFocus 1.
  - sensible: temp 2.
  - Gerda and PUK play like temp 6. Gerda loses more often than even that predicts on 10–19 (her
    tray habit, see `archive/gerda-investigation.md`).
- **It still underrates people a little on the hardest boards.** On 80–89, Dennis won 71% of his
  first tries; strong predicts 47% on those boards. Mrs. Doubtfire won 40%; average predicts about
  10%. So treat the numbers below as a lower bound.

## The live levels (1.52), measured with the re-fitted players

200 games per level and persona (`analysis/refit-1.52.json`). Average first-try chance:

| levels | strong | sensible | average | old measure (focused) |
|---|---|---|---|---|
| 75–79 | 0.88 | 0.78 | 0.51 | 0.69 |
| 80–89 | 0.38 | 0.29 | 0.10 | 0.61 |
| 90–99 | 0.38 | 0.31 | 0.15 | 0.53 |
| 100–119 | 0.41 | 0.32 | 0.12 | 0.42 |
| 120–149 | 0.36 | 0.25 | 0.08 | 0.37 |
| 150–179 | 0.28 | 0.20 | 0.08 | 0.34 |
| 180–209 | 0.32 | 0.25 | 0.09 | 0.32 |
| 210–239 | 0.32 | 0.24 | 0.08 | 0.29 |
| 240–269 | 0.32 | 0.23 | 0.07 | 0.26 |

- From 80 on, the curve is **flat** under the honest measure (strong about 0.30–0.40). The 1.52
  re-ordering ("always harder") barely matches it: the correlation between the old and new measures
  on 90–269 is 0.13.
- **Big jump at 80**: strong drops from 0.88 (75–79) to 0.38 (80–89). That is where the alarm clock
  and the face-down tiles start.
- **30 levels are close to impossible** (strong below 10%): 91 94 98 111 112 116 132 144 149 159
  164 171 178 179 193 195 196 205 208 209 221 222 230 238 247 254 256 259 261 265.
- **Every 10th level swings widely**: from 0.01 (230) to 0.98 (250).
- Ordering the existing boards by the new measure does not fix this on its own. The 90s would
  become very easy (strong 0.94), right after 80–89 at 0.38, and 240–269 would be nearly
  impossible (0.04). There are too few boards in the middle.

## Proposal (for Dennis to decide; point 4 of the stalled-work list)

Targets in the new measure, strong first-try chance, keeping today's skill level roughly
(today's average from 80 on is about 0.34):

- 75–79: about 0.85 (as now)
- 80: 0.60, going down to 0.45 at 100 and 0.35 at 150
- 150–269: plateau at 0.30
- No board below 0.15 for strong (now 30 boards). Every 10th level within ±0.10 of the curve.

Doing this means re-making the boards from 80 (or from 106, so that nobody's finished levels
change) with the designer on this branch and the re-fitted players. Measuring the face-down cap
(point 3) comes after that, with the same players.

Also to bring along: the game's own helpers in `layouts.js` (the solver and the "can the level still
be finished" check) also stop at 3 waiting. They do not know the face-down pair rule either. That is
safe (they only underrate), but they should match the game.
