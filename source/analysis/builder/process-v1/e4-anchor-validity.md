# E4: anchor and ruler validity (2026-11-07)

Verdict first: **E4 is NOT killed.** The kill rule needs spike AUC < 0.65 AND window error no better than the always-median baseline. The ruler has spike AUC 0.78 and beats the baseline at both window sizes. But the evidence is thin (12 spikes, 15 and 8 windows), and the comparison "ruler vs reference bot" says almost nothing on live levels (see section 3).

Sources: ratings `e4-live-ratings.jsonl` (258 rows, written by `loop/research/e4_live.js`, run through heavy.js label e4-live); analysis `loop/research/e4_analyze.js` -> `e4-anchor-validity.json` and `library/calibration.json`; real Y from `e2-real-data.json` (key "yardstick"). No loop tool was changed.

## 1. What was rated
- Live levels 85-199 decoded with `Hard.get` (levels table loaded from `source/www/levels-hard.js`, read only): 115 levels, all at their live clock. Family ruler `family-key-memory-v1-fast` (fingerprint 63be677e), CURVE block (4711 + 18427, 80 campaigns), and the reference bot (4cf0b4c7) on the same block. All 230 ratings valid. Nothing was cached on disk, so all were fresh bot time: ruler 383 s, reference 364 s summed over 115 levels (about 3.3 s per rating; much faster than the 10 min estimate in the E4 plan).
- Planner (planner-fast-v1) on 175-199 plus 91, 132, 150 (28 boards), 219 s summed (7.8 s per board; the plan said ~30 min).
- Real Y exists only for 76 levels (85-89, 106-176; `e2-real-data.json`). Mrs Doubtfire has not played 177 onward, so **no family Y exists for 177-199**; and none for 91. 12 of the 76 levels have Y >= 6 ("spikes"); 1 Y is censored (176, counted at its lower bound 8.6).

## 2. Where live 175-199 sits on the ruler
- Ruler D range over 85-199: 1.08 to 14.6; only 7 of 115 levels are at D >= 7 (this agrees with "almost no live level rates above 7").
- Window means of D (ruler): 85-94 2.5, 115-124 4.1 (124 alone is 14.6), 145-154 3.4, 165-174 2.4, 175-184 3.7, 185-194 4.8, 195-199 5.6. Medians are lower (175-184 2.6, 185-194 3.7, 195-199 4.1).
- 190-199: D = 11.36, 6.08, 11.78, 3.69, 1.13, 2.59, 13.38, 4.12, 4.32, 3.38. Median 4.2, upper quartile 10.0. Three levels (190, 192, 196) are very high, six are near or under 4.
- Priority levels: ruler reads 132 at 6.69 and 150 at 7.19 (real Y 13.6 and 13.2, the two worst live spikes), 91 at 4.41.
- Planner S on 175-199: 1.0 to 3.75, median 1.3 on 190-199; 91, 132, 150 read 3.2, 2.1, 2.35. So the skilled player model finds every live level easy. It cannot flag the real spikes (n = 4 Y-levels only, AUC 0.67, meaningless).

## 3. Validity: ruler vs reference bot (levels with Y, n = 76)
| Check | Ruler | Reference | Baseline / note |
|---|---|---|---|
| Spike AUC (Y >= 6), 90% bootstrap band | 0.784 [0.63, 0.90] | 0.783 [0.63, 0.91] | threshold 0.65; synthesis cites 0.76 for reference |
| Level-wise Spearman D vs Y | 0.38 | 0.38 | |
| 5-level windows (15 windows with >= 3 Y-levels): Spearman | 0.65 | 0.65 | synthesis cites 0.55 (n 13) |
| 5-level window MAE, leave-one-window-out isotonic vs median | 0.82 vs 1.07 | 0.83 vs 1.07 | gain 0.25 [0.01, 0.49] ruler; reference band touches 0 |
| 10-level windows (8): Spearman | 0.76 | 0.76 | |
| 10-level window MAE vs median | 0.67 vs 0.95 | 0.68 vs 0.95 | gain 0.28 [0.08, 0.43] both |

- The ruler is "no worse than the reference bot" (AUC 0.784 vs 0.783, identical Spearman), as section 2 requires. **But the two bots are nearly the same bot on live levels:** they differ by more than 0.001 on only 4 of 115 levels (116, 121, 156, 170), median ratio exactly 1.00. Live boards have almost no key-memory effect, so this check cannot choose between the bots; it will have to be decided on 200+ boards.
- Level-wise correlation is weak (0.38). The ruler misses big spikes: 122 (Y 7.6, D 1.2), 156 (Y 8.0, D 2.0), 89 (Y 8.8, D 3.7), 135 (Y 6.4, D 3.0). It over-reads 124 (D 14.6, Y 4.6) and 147 (D 6.3, Y 1.8). It catches 132, 150, 121, 176 partly. The signal is window-level, not level-level.
- Window gains are real but small (about 0.25-0.28 tries of Y MAE on a 1.0 baseline). The 5-level bands are wide; with 15 windows treat this as "better than constant, not proven by much".
- Planner rank on Dennis's lab boards was not part of this run.

## 4. Isotonic map M (bot D -> real Y), fitted on the 76 levels, 1000 bootstraps, 5-95% band
Ruler: D 2 -> Y 3.0 [2.6, 3.3]; D 3 -> 3.5 [2.9, 3.9]; D 4 -> 4.0 [3.4, 4.8]; D 5 -> 5.0 [3.9, 6.5]; D 6 -> 6.3 [4.6, 8.7]; D 7 -> 7.0 [5.1, 13.4]; D 8 -> 7.7; D 10 -> 9.0 [5.9, 13.4]; D 12 and 14 -> 9.4 (flat). Reference is within 0.2 of this everywhere.
- **Everything at D >= 6 is extrapolation**: the 90th percentile of live D is 5.6 (median 2.3), and only 5 of the 76 Y-levels have D >= 6 (two of them are 132 and 150). The upper bands run to 13.4 because that is where those spikes sit. M is also compressed at the low end (D 2 maps to Y 3), because Y includes slow players and has a floor.
- M is a lookup for ordinal comparison, not a promise about a given level. Full table in `library/calibration.json`.

## 5. Proposed T(200) (section 5 rule)
- 1.15 x upper quartile of ruler D on 190-199 = 1.15 x 10.04 = **11.54**.
- Cap: the ruler's reading of 132 (6.69) and 150 (7.19). Taking the lower, the cap is **6.69**, and it binds.
- **Proposal: T(200) = 6.7 on the ruler.** If the cap is read as the mean of the two it would be 6.9. Via M that is real Y about 6.7 (extrapolated, band roughly 5-13), versus live 152-191 Y of about 3.3-3.8 (from the 2026-11-07 plays draft cited in synthesis section 5). In other words 200 would start at roughly the difficulty of the two worst live spikes (132 and 150), which Dennis's first-try rate says he lost. This is Dennis's call, together with g.
- Weakness of the rule: the upper quartile of 10 levels is set by three outliers (190, 192, 196; 11.4-13.4) and 190-199 has no family Y at all, so it is an unvalidated start. The median of 190-199 is 4.2, which is where the ruler says the live game really is; the proposed 6.7 is about 1.6x that.

## 6. Not done
- The spare-count repeat from section 3 with D as covariate (listed in the E4 method) was not run.
- No Y for 177-199 or 91, so the anchor window itself cannot be validated against real players.
- Isotonic M uses level-wise Y of different players' coverage; Y at capped/censored levels is a lower bound.
