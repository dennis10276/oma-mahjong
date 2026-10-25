# Certified re-deal experiment04: forecast picture-only information

Target: tray failures with unseen partners,634/893 retained-baseline misses(71.0%) across139 boards.
Change `passiveInformation` from `shortRoles` to `shortAll`. Keep the existing
three-tap information horizon while forecasting public orientation/picture
exposure as well as role overlays. The model forecasts which tile can become
readable; it records the picture only after the real observation.

| Measure | Frozen baseline | Candidate |
|---|---:|---:|
| Target successes |657/1550(42.4%)|pending|
| Slowest move |1534.6ms|pending|
| Paired gain /2SE |—|pending|
| Boards dropping>10 points |—|pending|
| Adopted |—|pending|

Use all1550 identical certified cases, manifestda3d05314eb24d6f8068e3eef40ec2f576a8c69aec4fc66690ffa901a4e87efc.
Adopt only a complete valid run with paired improvement>2SE(case/board-cluster maximum)
and no board losing>10 percentage points. Fresh experiment4 of at most8; no-gain counter3 before testing.
Code c6074da passed106/106 reference tests in14s, including7680 concealed-world
controls, all37 new picture-exposure cases, unchanged clock/pair witnesses,
actual-observation-only memory and uncapped three-tap horizon accounting.
The tested changed-file Git blobs match the working branch; the temporary checkout
has been removed. Raw test/worker logs and the original frozen source bytes remain in .codex-runs/.
