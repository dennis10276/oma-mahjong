# Difficulty plan — new measured levels from 80

Updated 12 October 2026. The user has now authorized implementing and publishing the harder levels from 80, followed by resetting Dennisisdebeste to 79. Release 1.46 is the current baseline; the new release will be 1.47.

## Scope and approved targets

Preserve the existing levels 1–79, including their saved games. Introduce the new measured designs and tighter clocks from level 80. Preserve grandma's separate easier track and the existing tile-size minimums: 54 pixels on normal levels and 48 on every tenth level, measured on the supported phone layout.

The user's final strong-player targets replace the earlier, more aggressive proposal. Interpolate linearly between checkpoints; keep the 30% strong-player plateau from 150 onward. The 75 checkpoint defines the curve, but does not replace levels 75–79.

| Level | Strong-player target | Sensible middle-player target |
| --- | ---: | ---: |
| 75 — reference only | 70% | 42% |
| **80 — first new level** | **65%** | **40%** |
| 85 | 60% | 38% |
| 100 | 45% | 31% |
| 120 | 35% | 22% |
| 150+ | 30% | 22% |

The middle-player curve is 42% at the reference level 75, falling linearly to 22% at 120 and staying there. Table values are rounded. The average-player simulation remains a diagnostic rather than a third acceptance target. These are simulated first-attempt win probabilities; real-player results must be checked after any future release.

## Why change the clocks

In 1.45, the recorded runs at levels 80–83 removed the clocks with 18, 19, 11 and 33 moves remaining. Those deadlines allow substantial detours. The existing designer can also keep its closest candidate after three attempts even when it misses the intended win rate.

Design each new clock around a verified route, rather than a percentile of leisurely successful games:

1. Choose a visible clock that needs a deliberate sequence of moves to reach. Exclude face-down, gold, iced and locked clock tiles, and avoid clocks that are immediately removable.
2. Find a legal route to remove it and then finish the entire board. Verify the complete route with the actual tray, ice and lock rules.
3. Give that route 3–4 spare moves at levels 80–89, 2–3 at 90–109, and 1–2 from 110 onward. Count individual tile taps; taking the clock on the final allowed tap succeeds.
4. Prefer clocks reached early enough to require an immediate plan. Initial search limits are 18 route moves at 80–89, 16 at 90–109, and 14 from 110. If these constraints prevent a fair design, review the board rather than silently stretching its deadline.
5. Measure clock losses separately from tray losses. Compare focused clock play, normal strong play, and play without a clock. Focus should help; a clock with almost no effect should be redesigned. Confirm this across fresh seeds, not a single recorded route.

The route proves the board can be completed within the deadline. It does not prove that every player can identify the route, especially around hidden tiles, so independent simulation and human review remain necessary.

## Build and acceptance plan

1. **Calibrate the simulations.** Check the strong player's decisions against recent play, including restarts as failed first attempts. Include deliberate clock planning without knowledge of hidden faces. Use a more careful clock-focused player as a diagnostic.
2. **Build a pilot of levels 80–89.** Preserve 1.45 rows through 79 exactly. Keep readable tiles and clock badges. Supply a complete solution witness for each new design.
3. **Measure independently.** Candidate selection and acceptance must use different random seeds. Use at least 300 fresh runs per persona for acceptance. Require each pilot level to be within 8 percentage points of both targets; use 10 points beyond level 89. Regenerate or explicitly review misses rather than silently shipping the closest candidate. Report sampling uncertainty and averages by level band. Aim for band averages within 3 percentage points of their targets.
4. **Review the pilot.** Show per-level targets, measured rates, clock budgets, route lengths, spare moves, and clock-loss rates. Keep any unresolved misses visible. Do not treat an unfinished generation run as measured release results.
5. **Build the remaining shipped levels, 90–269.** Apply the same complete-route checks and independent measurements. Repeat levels beyond the table using the existing transformations, starting the repeat pool at 150 so the 30% plateau is maintained. Verify transformed solution witnesses too.
6. **Verify game behavior.** Check deadline handling per tap, the final allowed move, retries, saves and resumes, ice and locks, and phone tile sizes. Preserve saved boards below 80. For replaced boards at 80+, discard incompatible in-progress boards while keeping progression and earned rewards. Run the full suite and focused regressions; compare preserved levels against the original table.
7. **Publish 1.47 after validation.** The user has authorized this release. Verify the live automatic update, browser version and signed APK. Only after publication, send a new one-time reset to level 79 for Dennisisdebeste.

## Reset and current work

The earlier reset to 75 was already applied. The new instruction is to reset Dennisisdebeste to 79 after the harder levels are published. Send a fresh reset ID only after verifying 1.47 is live; preserve all progress through 78 and all other players. The reset removes stars, points and tries from 79 onward, following the existing reset mechanism.

The generator and validation work has resumed from its saved checkpoints. Levels 1–79 must still match 1.46 exactly. All new levels need complete legal clock-safe solutions and fresh independent measurements. Previous prototype results and the 1.46 clock-only measurements are historical, not measurements of the final 1.47 curve.
