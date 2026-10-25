# Certified re-deal experiment01: preserve pair room at one carry

Target: tray failures with unseen partners,634/893 baseline misses(71.0%) across139 boards.
Change only `patientSingleCarry` from its default false to true. With one carried
tile and no active clock, prefer a guaranteed available pair or tray match before
opening another unmatched tile. The planner uses observed pictures and public roles.

| Measure | Frozen baseline | Candidate |
|---|---:|---:|
| Target successes |657/1550(42.4%)|pending|
| Slowest move |1534.6ms|pending|
| Paired gain /2SE |—|pending|
| Boards dropping>10 points |—|pending|
| Adopted |—|pending|

Use all1550 identical certified cases, manifestda3d05314eb24d6f8068e3eef40ec2f576a8c69aec4fc66690ffa901a4e87efc.
Adopt only a complete valid run with paired improvement>2SE(case/board-cluster maximum)
and no board losing>10 percentage points. Fresh experiment1 of at most8; no-gain counter0 before testing.
The focused production test passes: ready-pair selection uses guaranteed observed
partners and completes that physical pair. Raw test/worker logs stay in .codex-runs/.
