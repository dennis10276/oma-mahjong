# Real-board planner experiments

These use the current real-board gates. Old salt-screen and certified re-deal
experiments are archived separately and do not count toward this eight-trial batch.
No private pictures, future reveals, target counts or level IDs enter a policy.
Certain deductions may enter trusted picture memory only with a rule-supported
proof covering every consistent hidden board; agreement of sampled boards is not proof.

## Experiment01: complete public-memory retry witness

Pre-run design: preserve first-try behavior and existing constructive wins. On a
retry whose alive pictures are all known, seek a complete winning physical route.
Search is positive-only: capped or failed searches do not prove impossibility and
return the primary plan unchanged. Respect remaining physical-choice allowance.
Global profile is baseline dc0d1ecd18b9fcc9c860187df2a9ae3bf7abcc56361e201aa2f94d0eb87a78f2
plus retryCompleteWitness=true, retryCompleteMs=250, retryCompleteNodes=2000.
Implementation aa610a7;113/113 reference tests pass, including production retry replay.

Comparator: corrected baseline-v2, source
596e37bde6e1c996ad068614c888e30ac29d1d14e8670d6d4f7bddf876f48618.
Reuse its actual measurements without a redundant baseline run. Real boards and
salts1,2,3 remain identical; max12 actual tries/salt, at most12 game workers.
Development selection hash:
806fc19e13ee57989fcc8bd4d8ca785020e858ca1c5da50a3f1d3fca79b93b1d.
Failing levels:86,144,150,10011,10015,10032,10033,10041,10049,10052.
Twenty passing guards:33,36,39,42,49,52,54,72,77,78,91,92,97,102,103,105,110,114,123,124.
Run these30 first; if a failing level is repaired and no passing level breaks,
run the other125. Adoption requires the same condition on the full155 boards,
all independent replays valid and every move under2s. Default profile remains
unchanged until full qualification. A valid rejection counts as one unadopted trial.

Raw profiles, frozen source bytes, native process exits, action sequences and
summaries: .codex-runs/level-measure/experiment-01/. State and outcomes pending.
