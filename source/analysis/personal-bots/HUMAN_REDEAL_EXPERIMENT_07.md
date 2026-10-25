# Certified re-deal experiment-07: retune inspection and short information routes

Target:unseen-partner tray failures,634/893 retained misses(71.0%).
Test a broader inspection threshold together with carrier-aware ordering of short information routes. A future information route is charged for both path length and waiting unseen partners. This retunes the exploration route instead of discarding it after a single threshold test. Recovery priority and active-clock policy remain intact.

Changes from retained profile:{"inspectionTrayLimit":3,"shortInformation":"carrierAware","informationTrayLimit":2}.

| Measure | Retained baseline | Candidate |
|---|---:|---:|
| Target successes |657/1550(42.4%)|610/1550(39.4%)|
| Slowest move |1534.6ms|1529.1ms|
| Paired gain /2SE |—|-3.03 /1.95 points|
| Boards dropping>10 points |—|22|
| Adopted |—|false|

Same1550 certified cases; manifestda3d05314eb24d6f8068e3eef40ec2f576a8c69aec4fc66690ffa901a4e87efc.
Require full validity, paired gain>2SE(case/board-cluster maximum), and no board drop>10 points.
Previously validated global options; production source remains frozen:767865dc5f4358f06c276efe42fd666139c26e7de154024f759c0ce8ed5d804f.
Actual-observation-only memory, original-production replay, single-thread games,12 workers,under2s/move.
Fresh trial7/8; no-gain counter before trial:6.
Raw logs remain in ignored .codex-runs/redeal-v2/experiment-07/.

Completed/valid:true/true; all12 native workers exited0. Launch commit:a759c34a80a92ca3f134f7f35b294bf3b78cd55f. No-gain counter:7; fresh batch:7/8.
Paired identical cases; use the larger of case and board-cluster standard errors. No board may lose more than10 percentage points.
Boards dropping>10 points:20, 27, 28, 30, 31, 34, 38, 59, 60, 69, 86, 89, 90, 106, 128, 144, 145, 155, 10015, 10042, 10047, 10052.
