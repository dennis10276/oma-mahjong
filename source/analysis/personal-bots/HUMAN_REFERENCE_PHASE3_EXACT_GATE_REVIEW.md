# Exact-search gate regression

Both information schedules used `min(1, 2 * unseenFraction)` below the alive-picture
count gate. At eight or fewer unseen alive pictures, a fraction of one half or more
therefore produced honest weight1, causing the exact evaluator to be skipped.
The old gate test covered8/30, so it did not exercise this branch.

The new regression failed before the change with `0 !== 4` exact calls. It covers
both schedules, alive unseen counts0/1/7/8/9, and remaining-board fractions up to1.
It also keeps sixteen unknown pictures in memory to ensure removed unknowns do
not incorrectly disable the alive-picture gate.

The candidate caps honest weight at0.75 below the configured count limit, reserving
at least0.25 of both score weight and the per-action time slice for exact sampled
search with a4096-node cap. Counts above8 remain honest-only. Lower existing honest
weights are unchanged. This reservation is a candidate allocation, not an adopted
calibration or a guarantee that time permits all4096 nodes.

Identical fillings, paired2SE overrides, production physics, honest observations,
unresolved caps and the real-primary fallback remain in place. Exact searches are
still conditional on guessed fillings, never actual memory, loss proofs about the
real board, or calibrated player success probabilities.

Targeted gate and comparison tests pass. The complete offline human-reference suite
passes100/100 in35s while existing screens run elsewhere. No campaign improvement
is claimed. Two complete48-case screens will compare progress32x1 and12x16 against
the fixed24/48 baseline, retaining all paired guard losses and all capped failures.
