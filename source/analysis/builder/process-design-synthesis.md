# Oma's Mahjong level process: frozen puzzles, one dial, honest yardstick

Updated 2026-11-08 to Dennis's decisions in `LEVEL-DESIGN-FACTS.md`: new levels start at 250; family 10 at 250, 12 at 274, 13 at 275, then about +3 per 25 levels. Skilled target is 2.5-6 per level, with an explicit minimum of 2 if really needed. Record each fallback level; never average skilled ratings across levels. There are no difficulty dips or peak slots. E1-E7 results remain historical experiments, not authority to override these decisions.

## 1 Thesis

The record shows three separate causes of difficulty jumps. Each needs its own fix.

1. **Rebuilding to steer.** Every change to the builder's seed, brief, target, way length or a piece produces a new puzzle. One brief across seeds 1/2/3 gave 19.3 / 6.9 / 19.1. The way ladder is a cliff in 5 of 6 pairs. 36% of 746 journaled edits moved the rating by 3 or more tries.
2. **Noise and bot blind spots measured as if they were difficulty.** Two seeds of the same board agree only at r 0.71-0.83. Key memory lowers hidden-key boards by 6.18 tries. Frozen keys took one board from 20 to 3.4. The planner's 201 paradox reads 5.42 as is and 19.93 face-up.
3. **Human spikes the bot cannot see.** 132 is an opening-clock race that the bot solves first try 90% of the time while Gerda lost 54 of 70 tries. 150 is a squeeze in the middle of the board. 91 and 149 come from hidden tiles.

The process:

- **Build once and freeze.** The builder makes readable puzzles once. After a puzzle has been measured it is never changed, except for its clock budget through `knobs.clockSpare`.
- **Measure the whole curve.** For each puzzle, measure family difficulty at every clock budget (spare 0-3) with one pinned family bot on paired seeds. Confirm the value we will ship on fresh seeds that were never used for any choice.
- **Reject unintended difficulty.** A puzzle is refused unless its difficulty comes from a readable, early, learnable trap. Engine proofs, bot traces and counterfactual checks enforce this.
- **Place pairs on the approved curve.** Each level gets a (puzzle, spare) pair on the steadily rising curve starting at 250. Rules guard against a cliff at the neighbouring spare, and the known human spike patterns are banned or rationed.
- **Real play sets only the slope.** The loop is windowed, deadbanded and rate-limited, and it only touches levels nobody has opened.

There are two axes:

- **Family difficulty** is set by the spare and by which puzzle is chosen.
- **Skilled difficulty** (Dennis) is set by which puzzle is chosen. Spare barely moves it: the median change from spare 1 to 2 is -0.02.

What this does **not** claim: it does not predict how one level will feel to one person. Players agree on which levels are hard at rank 0.03-0.18 at best, and the bots do worse per level than a constant guess. What it does claim:

- no cliffs the bot can see;
- none of the documented human spike patterns;
- steady 5-level averages;
- a curve whose scale is re-measured from real play.

The bottleneck will be **supply**, mostly skilled 2.5-6 under the readability rule (about 8 of 74 readable ladder boards), not measurement. The experiments are ordered to find this out early.

## 2 What difficulty means and how it is measured

**Units**

- **D (family):** the expected tries to the first win, capped at 20, of the pinned family bot. We work in log D. p_hat (wins per attempt) is stored with every rating so that boards near the cap still give a gradient.
- **S (skilled):** the pinned planner's expected tries, taking the better of its route and plain styles. It is measured once per puzzle, at spare 2.
- **Y (real family yardstick):** Dennis's weighting, (2·Dennis + Gerda + 2·Mrs Doubtfire)/5. It counts tries until the first win, on the current board only (tile count and design version must match), with restarts counted as losses and replays after a win dropped. Capped at 20 for reports and at 12 for model fitting.
- **Dennis's first-try rate per window:** the real skilled yardstick.

**Bots and tools, and what each is trusted for**

| Tool | Role | Trusted for |
|---|---|---|
| engine.js | exact rules (peek pairs, ice, locks, tray, clock after the action) | winnable, clockShortest, classify, honest clock, detour costs. 'unknown' is never read as a loss |
| family-key-memory-v1 (fingerprint d362e85f…), if Dennis adopts it; otherwise reference f3285928 | the family ruler | relative comparisons on the same puzzle (spare steps) and averages over windows. Not per-level human prediction |
| reference family bot | counterfactual only | flags boards whose rating depends on forgetting keys |
| planner (Task 05 better-of-two-styles), pinned | S | a gate on the skilled band. Dennis's own won lab tries override it on boards he played |
| planner with all tiles face up | counterfactual | flags skilled numbers that come from planner artifacts or from hidden information |
| task11_capture.js / task11_scoring.js (already in loop/) | per-move traces classified by the engine | trap attribution, timing of the first error, delay from error to loss, repeated losing moves |
| GPU proxy (Spearman 0.50 family) | not used for decisions | at most a later easy-floor cut, if it ever saves time |
| simple-playout kernels | optional | Monte-Carlo luck and permutation checks |

**Precision**

Tries are roughly geometric, so the spread of one campaign is about √(D(D−1)): about 7.5 at D 8 (this matches the 3,865 two-seed pairs) and about 10-11 at D 12. Standard error (SE) at D≈8:

| Campaigns | SE (tries) | SE (log D) |
|---|---|---|
| 40 | ~1.2 | ~0.15 |
| 80 | ~0.85 | ~0.11 |
| 160 | ~0.6 | ~0.08 |
| 320 | ~0.42 | ~0.05 |

At D 12, multiply the try column by about 1.4. Two consequences:

- A fixed ±1 tolerance gets very expensive above D≈10, so above D 10 the tolerance becomes relative (±10%, a decision for Dennis).
- At 160 campaigns per level, a 5-level window mean has SE ≈ 0.27, so the approved ±0.5 window band becomes meaningful. At 80 campaigns (SE ≈ 0.38) it is not.

**Seed blocks (yardstick.json)**

| Block | Seeds | Used for | Rule |
|---|---|---|---|
| SCREEN | 20-campaign prefix of 4711 | early stop | discarded after use |
| CURVE | 4711 + 18427, 80 campaigns | every spare of a puzzle | paired, so that steps between spares are differences on common random numbers |
| ACCEPT | fresh 40-campaign blocks from 29717 upward | the value of record | never reused, never used for choosing |

Only ACCEPT numbers enter assignment and window checks. This removes the winner's curse seen in Task 01 (213: 8.0 pooled vs 10.5 on a fresh seed).

**Sequential acceptance**

1. Start with 160 ACCEPT campaigns.
2. If the gap |D − T| is at most 0.6 × tolerance, accept.
3. If it is above 2.5 × tolerance, the pair is refused for that slot. The puzzle goes back to the library for other slots.
4. Otherwise add blocks up to 320 campaigns, then decide within tolerance.

Precision is spent only near the edges.

**Validity of the ruler**

MAE against real tries is the wrong test, since a constant beats every bot. The ruler must be no worse than the reference bot on three checks:

- spike AUC on live levels (yardstick ≥ 6; reference 0.76);
- 5- and 10-level window error against the always-median baseline (reference window Spearman 0.55 at 5 levels, n=13);
- planner rank on Dennis's lab boards.

D is used as an ordinal ruler. Its scale against real players comes from a map M from bot tries to real tries: isotonic, fitted per fingerprint, and refitted after every played window. Live levels read at about 0.78× today, and almost no live level rates above bot 7. So any part of M above 7 is extrapolation, and is labelled as such.

**Real-data estimator (real_fit.py)**

- logit P(win on a try) = player skill + slow skill drift − window effect (20 levels, random walk) − level effect (shrunk hard toward 0).
- Exact censoring of unfinished levels.
- Tries after the 12th dropped (rage).
- Leave-one-player-out sign check.
- Expected precision is about 0.17 logit per 20-level window. Judge 3's arithmetic says a 0.35-logit step is caught only about half the time at a 2-SE deadband, so real data is a **slope and spike instrument**, not a per-level one.

## 3 Why it will not jump

1. **No rebuilding after measurement.** Every recorded cliff came from a rebuild. A library puzzle's design is frozen. The only transform is `knobs.clockSpare`, which changes only clock.n and replays the full witness (judge-verified in knobs.js). If a level misses its target, it moves to an already-measured spare or to another library puzzle. Nothing is edited.
2. **The one dial is a pure relaxation, and its direction is verified.** Any play that wins with n clock moves also wins with n+1. Evidence:
   - Task 10: 23 of 24 pairs in the expected direction (20 of 21 without frozen keys, median −1.13).
   - clock-spare-1: 18 of 20.
   - v3 ladder: 0 of 74 exact spare 1→2 pairs got harder by more than 0.5 (47 easier, 27 flat).
3. **Every curve is measured, and cliffs next to the shipped spare are refused.** Paired curve D(0..3) per puzzle; spare 0 is a measurement probe only. Spare s may ship only if:
   - **Monotone:** D(s+1) ≤ D(s) + max(0.5, 2·SE of the paired difference).
   - **Tighter-neighbour rule:** D(s−1) ≤ min(1.5·D(s), D(s) + 3). A player who wastes one move more than the bot then lands near the plan, not over a cliff. This is the 217 lesson: spare −1 sent it to 20.
   - **Not censored:** D(s) < 18.5.
4. **Noise cannot pose as difficulty.**
   - Steps are measured on paired seeds.
   - Values of record come from fresh ACCEPT blocks.
   - Acceptance is sequential near the tolerance edge.
   - Tolerance is set from the measured noise.
5. **Bot blind spots are removed by construction and flagged by counterfactuals.**
   - Removed: frozen keys (frozenGuards and chainReaction are dropped), hidden keys (both key glyphs visible at the start), hidden objectives (readable).
   - Flagged: reference vs key-memory disagreement, and the planner face-up artifact (gates C1-C3 in section 4).
6. **The known human spike patterns are banned or rationed.**
   - **Opening-clock rule:** if engine.clockShortest k at move 0 is 6 or less, the shipped spare must be at least 2.
   - **Spare-1 rationing:** spare 1 on at most 1 level in 5, never on two levels in a row. The family's walls (132, 149, 150, and PUK on 82) are 1-move margins. On live 90-199 by spare, the weighted real tries are 4.35 / 3.50 / 2.98 at spare 1/2/3. This compares different puzzles and is confounded (n is about 32/40/8 in the judge's recount), but the direction holds.
   - **Late squeeze and hidden-tile gates:** see section 4.
7. **Assignment keeps neighbours close.**
   - Per-level tolerance is ±1 try.
   - The 5-level window mean must be within ±0.5.
   - No level more than +1 try above its curve target. Big-board slots have the same target rule.
   - Player-loop's mix of gentle levels next to hard ones is **not** used: it brings back the easy-hard alternation Dennis rejected.
8. **The real-data loop cannot oscillate.** It acts only when the gap exceeds 2 SE and 0.15 logit and the leave-one-player-out check agrees. It moves by at most one slope step per window, never acts within 10 levels of any player's frontier, and never changes a level that has been started.

**What remains.** A board the bot finds medium can still be a wall for Gerda through a mechanism no bot models. Mechanisms 6 and 8 reduce this, but nothing removes it. Guardrails catch it after the fact (section 5).

## 4 Puzzle quality gates

The gates run in order of cost. "Report-only" gates are logged but do not reject until experiment E5 calibrates them. "Unknown" from the engine never counts as a loss.

**A. Static gates (engine only, seconds per board; `loop/static_gates.js`)**

| # | Gate | Exact check |
|---|---|---|
| A1 | Honest build | builder v3 with the readable intent on; stories other than frozenGuards and chainReaction. gate.js: witness replays; honest clock (winnable at k, lost at k−1, engine with peek pairs); 0 idle specials (builder prune plus gate ablation); picture counts; at least 72 tiles |
| A2 | Readable | `placement_score.readable` passes (objective in sight, at most 1 face-down tile on the route, no face-down clock, key or lock). `tileVisibility` shows both key glyphs at move 0, or both revealed within 3 moves |
| A3 | Release-legal clock | the stored strict witness passes `H.validSolution`. Its clock index + 1 equals `engine.clockShortest` k, so there is no peek-pair shortcut and the t_clocks spare equals the true spare (5 of 18 qualified boards had a hidden larger spare). clock.n = k + s ≤ 19. Shipped s ∈ {1, 2, 3} |
| A4 | No hidden single order | `engine.classify` at the opening finds at least 2 winning actions. At every witness state with exactly one winning action, that action is in the visible-goal set: a clock blocker on `engine.toClock` within 3 of the clock, a visible key glyph, a visible lock, or a tray match. New `obvious.js` reimplements the attraction idea; another session's cone.js is not touched |
| A5 | Priced temptation | new `detour.js`. At one or more witness states in the first 15-60% of the way there is a visible tempting move (a free face-up pair or match not on toClock) whose cost, clockShortest after it minus the remaining clock moves, is 1-2. This gives the dial a meaning: each extra spare move buys one such mistake |
| A6 | Fair lose-forks | new `publicfork.js`. Any tempting move that loses outright at every shippable spare must: be 'lose', with a goal-directed alternative 'win', under K=4 permutations of the face-down pictures (K=16 once the cost is known); have a losing branch whose loss shows within 6 removals; and sit while at least 60% of tiles are left. A losing tempting move that fails this rejects the board. 'unknown' is a warning until E6 measures the yield |
| A7 | Luck bounded | room profile unrelieved = 0, `luck.tightBlind` ≤ 1; winnable from the start in all K permutations |
| A8 | Opening clock | k at move 0 ≤ 6 → mark "spare ≥ 2 only" |
| A9 | Original and shaped | `originality.js` (D4 overlap under 75%, or Dennis's relaxed rule), no blob or block shapes, boards over 88 tiles only for lv%10==0 slots |

**B. Trace gates** (40 family campaigns captured from the CURVE block at each spare that could ship; `loop/traces.js` wraps task11_capture.js and task11_scoring.js; about 20-40 s per puzzle)

- **B1 Fork bites:** the family bot picks the losing or detour move at a designed fork in at least 15% of first tries. This is the check Task 10's idle traps never had.
- **B2 Losses at the trap:** in at least 50% of lost tries, the first irreversible error is at a designed fork or priced detour. The old gate was 60%; this threshold is calibrated in E5.
- **B3 Early:** the median first error falls in the first 15-60% of the board.
- **B4 Learnable:** the median delay from error to loss is at most 6 removals (brutal boards had 10, easy ones 5).
- **B5 No late squeeze:** tray losses with under 25% of tiles left make up at most 10% of losses.
- **B6 Post-clock:** losses after the clock is taken make up at most 40% of all losses. Boards labelled "second act" need at least 10%, with the post-clock fork at 40-65% of the board.
- **B7 Repeated losing moves (report):** the share of losses in tries 6-20 that repeat a known losing move. If it is above 50%, the rating is inflated by the bot's second blind spot, and the board may only fill slots with T ≤ 10.

**C. Counterfactuals** (finalists only)

- **C1:** |D_reference − D_key-memory| ≤ max(2, 25%) at the shipped spare.
- **C2:** planner face-up ≤ planner as is + 2. Otherwise S is untrusted (the 201 pattern) and the board earns no skilled credit.
- **C3 (report, Dennis decides whether to enforce):** planner face-up ≥ 50% of planner as is, meaning the skilled difficulty is not mainly hidden information.
- **C4:** the specials ablation at ACCEPT. Removing each special must lower D by at least max(1, 2 SE). This is the old "every special matters" rule.

**D. Curve gates** (`loop/dial_curve.js`): monotone, not censored, tighter-neighbour (section 3). D(1)/D(3) ≥ 1.2 marks a puzzle "diallable". A flat puzzle may still ship as "fixed" if it passes B and C, but it can never be re-dialled.

**E. Skilled band:** target S between 2.5 and 6 on every level. Dennis permits a minimum of 2 if really needed. Report normal and fallback supply separately and record each level using S below 2.5; none below 2 or above 6. No hidden screening margin or averaging across levels. Dennis's actual lab results count where the exact puzzle identity is established.

**Card.** Each accepted pair carries one sentence a person can read. Example: "Take the free pair before the clock and you lose a move; you can afford 2." Also its archetype label (A1 free-pair relief, A2 keys before the clock, A3 thaw order, A5 second act) and the measured share of errors at the trap. Labels come from the A5/A6 analysis of what the builder produced. Building archetypes on purpose is later work, because builder v3's greedy pairing cannot make them today.

## 5 The curve for all future levels and the role of real player data

**Anchor (E4).** Rate live 175-199 plus 91, 132 and 150 on the pinned ruler, and re-read the fresh plays export from 2026-11-07. The draft from that export puts live 152-191 at family-weighted Y ≈ 3.3-3.8, with Dennis winning about 64-70% first try.

- E4's suggested lower start at 200 is historical evidence only. It does not set the new starting target.
- Dennis's approved start is family 10 at 250, with skilled target 2.5-6 and an explicit minimum-2 fallback if needed.

**Trend.** Family target 10 at 250, rising evenly to 12 at 274, then 13 at 275. After 275, increase about as much per 25 levels: +3 tries (about 16 at 300 and 19 at 325). `loop/policy.js` holds this curve. There are no per-position difficulty modifiers. Big boards remain on every tenth slot, without a difficulty boost.

**Tolerance:**

- per level: |D_accept − T| ≤ 1, including an independent seed check;
- every 5 consecutive levels: mean within 0.5 of the curve.

**Measurement limit.** Above about D 14-16 the current meter loses resolution because of its 20-try cap. Do not flatten the approved curve to fit the meter. Targets beyond its reliable range must be reported as unresolved until a suitable measure is validated.

**Skilled track.** Normal band 2.5-6, independently of neighbours; an explicitly recorded fallback may go down to 2 if needed. A level below 2 cannot be compensated by a harder one.

**Real player data: the outer loop only**

1. **Lock predictions.** Before each window ships, write a locked prediction of its real band (M applied to the window's D, with an interval) into the batch plan.
2. **Power simulation first (E2).** Real data may steer only within the detection power shown there. If the power is low, it only flags spikes and gross band errors.
3. **After the trailing family player passes a window**, refit real_fit.py and score the locked prediction.
4. **Retarget slowly.** Only if the gap clears the deadband and the leave-one-player-out check, change g for windows not yet built or opened, by at most one step (±0.25% per level). With Dennis's OK, re-dial levels that are shipped but unopened by exactly one spare. That is possible only because every shipped curve is already measured.
5. **Guardrails:**
   - **Gerda:** no board predicted above 3× her window median, and no window above about 12 expected tries for her.
   - **Defects:** any level where Gerda or Mrs Doubtfire needs more than 20 tries triggers investigation. Diagnose it with real_losses.js (loss phase, tiles left) and append it to a spike ledger whose features feed back into gates A8 and B.
6. **Refit M** per fingerprint and report spike AUC and window error, never MAE alone.

**Grandma (OmaHanny)** gets her own monitor (care_monitor.js) with a first-try target of at least 70% per 10 levels. Her data never enters the family fit. Her actuator, the CARE_CATCHUP pace, is game code and needs Dennis's OK.

## 6 The pipeline step by step

New code goes under `cc-builder-loop/source/tools/builder/loop/`; data under `cc-builder-loop/source/analysis/builder/library/`. Existing tools are wrapped, not edited.

**0. One-off prerequisites**

- **(a) Pin the ruler.** Claude reviews and merges family-key-memory-v1 (Codex, wip/codex-why-hard) and Gemini's G2 zero-drift fast path (wip/gemini-fast-rating), resolving the conflict on the `createMeter`/`BOT_VERSIONS` line. Gemini extends `campaignFast` to the key-memory bot and re-proves zero drift with `verify_fast_rating.js --mode verify` on 100 boards. Pin the planner fingerprint. Recalibrate the 20-campaign early stop (`task10_speed.js`) for the pinned bot.
- **(b) Deterministic builds.** Replace builder.js's wall-clock budgets (DEADLINE, softMs, hardMs) with node budgets in the cc-builder-loop copy, so that a brief and a seed rebuild the same board on the busy PC. Library entries store full designs anyway.
- **(c) Peek pairs.** Decision: require gate A3, or get Dennis's OK to teach validSolution and the hint solver about peek pairs.
- **(d) Shipping path.** Port ship_batch.js, the HARD_LEVELS.revisions/designVersion code and the test exemptions from origin/wip/release-1.63.
- **(e) Write `library/yardstick.json`:** fingerprints, seed blocks, the sequential rule, tolerance.
- New: `yardstick.js` (loads the pins and wraps `meter.createMeter`; refuses a mismatched fingerprint).

**1. Anchor and validity (E4).** Rate the live boards (decoded through Hard.get), fit M, and compute spike AUC and window error. Outputs: `library/calibration.json`, and `library/curve.json` once Dennis has chosen.

**2. Build.** builder.js v3 runs many briefs across the 8 allowed stories and 48 layouts, readable, at 17-30 ms each. Seeds and stories are varied only to get different puzzles. Output: `library/candidates.jsonl`.

**3. Static gates.** `static_gates.js` runs A1-A9 cheapest first: gate.js, readable and originality first, then classify/`obvious.js`, then `detour.js`, then `publicfork.js` on the survivors. The cost is a measured unknown, estimated at 2-5 s per board for the full set. Rejection reasons go to `library/rejects.jsonl` so that yield per gate is visible.

**4. Family screen.** `screen.js`: 20-campaign SCREEN prefix at spare 1 and spare 3. Keep the board if D(1) ≥ the lowest open target − 1, D(3) ≤ the highest open target + 1, and D(1) < 18.5. About 2 × 1 s with the fast path.

**5. Skilled screen.** Planner at spare 2; normal band 2.5 ≤ S ≤ 6. An explicit fallback pass may use 2 ≤ S ≤ 6 if needed, with separate counts and per-level flags. G4 speeds this up; see its measured timings. No hidden margin or skilled averaging.

**6. Dial curve.** `dial_curve.js`: 80 paired CURVE campaigns at spares 0-3 (spare 4 is measurement-only), about 15 s with the fast path. Records D, p_hat, the paired step SEs and the loss-phase split. Applies the D rules and marks which spares could ship.

**7. Traces and counterfactuals.** `traces.js` (B1-B7) and `counterfactual.js` (C1-C3) at each spare that could ship.

**8. Library.** `library.js` appends to `library/library.jsonl`:

- the frozen design without spare;
- the curve and S;
- gate reports;
- the card and archetype label;
- fingerprints;
- story and layout tags.

Unused puzzles stay for later, harder windows, so the cost per level falls as the library grows.

**9. Assign.** `assign_levels.js` adapts `batch_assign.js` and `curve_policy.js`. Branch-and-bound over (puzzle, spare) pairs that minimises Σ|log D − log T|, subject to:

- level and window tolerances;
- the steadily rising curve and ±1 per-level tolerance;
- big boards only on lv%10==0;
- the opening-clock rule and spare-1 rationing;
- no story twice within 3 levels;
- archetype rotation.

**10. Accept.** `accept.js` runs the sequential ACCEPT measurement and the C4 ablation on the assigned pairs. A miss sends the slot back to step 9 with the measured value. A puzzle is never tuned.

**11. Release checks.**

- `preview_check.js`: phone preview and replay through the real game.
- The full test suite passes (`node source/tests/run.js`) with the ported exemptions.
- `batch_plan.js` writes `library/batch-plan-<range>.json` with fingerprints, ACCEPT values, cards and the locked window predictions.
- Dennis approves the cards, not playtests.
- `ship_batch.js`, then `release.py <v> --deploy` from a clean main. Ship at least 30 levels ahead of the leading player. `RULES.levels.blockedFrom` is available if the buffer runs out.

**12. Learn.**

- `real_ledger.js`: read-only plays/ export → per player, level and try rows, using forecast-score.js `outcome()` and tries.js filters.
- `real_fit.py`, then `window_report.js`: windows, locked-prediction scores, spike ledger, guardrails, a one-page report for Dennis.
- `care_monitor.js` for grandma.
- Never write to plays/, scores/ or replays/.

**CPU etiquette.** busy.js before every heavy step; one heavy job at a time.

**Rough budget per 25-level batch with the fast path.** About 3,000-8,000 builds, if the joint yield is 0.5-1%. Static gates 2-8 CPU-h, screens about 1 h, planner on survivors 2-4 h, curves, traces and acceptance about 1 h. That is roughly 6-14 CPU-h, or 1-2 h wall on 8 workers. These are estimates to be replaced by E6's measured numbers.

**Helpers.** Codex: detour.js / obvious.js / publicfork.js through a task folder. Gemini: fast path for key memory. Claude: review, merges, batch runs.

## 7 First experiments in order

**E1: dial audit on existing data (runnable today; no bots; minutes)**

- **Question:** Under the D rules, what share of existing same-puzzle curves has a spare that could ship? Is the noise model right? How many builder boards fail A3 (peek-pair shortcut)?
- **Method:**
  - Read the v3-candidate `ladder-summary.json` (spare 1/2 pairs, both bots), `knobs-v1/summary.json` (24 spare pairs), `knobs/clock-spare-1` (20 pairs, spare 1 vs 3) and `results/200-225*/rated-candidates.json` (same-puzzle groups, 3,865 two-seed pairs).
  - Apply the monotone and tighter-neighbour rules at spare 2 (neighbour spare 1).
  - Fit the spread per campaign against D from the seed gaps.
  - Run `engine.clockShortest` in strict and peek-pair mode on the 148 cone.json/ladder designs (read-only).
  - Extend scratchpad `s/dial.js`.
- **Cost:** JSON work in seconds, plus about 148 × 1-2 s of engine time.
- **Kill:**
  - If under 25% of mid-band (D 6-16) puzzles have a spare that could ship, the dial becomes a minor trim and the library must be about 2× wider. Tell Dennis.
  - If the spread per campaign departs from √(D(D−1)) by more than 30%, redo section 2's precision table before setting tolerances.
  - If more than 20% of boards fail A3, the peek-pair decision moves to the top of Dennis's list.

**E2: real-data estimator and power simulation (today; no bots; seconds to minutes of Python)**

- **Question:** With 3 players, censoring, the rage cut and lag, what window step can real data detect?
- **Method:**
  - `real_ledger.js` and `real_fit.py` on 85-199 from the fresh scratchpad plays export.
  - Simulate from the fitted skills: plant steps of +0.2, +0.35 and +0.5 logit at window boundaries, with realistic missing levels and lag. Measure detection and false alarms at the 2-SE deadband with leave-one-player-out, for 10- and 20-level windows.
  - Also report Y for 150-199 by window.
- **Kill:** If a +0.35 step over 20 levels is detected less than 70% of the time, or false alarms exceed 10% per window, real data does not steer the slope. It only flags spikes and gross band errors (for example "the 200-219 bridge is more than 40% above 175-199"), and the curve rests on the ruler and Dennis's choice. A result near 50% is expected.

**E3: noise scaling on the pinned ruler (after step 0a)**

- **Question:** Do independent seed blocks shrink SE as 1/√N? Are paired steps really less noisy than unpaired ones?
- **Method:** 40 boards spanning D 3-16. 8 blocks × 40 campaigns each on fresh seeds, at spare 2 and 3. Compare variance between blocks with variance within blocks. Compare the variance of paired differences with that of unpaired differences. Derive the final sequential rule and the early-stop margin.
- **Cost:** about 10 CPU-min with the fast path. About 55 CPU-min for key memory without it; wait for the fast path.
- **Kill:**
  - If the between-block variance is more than 1.5× the within-block prediction, the seeding is broken; fix it before any acceptance.
  - If pairing cuts the variance of steps by less than 30%, double the CURVE campaigns.

**E4: anchor and ruler validity**

- **Question:** Where does live 175-199 sit on the pinned ruler? Is the ruler valid at window level?
- **Method:**
  - Ruler and planner on live 175-199 plus 91, 132 and 150 (85-174 is mostly cached).
  - Spike AUC, window error against the constant baseline, M fit with bootstrap bands, against the reference bot.
  - Repeat the spare count from section 3 with D as a covariate.
- **Cost:** family about 28 × 20 s ≈ 10 min (2 min fast); planner about 30 min.
- **Kill:** If spike AUC < 0.65 and window error is no better than the constant, the ruler cannot anchor a curve. Dennis then sets the start by hand from real Y, and the ruler is used only for the same-puzzle dial and gates. The results also decide which bot becomes the ruler.

**E5: gate calibration on labelled boards**

- **Question:** Do gates A4-A7, B and C reject what Dennis disliked and pass what he liked?
- **Method:** run the gates on:
  - the 24 dennis-plays boards that carry tiles;
  - 200, 217 and 225;
  - the 18 qualified 200-225 boards;
  - 9001-9003.

  Compare with stars and labels (lateSqueeze, guessing). This has little statistical power, and the old boards are not readable, so A2 fails by construction and is excluded.
- **Cost:** about 1-1.5 CPU-h, about 40 min with the fast path.
- **Kill:** If 225 (4 tries, 5 stars) fails, or boards Dennis called a late squeeze pass, or more than 70% of the boards Dennis liked fail, re-specify the thresholds before production. If B2 does not score higher on the boards he liked than on those he disliked, B2 becomes report-only.

**E6: end-to-end yield and 30 full curves**

- **Question:** How many accepted pairs does a 200-209 mock window get per 500 builds, at what CPU cost, and which gate starves the pipeline?
- **Method:** 500 readable v3 builds through steps 3-10 against a mock curve. Full curves (spare 0-4) for every puzzle that reaches step 6, aiming for at least 30. Record the pass rate per gate.
- **Cost:** about 2-4 CPU-h as the single heavy job.
- **Kill:**
  - If there are fewer than 3 accepted pairs per 500 builds, or more than 60 CPU-min per accepted level, supply is the problem. The next work goes into the builder making real visible choices (A1-A3 archetype construction). Target skilled 2.5-6; quantify the permitted minimum-2 fallback separately, never averaging. It does not go into more measurement speed.
  - If fewer than 30% of curves in the 6-16 mid band can ship, or more than 15% are non-monotone beyond noise, demote the dial to a trim and fill slots by selection from a larger library.

**E7: re-dial or replace the kept 200-225 boards**

- **Method:** curves, traces and counterfactuals for the 20 kept boards on the pinned ruler.
- **Cost:** about 27 min, about 5 min with the fast path.
- **Expected:** 205 and 213 cannot be raised by spare. 223 may come down. 200, 202 and 212 break the hidden-route rule.
- **Kill:** A board with no spare that could ship at its slot, or failing A2/B/C, goes to Dennis as "replace".

**Later, only if needed:**

- the loose-clock curve predictor (one captured rating at spare 6 → predict D(0..3));
- ice strength as a half-step second dial (keep it only if at least 85% of the boards that move go in the expected direction and none creates an idle special);
- the number of armed forks as a dial (keep it only if at least 80% go in the expected direction with a median effect of at least 0.5).

The prior for the last one is poor: Task 10 traps had about 0 effect.

## 8 Decisions Dennis must make

1. Use the key-memory family bot as the ruler? It passes the old checks and removes about 6 tries of fake difficulty on hidden-key boards. Under it, 15 of the 20 kept 200-225 levels stay within ±1.
2. Where should 200 start: a step above how hard 190-199 actually were, or your original "10 at 200"? On the bot's scale, 10 is harder than 132 and 150, where Gerda needed 73-82 tries.
3. How fast should it rise after that: about +1% per level (10 around 250), or slower (+0.6%, 10 around 300)?
4. When the family bot reaches about 14 tries (the limit of what it can measure), should the family difficulty hold there while it keeps getting harder for you, or should it keep rising on a different measure?
5. Settled 2026-11-08: target skilled 2.5-6 per level; minimum may go down to 2 if really needed, with explicit per-level flags. Averaging is removed.
6. A 1-move clock margin on at most 1 level in 5, never twice in a row, and never on a fast opening clock: OK?
7. Settled 2026-11-08: no alternating easier levels and peaks. Big boards get no difficulty exception.
8. Boards whose fastest clock route needs a peek pair: reject them (simplest), or let the game's checker and hint learn peek pairs?
9. May a new puzzle reuse an existing layout shape? If so, how many levels apart?
10. The kept 200-225 boards: re-dial the ones a spare can fix, and replace 205, 213 and the ones with hidden routes (200, 202, 212)?
11. Shipping: replacing a level someone has started restarts their save. Is that OK for 200 (you), or should we hold levels with blockedFrom? Do you give a standing OK for one-spare changes on levels nobody has opened, or approve each batch?
12. Beyond 269: extend the level table (needs a test change), or keep replacing 150-269 rows that feed the endless cycle?
13. Grandma: separate monitor; may we slow her catch-up if her first-try rate drops below 70%?
14. Optional, not routine: would you play about 6 boards once, where the two family bots disagree most, to tell us which bot reads them right?

## 9 Risks

- **Supply, not measurement, is the limit.** E6 produced zero library candidates per 500 builds, even under its historical relaxed screening margin. The next work builds real visible choices into the builder; keep the normal skilled band and report the permitted minimum-2 fallback separately.
- **The dial is narrow.** Only spares 1-3 can ship (t_clocks, clock.n ≤ 19). A smooth step is about 1.3 tries, and about a third of mid-band steps are cliffs or flat. Many puzzles will offer one usable spare, so the library must be wide.
- **The dial does nothing for skilled difficulty.** The family curve could rise while Dennis keeps winning first try (2.3 stars). His real first-try rate per window will show this, but only after he has played.
- **The bot curve may not be the human curve.** People learn routes across tries and lose earlier. The family bot repeats known losing moves (543 repeats, 1 win in 711 late attempts), which inflates D on hard boards. Gate B7 and real-data guardrails reduce this but do not remove it. Spikes of the 132 kind can still appear through mechanisms nobody has found.
- **Extrapolation.** Almost no live level is above bot 7, so M and the targets above 7 are guesses until 200+ windows are played. The ramp is slow for that reason.
- **The real-data loop is weak and slow.** 3 players, about 30 levels of lag, skill drift (Dennis went from 0.55 to 0.70 first try), and pauses that look like difficulty changes. E2 will probably limit it to spikes and slope.
- **Gates are new and uncalibrated.** Trap attribution is measured on bot errors, which may not be people's errors. Permutation proofs return 'unknown' on 96-tile boards. Thresholds may over-reject. E5 and E6 exist for this.
- **Bot and version churn.** Key memory and the fast path are unmerged and conflict in meter.js. The fast path re-implements the game physics with only a 1% audit. Any change to the engine, the rules or the bot re-rates the whole library and forces a refit of M; the fingerprint discipline enforces this but costs CPU.
- **Content monotony.** Dial-friendly puzzles are "race the clock with priced detours". Archetype labels, the "second act" requirement and story rotation help. Real archetype construction is not built yet.
- **Release friction.** The revisions mechanism exists only on an unreleased branch. Dennis is already on 200 on the old board. The table is fixed at 200 rows. The peek-pair validSolution gap is a release blocker unless gate A3 holds.
- **Originality.** 18 of 20 new layouts failed the overlap rule. Hundreds of levels need Dennis's relaxed definition.
- **Shared PC.** About 6-14 CPU-h per batch estimated. It must run under busy.js as the single heavy job alongside Codex and Gemini, and deadlines can slip.
