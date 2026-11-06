# Task 08: tolerance and pressure frames

The reuse pass qualifies **16/26 levels**, adding 203, 207, 209, 218, 220 and
223 to the ten exact v12 boards. The big board at 220 has 96 tiles. The new
composition model failed its registered test: **0/12** met family and skilled
targets together. No further model-driven generation followed that failure.
No new model-composed board qualifies.

Detailed portable handbacks are beside this checkout in
`codex-tasks/results/200-225-v13/` and `codex-tasks/results/pieces-v2/`.
The game, calibrated bot, Firebase, main and release files are unchanged.

## Approved curve rule

Pooled family seeds 4711 and 18427 must be within one try of the slot. Edited
boards also need reserved seed 29717 within one try, with maximum pairwise seed
gap two. Every complete window of five consecutive levels must have mean
pooled-minus-target within 0.5. Partial windows are explicitly uncertified.

Assignment maximizes coverage, then minimizes total absolute pooled-family
offset, using authoring preferences to break ties. It retains the ten mandatory
boards and all existing originality, skilled, component, attribution, spare and
room gates. The previous adjacent reverse-step bound remains in effect.
`curve_policy.js`, assignment, verification and handback implement this; tests
cover window drift, balance, holes, exact tolerance boundaries and fixed boards.

Nine requested pools yield 5,237 distinct boards. There are 441 fully measured
boards near an empty slot at ±1 versus 316 at ±0.5 (1.396×). Of these, 352 also
meet the two-seed gap; 89 already fail it. All 195 lacking current compatible
quality received that check: 106 stable-gap boards (34 quality passes) and 89
bad-gap boards (five quality passes, still ineligible because of their gaps).
Nineteen missing final-seed measurements were completed.

The reuse assignment finished in 7,491 nodes, with cost 2.78 and 16 selected
boards. On the same newly checked pool, changing only the tolerance back to
0.5 yields 15 boards. Thus the combined pool/check/tolerance pass adds six over
v12; the tolerance alone adds one relative to that current-quality counterfactual.
All sixteen pooled offsets are within 0.36; the largest fresh offset is 0.93.
There is still no complete five-level window, so the batch-level window rule
cannot yet be certified. Missing slots remain explicit.

## Frame and conditional experiments

`pressure_frame.js` changes only the clock on a neutral board: pictures and
positions stay fixed. Depth is transitive cover count; share uses the shortest
proven winning clock route. Spare is 1–3. It does not pad a witness with optional
moves or insert an unrequested partner mechanism. Exact-route budgets are
20,000 nodes / 250 ms per call, 3.5 seconds per construction; achieved share must
be within 0.035 of the requested share and cover depth must match exactly.

Eight calm bases crossed share 0.10/0.20/0.30, depth 0/2/4, spare 1/2/3: 216
intended cells. Twenty-two of 72 share/depth/base groups were realized, graded
to all three spares: **66 valid fully measured boards**. The other 150 cells are
unrealized within the search limits, not proven impossible. All grid boards
rate skilled 1.00–1.20, even when family reaches the twenty-try cap.

Three measured controls on distinct layouts, selected before conditional outcomes:

| Shape | Requested share / depth / spare | Family | Skilled |
|---|---|---:|---:|
| hourglass, 74 tiles | 0.10 / 4 / 1 | 6.385 | 1.05 |
| star, 96 tiles | 0.10 / 4 / 1 | 7.110 | 1.07 |
| pyramid, 96 tiles | 0.10 / 2 / 2 | 8.685 | 1.00 |

These span the requested family band but only two distinct parameter settings.
Thirty-three single settings and fifteen common pairs on each control gave
144 attempts, **116 legal placements** (115 distinct physical boards), 28
failures. All 116 full measurements are valid. Effects expose frame drift and
changed tile roles in ten pair contexts; they are not universal causal constants.
Clock/route pieces replace frame coordinates and undo to the measured frame.

Only one conditional case reaches skilled 2.5–6: the star's depth-five, spare-one
clock (family 5.015 / skilled 2.67). Another, clock plus one hidden route tile on
the hourglass, overshoots both (18.94 / 19.63). The remaining 114 are below the
skilled floor. The same requested frame (share 0.20, depth 4, spare 2) ranges
from family 2.39 to 19.24 across four bases.

## Frozen model and prospective test

`frame_model.js` fits frame pressure, then conditional piece residuals with pair
interactions and frame depth/share/spare interactions. Normal clock-only grade
treatments belong to the frame fit. It uses 1,989 deduplicated boards: 1,989 full
family labels (1,524 pooled) and 992 full current-bot skilled labels. Old calm
controls and rated history are included; obsolete skilled labels and reserved
seed 29717 are excluded. Human overrides never become model labels.

Fixed ridge penalty 12; full D4-layout holdout (1,485 train / 504 test boards).
Target-family within one/two tries is 22.2%/46.5% (n=144), MAE 2.39, rank 0.140;
a training median 9.485 does better on target-family MAE (1.75). Skilled target
within one/two is 44.1%/73.5% (n=34), MAE 1.39, rank 0.257. Easy controls still
dominate aggregates. Raw reports, strata, baselines and residual intervals are
saved; interval coverage is not calibrated.

Calibration exposed an implementation omission before any fit or registered
test: the designer could not use clock-coordinate treatments it had measured.
The corrected proposal set covers all catalogue clock grades; normal clock-only
treatments train frame pressure. The job resumed its 96 cached conditional
records; no prospective outcomes existed during that correction.

After fitting, the protocol was registered, new boards generated, and the exact
twelve boards/predictions hashed before full confirmation. There were 118 model
proposals on 33 compatible unused layouts, with a budget of two fresh pairings
per layout.
All thirteen previously delivered layouts were reserved. Only two selected
boards were predicted inside both target bands; ten were explicitly the closest
feasible model proposals. No uncertainty bonus or unreported replacement was used.

Reuse had left only ten gaps, so the protocol kept twelve new test boards using
the original sixteen v12-empty targets, with the unchanged eight-of-twelve bar.
This interpretation was stated to Dennis before the test. All ten original
keepers remain mandatory. The six new reuse matches are validated alternatives.

**Result: 0/12 joint successes; 1/12 family-target hits; 0/12 skilled-range hits.**
Actual skilled spans 1.00–2.17. Family prediction MAE is 5.06; skilled MAE 1.57.
Neither point-predicted board succeeds. No exact test board occurs in training.
No model, parameter, target or board was replaced after the outcomes. The model
output refuses overwriting with changed data, preserving the frozen test.

The frame is mostly family pressure in this study. Coarse counts and clock
coordinates miss which pictures wait in the tray, which partners share a key
or thaw dependency, and whether a trap still matters after the strong player's
clock route. The next model needs fixed-role conditional experiments and route/
tray dependency descriptors, including coupled mechanisms beyond the most
frequent pairs. It should establish joint family/skilled anchors, then face a
new registered test. More proposals from this fitted model are not justified.

## Use and validation

Run one heavy job at a time. Construction and measurement stages are resumable;
changed source hashes require a new directory. Use new model/test outputs for a
new experiment, preserving the finished registered test.

```powershell
node source/tools/factory/frame_calibrate.js frames <experiment-dir>
node source/tools/factory/frame_calibrate.js conditional <experiment-dir>
node source/tools/factory/frame_calibrate.js fit <experiment-dir> <model-dir>
$env:FACTORY_RATE='1,20'
$env:FACTORY_SKILLED='2.5,6'
node source/tools/factory/frame_prospective.js <plan> <pool> <model> <representative-frames> <effects> <test-dir> <measurements-dir>
node source/tools/factory/batch_verify.js <portable-plan> <levels.jsonl> --partial
```

`frame_designer.js` implements frame-first proposals and measured one-piece
changes; the latter was not run after the failed test. Authored wrong-clock
recipes retain the existing grab-first counterfactual gate; none of the twelve
test boards used that treatment. All 16 delivered levels pass current cached
full-bot verification (zero new calls, 132 hits), originality, phone bounds and
their stored route in the actual game at 390×820. **91/91 factory tests pass.**
