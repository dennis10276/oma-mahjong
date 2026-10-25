# Certified re-deal experiment03: combine pair-room preference and balanced costs

Target: tray failures with unseen partners,634/893 baseline misses(71.0%) across139 boards.
Enable `patientSingleCarry` and `balancedTrayRecovery` together from the retained
baseline. Experiments01 and02 each failed the adoption gate on their own. This
trial tests their interaction before rejecting the family. All other settings match.

| Measure | Frozen baseline | Candidate |
|---|---:|---:|
| Target successes |657/1550(42.4%)|pending|
| Slowest move |1534.6ms|pending|
| Paired gain /2SE |—|pending|
| Boards dropping>10 points |—|pending|
| Adopted |—|pending|

Use all1550 identical certified cases, manifestda3d05314eb24d6f8068e3eef40ec2f576a8c69aec4fc66690ffa901a4e87efc.
Adopt only a complete valid run with paired improvement>2SE(case/board-cluster maximum)
and no board losing>10 percentage points. Fresh experiment3 of at most8; no-gain counter2 before testing.
Both constituent paths passed their focused tests; the full paired run evaluates
their interaction and independently replays every accepted tap through production.
Raw worker/test logs stay in .codex-runs/.
