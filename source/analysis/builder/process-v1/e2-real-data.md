# E2: what the family's real plays can and cannot tell us

Experiment E2 of `source/analysis/builder/process-design-synthesis.md` (sections 5 and 7). Written 2026-11-07.

**Verdict: the E2 kill condition holds. Real player data cannot steer the slope of the curve.** With three family
players, a +0.35 logit step over a 20-level window is caught about 12.5% of the time, against the 70% the rule asks for.
Use real data only to flag spikes and big band errors, and to check the trailing player, as section 5 already allows.

All numbers come from `source/analysis/builder/process-v1/e2-real-data.json`, made by

    node source/tools/builder/loop/heavy.js --label e2-real-data -- node source/tools/builder/loop/real_fit.js e2 source/analysis/archive/plays-2026-11-07.json source/analysis/builder/process-v1/e2-real-data.json 100

(262 s on one core), except where another source is named.

## 1 Data

- **Source.** A read-only export of Firebase `plays/` in `source/analysis/archive/plays-2026-11-07.json` (git-ignored).
  It was taken this morning. The newest record in it is from 2026-11-06 21:05 UTC. Nothing was written to Firebase.
- **Players.** Dennisisdebeste `pmuy78xu6tsths9`, Gerda `pmv6yhzz3x9oxs8` and Mrs. Doubtfire `pmv16kj3jr35750` make up
  the family fit. PUK is `pmv2gaa0g00eq3q`; the name was checked in the export. PUK is at level 82, below the range,
  so he is not used. Grandma OmaHanny `pmuy4wmdp17hbws` is reported only on her own care track (section 5). The test
  account DennisTEST `pmuxw2uqkzcnbgx` is never read.
- **Current board only.** `plays/` has no design-version field, so `real_ledger.js` uses two checks together:
  - the app version must be at least the release that put today's board on the level: 1.54 for 92+ (the reorder of
    2026-10-16), 1.52 for 90-91 and 1.48 for 85-89;
  - the tile count `n`, and on start records the clock moves `ck`, must match `source/www/levels-hard.js`. That
    table has not changed on main since 2026-10-16 (`git log main -- source/www/levels-hard.js`, commit e8664e06).

  A player who had already **won** a level on an older board is left out of that level, because the current board
  was then only a replay. This happened 9 times, mostly Dennis on 90-105, so Dennis has almost no data on 90-105.
  Another 7 player-levels had no try on the current board.
- **Tries.** One try is one attempt id. A restart counts as a loss. A try that was left without an end and followed
  by a new try counts as a loss. A last try with no end is open: it is censored, not counted as a loss. Replays
  after the first win are dropped. A new attempt id whose attempt counter `at` did not go up is the same try logged
  twice, and is ignored.
- **Cross-check against the dashboard's `forecast-score.js` `outcome()`.** The two agree on 296 of 297 won levels.
  The one difference is Dennis on 106. `outcome()` says 3 tries because the game's `at` counter carried over his
  first try on the old 1.52 board. The ledger says 2, which is correct for the current board.
- **Size.** 299 family sequences with 1,557 tries, of which 1,121 remain after the 12-try rage cut.
- **Unsure: 85-89.** These levels count plays from 1.48 on. The history map says 1.52 reordered only 90-269, and
  the 1.50 commit says "keep live 1.49 boards", so 85-89 should be the same board since 1.48. This was not checked
  board by board. If 1.52+ were required instead, Dennis would keep only level 85 and Mrs. Doubtfire's 89 would fall
  from 13 tries to 3 (ad-hoc check with the same ledger).
- **Version note.** Mrs. Doubtfire has 44 records from app 1.65 (levels 175-176, from 2026-11-06), and main's log
  shows "Version 1.65". So 1.65, not 1.64, appears to be live now. The level table is the same in both.

## 2 Frontiers (from the export, as of 2026-11-06 21:05 UTC)

| Player | Highest started | Highest won | Last play | Open now |
|---|---|---|---|---|
| Dennis | 200 | 199 | 2026-11-04 | 200: one try started, none finished, so it is not counted |
| Gerda | 192 | 191 | 2026-11-06 | 192: 3 tries lost, still playing |
| Mrs. Doubtfire | 176 | 175 | 2026-11-06 | 176: 10 tries lost, still playing |
| PUK | 82 | 81 | 2026-11-03 | not in the family fit |
| OmaHanny (care track) | 140 | 140 | 2026-11-05 | (see section 5) |

The trailing player, Mrs. Doubtfire, is 24 levels behind Dennis. That lag is built into the power simulation.

**Beyond 199:** no family player has a finished try on any level from 200 up. There is nothing to report there yet.

## 3 Y and Dennis's first-try rate per 10 levels (85-199)

- **Y** is (2·Dennis + Gerda + 2·Mrs Doubtfire)/5. Each player's tries to the first win are capped at 20. A level not
  won yet counts as tries + 1 and is marked censored. Y is defined only on levels all three have played, so it ends
  at 176.
- **Model Y** comes from the fit with 20-level windows mapped onto these 10-level rows, and with 10-level windows in
  brackets. It is the capped expected tries at an average level of the window, with the level-effect spread
  integrated out. It is the only Y for 177-199, where Mrs. Doubtfire has no data yet, so read it there as an
  extrapolation.
- The per-player columns are mean tries to the first win, capped at 20.

| Levels | Y levels | Y mean | Y median | Model Y 20 (10) | Dennis levels | Dennis first-try | Dennis | Gerda | Mrs D |
|---|---|---|---|---|---|---|---|---|---|
| 85-89 | 5 | 4.16 | 3.2 | 3.58 (3.86) | 5 | 0.40 | 1.8 | 7.2 | 5.0 |
| 90-99 | 0 | – | – | 3.58 (3.34) | 0 | – | – | 5.9 | 4.5 |
| 100-109 | 4 | 2.50 | 3.0 | 3.28 (2.98) | 4 | 0.25 | 2.25 | 4.6 | 1.9 |
| 110-119 | 10 | 3.26 | 3.4 | 3.28 (3.57) | 10 | 0.50 | 1.9 | 8.9 | 1.8 |
| 120-129 | 10 | 4.32 | 4.6 | 3.77 (3.99) | 10 | 0.60 | 2.0 | 11.2 | 3.2 |
| 130-139 | 10 | 3.86 | 2.6 | 3.77 (3.58) | 10 | 0.50 | 1.9 | 7.5 | 4.0 |
| 140-149 | 10 | 3.92 | 3.8 | 3.75 (3.53) | 10 | 0.90 | 1.1 | 7.0 | 5.2 |
| 150-159 | 10 | 4.58 | 3.4 | 3.75 (3.88) | 10 | 0.20 | 2.1 | 6.3 | 6.2 |
| 160-169 | 10 | 3.06 | 2.2 | 3.24 (3.13) | 10 | 0.90 | 1.4 | 6.1 | 3.2 |
| 170-179 | 7 (1 censored: 176) | 3.63 | 2.2 | 3.24 (3.36) | 10 | 0.60 | 1.9 | 5.1 | 5.0 (7 levels) |
| 180-189 | 0 | – | – | 3.19 (3.10) | 10 | 0.80 | 1.4 | 5.7 | – |
| 190-199 | 0 | – | – | 3.19 (3.59) | 10 | 0.60 | 2.1 | 6.0 (3 levels) | – |

How to read it:

- **Family Y is flat at about 3-4.5 over 85-199.** The fitted window effects never move by more than 0.4 logit (20-level windows; 0.5 with 10-level windows), and
  no step between neighbouring windows clears 2 SE (section 4). Nothing in the real data says that 100-199 got
  harder.
- **Dennis's first-try rate is 59.6% over all his levels.** Per 10 levels it swings from 0.2 to 0.9. With 10 levels a
  rate has an SE of about 0.15, so these swings are mostly noise. The model's figure per window is 0.57-0.63 (20-level) and 0.55-0.66 (10-level).
- **The walls are single levels, not windows.** Tries over 12 (ledger, before the rage cut): Gerda 91 (68), 132 (71),
  149 (75), 150 (81), 188 (37), 123 (36); Mrs Doubtfire 144 (38), 132 (31). 25 player-levels go over 12, 19 of them
  Gerda's.

## 4 The estimator (real_fit.js)

**Model.** For each try:

    logit P(win) = skill[player] − window[W(level)] − level[level] − u[player, level]

- The windows follow a random walk with step sd τ = 0.5 (fixed), and the first window is fixed at 0.
- Level effects are shared by all players and shrunk with sd `sdLevel`. The player-by-level term `u` has sd `sdSeq`.
  `sdLevel` and `sdSeq` are chosen **together** by Laplace evidence on a grid (`chooseSds`, 8 x 5 points). For both
  window sizes the evidence picked **sdLevel 0.6 and sdSeq 0**, so there is **no player-by-level term** in the fit
  (20-level evidence −565.5; 10-level −566.91; `windows.<size>.sds`).
- The evidence is flat near the top: for 20-level windows (0.6, 0.25) scores −565.64 and (0.6, 0.5) scores −566.69.
  The data therefore do not say that the family disagree on which levels are hard; they also do not rule out some
  disagreement. That is why the power run also tries worlds with sdSeq 0.5 and 1.0 (section 5).
- An unwon level adds only its lost tries (exact censoring). Tries after the 12th are dropped.
- It is fitted by Newton's method on the posterior mode, with SEs from the Laplace approximation.
- The code is plain node, not the `real_fit.py` the synthesis names.
- **Departure from the synthesis (line 102):** the synthesis estimator has a "slow skill drift" term. This one has
  none, on purpose: a drift shared by the players cannot be told apart from the window random walk. Adding a drift
  term could only widen the SEs and lower the power, so the kill verdict below holds a fortiori.
- **First windows are short.** Windows line up with multiples of the window size, not with level 85. So the first
  20-level window is 85-99 (15 levels) and the first 10-level window is 85-89 (5 levels). Boundary 1 is measured
  against a short window. It is one of the five 20-level boundaries (three players on both sides), so the pooled
  kill figure includes it; the other four boundaries are against full windows.

**Fit, 20-level windows** (`windows.20.fit`).

- Skills (logit): Dennis +0.37, Mrs Doubtfire −0.86, Gerda −1.72. The fitted level effects have an rms of 0.35.
- Window effects relative to 85-99: 100-119 −0.14, 120-139 +0.09, 140-159 +0.08, 160-179 −0.16, 180-199 −0.18.
- Steps between neighbouring windows:

| Boundary | Step (logit) | SE | Players | Flagged |
|---|---|---|---|---|
| 85-99 → 100-119 | −0.14 | 0.28 | 3 | no |
| 100-119 → 120-139 | +0.23 | 0.25 | 3 | no |
| 120-139 → 140-159 | −0.01 | 0.25 | 3 | no |
| 140-159 → 160-179 | −0.24 | 0.25 | 3 | no |
| 160-179 → 180-199 | −0.02 | 0.29 | Dennis, Gerda | no |

- The SE of a 20-level step is 0.25-0.29. The synthesis assumed about 0.17.
- With 10-level windows, the step SEs are 0.30-0.37 and no step is flagged.
- For comparison, the first-draft setting (sdLevel 0.3, sdSeq 0.5, `fitOldSettings`) gave SEs of 0.23-0.28; the
  current setting gives slightly larger ones.

**Does the model reproduce the real data?** Predictive check with 200 simulations (`windows.20.predictiveCheck.fitted`):

| Player | Share won first try: real / simulated (90% range) | Share hitting the 12-try cut: real / simulated (90% range) |
|---|---|---|
| Dennis | 0.596 / 0.592 (0.51-0.67) | 0 / 0.001 |
| Mrs Doubtfire | 0.308 / 0.312 (0.22-0.40) | 0.066 / 0.040 (0.01-0.08) |
| Gerda | 0.131 / 0.176 (0.12-0.24) | 0.178 / 0.167 (0.11-0.23) |

Every real value lies inside its 90% range. Gerda's real first-try share sits at the low edge: she has more
"almost never first try" than the model gives her.

## 5 Power simulation (the E2 question)

**Set-up.**

- The simulated world uses the fitted skills, level effects with sd 0.6 and no player-by-level term (the chosen
  setting, `windows.<size>.power.world`).
- Missingness and lag are the real ones: exactly the player-levels the family really played. That includes Dennis's
  gap on 90-105 and the frontiers, so the last 20-level window has only Dennis and Gerda.
- Won levels are replayed to a win or to the 12-try cut. Unfinished levels are simulated only as far as the player
  really got.
- One step of +δ is planted at each window boundary in turn.
- **Detected** means the estimated step is above 2 SE in the right direction and every leave-one-player-out refit
  agrees on its sign. A **false alarm** is the same test passing in a world with no step.
- There were 100 simulations per δ and boundary (50 in the flat-τ and heavier-world checks) and 200 null worlds per
  size. 16,000 refits for 20-level windows and 30,400 for 10-level windows; none failed to converge.

**Results** (`windows.<size>.power.summary`; "3-player boundaries" means boundaries that all three players have
played on both sides):

| Window | Planted step | Detected (3-player boundaries) | Best single boundary | Mean estimate / true step |
|---|---|---|---|---|
| 20 levels | +0.20 | 3.7% | 4% | 0.68 |
| 20 levels | **+0.35** | **12.5%** | 14% | 0.74 |
| 20 levels | +0.50 | 21.5% | 24% | 0.70 |
| 20 levels | +0.75 | 55.7% | 65% | 0.72 |
| 10 levels | +0.20 | 1.1% | 3% | 0.56 |
| 10 levels | +0.35 | 4.7% | 10% | 0.62 |
| 10 levels | +0.50 | 8.9% | 13% | 0.60 |
| 10 levels | +0.75 | 25.3% | 30% | 0.58 |

False alarms per window:

- 20-level windows: pooled 1.0%, worst window 1.5%;
- 10-level windows: pooled 0.3%, worst window 1.0%.

**Robustness checks** (all in the JSON):

- **Less shrinkage** (τ = 5, so the window prior hardly shrinks the steps; `summaryFlatTau5`). With 20-level windows,
  +0.35 is detected 16.5%, +0.5 30% and +0.75 67.5% of the time. False alarms are 3.7% pooled and 4% in the worst
  window. The estimates are then nearly unbiased (0.95-1.00 of the true step), but the power stays far below 70%.
  With 10-level windows and τ = 5, +0.35 is detected 9.7% and the worst-window false alarm is 7.5%.
- **A heavier world** (player-by-level sd 1.0, fitted with sdSeq 0; `heavierWorldSd1`). With 20-level windows +0.35
  is detected 8-16% of the time per boundary (8.5% pooled over 3-player boundaries), with false alarms of 2.5-5%.
- **A misspecified fit** (world with sdSeq 0.5, fitted with sdSeq 0; `falseAlarmMisspecified`). With 20-level
  windows false alarms stay at or below 2% per boundary.
- **The leave-one-player-out check** almost never changes the outcome: the rates without it are the same within 1
  point. The 2-SE threshold is what decides.

**What the step sizes mean in tries** (`windows.20.fit.stepInTries`, at the first window, capped at 20):

| Step | Dennis | Mrs Doubtfire | Gerda |
|---|---|---|---|
| +0.35 logit | 1.8 → 2.2 tries | 3.8 → 4.8 | 6.7 → 8.3 |
| +0.75 logit | 1.8 → 2.7 | 3.8 → 6.3 | 6.7 → 10.3 |

So even a window becoming about 1.5 times as hard for Gerda is caught only a little over half the time. A 25% rise
goes unnoticed.

## 6 Kill verdict and what follows

The rule from synthesis section 7 is: if +0.35 over 20 levels is detected less than 70% of the time, or false alarms
are above 10% per window, real data does not steer the slope.

- **Measured:** 12.5% detection (16.5% with the flat prior; 4.7% with 10-level windows), and at most 1.5% false
  alarms (4% with the flat prior).
- **Killed.** It fails by a wide margin and on every robustness check, not near the threshold.
- The synthesis expected about 50%. The real figure is lower for three reasons: the step SE is about 0.25-0.29
  rather than 0.17, the window prior shrinks estimates by about 25% (mean estimate 0.74 of the true step), and Mrs
  Doubtfire's lag removes the third player from the newest window.

What this means for the process (section 5 of the synthesis, applied as written there):

1. **The slope g is Dennis's choice, held by the ruler.** Retargeting g from real data (step 4) is off. Section 5's
   ±0.25%-per-level nudges are far smaller than anything the data can see.
2. **Real data keeps three jobs.**
   - **Gross band check (a proposal for Dennis, not a tested rule):** a 20-level window about 0.75 logit or more off
     its locked prediction, which is roughly 1.5 times Gerda's tries. The tables above say this size is caught only
     about 56% of the time (67.5% with the flat prior; lower on the 2-player newest window), under the 70% bar.
     No size that was tested reaches 70%. A step of about 1.0 logit was not measured, so a trigger there would need
     another run. Treat any trigger as a prompt to look, not as proof.
   - **Spike and defect ledger:** single levels where Gerda or Mrs Doubtfire need more than 20 tries. This has always
     been the clearest signal (91, 132, 149, 150, 188 for Gerda).
   - **Gerda's guardrail and Dennis's first-try rate,** reported as trends with their SEs (about 0.15 per 10 levels),
     not used as triggers.
3. **Locked predictions (step 1) are still worth writing.** Scoring them over many windows calibrates the map M,
   which is a slow, averaged use the power test does not cover.

## 7 Grandma (care track, not in the family fit)

Grandma has her own monitor, with a target of at least 70% won on the first try per 10 levels (synthesis section 5).
Her figures are from `careLedger` in the JSON. It counts all her records, because her track has its own boards.

| Levels | First-try rate | Mean tries |
|---|---|---|
| 81-90 | 0.9 | 1.1 |
| 91-100 | 0.5 | 2.5 |
| 101-110 | 0.8 | 2.2 |
| 111-120 | 0.8 | 1.4 |
| **121-130** | **0.2** | **5.7** |
| 131-140 | 0.5 | 1.8 |

- She is at level 140 and has won every level she started.
- 121-130 and 131-140 are under her 70% target, and 91-100 is too. **Dennis should look at 121-130 for her.** The
  actuator, CARE_CATCHUP, is game code and needs his OK.

## 8 Unknowns and limits

- **85-89 rests on pre-1.52 plays.** Board identity there is inferred, not checked (section 1).
- **Dennis played almost nothing on the current boards of 90-105,** so the first windows lean on Gerda and Mrs
  Doubtfire.
- **τ (0.5) is fixed, not fitted.** The level sd (0.6) and the player-by-level sd (0) are chosen by evidence, which is flat near the top (section 4). The flat-τ check shows the verdict does not depend on τ.
- **Player skill drift (learning) is not in the model** (a departure from the synthesis, see section 4). Steady learning would look like a slowly easing window effect. That is one possible reading of the slightly negative effects after 160. Adding it can only lower the power.
- **The first windows are short** (85-99 and 85-89), so boundary 1 is measured against a short window.
- **The estimator is node (`real_fit.js`), not `real_fit.py`.** Its tests (`node --test
  source/tools/builder/loop/test_real_fit.js`, 18 pass, under 1 s) check that a planted step is recovered, that
  censoring works, that the evidence picks the player-by-level term when the data have one, and the ledger rules. They also check the real
  export: Dennis's highest win is 199, `outcome()` agrees on at least 95% of won levels, and no test or care account
  appears in the family data.

## Files

- `source/tools/builder/loop/real_ledger.js`: the ledger (current board, tries to the first win, Y, care ledger).
- `source/tools/builder/loop/real_fit.js`: the estimator, the step test, the power simulation and the E2 runner.
- `source/tools/builder/loop/test_real_fit.js`: the tests.
- `source/analysis/builder/process-v1/e2-real-data.json`: all the numbers above.
