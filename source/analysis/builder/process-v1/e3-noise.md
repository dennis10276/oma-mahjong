# E3: noise scaling on the pinned ruler

Date 2026-11-07. Ruler: family-key-memory-v1-fast (fingerprint 63be677e...), through yardstick.js `rateCalls` with `allResults:true`, no cache, no ledger. All numbers come from `e3-noise.json` in this folder (script `source/tools/builder/loop/research/e3_analyze.js`, raw ratings `source/build/e3/e3-ratings.*.jsonl`, boards `source/build/e3/e3-boards.json`).

## Verdict (kill criteria from synthesis section 7, E3)

1. Kill "between-block variance more than 1.5x the within-block prediction": **not fired.** The pooled ratio is 0.98 (95% interval 0.83 to 1.15, resampling boards; e3-noise.json sec1 pooledRatio). The seeding is not broken. Spare 2 and spare 3 give 0.98 each.
2. Kill "pairing cuts the variance of steps by less than 30%": **not fired on the best estimate, but it is borderline.** Campaign-level reduction 35.8% (interval 22.8% to 49.0%); 40-campaign blocks 36.9% (20.1% to 50.3%); D 6-16 boards only 34.6% (20.7% to 48.5%) (sec3). At the CURVE size of 80 campaigns the direct estimate is 22.5% but its interval is -19.6% to 50% (only four 80-campaign values per board), so it does not overrule the campaign-level figure. The lower end of every interval is under 30%. Treat pairing as worth about one third of the variance (about 20% of the SE), not more. Doubling CURVE is not required by the rule, but see "Steps are small" below for why it may be wanted anyway.

## Design as run

- 40 boards from the three pools (ladder v3, knobs-v1, qualified 200-225; 412 unique puzzles). The pool was first screened at spare 2 with 20 campaigns on seed 4711 (`e3_prescreen.js`, 170 puzzles screened, output `source/build/e3/e3-pool.jsonl`). The 40 boards were then taken by quota from screen D 3 to 16.3 (screen-D bins 3-4, 4-5, 5-6.5, 6.5-8, 8-10, 10-13, 13-16.6). The first attempt, evenly spaced by rank, was bottom-heavy (many boards below D 3), so I stopped it, deleted its output and reran with the quotas. Final measured D (320 campaigns, 80 cells): 10 cells in 3-4, 21 in 4-6, 28 in 6-9, 8 in 9-13, 13 in 13+ (the 13+ cells reach the cap; see sec4 shareAtCap 52%).
- Spare 2 and spare 3 by `knobs.clockSpare` (proved minimum plus spare). 8 blocks of 40 campaigns each: meter call {runs 20, seeds 2, seed 7000003 + 15838 x block}. These seeds are far from 4711, 18427, 12630, 26346 and the ACCEPT range (29717 + 15838 x j, j small). The ACCEPT ledger was not touched.
- Same seeds at both spares, so spare 2 block j and spare 3 block j are paired; unpaired comparisons use spare 3 block (j+3) mod 8.
- 640 ratings, all valid, 80 complete cells, all 40 boards have both spares. The meter's expectedTries equals the mean of the returned per-campaign values (largest difference 0.005, sec coverage). Cost: about 5 minutes wall on 6 workers via heavy.js (label e3-run), plus the prescreen job.

## 1. Between-block against within-block variance

- Pooled variance of the 8 block means over the within-predicted variance: 0.983 (0.83 to 1.15). Against the capped-geometric model: 0.85 (0.71 to 1.00), i.e. model prediction is slightly too wide, not too narrow.
- By D band: 3-4: 1.24; 4-6: 1.18; 6-9: 0.86; 9-13: 0.96; 13+: 1.08. Every interval contains 1 except 4-6 (0.99 to 1.42, borderline touching 1).
- A seed shared by all boards being lucky: the average z per block over the 40 spare-2 cells has sd 0.192 against 0.148 expected if independent (variance ratio 1.7 on 7 degrees of freedom, p about 0.1). No block seed is systematically off (per-block mean z between -0.25 and +0.29).
- The two meter sub-block seeds inside one block behave as independent equal halves: mean z of (first 20 minus last 20) is 0.00, variance 1.03 over 640 blocks.
- Conclusion: independent seed blocks are independent, and the 40-campaign block mean has the SE that the within-block spread predicts.

## 2. Does SE shrink as 1/sqrt(N)?

Root-mean-square SE of group means (disjoint groups of blocks, all 80 cells; sec2):

| Campaigns | Observed SE (tries) | 1/sqrt(N) from 40 | Capped-geometric model | Within-block plug-in | SE in log D |
|---|---|---|---|---|---|
| 40 | 0.78 | 0.78 | 0.84 | 0.78 | 0.105 |
| 80 | 0.57 | 0.55 | 0.60 | 0.55 | 0.075 |
| 160 | 0.44 | 0.39 | 0.42 | 0.39 | 0.058 |

Observed/predicted: 1.00, 1.03, 1.14. Log-log slope -0.41 (expected -0.5). The 160 row rests on only 80 degrees of freedom (2 groups per cell), so 1.14 is within about 1.7 standard errors of 1.0. The pooled variance test in section 1 (ratio 0.98) says the scaling holds; the log-log slope hints at a mild shortfall at 160 (possibly 5-10% more SE than 1/sqrt(N)). I would not change the rule for it, but I would not trust SE at 320 to be better than the 1/sqrt(N) value by more than the plug-in says.

SE by D band, tries, from the within-block spread (per-campaign SD in brackets):

| D band (mean D) | cells | SD/campaign | SE 40 | SE 80 | SE 160 | SE 320 |
|---|---|---|---|---|---|---|
| 3-4 (3.6) | 10 | 1.88 | 0.30 | 0.21 | 0.15 | 0.11 |
| 4-6 (4.9) | 21 | 3.82 | 0.60 | 0.43 | 0.30 | 0.21 |
| 6-9 (7.2) | 28 | 5.39 | 0.85 | 0.60 | 0.43 | 0.30 |
| 9-13 (11.1) | 8 | 6.74 | 1.07 | 0.75 | 0.53 | 0.38 |
| 13+ (15.2) | 13 | 5.85 | 0.93 | 0.65 | 0.46 | 0.33 |

The synthesis precision table (SE 1.2 at 40 and 0.6 at 160 for D about 8) is too pessimistic by about 25%: at D 7.2 the measured SE is 0.85 at 40 and 0.43 at 160. In log D the SE at 160 is about 0.058 (synthesis said about 0.08).

## 3. Paired against unpaired steps (D at spare 2 minus D at spare 3)

- Mean campaign-level correlation between spare 2 and spare 3 on the same seed: 0.28.
- Variance of the step, paired over unpaired (ratio of sums, boards resampled): campaign level 0.64 (reduction 35.8%); 40-campaign blocks 0.63 (36.9%); 80-campaign blocks 0.78 (22.5%, wide interval); D 6-16 only: 0.65 (34.6%). By band the campaign-level reduction is 24%, 51%, 39%, 35%, 20% for 3-4, 4-6, 6-9, 9-13, 13+ (4 to 15 boards each).
- Step SE in tries: at 80 campaigns paired 0.71 against unpaired 0.81 (direct); at 320 campaigns paired 0.31 against unpaired 0.39. For a CURVE of 80 campaigns the paired step SE is therefore about 0.63 (scaled from 320) to 0.71 (direct).
- **Steps are small.** The mean spare 2 minus spare 3 step over the 40 boards is only 0.38 tries and the median 0.09; spare 3 is easier on 62.5% of the boards. At 80 campaigns the paired step SE (0.63 to 0.71) is larger than the typical step. The monotone rule `D(s+1) <= D(s) + max(0.5, 2 SE)` is then governed by its 2 SE term (1.3 to 1.4 tries at mid D), so it only catches big reversals; the 217-type cliff is a spare 0/1 effect that this data (spare 2 vs 3) does not test. Seeing a 0.4-try step at 2 SE needs a paired SE of 0.2, which is about 800 campaigns (0.314 x sqrt(320/800)); this is the reason the dial's value is established from many puzzles (E1 audit) rather than per puzzle.

## 4. Spread against sqrt(D(D-1)) and the cap

Observed per-campaign SD over the 320 pooled campaigns, mean over cells (sec4):

| D band | Observed SD | sqrt(D(D-1)) | Capped geometric | Observed / sqrt(D(D-1)) | Observed / capped | Share at cap |
|---|---|---|---|---|---|---|
| 3-4 | 1.83 | 3.03 | 3.00 | 0.60 | 0.61 | 0% |
| 4-6 | 3.53 | 4.40 | 4.18 | 0.79 | 0.83 | 3% |
| 6-9 | 5.23 | 6.69 | 5.67 | 0.79 | 0.93 | 9% |
| 9-13 | 6.69 | 10.60 | 6.88 | 0.64 | 0.97 | 28% |
| 13+ | 5.80 | 14.74 | 6.31 | 0.40 | 0.92 | 52% |

- sqrt(D(D-1)) is not a usable model above D 9 because of the 20-try cap (observed SD at D 15 is 5.8, not 14.7). The capped geometric `min(Geometric, 20)` fits to within 8% for D 6 and above (ratios 0.93, 0.97, 0.92). Below D 6 the real spread is 17% to 40% smaller than the model (the bot's wins are less random than a geometric draw at low D).
- Overall 75% of the 80 cells lie within 30% of the capped model against 46% for sqrt(D(D-1)). Ratio range for the capped model 0.42 to 1.60; the worst cells are board 26 (sd 8.0 against 5.0, a mixture board, both spares) and low-D boards at 0.4 to 0.5 of the model.
- This is consistent with `yardstick.json` blocks.SCREEN calibration (observed/model 0.97, 0.87, 0.94, 0.96, 1.00).
- The SCREEN z=3 rule checked on E3's real campaign sequences (1,280 sequences of 20 campaigns, looks at 5, 10, 15, threshold exactly at the cell mean): false-stop rate 0.7% (criterion 2%; sec5b). Confirms the z=3 early stop (the cell mean is the 320-campaign estimate, so the check is slightly optimistic).

## 5. Final sequential acceptance rule and early-stop margin

Method (sec5): bootstrap campaigns from each cell's pooled 320, treat the cell mean as truth, targets T = truth + delta x tol for delta from -3 to +3 (tol = max(1, 0.10 T)), 60 replicates per cell and delta, 77 cells with D 3 to 16.5 (67,080 simulated acceptances per rule). "Bad accept" = accepted although the true gap is at least 1.25 tol. "Good refuse" = refused although the true gap is at most 0.75 tol. SE1 in the rule is the capped-geometric SD at the measured D over sqrt(n) (this is the measured SE within 8%, section 4).

| Rule | Stopped at 160 | Mean campaigns | Bad accept | Good refuse |
|---|---|---|---|---|
| Current: accept gap <= 0.6 tol, refuse > 2.5 tol, else 320 and accept <= tol | 33% | 267 | 4.2% | 5.8% |
| z 0.5 | 81% | 190 | 4.7% | 7.3% |
| **z 1.0** | 63% | **220** | **4.2%** | **6.2%** |
| z 1.5 | 47% | 245 | 3.9% | 6.0% |
| z 2.0 | 33% | 267 | 3.9% | 5.9% |
| z 1.0, third look up to 480 | 63% | 257 | 2.8% | 4.1% |
| z 1.5, third look up to 480 | 47% | 306 | 2.5% | 3.8% |
| z 2.0, final needs gap + 0.5 SE <= tol (conservative) | 33% | 267 | 1.5% | 13.2% |

Where z-rule means: at 160 campaigns accept if `gap + z x SE1 <= tol`; refuse if `gap - z x SE1 > tol`; otherwise add 160 and accept if `gap <= tol` (320).

What this shows:

- The current 0.6/2.5 rule is statistically about the same as a z of 2 (same errors, same cost): the 0.6 tol accept edge is about 1.5 to 2 SE at D 6 to 10 (SE1 0.43 to 0.53 against tol 1.0 to 1.1).
- The final decision at 320 campaigns, not the early stop, sets the error rates, so an earlier stop with z 1.0 costs nothing visible (4.2% and 6.2% against 4.2% and 5.8%) and saves 18% of campaigns (220 against 267 mean).
- The error rates are not uniform: bad accept is 0.4% at D 3-4, 3.2% at 4-6, 6.0% at 6-9 and 6.5% at 9-13 (z 1.0). The relative tolerance of 10% above D 10 is already in the pins; between D 6 and 13 the 320 limit is the weak point. Raising the limit to 480 (three looks) cuts bad accept in those bands to about 4% and good refuse to about 6% for +37 campaigns on average.
- The conservative final (gap + 0.5 SE) trades bad accept down to 1.5% but refuses 13% of good pairs. Not recommended while the library supply is the bottleneck.

### Proposal block for yardstick.json (not applied; pins unchanged)

```json
"acceptance": {
  "rule": "sequential-z (E3)",
  "startCampaigns": 160,
  "maxCampaigns": 320,
  "z": 1.0,
  "se": "capped-geometric sd at the measured D over sqrt(n)",
  "steps": [
    "Measure 160 ACCEPT campaigns (4 blocks).",
    "If gap + z*SE <= tol: accept. If gap - z*SE > tol: refuse for that slot.",
    "Otherwise measure 160 more (8 blocks, 320) and accept only if gap <= tol."
  ],
  "optionalThirdLook": "480 campaigns (12 blocks) for D 6-13 only: bad accept 6% -> 4%, +37 campaigns on average"
}
```

Consequences for the code: `accept()` needs the z-test and a `se` function (D-dependent, not the sample SD, which is noisy), and `ledger.reserve` must reserve 8 blocks (or 12 with the third look). Nothing was changed in yardstick.js or its pins.

Other proposals from this data:

1. Replace the synthesis section 2 precision table with the measured one in section 2 above (SE about 25% lower at D 7).
2. Use the capped geometric, not sqrt(D(D-1)), for any SE calculation above D 8; use observed SD (about 0.6 to 0.8 of the model) below D 6 only if a smaller SE matters.
3. Do not read single-puzzle steps between neighbouring spares at 80 campaigns as signal (paired step SE 0.63 to 0.71 tries against a median step of 0.09).

## Open points

- Pairing is one third of the variance only. If Dennis wants per-puzzle monotone checks to be informative at spare 2 against 3, CURVE would need about 300 or more campaigns per spare (paired SE 0.31 at 320). The kill rule does not require it.
- The log-log slope of -0.41 (SE ratio 1.14 at 160) deserves a repeat if it ever matters; the pooled variance test does not support a real departure.
- The E3 boards are from builder/factory pools, so their per-campaign spread at low D (0.6 of model) may not carry to every future build.
- Not run: the full CURVE structure (4711 + 18427 allResults) was not repeated; the SE table assumes campaigns in a CURVE rating behave like these.
