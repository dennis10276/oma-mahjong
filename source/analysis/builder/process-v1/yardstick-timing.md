# Yardstick and dial curve: timing and first real curves (2026-11-07)

Piece "yardstick-dial" of the level process (process-design-synthesis.md sections 2, 3, 6 steps 0e, 4 and 6).

## What was measured

Command (single process, under the global heavy-job lock, after busy.js reported the PC free):

```
node source/tools/builder/loop/heavy.js --label yardstick-dial -- node source/tools/builder/loop/dial_curve.js --timing
```

Raw output: `source/build/yardstick-timing.json` and `source/build/yardstick-timing.log` (not committed; source/build is git-ignored).

- Ruler: `createMeter({botVersion:'family-key-memory-v1-fast'})`, fingerprint 63be677e... Planner: `createMeter()` (reference, fast), fingerprint 4cf0b4c7..., settings `{setting:'planner', runs:20, seeds:2, seed:4711}`.
- Disk cache **off**, so the times are bot time. The meter's in-memory cache was still on (see the note on spare 1 below).
- Boards: three rows of `source/analysis/builder/data/qualified-200-225.jsonl`, chosen because the stored witness fits every spare 0-3 (no peek-pair shortcut): 201 (70bde28d4c0922c5, 76 tiles, k 9), 206 (fb46c7888c54e687, 80 tiles, k 7), 213 (0fcd2cc72af5f1a6, 88 tiles, k 15). All three are stored at spare 1.
- Wall time on one process. Other agents' processes may have used some CPU at the same time (busy.js had reported 2.8-4.1 other cores just before the job started). Treat the numbers as "on this shared PC", not as a clean benchmark.

## Wall times (seconds, one process)

| Board | One CURVE rating (80 campaigns, as stored = spare 1) | Spare 0 | Spare 2 | Spare 3 | Full curve 0-3 (bot time) | SCREEN spares 1+3 (40 campaigns, no early stop) | Planner at spare 2 |
|---|---|---|---|---|---|---|---|
| 201 | 2.03 | 2.32 | 3.80 | 3.27 | 11.4 | 1.80 | 58.6 |
| 206 | 7.09 | 8.07 | 6.76 | 6.72 | 28.6 | 3.43 | 26.5 |
| 213 | 4.76 | 6.34 | 5.60 | 4.19 | 20.9 | 2.71 | 54.8 |
| mean | 4.6 | | | | 20.3 | 2.6 | 46.6 |

Note on the full curve: `measureCurve` reported 9.5 / 21.5 / 16.4 s, because its spare-1 rating was a hit in the meter's in-memory cache (the same design had just been rated as the single CURVE rating; 0.004-0.28 s). The "full curve (bot time)" column adds the single CURVE rating back in: spares 0, 2, 3 plus that rating.

What this means:

- **One CURVE rating** costs 2-8 s (mean 4.6 s). Gemini's report gives 1.74 s per 40-campaign rating on one core (gemini-tasks/results/km-fast/km-fast.md section 1), so 3.5 s per 80; 201 matches that, 206 and 213 are about 1.5-2x slower (bigger boards, possible CPU contention).
- **One full curve (spares 0-3)** costs 11-29 s (mean 20 s). The synthesis estimated about 15 s (section 6 step 6).
- **One planner rating** costs 26-59 s (mean 47 s). That is 2-5x the 12.6 s per board in the task brief, and inside the synthesis's own 27-51 s estimate (section 6 step 5). The planner is by far the most expensive step: about 2.3 full curves.
- **SCREEN** at spares 1 and 3 costs 1.8-3.4 s per board. Early stopping can only save part of this (see below).

Rough per-board cost for a board that goes all the way: screen 2.6 + planner 47 + curve 20 = about 70 s on one core, before traces, counterfactuals and ACCEPT (160-320 campaigns = 4-8 CURVE-rating equivalents of 40, about 9-37 s).

## First real curves on the fast ruler

From the same run (D = expected tries to the first win, capped at 20; SE from the 40 visible campaigns, see "Limits"):

| Board | D(0) | D(1) | D(2) | D(3) | D(1)/D(3) | Shippable spares | Why not the others |
|---|---|---|---|---|---|---|---|
| 201 | 9.50 | 10.05 | 6.46 | 5.72 | 1.76 (diallable) | 1, 3 | spare 2: tighter neighbour D(1) 10.05 > min(1.5 x 6.46, 6.46 + 3) = 9.46 (a cliff at spare 1) |
| 206 | 8.90 | 9.10 | 7.91 | 8.08 | 1.13 (flat) | 1, 2, 3 | none; but the puzzle is not diallable |
| 213 | 5.46 | 4.39 | 4.50 | 3.59 | 1.22 (diallable) | 1, 2, 3 | none |

Planner S at spare 2: 201 5.30 (route 5.30, plain 5.75); 206 2.20; 213 2.02. Only 201 is inside the skilled band 2.5-6 (section 4 E).

**Paired steps barely beat unpaired ones.** Step SE paired vs unpaired (same run): 201 1.31/1.34, 1.27/1.32, 1.16/1.20; 206 0.77/0.77, 0.67/0.78, 0.74/0.75; 213 0.48/0.47, 0.34/0.33, 0.37/0.37. Pairing cuts the step variance by at most about 25% here and usually by nothing. Experiment E3's kill rule (section 7) is "if pairing cuts the variance of steps by less than 30%, double the CURVE campaigns". These are 9 steps on 3 boards from 40 visible pairs each, so this is a warning, not the E3 answer. Two of nine steps already go the wrong way (201 spare 0 to 1: +0.55; 213 spare 1 to 2: +0.11), both well inside 2 SE.

## Early stop for SCREEN (screen.js)

Rule: SCREEN's 20 campaigns are played as 4 chunks of 5. Chunk j is the meter call `{runs:5, seeds:1, seed:(4711 + imul(5j, 0x9e3779b9))|0}`; it plays exactly campaigns 5j..5j+4 of the SCREEN block (proved in test_yardstick.js for the seeds and in test_screen.js with the real fast bot: identical per-campaign tries). After 5, 10 and 15 campaigns the rating stops when the running mean is beyond a failing threshold t (lo - 1 at spare 1, hi + 1 at spare 3) by more than z * sd(t) / sqrt(n), where sd(t) is the SD of a geometric number of tries with mean t capped at 20.

Calibration (`node source/tools/builder/loop/screen.js --calibrate`, 1.5 min, no bot runs; numbers pinned in `library/yardstick.json` blocks.SCREEN.sequential):

- The capped-geometric spread fits the real bot. Over 634 cached key-memory ratings (20 visible campaigns each), observed / model SD per campaign was 0.97, 0.87, 0.94, 0.96, 1.00 in D bands 1-3, 3-6, 6-10, 10-14, 14-20.
- **The precision table in synthesis section 2 overstates the spread above D about 6.** It uses sqrt(D(D-1)) without the 20-try cap: 7.48 at D 8 and 11.5 at D 12, while the capped model gives 6.10 and 7.02 and the real ratings agree with the capped model. The table says this matched the 3,865 two-seed pairs; I did not re-run that check. If the cap is right, SEs and the tolerance arithmetic above D 8 are somewhat pessimistic. This should go into E3.
- z = 3 is the smallest z on the grid whose simulated false-stop rate, for a board exactly on a threshold, is at most 2% at every threshold 2-18.5 and on both sides (max 1.9%; z 2.5 gives 4.2%). This is the same 2% rule task10_speed.js used. On the 634 real ratings, with the threshold set at each rating's own 40-campaign D, z 3 stopped 0.16% (below) and 0% (above).
- The gain is small. A board at D 2 against lo - 1 = 9 stops in 100% of runs after 10.2 campaigns on average; D 3 vs 9: 93%, 13.0 campaigns; D 15 vs hi + 1 = 7: 98%, 7.6 campaigns. A board only 2 SCREEN-SEs past the threshold stops in 0-25%. The censoring condition D(1) >= 18.5 can never stop early at z 3, because its bound passes 20; it is decided at 20 campaigns. The larger saving comes from ordering: spare 3 is never rated when spare 1 already fails.
- When the CURVE 4711 rating at that spare is already cached (as it is for 17 of the 18 qualified boards as stored, through the migration below), its first 20 visible campaigns are the SCREEN block, and the screen costs no bot time.

## Ruler migration check

On level 200 (58a099f8cfe6eb4d) as stored, with no 63be677e entry on disk, `createMeter({botVersion:'family-key-memory-v1-fast'}).measure(design, {setting:'family', runs:20, seeds:2, seed:4711})` returned in 2 ms with meter stats `{calls:0, hits:1, familyReused:1}`, reusing Codex's d362e85f entry (expectedTries 10.03), and wrote it under the new key. A fresh fast rating without cache took 2.7 s and gave 10.03 with identical wonOn for all 20 visible campaigns. The meter migrates for setting 'family' only, so planner ratings and capture variants are reused only through their exact keys. The yardstick's own reusePrior code was removed.

## Limits and unknowns

- The meter keeps per-campaign results only for the first sub-block of each seeds:2 call. So every SE (rating and step) comes from 40 of 80 campaigns, scaled by sqrt(80). Once Gemini's opt-in for all sub-blocks exists, the SEs should use all 80.
- These timings are from 3 boards, one run each, on a shared PC. The planner's spread (26-59 s) is large; 20-30 boards are needed for a budget.
- The SCREEN calibration rests on the capped-geometric model and on 634 cached ratings that come mostly from 200-225 candidates. It has not been checked on boards from builder v3.
