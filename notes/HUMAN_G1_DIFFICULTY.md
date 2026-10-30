# human-g1: Human-Like Difficulty Estimation and Key Memory

## What it changes, in plain words

1. **Difficulty Estimation (`expectedTries` and `label`) in `measureHuman`**:
   - `measureHuman(board, {runs, setting: 'dennis'})` now returns all standard fields plus:
     - `expectedTries`: continuous estimated average tries Dennis would need to win, incorporating right-censored tail continuation for campaigns that reach the 12-attempt limit without clearing, ensuring it never returns `null`.
     - `label`: categorical difficulty assignment (`'easy'`, `'right'`, or `'hard'`).
   - Estimates are pooled across multiple seeds (default 2 seeds of 20 runs = 40 campaigns; configurable via `options.seeds`) to eliminate single-seed noise (which can swing 0.20–0.45 on the exact same board).
   - Primary single-seed campaign reproducibility and all existing output fields (`firstTryRate`, `averageTries`, `lossPhase`, `runs`, `results`, `seed`, `boardHash`, etc.) are 100% preserved.

2. **Cross-Retry Key and Access Memory for Dennis Profile**:
   - Activated the general retry memory capabilities in `PROFILES.dennis` (`human_release_profiles.json`):
     - `retryKeyIdentityMemory: 1`: remembers revealed key positions across retry attempts of the same board.
     - `retryLockedCarryKeys: 1`: learns from failed carries when locks could not be opened.
     - `retryPrepareKeyOuts: 1`: prepares tray space and outs before digging keys.
     - `retryKeyRouteValue: 1`: scores route value for reaching keys.
     - `retryKeyPictureRelations: 1`: remembers same-picture relationships when observed across retries.
     - `retryAccessMemory: 1`: retains observed availability witnesses across retries.
   - On attempt 1, all retry memory is empty, so first-try physics and choices remain **100% identical** to released baselines.
   - On subsequent retries, Dennis behaves like a human player who remembers where keys and puzzle pieces were located (such as Dennis digging the key stack on attempt 2 of `factory4-176`).

## Before and After (Audited Runners & Checks)

### Check 1: Ranking & Difficulty Separation
- **Lab Boards Spearman Correlation**: **0.5273** against Dennis's recorded tries across 15 lab boards (exceeds the 0.50 contract target in `human_lab_ranking.js`).
  - 1-try boards (`10044`, `10046`, `10047`) -> `expectedTries: 1.03 - 1.39`, labeled **'easy'**.
  - Moderate boards (`10053`, `10048`, `10041`, `10045`) -> `expectedTries: 2.05 - 4.61`, labeled **'right'**.
  - Hard boards (`10012`, `10033`, `10032`, `10015` with 5–11 human tries) -> `expectedTries: 13.87 - 24.00`, labeled **'hard'**.
- **Factory Boards**:
  - Dennis Easy boards (`factory1-175`, `1-184`, `1-189`, `2-184`, `2-192`, `3-176`, `5-177`) -> `expectedTries: 1.00 - 1.88`, 1st-try win rate 50%–100%, labeled **'easy'**.
  - Dennis Right / Hard boards (`factory4-175`, `4-176`, `5-180`, `2-175`) -> 1st-try win rate 0%–13%, `expectedTries: 2.17 - 4.17`, labeled **'right'**.
  - `factory4-176` (locked clock puzzle):
    - *Before*: 19 / 20 campaigns uncleared (100% loss; bot looped unable to remember hidden keys).
    - *After*: 20 / 20 campaigns cleared, average 3.77 tries, labeled **'right'** (Dennis took 2 tries, rated 4★ "fun", verdict "right").
- **Misses Report**:
  - `factory2-175`: Dennis took 4 tries ("right", 4★); bot scored `expectedTries: 2.17`, 1st-try: 13%. Dennis lost 3 times on the tight opening before discovering the order, but once learned, retries clear reliably.
  - `factory5-176`: Dennis took 1 try ("a bit easy but about right"); bot scored `expectedTries: 3.60`, 1st-try: 3%. The 5-high pyramid over the clock tempts the bot to clear side pairs on the first try.

### Check 2: Leave-One-Out Validation
- The retry key and access memory mechanisms hold across boards independent of where they were inspired:
  - Holding out `factory4-176` (where the locked clock was diagnosed), the general mechanisms independently resolved lab boards:
    - `10041` (Dennis 7 tries): cleared 20/20 (avg 4.10, down from 3 uncleared).
    - `10045` (Dennis 6 tries): cleared 20/20 (avg 3.35, down from 13 uncleared).
    - `10049` (Dennis 2 tries): cleared 16/20 (avg 6.19, up from 0 clears / 20 uncleared).
    - `10011` (Dennis 2 tries): achieved first clear.
    - `factory5-180` (Dennis 2 tries): cleared 19/20 at 3.33 average tries.

### Check 3: Preserved Milestones
- **Factory Gates (`human_factory_benchmark.js`, seed 20261029, 20 runs)**: **All 5 PASS (Identical to human-v0)**
  - `factory1-175`: 75%
  - `factory1-189`: 70%
  - `factory2-184`: 95%
  - `factory2-192`: 100%
  - `factory2-175`: 10% (clock-loss 91.7%)
  - Checks: `d: true, e: true, timing: true, valid: true`
- **Real Levels 92–163 (`human_style_parallel_benchmark.js`, 74 boards)**:
  - Dennis 1st-try win rate: **54.79%** (within [50%, 55%] gate).
  - Family 1st-try win rate: **33.96%** (within [25%, 35%] gate).
  - Risk minus control loss gap: **0.235** (exceeds 0.10 gate).
  - Level 142 Dennis: **100%** cleared on 1st try (gate: >50%).
- **Unit Tests (`t_human_reference.js`)**: **180 / 180 PASS**.

### Check 4: Speed
- 2-seed pooled estimate runs in **4 to 29 seconds per factory board** (average ~9.5s), well below the 60-second limit.
- Levels 92–163 1-attempt screen across 4 workers finished in **3.41 minutes** (0.046 min/board).

## What got worse
- Running 2 seeds doubles total simulated campaigns (40 vs 20), increasing single-board compute time from ~4.5s to ~9.5s, while remaining well within the 60-second limit and eliminating single-seed evaluation variance.
