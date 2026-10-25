# Certified re-deal experiment02: balance known and unknown recovery burden

Target: tray failures with unseen partners,634/893 baseline misses(71.0%) across139 boards.
Change only `balancedTrayRecovery` from false to true, starting from the retained
baseline. Rank recovery by estimated public access cost plus2 per unseen partner
and2 per extra carried tile after immediate matches. This balances the cost of a
deeply buried known partner against keeping space to discover an unknown partner.
The focused burden test passes; these scores guide ordering and supply no hidden facts.

| Measure | Frozen baseline | Candidate |
|---|---:|---:|
| Target successes |657/1550(42.4%)|656/1550(42.3%)|
| Slowest move |1534.6ms|1510.1ms|
| Paired gain /2SE |—|-0.06 /1.14 points|
| Boards dropping>10 points |—|5|
| Adopted |—|false|

Use all1550 identical certified cases, manifestda3d05314eb24d6f8068e3eef40ec2f576a8c69aec4fc66690ffa901a4e87efc.
Adopt only a complete valid run with paired improvement>2SE(case/board-cluster maximum)
and no board losing>10 percentage points. Fresh experiment2 of at most8; no-gain counter1 before testing.
Experiment01 remains available for a later combination test. Raw test/worker logs stay in .codex-runs/.

Completed/valid:true/true; all12 native workers exited0. Launch commit:54ffbbc2616ab2e7f333c95ffff8e01dde0ffbfe. No-gain counter:2; fresh batch:2/8.
Paired identical cases; use the larger of case and board-cluster standard errors. No board may lose more than10 percentage points.
Boards dropping>10 points:23, 30, 38, 60, 92.
