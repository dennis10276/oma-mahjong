# Harder levels — release 1.47

Implemented 12 October 2026. New normal boards start at level 80; levels 1–79 and grandma’s separate track are preserved. The strong target interpolates between the approved reference checkpoints: 75: 70%, 85: 60%, 100: 45%, 120: 35%, and 150+: 30%. The middle target declines from 42% at reference level 75 to 22% at 120.

## Independent measurements

Each of the 190 new boards (80–269) was measured on 600 fresh games per persona, using seeds different from candidate selection. All boards are within 8 percentage points of both targets at 80–89 and 10 points afterwards. All band averages are within 3 points. No failed candidate is shipped.

| Levels | Strong | Strong target | Middle | Middle target | Average diagnostic |
| --- | ---: | ---: | ---: | ---: | ---: |
| 80–89 | 62.0% | 60.5% | 36.9% | 37.8% | 13.8% |
| 90–104 | 50.4% | 48.3% | 30.2% | 32.2% | 11.5% |
| 105–119 | 39.7% | 39.0% | 23.6% | 25.6% | 9.4% |
| 120–149 | 33.2% | 32.6% | 20.4% | 22.0% | 7.9% |
| 150–269 | 31.4% | 30.0% | 19.9% | 22.0% | 8.4% |

These are simulated first-attempt win rates, not guarantees of an individual player’s results. A single 600-game estimate has approximately ±4 percentage points of sampling uncertainty at 95% confidence in the worst case; model uncertainty is separate. Band averages are less noisy.

## Clocks, readability and saved games

Every new board includes a complete legal solution that removes its clock before the deadline and finishes without overflowing the tray, respecting ice and keys. Clock removal on the final allowed tap succeeds. Budgets leave 3–4 spare route moves at 80–89, 2–3 at 90–109, and 1–2 from 110. Clocks require at least five route moves and are visible, initially blocked, and never face-down, gold, iced, locked or keys.

- 80–89: countdowns 8–16; normal strong wins 62.0%, focused clock diagnostic 78.8%, without clocks 72.7%.
- 90–109: countdowns 7–18; normal strong wins 48.2%, focused clock diagnostic 64.3%, without clocks 67.0%.
- 110–269: countdowns 6–16; normal strong wins 32.2%, focused clock diagnostic 52.1%, without clocks 69.1%.

Minimum simulated tile width: 54.92 px on normal boards and 51.03 px on every tenth board; minimum requirements are 54 and 48 px.

Boards after 269 repeat the final plateau pool (150–269), mirrored and with permuted faces; their complete solution proofs are also checked. Old in-progress normal boards at 80+ start fresh after updating, keeping earned progress. Boards below 80 and grandma’s saved boards still resume.

The full data, including per-level rates, clock budgets, spare moves, solution checks and tile sizes, is in `validation-1.47.json`. Runtime and offline simulator share the same per-tap deadline rule.

## Verification

All 90 offline app tests passed. Focused save tests also cover optional easier fallback boards, and the browser replay removes the clock on its final allowed tap and completes the whole board. The APK uses the existing signing certificate; packaged game assets match the source. The browser version, automatic-update bundle and APK all contain the same final designs.

## Publication and requested reset

Publish the browser update, installed-app bundle and signed APK as 1.47. Verify the public artifacts and automatic update before sending Dennisisdebeste a fresh one-time reset to 79. That reset clears stars, points and tries at 79+, preserving levels 1–78 and every other player. The player-specific reset event and account data remain local and are not published.
