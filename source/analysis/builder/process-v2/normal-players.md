# Normal players: N(level) and the bot ruler

Written 2026-11-12 for Dennis's decision "the curve follows the normal players" (Gerda, Mrs. Doubtfire, D4V3, Loulou; not Dennis, not OmaHanny).
All numbers: `normal-players.json` (per-level rows included), made by `source/tools/builder/loop/research/normal_players.js`
(pull: `normal_pull.js`, GET only; bot ratings: `normal_rate.js`, run via heavy.js, 161 s, 8 workers). Raw pulls are in `source/build/real-v2/v3/` (git-ignored).

## 1 Players found (plays/ pulled 2026-11-12)

| Name (as stored) | Role here | Furthest started / won | Levels played | Period |
|---|---|---|---|---|
| Dennisisdebeste | not normal | 250 / 249 | 234 | 10-07 to 11-11 |
| Gerda | normal | 210 / 209 | 210 | 10-13 to 11-11 |
| Mrs. Doubtfire | normal | 183 / 182 | 183 | 10-09 to 11-12 |
| D4V3 (stored `D4V3`) | normal, new | 132 / 131 | 132 | 11-09 to 11-12 |
| Loulou | normal, new | 77 / 77 | 77 | 11-09 to 11-11 |
| PUK | other | 82 / 81 | 82 | to 11-08 |
| Rashmiisookdebeste | other | 66 / 65 | 66 | to 11-09 |
| Mama | other | 44 / 44 | 44 | 10-09 to 10-12 |
| Marcel!! | other | 16 / 16 | 16 | 10-20 to 10-23 |
| OmaHanny | own care track, not read | 145 | | |
| DennisTEST | test account, not read | 3 | | |

D4V3 and Loulou have been playing only since 2026-11-09 (3 days). Mrs. Doubtfire is still 24+ levels behind Gerda, so beyond level 183 only Gerda has data.

## 2 Ledger and N

- Same rules as `real_ledger.js` (one try = one attempt id, restart = loss, tries after the first win dropped, current board only by app version plus tile count and clock moves; a player who had already won on an older board is dropped from that level: 9 cases; 37 player-levels had no try on the current board).
- Range read: levels 70-269 (the hard table starts at 70; levels below 70 are not read and Loulou's levels 1-69 are therefore unused). **New in this run:** for levels 70-84 the app version must be >= 1.52 (AGENTS: 75-105 are the 1.52 boards; 70-74 not verified, tile signature is the only check there). 85-89 still from 1.48 (as e2; "unsure" flag from e2 stays).
- Value per player and level v = tries to first win, capped at 20. **Censored** (not yet won; 2 of 310 sequences, both open) counts as tries so far + 1, a lower bound. The cap is far more important: 17 of 310 sequences hit it (Gerda needed 81 tries on 150, 102 on 82, 75 on 149).
- **N = plain mean of v over normal players with data** (equal weights). Also stored: median `Nmedian`, uncapped `Nuncapped`, per-player tries, and `Nadj` (player-adjusted, below).
- 310 normal sequences; 141 levels have data (70-210): **1 player: 28 levels, 2: 57, 3: 56, 4: 0** (Loulou only has levels 70-77, D4V3 only to 132, so no level has all four).

| Player | Levels | Mean v | Median | First-try win | Fitted factor (90% CI) |
|---|---|---|---|---|---|
| Gerda | 141 | 6.5 | 4 | 18% | **1.51** (1.37-1.68) |
| Mrs. Doubtfire | 98 | 3.9 | 2 | 30% | 0.91 (0.83-1.01) |
| D4V3 | 63 | 4.1 | 3 | 27% | 1.11 (0.98-1.24) |
| Loulou | 8 | 1.0 | 1 | 100% | 0.66 (0.55-0.78), 8 easy levels only, weak |

Player effect (log v = level + player, 113 levels with 2+ players, bootstrap over levels): **yes, a multiplicative effect exists.** Gerda is about 1.75x slower than Mrs. Doubtfire (98 shared levels) and 1.5x slower than D4V3 (63). Mrs. Doubtfire vs D4V3: 0.83 (48 shared). Loulou: 8 shared levels only. Consequence: a plain mean over whoever happens to have played a level is biased by who played it. Beyond 183 it is Gerda alone, so N there is about 1.4x too high; `Nadj` rescales to the average of the fitted players (factor mean 1) and is the number to use for 183+.

## 3 Hardest levels and bands

Typical level (levels with 2+ players, n = 113): N median 3.5, 75th pct 6, 90th pct 11.5, 95th pct 13.5 (Nadj: 2.5 / 4.0 / 8.4 / 11.3).

Top 15 by N, levels with 2+ players (per-player tries are raw; N uses cap 20; D = bot D40):

| Lv | N | Nadj | Tries per player | D |
|---|---|---|---|---|
| 150 | 20 | 17.8 | MrsD 21, Gerda 81 | 7.2 |
| 91 | 18.7 | 16.9 | MrsD 21, Gerda 68, D4V3 16 | 4.4 |
| 132 | 16.3 | 13.9 | MrsD 31, Gerda 71, D4V3 >=9 (open) | 6.7 |
| 80 | 14.5 | 11.7 | Gerda 16, D4V3 13 | 3.1 |
| 161 | 14 | 11.3 | MrsD 8, Gerda 21 | 5.2 |
| 82 | 13.5 | 9.6 | Gerda 102, D4V3 7 | 4.3 |
| 176 | 13.5 | 12.0 | MrsD 12, Gerda 15 | 8.3 |
| 121 | 13 | 8.0 | MrsD 2, Gerda 21, D4V3 17 | 8.4 |
| 144 | 13 | 9.8 | MrsD 38, Gerda 6 | 7.5 |
| 135 | 12 | 9.3 | MrsD 6, Gerda 18 | 3.1 |
| 143 | 12 | 9.7 | MrsD 7, Gerda 17 | 4.2 |
| 149 | 11.5 | 6.9 | MrsD 3, Gerda 75 | 4.6 |
| 122 | 11 | 8.4 | MrsD 5, Gerda 25, D4V3 8 | 1.2 |
| 89 | 10.3 | 8.2 | MrsD 13, Gerda 14, D4V3 4 | 3.7 |
| 124 | 10.3 | 7.9 | MrsD 5, Gerda 7, D4V3 19 | 20.6 |

Single-player levels with N = 20 (Gerda only: 188, 196, 209; 205 at 18) are not ranked, they lack a second opinion.

**Is "about 10" what the hardest pre-250 levels gave? Yes, roughly.** Mean of the top 5 / 10 / 15 (2+ players): N 16.7 / 14.9 / 13.6 (capped at 20; uncapped 43 / 29 / 24); Nadj 14.5 / 12.2 / 10.9. So "about 10 try on average" is the level of the hardest ~15 of 113 levels (top 13%) after the Gerda adjustment, and of about the 90th percentile of N (11.5). Only a handful are really above 15 and those are single outlier hits (Gerda's 68-102 tries).

Per band of 10 levels (N mean / median / Nadj mean / levels with 2+ players / max N; D40 mean of the bot on all rated levels in the band):

| Band | N mean | N med | Nadj | 2+ pl | max | bot D40 |
|---|---|---|---|---|---|---|
| 70-79 | 2.0 | 1.8 | 1.6 | 10 | 3.7 | 1.4 |
| 80-89 | 6.8 | 5.3 | 5.0 | 10 | 14.5 | 3.5 |
| 90-99 | 4.9 | 3.5 | 3.9 | 10 | 18.7 | 2.0 |
| 100-109 | 3.1 | 3.0 | 2.4 | 10 | 6.7 | 2.6 |
| 110-119 | 4.6 | 4.7 | 2.6 | 10 | 8 | 2.7 |
| 120-129 | 6.8 | 6.7 | 4.6 | 10 | 13 | 4.5 |
| 130-139 | 5.3 | 3.3 | 4.2 | 10 | 16.3 | 2.7 |
| 140-149 | 6.1 | 4.0 | 4.4 | 10 | 13 | 3.9 |
| 150-159 | 6.3 | 4.8 | 4.9 | 10 | 20 | 3.5 |
| 160-169 | 4.7 | 3.3 | 3.5 | 10 | 14 | 2.8 |
| 170-179 | 5.2 | 4.0 | 4.4 | 10 | 13.5 | 3.4 |
| 180-189 | 5.7 | 3.3 | 4.0 | 3 | 20 | 3.2 |
| 190-199 | 6.3 | 3.5 | 4.4 | 0 | 20 | 8.4 |
| 200-209 | 7.2 | 5.0 | 5.0 | 0 | 20 | 2.6 |
| 210-219 | (1 level) | | | 0 | | 6.4 |
| 220-239 | no normal data | | | | | 12.3 / 5.7 |

Band means are 3-7 and do not rise from 85 to 210 (Nadj 2.4-5.0). The single band means are dominated by a few spikes, so the "1 try per 10 levels" rise cannot be seen in this data (the rise from 2.0 to ~5 comes mostly from 70-79 being easy).

## 4 Bot D versus N

Bot D = pinned family ruler, cap 40, 80 campaigns. Levels 70-169 rated now (`ratings40.jsonl`), 170-239 from `ratings.jsonl` D40. D20 equals the e4 family rating (checked on 170-174). 141 levels have both D and N.

- **Rank correlation D40 with N: rho 0.42 (90% CI 0.29-0.54)**; 2+ players 0.47; levels 85+ 0.36; 85-149 0.35; 150+ 0.37; 70-84 0.74 (15 levels). Against the median 0.47. Player adjustment does not change it (0.42). This is moderate, not tight; the old Y comparison (Dennis x2 + Gerda + MrsD x2) was not recomputed here.
- Monotone map and spread (D bin: n, mean N, median N, middle half of N, mean Nadj, N/D):

| D40 bin | n | N mean | N median | N 25-75% | Nadj | N/D |
|---|---|---|---|---|---|---|
| <1.5 | 35 | 3.1 | 2 | 1.7-3.7 | 2.3 | 2.4 |
| 1.5-2 | 20 | 4.2 | 3.5 | 2.7-5 | 2.9 | 2.5 |
| 2-3 | 33 | 4.1 | 3.5 | 2.5-5.5 | 2.9 | 1.7 |
| 3-4 | 15 | 6.7 | 5 | 2-12 | 5.0 | 2.0 |
| 4-5 | 15 | 8.8 | 8 | 4-13.5 | 6.4 | 2.0 |
| 5-7 | 11 | 6.0 | 3 | 2-10 | 4.6 | 1.0 |
| 7-10 | 7 | 10.7 | 13 | 5-13.5 | 8.4 | 1.3 |
| >10 | 5 | 10.1 | 10.3 | 5-12 | 7.1 | 0.5 |

The spread at a given D is about the whole range 2-13: one level's N is very noisy (1-3 players, geometric-like tries).

- **Reverse: which D gives N = 10?** Isotonic fit: D about 6.7 (N 10.1 for all D >= 7, where the fit is flat). Power-law fit: 19; linear c: 6.7. The fits disagree for N >= 11 (isotonic 24, power-law 23-33, linear 7-9). **Only about 12 levels have D > 7 and their N tops out near 10 (median 13 for D 7-10, 10 for D > 10), so N = 11, 12, 13 cannot be mapped to a D with this data.** Honest answer: N = 10 corresponds to D roughly 6-8 under the isotonic and linear fits but 19 under the power-law fit (so 6-19, unvalidated), N >= 11 unknown.
- **Single factor N = c*D?** c fits overall at 1.5 (geometric), 1.52 (ratio of means), 1.63 median, but the log-log slope of N on D is **0.48 (90% CI 0.33-0.62)**, not 1. N/D falls from 2.4 (D < 2) to 2.0 (D 3-5) to about 1.0-1.3 (D 5-10) and 1.2 in 180-219 vs 2.0 in 70-99. **A single factor is not adequate**: the bot scale is stretched against the normal players' (the bot separates hard levels more than players do), or equivalently real tries are compressed because of the cap-20 and a few extremely slow outliers (Gerda). With the cap-20 the compression partly artificial.
- **Per-attempt behaviour** (pooled over rated levels with normal-player data): real first-try win rate 0.235 vs the bot's 0.423 (bot much too good on try 1); level-by-level correlation of first-try rates 0.29 (weak). Hazard by try index, real: 0.26, 0.26, 0.18, 0.19, 0.21, 0.18, 0.18, 0.12 (flat, no learning visible); bot: 0.42, 0.36, 0.30, 0.30, 0.26, 0.19, 0.19, 0.19 (declines, the key-memory/mix effect). So the bot is off in **both** level order (rho 0.4) and in per-attempt shape, not only in scale. Hazard caveat: pooled over levels and players, so selection (hard levels dominate late tries) shapes both curves.
- Bot D for 190-239 is much higher than for 85-189 (band means 8.4 at 190-199, 12.3 at 220-229, max 39) while Gerda's N on 200-210 is 7 (Nadj 5.0). 220-239 have no normal player data, so this extrapolation cannot be checked yet.

## 5 Uncertainty, and the smallest change

- Data: 141 levels, 310 sequences, 3 slow-to-fast players plus Loulou on 8 levels. Per level 1-3 players; one try count per player is a geometric-like draw (SD about equal to its mean), so a level's N has relative error of order 50-100%. Rank correlation of any ruler with N can be estimated to about +-0.12 (90%), but ruler *calibration* (a level target) only at the level of bands of 20-30 levels. Beyond level 183 the only normal player is Gerda; the other three do not reach there for weeks.
- A ruler that "follows the normal players" can only be checked on aggregates (bands, bins of D), never level by level. The best possible rho with N itself (split-half over players) is not computed here, but with ~2 players of geometric noise it is clearly below 0.7, so rho 0.42 is not far off its ceiling.
- Cap 20 and Gerda: Gerda's 68-102 try levels (82, 91, 132, 150, 149) drive the top of N. With no cap the top-15 mean N is 24, with cap 13.6. Which one is "the same as 10 at level 250" depends on the cap Dennis wants for the target.
- Early levels (70-84): board version rule 1.52 is an assumption.
- **Smallest change: rescale targets, not refit.** The bot ordering (rho 0.4) is not clearly worse than the family fit was; what changed is the target level. Replace the target "D(level)" by the bin map above (D 2 -> N 3.5-4, D 4-5 -> N 7-9, D 7 -> N 10) and set the 250 target at D about 7 (N 10), rising at least 1 try per 10 levels (that is about +0.5-0.7 D per 10 levels at slope ~0.5, 1 try needs about 1.5 D units at the top). Refitting the Y weights (Dennis x2 etc.) to {Gerda, MrsD, D4V3, Loulou} is cheap but pointless until D4V3 and Loulou have 100+ levels; weights would also mostly move the scale (Gerda 1.5x). A new bot fit would be needed only if the per-attempt gap (0.42 vs 0.235 first-try) matters, i.e. to make the bot's tries literally readable as player tries; that is a larger job and cannot be validated with this data.
- Recheck in about 2 weeks when D4V3/Loulou have more levels; the script is rerunnable (`normal_pull.js`, `normal_rate.js` for new levels, `normal_players.js`).

## Checked (adversarial review, 2026-11-12)
- Players: plays/ has 11 ids, each with exactly one name (Gerda, Mrs. Doubtfire, D4V3, Loulou are the only normal ones; Dennis, DennisTEST and OmaHanny are excluded in code, PUK, Rashmi, Mama and Marcel are not in NORMAL). Furthest-level numbers (210/183/132/77) re-counted from raw: correct.
- Boards and censoring: tries come only via real_ledger.js (version >= board release, tile count and clock match); open last tries are censored as tries+1, and only 2 of 310 are. Not independently re-verified: the version filter itself.
- Hand recount from raw plays (distinct attempt ids until first win) for levels 110, 111, 112, 150, 190, 205: all 14 player values match the rows (e.g. 111: MrsD 1, Gerda 12, D4V3 1; 150: Gerda 81 and MrsD 21 are capped to 20 in N).
- D -> N map, bootstrap (1000 resamples of the 141 levels, isotonic fit): N at D=2 is 3.1-4.5, at D=4 4.2-7.9, at D=6 5.8-9.3 (90% bands). Top plateau (the "N about 10 for D 7+") is 8.9-20 across resamples, so it rests on ~12 levels and is not stable. Bins are not monotone (D 5-7: N 6.0, median 3, n=11, below D 4-5 at 8.8), so the isotonic fit pools them. 7 of the 12 levels with D>7 have N>=10, and 21 of the 23 levels with N>=10 have D>3.
- Correction in wording: "N=10 corresponds to D about 6-8" is the isotonic/linear answer only. The power-law fit gives D 19. Treat N=10 -> D as 6-19 and unvalidated; N=11-13 are extrapolations beyond the data (stated above, confirmed).
- Still doubtful: Gerda-only data above level 183, cap 20 sensitivity, 70-84 version rule, D4V3 and Loulou sample sizes.
