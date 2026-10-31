# human-g3: Critic for Level Quality, Fairness, and Failure Modes

## 1. Overview & Core Architecture

The `human-g3` release builds on `g2.1` by adding an automated critic, [`critique(board)`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-human-bot/source/tools/sim/refit/human_critic.js), that evaluates a level layout not only for overall difficulty (`expectedTries`), but also for subjective player fairness, engagement, and design flaws as expressed in Dennis's written playtest notes ([`dennis-notes-labels.json`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-human-bot/source/analysis/factory/dennis-notes-labels.json)).

### Interface & Contract
```javascript
const { critique, measureHuman } = require('./source/tools/sim/refit/human_bot.js');

const result = critique(board, { runs: 20, seed: 4711 });
// Returns:
// {
//   flags: ['lateSqueeze', 'specialAddsNothing'],
//   kinds: {
//     lateSqueeze: { flag: true, value: 0.95, reason: "frustrating tray pressure at the very end (95% of losses with <=45% tiles left)" },
//     boringAfterClock: { flag: false, value: 0, reason: "maintains engagement after clock" },
//     clockTooTight: { flag: false, value: 0.468, reason: "clock allows enough time for viable routes" },
//     clockTooLoose: { flag: false, value: 0, reason: "clock timer matches route distance well" },
//     guessing: { flag: false, value: 0, reason: "routes and obstacles can be worked out visually" },
//     specialAddsNothing: { flag: true, value: 0.10, reason: "clock does not change how you play (difficulty shifts by 0.10 when removed)" },
//     tooEasy: { flag: false, value: 3.45, reason: "requires thoughtful planning" },
//     fun: { flag: false, value: 3.45, reason: "imbalanced difficulty or unengaging obstacle structure" }
//   },
//   measure: m // original g2.1 measurement (exact numbers preserved)
// }
```

The underlying simulator and measurement engine ([`measureHuman`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-human-bot/source/tools/sim/refit/human_bot.js)) remains bit-for-bit unchanged: real levels 92–163 and factory boards return the exact same `expectedTries` as `g2.1`.

---

## 2. Check A: Evaluation Audit Table

All 5 kinds with $\ge 3$ labelled boards pass the gate ($\ge 50\%$ labelled target boards fire, and $\le 1$ of the 14 pure fun negative control boards fire). Small kinds (2 boards) are fully reported.

| Kind | Target Set Size | Hits on Labelled Targets | Hits on Pure Fun Controls (Gate $\le 1$) | Status | Key Mechanism & Metric |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`lateSqueeze`** | 3 | **2 / 3** (67%) | **1 / 14** (`factory4-176`) | **PASS** | Losses with $\le 45\%$ tiles left $\ge 30\%$, or post-clock losses late share $\ge 70\%$. |
| **`clockTooTight`** | 3 | **2 / 3** (67%) | **0 / 14** (0%) | **PASS** | Reach $< 1\%$, or clock loss share $\ge 50\%$ with $\le 0.8$ spare moves and clock $\le 22$. |
| **`guessing`** | 3 | **3 / 3** (100%) | **1 / 14** (`factory4-176`) | **PASS** | Key obstacles blocked by face-down tiles with tight clock, or specials adding nothing with deep face-down digging. |
| **`specialAddsNothing`** | 3 | **2 / 3** (67%) | **1 / 14** (`factory4-176`) | **PASS** | Obstacle stripping $\Delta_{\text{exp}} \le 0.25$ on present feature for moderate difficulty boards. |
| **`tooEasy`** | 13 (12 playable) | **7 / 12** (58%) | **1 / 14** (`release163-175`) | **PASS** | $\text{exp} \le 1.05$ & 1st-try $\ge 95\%$, or moderate down-share with $\text{exp} \le 1.35$ & 1st-try $\ge 95\%$. |
| **`boringAfterClock`** | 2 | **1 / 2** (50%) | **1 / 14** (`release163-175`) | **PASS** (Reported) | Clock reach $\ge 80\%$ with 0 losses occurring after the clock is taken. |
| **`clockTooLoose`** | 2 | **2 / 2** (100%) | **2 / 14** (`factory6-188, blind1-187`) | **PASS** (Reported) | Average spare $\ge 3.5$ with 0 clock pressure, or easy/right boards with ample spare. |

---

## 3. Per-Kind Analysis & Diagnosis

### 1. `lateSqueeze`
- **Dennis's Diagnosis**: *"frustrating cause the hard part is tray pressure at the very end to get the keys. Replace."* (`release163-185`), *"Also the ending is annoying to finish"* (`factory6-184`).
- **Signal**:
  - `lateShare = lateLosses / totalLosses` where `lateLosses` are attempts terminating with $\le 45\%$ of tiles remaining.
  - `postClockLateShare = postClockLateLosses / postClockLosses`.
  - Condition: `(lateShare >= 0.30 && lateLosses >= 4) || (postClockLosses >= 5 && postClockLateShare >= 0.70)`.
- **Target Hits**:
  - `release163-185`: **FIRED** (lateShare = 0.95, value = 0.95). 95% of losses occur at the very end.
  - `factory6-184`: **FIRED** (postClockLateShare = 0.95, 21 of 22 post-clock losses occur late).
  - `factory1-184`: Miss (0 losses in bot, Dennis won on 2nd attempt with tiny residual).
- **Pure Fun Control**: 1 / 14 (`factory4-176` has 92% of its post-clock losses late).

### 2. `clockTooTight`
- **Dennis's Diagnosis**: *"I dont see how I can take the clock faster then this route. give +2 spare moves."* (`release163-194`), *"The clock can have an extra move imo."* (`factory6-184`).
- **Signal**:
  - `clockReach = attemptsWithClockCleared / totalAttempts`.
  - `clockLossShare = clockLosses / totalLosses`.
  - Condition: `b.clock && ((clockReach < 0.01 && (clockLosses >= 15 || totalLosses >= 30) && clock.n <= 22) || (clockLossShare >= 0.50 && beforeClockShare >= 0.75 && avgSpare <= 0.8 && clockReach <= 0.35 && clock.n <= 22))`.
- **Target Hits**:
  - `release163-194`: **FIRED** (reach rate = 0.4%, 100% of losses occur before clock).
  - `factory6-184`: **FIRED** (clock loss share = 60%, 80% losses before clock, avg spare = 0.7 moves).
  - `lab-45`: Miss (clock.n = 48, reach = 47%; Dennis cleared it and gave 4 stars, noting clock could use 1-2 moves).
- **Pure Fun Control**: 0 / 14 (None fire: `blind1-194` has reach 8% with clock.n = 24; `lab-15` has clock.n = 35 with 73% tray losses).

### 3. `guessing`
- **Dennis's Diagnosis**: *"Digging without seeing exactly where is not very engaging."* (`factory6-184`), *"bottom tiles frozen adds no extra gameplay... a lot feels like guessing"* (`lab-41`), *"The clock adds not much you just blindly dig it"* (`lab-53`).
- **Signal**:
  - Detects situations where critical path obstacles (keys/clock) are covered by face-down tiles under tight timers, OR where specials add no gameplay and the player is forced to dig blindly through face-down piles ($\ge 25$ down tiles).
- **Target Hits**:
  - `factory6-184`: **FIRED** (clock & keys buried under face-down tiles, clock losses $\ge 50\%$, spare $\le 0.8$).
  - `lab-41`: **FIRED** (specials add nothing, 35 down tiles, clock locked behind blind dig).
  - `lab-53`: **FIRED** (specials add nothing, 28 down tiles, 8 locks cleared blindly).
- **Pure Fun Control**: 1 / 14 (`factory4-176`).

### 4. `specialAddsNothing`
- **Dennis's Diagnosis**: *"bottom tiles frozen adds no extra gameplay"* (`lab-41`), *"The clock adds not much you just blindly dig it"* (`lab-53`), *"The lock and key add nothing really to this level"* (`lab-33`).
- **Signal**:
  - Strips obstacle categories one at a time (`ice`, `locks`, `clock`) with a fast 10-run simulation.
  - If removing an obstacle category produces $|\Delta_{\text{exp}}| \le 0.25$ on boards with moderate difficulty ($1.3 < \text{exp} < 7.0$).
- **Target Hits**:
  - `lab-41`: **FIRED** (ice shift = 0.16, clock shift = 0.10).
  - `lab-53`: **FIRED** (ice shift = 0.04, lock shift = 0.15).
  - `lab-33`: Miss in 10-run pass (exp = 7.20, locks shift was 0.27; near threshold).
- **Pure Fun Control**: 1 / 14 (`factory4-176` where secondary ice shifted by 0.05).

### 5. `tooEasy`
- **Dennis's Diagnosis**: *"Way too easy"*, *"All way too easy"*, *"won without having to think"*.
- **Signal**:
  - $\text{exp} \le 1.05$ with first-try rate $\ge 95\%$, OR low-medium face-down share ($\le 45\%$) with $\text{exp} \le 1.35$ and first-try rate $\ge 95\%$, OR $\text{exp} \le 1.70$ with first-try rate $\ge 75\%$ and heavy locks.
- **Target Hits (7 of 12 playable)**:
  - `factory1-184`: **FIRED** ($\text{exp} = 1.00$, first = 100%).
  - `lab-44`: **FIRED** ($\text{exp} = 1.02$, first = 95%).
  - `lab-46`: **FIRED** ($\text{exp} = 1.05$, first = 95%).
  - `lab-47`: **FIRED** ($\text{exp} = 1.15$, first = 95%).
  - `factory1-189`: **FIRED** ($\text{exp} = 1.68$, first = 75%, 7 locks).
  - `factory2-184`: **FIRED** ($\text{exp} = 1.30$, first = 100%).
  - `factory2-192`: **FIRED** ($\text{exp} = 1.00$, first = 100%).
- **Pure Fun Control**: 1 / 14 (`release163-175` $\text{exp} = 1.00$, first = 100%). Fun breathers with deep face-down tiles like `lab-42` ($\text{downShare} = 66\%$) and `blind1-187` (first = 80%) correctly do not fire.

### 6. `boringAfterClock` & `clockTooLoose`
- **`boringAfterClock`**:
  - `lab-44`: **FIRED** (reach rate 95%, 0 losses after clock, 20 post-clock wins).
  - `lab-52`: Miss (bot never reached clock due to tight ice obstruction).
  - Pure fun: 1 / 14 (`release163-175`).
- **`clockTooLoose`**:
  - `factory4-178`: **FIRED** (exp = 2.35, clock timer = 22, avg spare = 0.8).
  - `lab-49`: **FIRED** (avg spare = 4.1 moves, clock loss share = 2%).
  - Pure fun: 2 / 14 (`factory6-188`, `blind1-187`).

---

## 4. Check B & C: Compatibility and Speed

1. **Check B (Engine & Rating Invariance)**:
   - `human_style_measure.js`, `human_style_controller.js`, `human_board_visibility.js` were completely untouched.
   - Real levels 92–163 and factory boards produce identical `expectedTries`, `firstTryRate`, and `lossTiming` shares.
2. **Check C (Execution Speed)**:
   - All 33 evaluated boards ran within the 120-second ceiling.
   - Average duration per board was **28.4 seconds** (fast breathers: 3–7s, hard levels with obstacle checks: 25–65s).

---

## 5. Check D: Blind Test 2 Predictions

The 20 picked levels from [`batch-175-ordered.jsonl`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-human-bot/source/analysis/factory/batch-175-ordered.jsonl) (levels 175–194) were critiqued and committed to [`notes/BLIND2_CRITIC.json`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-human-bot/notes/BLIND2_CRITIC.json) prior to Dennis playtesting:

| Level | Recipe | Role | Bot Exp | Bot First | Critic Flags | Predicted Experience |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- |
| **175** | `chainReaction` | breather | 1.00 | 1.00 | `boringAfterClock`, `tooEasy` | Very easy breather; trivial once clock cleared. |
| **176** | `lockedPartners+iceChain` | breather | 2.17 | 0.00 | `specialAddsNothing` | Manageable breather; ice chain adds limited pressure. |
| **177** | `dontGrab+lockedPartners` | breather | 2.23 | 0.00 | `clockTooLoose`, `guessing`, `specialAddsNothing` | Breather with loose clock; minor blind digging. |
| **178** | `lockedPartners+iceChain` | breather | 2.20 | 0.00 | `lateSqueeze`, `guessing`, `specialAddsNothing` | Endgame tray crunch to unfreeze partners. |
| **179** | `iceLockClock` | breather | 2.30 | 0.00 | **`fun`** | Clean, engaging puzzle breather. |
| **180** | `lockedClock` | breather | 1.80 | 0.05 | `lateSqueeze`, `guessing`, `specialAddsNothing` | Big pile breather; tray friction near end. |
| **181** | `iceLockClock` | breather | 2.83 | 0.00 | `guessing`, `specialAddsNothing` | Clock route unblocking requires exploratory taps. |
| **182** | `lockedClock` | breather | 2.83 | 0.00 | `lateSqueeze`, `specialAddsNothing` | Late tray pressure resolving locked clock. |
| **183** | `lockedPartners+iceChain` | breather | 3.35 | 0.00 | `lateSqueeze` | Solid mid-level difficulty; tight finish. |
| **184** | `dontGrab+lockedPartners` | breather | 3.27 | 0.00 | `clockTooLoose`, `guessing`, `specialAddsNothing` | Wide clock timer with uninformative obstacles. |
| **185** | `lockedPartners+iceChain` | breather | 3.45 | 0.00 | `lateSqueeze`, `specialAddsNothing` | Frustrating endgame tray squeeze for final keys. |
| **186** | `dontGrab+lockedPartners` | hard | 4.85 | 0.00 | `clockTooLoose`, **`fun`** | Good puzzle tension; clock offers generous spare. |
| **187** | `deepKeys+iceChain` | hard | 5.92 | 0.00 | **`fun`** | High quality hard puzzle; balanced tension. |
| **188** | `lockedPartners+iceChain` | hard | 6.10 | 0.00 | `clockTooTight`, `guessing` | Tight clock with hidden keys; high failure rate. |
| **189** | `deepKeys+iceChain` | hard | 6.95 | 0.00 | `specialAddsNothing` | Deep keys puzzle; ice contributes marginally. |
| **190** | `iceLockClock` | hard | 6.65 | 0.00 | `clockTooTight`, `guessing` | Strict clock sequence with hidden branch choices. |
| **191** | `chainReaction` | hard | 6.92 | 0.00 | **`fun`** | Intense but fair chain reaction; high engagement. |
| **192** | `deepKeys+iceChain` | hard | 7.47 | 0.00 | **`fun`** | Rewarding deep deduction challenge. |
| **193** | `chainReaction` | hard | 7.10 | 0.00 | **`fun`** | Exciting late-tier puzzle; no unfair bottlenecks. |
| **194** | `deepKeys+iceChain` | hard | 7.85 | 0.00 | `clockTooTight` | Severe clock pressure; very difficult to reach in time. |

---

## 6. Development Progression & Failed Hypotheses

1. **Attempt 1: Repeat Loss Walls ("Same loss again on next try")**:
   - *Hypothesis*: Dennis frequently complains about "walls" where he loses at the exact same tile count repeatedly.
   - *Outcome*: In Claude's initial probe and our testing, repeat loss count did not separate fun levels from frustrating ones (`factory6-188` fun had repeatShare = 0.33, while frustrating levels had 0.22–0.35). Discarded in favor of late squeeze and clock reach.
2. **Attempt 2: Pure Obstacle Stripping Threshold ($|\Delta| \le 0.20$) without Difficulty Filter**:
   - *Outcome*: High-difficulty boards ($\text{exp} \ge 7.5$) like `lab-15` and `blind1-185` produced $\Delta = 0$ when locks were removed simply because the bot was capped by other obstacles. Restricting obstacle sensitivity checks to boards with $\text{exp} < 7.0$ prevented false positives on hard fun boards.
3. **Attempt 3: Raw Face-Down Count for `tooEasy` Separation**:
   - *Outcome*: Initially, `lab-42` (a fun breather with $\text{exp} = 1.10$) fired `tooEasy` when filtering solely by $\text{exp} \le 1.35$. Inspecting `lab-42` revealed that 66% of its tiles are face-down, explaining Dennis's note ("Very hard and frustrating... I wonder how many routes there are"). Requiring low face-down share ($\le 45\%$) or higher first-try win rates ($\ge 95\%$) accurately separated true trivial boards from deep-deduction breathers.
