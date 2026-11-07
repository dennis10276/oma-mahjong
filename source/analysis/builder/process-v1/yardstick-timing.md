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

## Wall times (seconds, one process, cache off) - run 2026-11-07 after G3 and G4

Source: `source/build/yardstick-timing.json` (written by `dial_curve.js --timing` under heavy.js; node, single process). The PC was shared with other jobs (static_gates ran, busy.js said 1.4 cores in use), so times are noisy; the first board's first CURVE rating (1.7 s) is likely the quiet case, and later ones ran 2.5-5x slower.

| Board (level, tiles, clock.n) | CURVE rating, 80 campaigns | Full curve, spares 0-3 (allResults) | Screen (spare 1 and 3, 20 campaigns each, early off) | Planner (planner-fast-v1, spare 2) |
|---|---|---|---|---|
| 70bde28d (201, 76, 10) | 1.7 | 14.2 | 2.3 | 20.2 |
| fb46c788 (206, 80, 8) | 8.5 | 28.6 | 3.5 | 5.9 |
| 0fcd2cc7 (213, 88, 16) | 4.5 | 20.8 | 2.6 | 9.3 |

Reading: a full curve costs about 14-29 s (4 ratings of 80 campaigns with all results, 2.5-7.5 s each); a planner rating 6-20 s (the 20 s on board 1 coincided with other load; G4 reports 6-7 s/board quiet). Three boards, one run each: no budget claim beyond "roughly half a minute per board for curve plus planner".

First curves (fast ruler, paired seeds): board 1 D 9.5 / 10.05 / 6.46 / 5.72 at spares 0-3 (shippable 1 and 3; spare 2 fails the tighter-neighbour rule), ratio D(1)/D(3) 1.76, diallable; board 2 D 8.9 / 9.1 / 7.9 / 8.08, not diallable (ratio 1.13); board 3 D 5.46 / 4.39 / 4.5 / 3.59, diallable (1.22).

SE note: with allResults the SE uses all 80 campaigns (the meter now returns resultsBySeed). allResults changes the meter cache key, so a curve at the stored clock no longer reuses old cached ratings; yardstick.rate(..., {allResults:false}) keeps old cache reuse (SE then from 40 of 80).

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

- Planner is pinned to planner-fast-v1 (fingerprint e686e095...); its zero-drift claim comes from Gemini G4, which I did not re-verify. I did not check a planner migration hit on a cached board.
- Timings are from 3 boards, one run each, on a loaded shared PC; 20-30 boards are needed for a budget.
- The SCREEN calibration rests on the capped-geometric model and on 634 cached ratings that come mostly from 200-225 candidates. It has not been checked on boards from builder v3.
- screen.js still uses the 20-campaign first sub-block (results); it does not use allResults.

## Corrections after review (2026-11-07)
- Cache: the CURVE ratings (and measureCurve by default) use allResults:true, which changes the meter cache key (meter.js:169-172). They therefore do NOT hit the production d362e85f / 63be677e caches or the family migration (which needs the identical settings key), and the alternatives lookup is skipped for them. All curve timings above are real bot time with no cache reuse. Pass allResults:false to reuse caches at the 40-campaign SE. A cached-hit check with allResults:true was not done.
- SE: the SE now divides by the number of campaigns actually visible (was: all campaigns), so it is no longer biased low without allResults.
- Ledger: ACCEPT reserves all 320 campaigns of blocks up front (crash safety), so nextBlock advances by the full reserve even when stage 1 decides; unused blocks are not released. This is accepted waste.
- Diallable verdicts (levels 201 ratio 1.76, 213 ratio 1.22, 206 ratio 1.13) come from one run each on 3 boards. measureCurve now returns ratio13Se (delta method, unpaired) and diallableUnsettled (true when 1.2 is within 1 SE of the ratio). The 1.22 verdict for level 213 is within about one SE of the cut and must be treated as unsettled; the SEs for the old runs were not recorded and the timing run was not repeated.
