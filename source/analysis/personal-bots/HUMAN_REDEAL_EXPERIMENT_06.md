# Certified re-deal experiment-06: inspect before a third unmatched carry

Target:unseen-partner tray failures,634/893 retained misses(71.0%).
Raise the existing non-clock inspection threshold from one carried tile to two. Keep recovery priority: a proved win or known tray recovery still takes precedence. The saved eight-board public diagnostic found unmatched commitments with unused free peeks on five distinct failing boards. Eligibility comes from the full retained loss classification.

Changes from retained profile:{"inspectionTrayLimit":2}.

| Measure | Retained baseline | Candidate |
|---|---:|---:|
| Target successes |657/1550(42.4%)|pending|
| Slowest move |1534.6ms|pending|
| Paired gain /2SE |—|pending|
| Boards dropping>10 points |—|pending|
| Adopted |—|pending|

Same1550 certified cases; manifestda3d05314eb24d6f8068e3eef40ec2f576a8c69aec4fc66690ffa901a4e87efc.
Require full validity, paired gain>2SE(case/board-cluster maximum), and no board drop>10 points.
Previously validated global options; production source remains frozen:767865dc5f4358f06c276efe42fd666139c26e7de154024f759c0ce8ed5d804f.
Actual-observation-only memory, original-production replay, single-thread games,12 workers,under2s/move.
Fresh trial6/8; no-gain counter before trial:5.
Raw logs remain in ignored .codex-runs/redeal-v2/experiment-06/.
