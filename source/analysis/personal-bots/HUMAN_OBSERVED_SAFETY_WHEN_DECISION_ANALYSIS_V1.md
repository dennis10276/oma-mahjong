# When to use expanded observed-key safety proofs in planning

Experiment11 partially improved144 and10049 but worsened10011. The new proofs
are logically sound; broader available planning choices did not automatically
improve the bounded policy's outcomes. Both policies were compared on the same
actual11 public histories and acknowledged the recorded physical taps.

| Case | Actual taps replayed | Different baseline suggestion | Strategy replan drift |
|---|---:|---:|---:|
|144:5 to4 tries|128|2|0|
|10049:>12 to5 tries|217|7|0|
|10011:8 to>12 tries|589|97|0|

All934 taps independently replayed through production; all three native trace
commands exited0. Every changed position on the partially improved cases had an
active clock. Every changed position on10011 had its clock already cleared.
These are counterfactual baseline suggestions, not individually proved causes.
Neither partial improvement meets its Dennis+1 gate yet.

The fit compared clock-on and clock-off predicates, using one public feature and
no thresholds or board IDs. Requiring an active clock retains all9 changed
positions on both partially improved cases and none of the97 worsening-case
positions. The proposed condition is: start planning with expanded safety
transfers only while the actual observed clock remains active. The fit uses
completed11 development histories only;11 never ran a full-cohort experiment.

The optional observedSafetyClockOnly flag gates proof use at an actual observed
planning root. It does not discard actual facts, invalidate sound proofs or read
hidden pictures. A previously planned physically valid route may continue after
the clock is taken. Existing subset memory continues to work outside the gate.
Counters distinguish actual transfer queries/hits from clock-gated skips.

All123 reference tests pass14s(native94467 exit0). Controller controls cover
unrestricted/gated nonclock cases and a live public clock, first monotone attempts
with no cross-retry transfer, failed and winning retries, relief/fresh-controller
isolation, three-key composite roles, hidden-world invariance and invalid flags.
The controller controls independently replay48 physical taps.

Raw evidence: .codex-runs/level-measure/when-observed-safety-v1/ and
observed-safety-clock-gate-tests-01.log. Condition-fit SHA256
1a68307ca2ac119579862d57473d64a3696db4a1b68f60bc4b186250e1ec2fb8.
The strategy still needs a fresh development/full comparison before adoption.

Two current failures are invisible to a salt1 gate-repair comparison:86 passes
salt1 but fails salt3;10033 passes salt1 but fails salt2. The next experiment
therefore preregisters an optional path to full testing after guarded partial
development gains, even without a salt1 gate repair. It requires no passing
regression, no earlier clearance lost, a partial improvement on a still-failing
development board and an existing failure confined to another salt.

This changes full-test eligibility only. Final adoption still requires an actual
full three-salt Dennis+1 repair with no passing-board regression. The post-run
audit re-summarizes development, checks the declared qualification and helper
hash against the pre-run snapshot, verifies projected full-run salt1 guards and
requires a real repaired off-salt target when that exception is used.

The helper's8 negative/positive controls and the actual rejected11 negative case
pass. In particular,11 cannot advance because it loses10011's previous clear.
Raw helper: off-salt-full-qualification.js, SHA256
19db395fc287c558b0678fd13a23c202b5509af86d6252e9f6ced08914fb52ab.
The core evaluator and benchmark harness are unchanged; prior adoption audits
retain their ordinary path. No target is excluded or assigned an invented count.
