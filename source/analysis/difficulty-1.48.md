# Clock-focused difficulty — release 1.48

The user selected the careful clock-focused player as the better calibration model and asked that added difficulty come from the rest of the board. The approved strong curve stays at 65% at 80, 60% at 85, 45% at 100, 35% at 120 and 30% from 150. Middle and average players are diagnostic results only.

## What changed

Only the face arrangement away from the original clock-removal prefix is tuned. Every board retains its 1.47 geometry, hidden tiles, ice, locks, gold positions, key positions, clock tile, clock counter and complete legal solution route. Faces along the clock-removal prefix, the gold pair and the keys are fixed. The full route still completes with the actual tray and obstacle rules. Clock margins remain 3–4 route moves at 80–89, 2–3 at 90–109 and 1–2 later.

The calibration profile is `temp: 0.7`, `end: 20`, `clockFocus: 4`, exactly the clock-focused diagnostic used in 1.47. Clock urgency applies while the clock is alive. Candidate selection and final measurement use different seeds.

## Independent measurements

Every shipped level from 80–269 was measured on 600 fresh games per persona. Per-level focused win-rate tolerance is 8 percentage points at 80–89 and 10 points afterwards; band tolerance is 3 points. Reaching the clock must remain at least as reliable within 3 points per level and 1 point per band; clock-expiry losses must not rise beyond those sampling tolerances. All structural clock protections are exact.

| Levels | Focused wins | Target | Clock reached | Previously reached | Middle diagnostic | Average diagnostic |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 80–89 | 61.4% | 60.5% | 97.9% | 92.9% | 22.0% | 6.7% |
| 90–104 | 49.9% | 48.3% | 87.7% | 86.1% | 21.9% | 8.5% |
| 105–119 | 39.1% | 39.0% | 76.1% | 73.5% | 18.2% | 6.6% |
| 120–149 | 33.7% | 32.6% | 80.2% | 78.2% | 12.0% | 4.0% |
| 150–269 | 31.2% | 30.0% | 69.0% | 66.6% | 14.0% | 5.6% |

## Level 80
The focused player wins 61.5% against its 65% target; it previously won 82.5%. The clock counter stays at 10, with the same 6-move route and 4 spare moves. Clock reach is 89.2%, previously 89.2%. Among games that reach the clock, 69.0% now finish the board, previously 92.5%.

The rest of the game supplies the added challenge. A lower overall win rate is accepted only with the clock protections above, rather than by shortening its deadline or moving it deeper.

## Verification and continuity

Levels through 79 remain unchanged. Grandma’s separate track is preserved. Existing in-progress normal designs at 80+ start fresh under design version 4, retaining progression; earlier boards, current designs and optional easier boards still resume. The start log now records the focused win chance and identifies its model; middle results remain in the measurement report.

Single-level 600-game estimates have up to approximately ±4 percentage points of sampling uncertainty at 95% confidence. The model is a user-selected proxy, not a guarantee of an individual player’s results. Raw per-level results are in `validation-1.48.json`.

Publish the app bundle, browser files and fresh signed APK together as 1.48 after the app tests pass. No new player reset was requested for this follow-up.
