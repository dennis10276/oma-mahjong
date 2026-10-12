# Clock-only changes from level 80

Release 1.46, 12 October 2026. The user authorized deployment of these clock-only changes. The steeper curve remains on hold.

The active local game keeps all 1.45 boards, faces, face-down tiles, gold, ice, locks, clock positions, tile sizes, repeat-pool settings and difficulty targets. Only existing clock countdowns from level 80 change. The steeper curve is archived in `analysis/steeper-curve-draft`; its plan remains available in `difficulty-plan.md`.

## Countdown examples

| Level | Old moves | New moves |
| --- | ---: | ---: |
| 80 | 27 | 6 |
| 81 | 30 | 8 |
| 82 | 19 | 9 |
| 83 | 56 | 22 |
| 84 | 68 | 36 |
| 85 | 76 | 66 |
| 86 | 37 | 29 |
| 87 | 40 | 18 |
| 88 | 17 | 7 |
| 89 | 53 | 32 |

All 188 existing clocks have a verified full-board solution. 186 countdowns are shorter. Levels 203, 253 already meet the check and retain their counters. Levels 152 and 159 had no clock in 1.45 and remain unchanged. Levels below 80 are unchanged. Grandma's separate levels remain unchanged.

## How deadlines were chosen

Start with an early legal route to the existing clock and add 3–4 moves at 80–89, 2–3 at 90–109, or 1–2 from 110. Check a deliberately clock-focused strong simulation. Widen a counter when the early route requires too precise a sequence for that player to use reliably; fixed boards sometimes need longer deadlines than newly designed boards would.

Candidate selection uses 160 simulated games. A separate 300-game sample must retain at least 65% of the lower of that focused player's no-clock and original-clock win rates. This is a clock fairness check, not a replacement difficulty curve or a prediction of a real person's success. The simulation retains the original strong player's temperature and end-game planning, adding explicit attention to clearing the clock.

Each accepted deadline has a complete successful route with the specified spare moves. These witnesses are examples of successful deliberate play; they are not asserted to be shortest routes. The report also records an earlier route found by bounded search. A witness can use information from hidden tiles, so route replay alone is insufficient; the simulation respects hidden faces when choosing moves. Live human play has not yet been evaluated.

The existing per-level rate fields in the game table remain the 1.45 measurements. They must not be presented as measurements of these new clock deadlines. `clock-changes.json` contains the clock-specific measurements and full solution witnesses. `clock-initial-diagnostics.json` records the rejected, overly tight first pass, not the accepted counters.

## Saves and validation

An in-progress saved game keeps its existing countdown and progress. A retry or a new game uses the new counter. No player reset is sent. Taking the clock on the final allowed tap succeeds; selecting a pair in the simulator cannot bypass the deadline.

Checks compare every table field except eligible countdowns against the original 1.45 content, replay every full-board witness, and replay the repeated levels after mirroring and face permutation. Browser regressions cover old saves, retries and the final allowed clock tap. The full offline suite passed 87/87 tests; focused clock and hard-level checks are rerun after final tuning.

Reproduce locally with:

```powershell
node tools/sim/tighten_clocks.js analysis/levels-1.45.js www/levels-hard.js analysis/clock-changes.json
$env:CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
node tests/run.js clocks
```

The 1.46 release includes the automatic app update and a fresh APK signed with the existing certificate.
