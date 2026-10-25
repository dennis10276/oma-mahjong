# Certified re-deal experiment05: picture forecasts with pressure management

Target: unseen-partner tray failures,634/893 retained-baseline misses(71.0%) across139 boards.
Combine `passiveInformation: shortAll`, `patientSingleCarry: true` and
`balancedTrayRecovery: true`. Experiment03's pressure combination improved the
point estimate without passing adoption; experiment04's information change alone
lost ground. Test their interaction before discarding either route. All other
settings, public information, actual-observation memory and budgets stay fixed.

| Measure | Frozen baseline | Candidate |
|---|---:|---:|
| Target successes |657/1550(42.4%)|pending|
| Slowest move |1534.6ms|pending|
| Paired gain /2SE |—|pending|
| Boards dropping>10 points |—|pending|
| Adopted |—|pending|

Use all1550 identical certified cases, manifestda3d05314eb24d6f8068e3eef40ec2f576a8c69aec4fc66690ffa901a4e87efc.
Adopt only complete valid results with paired improvement>2SE(case/board-cluster maximum)
and no board losing>10 percentage points. Fresh experiment5/8; no-gain counter4.
Production source is unchanged from tested c6074da(106/106 reference checks).
The new profile combines previously tested options; no additional production code.
All native worker exits and full production replay validity are required.
Raw logs remain in ignored .codex-runs/redeal-v2/experiment-05/.
