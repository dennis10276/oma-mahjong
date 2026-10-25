# Certified re-deal experiment03: combine pair-room preference and balanced costs

Target: tray failures with unseen partners,634/893 baseline misses(71.0%) across139 boards.
Enable `patientSingleCarry` and `balancedTrayRecovery` together from the retained
baseline. Experiments01 and02 each failed the adoption gate on their own. This
trial tests their interaction before rejecting the family. All other settings match.

| Measure | Frozen baseline | Candidate |
|---|---:|---:|
| Target successes |657/1550(42.4%)|670/1550(43.2%)|
| Slowest move |1534.6ms|1520.6ms|
| Paired gain /2SE |—|0.84 /1.29 points|
| Boards dropping>10 points |—|3|
| Adopted |—|false|

Use all1550 identical certified cases, manifestda3d05314eb24d6f8068e3eef40ec2f576a8c69aec4fc66690ffa901a4e87efc.
Adopt only a complete valid run with paired improvement>2SE(case/board-cluster maximum)
and no board losing>10 percentage points. Fresh experiment3 of at most8; no-gain counter2 before testing.
Both constituent paths passed their focused tests; the full paired run evaluates
their interaction and independently replays every accepted tap through production.
Raw worker/test logs stay in .codex-runs/.

Completed/valid:true/true; all12 native workers exited0. Launch commit:1e31c79b7663d0adbb18b357cb770ea7f376143d. No-gain counter:3; fresh batch:3/8.
Paired identical cases; use the larger of case and board-cluster standard errors. No board may lose more than10 percentage points.
Boards dropping>10 points:23, 35, 50.
