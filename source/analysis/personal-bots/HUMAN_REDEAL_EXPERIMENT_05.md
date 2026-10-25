# Certified re-deal experiment05: picture forecasts with pressure management

Target: unseen-partner tray failures,634/893 retained-baseline misses(71.0%) across139 boards.
Combine `passiveInformation: shortAll`, `patientSingleCarry: true` and
`balancedTrayRecovery: true`. Experiment03's pressure combination improved the
point estimate without passing adoption; experiment04's information change alone
lost ground. Test their interaction before discarding either route. All other
settings, public information, actual-observation memory and budgets stay fixed.

| Measure | Frozen baseline | Candidate |
|---|---:|---:|
| Target successes |657/1550(42.4%)|663/1550(42.8%)|
| Slowest move |1534.6ms|1522.7ms|
| Paired gain /2SE |—|0.39 /1.53 points|
| Boards dropping>10 points |—|6|
| Adopted |—|false|

Use all1550 identical certified cases, manifestda3d05314eb24d6f8068e3eef40ec2f576a8c69aec4fc66690ffa901a4e87efc.
Adopt only complete valid results with paired improvement>2SE(case/board-cluster maximum)
and no board losing>10 percentage points. Fresh experiment5/8; no-gain counter4.
Production source is unchanged from tested c6074da(106/106 reference checks).
The new profile combines previously tested options; no additional production code.
All native worker exits and full production replay validity are required.
Raw logs remain in ignored .codex-runs/redeal-v2/experiment-05/.

Completed/valid:true/true; all12 native workers exited0. Launch commit:a73c583c7b9191e7747b5fd1f0781bc91d87fd2d. No-gain counter:5; fresh batch:5/8.
Paired identical cases; use the larger of case and board-cluster standard errors. No board may lose more than10 percentage points.
Boards dropping>10 points:23, 30, 35, 50, 60, 10033.
