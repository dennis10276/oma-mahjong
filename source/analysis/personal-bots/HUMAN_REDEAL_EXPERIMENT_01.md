# Certified re-deal experiment01: preserve pair room at one carry

Target: tray failures with unseen partners,634/893 baseline misses(71.0%) across139 boards.
Change only `patientSingleCarry` from its default false to true. With one carried
tile and no active clock, prefer a guaranteed available pair or tray match before
opening another unmatched tile. The planner uses observed pictures and public roles.

| Measure | Frozen baseline | Candidate |
|---|---:|---:|
| Target successes |657/1550(42.4%)|658/1550(42.5%)|
| Slowest move |1534.6ms|1514.0ms|
| Paired gain /2SE |—|0.06 /0.89 points|
| Boards dropping>10 points |—|1|
| Adopted |—|false|

Use all1550 identical certified cases, manifestda3d05314eb24d6f8068e3eef40ec2f576a8c69aec4fc66690ffa901a4e87efc.
Adopt only a complete valid run with paired improvement>2SE(case/board-cluster maximum)
and no board losing>10 percentage points. Fresh experiment1 of at most8; no-gain counter0 before testing.
The focused production test passes: ready-pair selection uses guaranteed observed
partners and completes that physical pair. Raw test/worker logs stay in .codex-runs/.

Completed/valid:true/true; all12 native workers exited0. Launch commit:235726c0198286c1575e943e70be7275d1248b2e. No-gain counter:1; fresh batch:1/8.
Paired identical cases; use the larger of case and board-cluster standard errors. No board may lose more than10 percentage points.
Boards dropping>10 points:35.

Eight hash-selected public failure traces covered eight distinct boards, four from
each eligible class. All eight target misses reproduced; all ten attempts reached
a planner-certified dead state before the final loss. This supports inspecting
earlier pressure decisions. The original source stayed unchanged throughout.
