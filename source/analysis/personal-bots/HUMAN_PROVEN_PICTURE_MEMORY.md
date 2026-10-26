# Proven hidden pictures may join memory

Dennis clarified that a hidden picture known with100% certainty may be used
as observed memory. A picture proved from the permitted public information
may therefore be used by planning and remembered on later tries of the same
board and salt, even before its face is directly observed.

Keep its provenance as a deduction, rather than claiming a direct observation.
Certainty means every hidden board consistent with the public observations,
production rules and explicitly allowed priors gives that tile the same picture.
An exhaustive, complete enumeration or a sound logical proof can establish this.
When using the allowed winnability prior, pruning a candidate world requires
proof that it is unwinnable; bounded solver failure does not provide that proof.

Agreement in100% of sampled worlds, a single solved imagined board, or agreement
with the actual concealed board during offline evaluation does not establish
public certainty. Such hypotheses may inform action ranking but cannot become
remembered facts. Solver or time limits leave the picture unknown.

Existing implementation already supports a narrow proof case:
public_matched_picture.js derives an unseen tile's identity from an actual
unambiguous match to a previously observed tray or open picture, with guards
against ambiguous wildcard matches. human_reference_campaign.js places those
deductions in the same picture memory used by planning and retry observations.
The sampling ranker explicitly returns observedFact:false. This clarification
does not claim a general exhaustive hidden-world deduction engine is implemented.

Verification: test_public_matched_picture.js passes222 match controls and18
independently replayed wildcard-fixture taps; test_human_hypothesis_sampling.js
passes the no-guessed-memory and concealed-swap invariance checks. Both ran
sequentially with native exit0 after experiment24's supervisor exited0.
