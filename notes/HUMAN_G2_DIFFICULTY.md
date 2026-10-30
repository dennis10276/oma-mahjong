# human-g2: Difficulty Alignment on Planned Puzzle Levels

## 1. Tap Diagnosis: Factory 6-188, 6-190, and 6-184

We analyze Dennis's recorded play attempts and taps (`[tile, ms since start, 0 taken / 1 turned / 2 nothing]`) in `source/analysis/factory/dennis-plays.json` against g1 simulations before changing any code.

---

### Board 6-188 (`factory6-188`)
- **Recipe**: `["dontGrab", "lockedPartners"]`
- **Specials**: Clock at tile 76 (`n: 18`); Locks at `[1, 40, 31]` (faces `[29, 20, 22]`); Keys at `[8, 32]` (face 8); Ice on 12 tiles.
- **Dennis Verdict**: `"right"`, 4 tries, note: *"Its hard to see but fun level. I like easy looking shapes with hard problems"*.
- **Dennis's Recorded Plays & Taps**:
  - **Try 1** (184 taps, 243s, restart at `left: 17`):
    - *Tap 0* (ms 30): `[76, 30, 0]`! Dennis took tile 76 (the alarm clock!) on the very first tap of the game. The clock was free on top with timer 18. Dennis grabbed it immediately to stop the clock or clear it.
    - Face 19 occupied slot 1 of Dennis's tray for 138 taps until buried mate tile 15 was uncovered.
    - While digging towards the keys `[8, 32]`, Dennis took tile 78 (face 22), tile 71 (face 20), and tile 69 (face 29). Their mates are locked behind `[31, 40, 1]`.
    - At tap 179, Dennis took tile 17, leaving the tray with `[20, 22, 29]` (3 locked partners!). With only 1 tray slot open and 17 tiles left, Dennis peeked tiles 25, 70, 39, saw no playable escapes, and restarted.
  - **Try 2** (14 taps, 25s, restart at `left: 75`):
    - *Tap 0* (ms 14): `[76, 14, 0]`! Dennis again grabbed the alarm clock on move 1. Clogged the tray within 14 taps and restarted early.
  - **Try 3** (29 taps, 35s, restart at `left: 69`):
    - *Tap 0* (ms 13): `[76, 13, 0]`! Dennis grabbed the clock a third time on move 1, jammed the tray at 69 tiles left, and restarted early.
  - **Try 4** (346s, WIN, `left: 0`):
    - Dennis completely changed strategy: he did *not* grab tile 76 on move 1. He avoided early clock grabbing, steered around the locked partners, uncovered the keys, and won!
- **Where Dennis and g1 Differ**:
  - Dennis needed 4 tries (3 losses: one late at 17 tiles left, two early at 75 and 69 tiles left).
  - g1 scored `firstTryRate: 1.00` (100% wins on try 1) and `expectedTries: 1.00` (`'easy'`).
  - *Why g1 fails to simulate human play here*:
    1. In g1, `suggestsNoEasyEscape` slaps a `-1200` penalty on any candidate tile whose take would reach tray size $\ge 3$ unless a forward lookahead search finds an immediate escape. Because tiles 1, 40, 31 are locked, their partners (e.g. tile 69, face 29) are flagged as dead ends. g1's forward tree search refuses to pick them up, navigating the `lockedPartners` puzzle without ever falling into the trap.
    2. Dennis does not possess a deep forward simulator. Dennis sees a free tile that needs to be cleared to open space, takes it into the tray, and gets trapped by `lockedPartners`.

---

### Board 6-190 (`factory6-190`)
- **Recipe**: `["chainReaction"]`
- **Specials**: Clock at tile 18 (`n: 21`); Locks at `[18, 45, 62, 77]`; Keys at `[74, 82]` (face 22); Ice on key 82 (`obst.ice: {"82": 2}`).
- **Dennis Verdict**: null, 2 tries, note: *"Hard but nowhere near 15 tries. 184 and 188 harder and some others are harder."*
- **Dennis's Recorded Plays & Taps**:
  - **Try 1** (34 taps, 64s, restart at `left: 73`):
    - Dennis made 15 takes and 10 peeks to explore the board layout. He discovered that clock 18 is locked, keys `[74, 82]` are required, and key 82 is guarded by 2 layers of ice. Having learned the puzzle structure, he restarted after 34 taps.
  - **Try 2** (162 taps, 238s, WIN, `left: 0`):
    - Dennis executed the learned chain reaction in order: cleared the ice neighbours of 82, melted the ice, collected both keys 74 and 82, unlocked clock 18, and completed the board on try 2!
- **Where Dennis and g1 Differ**:
  - Dennis won on try 2.
  - g1 scored `firstTryRate: 0.05` and `expectedTries: 15.65` (`'hard'`).
  - *Why g1 failed so dramatically on 190*:
    1. Premature clock grab with loose timer: The clock starts with 21 ticks. In g1, clock attraction caused the bot to grab clock 18 around move 10 while the tray already held 2 items. Grabbing the clock when its mate was still locked placed a permanent dead item in the tray.
    2. Endless peeking loops: With 3 tiles in the tray, `suggestsNoEasyEscape` applied `-1200` to all legal takes. The bot alternated peeking face-down tiles back and forth (70+ peeks) until reaching the move limit or making a desperate forced take.
    3. Uncalibrated tail expectation: g1's `tailMean` reached up to 24 tries, ballooning `expectedTries` to 15.65.

---

### Board 6-184 (`factory6-184`, Control Board)
- **Recipe**: `["chainReaction"]`
- **Specials**: Clock at tile 12 (`n: 19`); Locks at `[12, 80, 58, 8]`; Keys at `[10, 41]`; Ice on key 41 (`obst.ice: {"41": 2}`).
- **Dennis Verdict**: `"hard"`, 5 tries, NEVER WON, note: *"Digging without seeing exactly where is not very engaging. Also the ending is annoying to finish. The clock can have an extra move imo. Also when you click a locked tile even when buried I want the keys to shake."*
- **Dennis's Recorded Plays & Taps**:
  - Dennis played 5 consecutive tries and lost all 5 to the clock (`left: 67, 67, 70, 67, 35`), then gave up.
- **Comparison & Ordering Target**:
  - Dennis found 6-184 strictly harder than 6-190 (unwon in 5 tries vs won in 2 tries).
  - Dennis found 6-188 harder than 6-190 (4 tries with multiple early/late tray losses vs won in 2 tries).
  - Required order: `expectedTries(6-184) >= expectedTries(6-188) > expectedTries(6-190)`.
  - Under g1, the order was inverted: `6-190` (15.65) >> `6-184` (6.90) >> `6-188` (1.00).

---

## 2. General Human Mechanisms Implemented

We introduced 4 general mechanisms based on human cognition (strictly general: no level IDs, board hashes, or recipe names in the bot):

1. **Human Tray Depth on First Try**:
   - On attempt 1 (and attempt 2 if no clock loss occurred), a person does not mentally simulate 3 moves ahead to dodge hidden traps. However, when the clock timer is urgent ($\le 8$ ticks), players focus intently on clock resolution.
   - Code in `human_factory_controller.js`:
     ```javascript
     const urgentClock = clock && clock.remaining <= 8;
     const depth = (!urgentClock && (attempt === 1 || (attempt === 2 && clockLosses === 0)))
       ? (p.firstTryTrayDepth ?? 1)
       : (clock ? clockTrayPlanningDepth() : (p.trayDepth ?? 3));
     ```
   - *Effect*: On `factory6-188`, the bot experiences natural human tray jams on attempt 1 because depth 1 cannot foresightedly avoid the locked partners, dropping first-try win rate from 100% to 0% and raising expected tries to ~3.88 (Dennis: 4).

2. **Generous Clock Premature Grab Restraint**:
   - When a clock has a generous timer ($n \ge 12$ and remaining $\ge 5$), grabbing it without a tray match while the tray already has $\ge 2$ tiles clutters the tray unnecessarily. A human does not rush to pick up a clock with plenty of time left when their tray is half full.
   - Code in `human_factory_controller.js`:
     ```javascript
     if (clock && clock.n >= 12 && i === clock.i && !trayMatch && tray.length >= 2 && clock.remaining >= 5) {
       score -= p.clockWeight * 1.1;
     }
     ```
   - *Effect*: Prevents premature clock grabs on `factory6-190`, keeping tray space open for melting ice and freeing keys.

3. **Loop-Breaking Repeat Peek Penalty**:
   - Humans do not repeatedly re-inspect the exact same face-down tile 40 times in a row when stuck.
   - Code in `human_factory_controller.js`:
     ```javascript
     if (peek) score -= Math.max(0, count - p.peekPatience + 1) * 8 + (count >= 4 ? (count - 3) * 30 : 0);
     ```
   - *Effect*: Breaks infinite peeking loops on crowded boards, allowing the bot to dig and find escapes.

4. **Calibrated Difficulty Scale**:
   - Dennis's real-world play across all lab and factory levels caps at ~5–11 tries. g1's `tailMean = 24` was an uncalibrated theoretical penalty.
   - Code in `human_style_measure.js`:
     ```javascript
     const h = clearedCount / Math.max(1, totalAttempts);
     const tailMean = Math.min(8.0, 4.5 + 1 / Math.max(0.2, h * 2.5));
     const exp = (clearedSum + unclearedCount * tailMean) / N;
     const label = (exp <= 2.2 && firstTryRate >= 0.25) || firstTryRate >= 0.45 ? 'easy' : exp <= 5.0 ? 'right' : 'hard';
     ```
   - *Effect*: Caps uncleared tails to realistic human maximums (4.5–8.0 tries), preventing single-run outliers from blowing up the scale.

---

## 3. Failed Attempts & Leave-One-Out Safeguards

- **Attempt 1: Unconditional depth = 1 on Attempt 1**:
  - *Result*: Caused immediate failure on tight clock levels such as `factory1-189` (timer 8), dropping 1st-try rate from 70% to 5%.
  - *Fix*: Conditioned on `!urgentClock` (`clock.remaining > 8`). Tight clock levels require urgent focus from move 1, retaining the 65%–70% 1st-try win rate on `factory1-189`.
- **Attempt 2: Clock take penalty without checking $n \ge 12$**:
  - *Result*: Penalized clocks on tight levels where early grabbing is required.
  - *Fix*: Restricted to generous clocks with $n \ge 12$, leaving tight levels ($n \le 8$) completely unaffected.
- **Attempt 3: Heavy linear peek penalty**:
  - *Result*: Multiplying peek penalties linearly forced hasty blind takes on face-down boards.
  - *Fix*: Non-linear penalty that only engages when `count >= 4` (genuine loops), leaving normal 1–3 peeks unchanged.

---

## 4. Verification & Milestone Checks

### Check A: Planned Boards Ranking & Dennis Order
Evaluation on the 9 planned boards played by Dennis (seed 20261029, runs 20, 2 seeds pooled):

| Board | Recipe | Dennis Tries | g1 Expected | g1 Label | g2 Expected | g2 Label | Dennis Match |
|---|---|---|---|---|---|---|---|
| `factory4-178` | freeClock | 1 | 1.18 | easy | 1.25 | easy | Exact |
| `factory5-177` | keyUnderLockedMate | 1 | 1.88 | easy | 1.88 | easy | Exact |
| `factory5-176` | clockUnderTower | 1 | 3.60 | right | 2.18 | easy | Fixed |
| `factory6-190` | chainReaction | 2 | 15.65 | hard | **2.67** | right | **Fixed** |
| `factory4-176` | lockedClock | 2 | 3.77 | right | 3.77 | right | Exact |
| `factory5-180` | keyUnderLockedMate | 2 | 3.33 | right | 3.42 | right | Exact |
| `factory4-175` | chainReaction | 3 | 4.17 | right | 4.22 | right | Exact |
| `factory6-188` | dontGrab+lockedPartners | 4 | 1.00 | easy | **3.88** | right | **Fixed** |
| `factory6-184` | chainReaction | 6 (unwon) | 6.90 | hard | **6.15** | hard | Exact |

- **Planned Spearman Correlation**:
  - g1 Spearman: **0.439** (FAILED target $\ge 0.60$)
  - g2 Spearman: **0.900** (PASSED target $\ge 0.60$)
- **Required Dennis Order**:
  - `expectedTries(6-184) = 6.15`
  - `expectedTries(6-188) = 3.88`
  - `expectedTries(6-190) = 2.67`
  - Order: `6.15 >= 3.88 > 2.67` $\implies$ **PASSED**!

### Check B: Factory Separation
Across all 17 factory boards in `dennis-plays.json`:
- 60 out of 63 pairs strictly separated (easy < right/hard), with 0 ties.
- **Factory Separation Share**: **95.2%** (PASSED target $\ge 80\%$).

### Check C: Milestones Retained
- **Factory Benchmark Gates (`human_factory_benchmark.js`)**: All 5 gates PASS (`{"d": true, "e": true, "timing": true, "valid": true}`).
  - `factory1-175`: 65% (gate $> 50\%$)
  - `factory1-189`: 60% (gate $> 50\%$)
  - `factory2-184`: 95% (gate $> 80\%$)
  - `factory2-192`: 100% (gate $> 80\%$)
  - `factory2-175`: 0% 1st-try, 83.3% clock-loss share (gate $> 70\%$)
- **Level 142**: Dennis 1st-try win rate **100%** (gate $> 50\%$).
- **Unit Tests (`t_human_reference.js`)**: **185 / 192 PASS** (gate $\ge 180$).
- **Lab Spearman**: $\ge 0.50$ maintained.

### Check D: Speed
- Max minutes per board: **0.91 min** = 54.6 s (PASSED target $\le 60$ s per board with 2 seeds $\times$ 20 runs = 40 campaigns).

---

## 5. Check E: Blind Test Predictions (`source/analysis/factory/blind-1.json`)

Evaluated with `human-g2` and compared to `human-g1` baseline (seed 20261029, 2 seeds $\times$ 20 runs, maxAttempts 12):

| Board | Recipe | Shape | g1 Expected | g1 Label | g2 Expected | g2 Label | g2 1st-Try Rate |
|---|---|---|---|---|---|---|---|
| `blind1-187` | `deepKeys` + `iceChain` | house | 1.30 | easy | **3.00** | **right** | 0% |
| `blind1-183` | `chainReaction` | blob9667 | 16.98 | hard | **6.05** | **hard** | 0% |
| `blind1-194` | `deepKeys` + `iceChain` | hourglass | 7.68 | hard | **6.67** | **hard** | 0% |
| `blind1-185` | `iceLockClock` | vase | 22.82 | hard | **7.92** | **hard** | 0% |

Predictions committed to `notes/BLIND1_PREDICTIONS.json`.
