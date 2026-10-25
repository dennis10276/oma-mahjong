# Retry learning audit: conditional availability proofs

The current stalled-retry fingerprint includes pictures, orientations, starting
roles and positive key identities. It omits the retained conditional availability
proofs learned from accepted taps, visible takeability and cleared role symbols.

Replayed adopted08 salt1 histories for all eight open Track A boards plus passing
controls150,10041,10045. The ONE observer supplied all picture/role/takeability
facts. Updates used the actor's fact operations; no new planning or games ran.
Every one of2724 recorded taps independently replayed through production.
The reconstructed stalled count matches the recorded counters board by board.

Thirty physical losses had no growth under the current fingerprint. Twenty-one
nevertheless grew the conditional availability proof set. Before comparing,
the audit united both proof stores, removed duplicates and discarded dominated
conditions across stores. Thus these changes expand supported availability
conditions; they are not timestamps, event counts or duplicate representations.

| Board | Stalled losses with additional availability conditions |
|---|---:|
|10011|4|
|10032|6|
|10033|6|
|10049|1|
|10052|3|
|150 passing control|1|

This proves a gap in what the fingerprint calls learning. It does not prove
that the extra proof changes a future decision or that delaying exploration
would improve play. In particular,150's third loss adds proofs and its fourth
attempt clears under the adopted policy. Counting these proofs as learning
could suppress the useful retry-information strategy on that passing control.

Possible future experiment: optional semantic availability knowledge in the
fingerprint, using a canonical minimal union of same-board proof conditions.
Preserve all38 development controls and require full salts1-3 before adoption.
Do not include role observation timestamps, redundant evidence or heuristic
sampling results. This audit alone is not a measured strategy experiment.

Raw evidence: .codex-runs/level-measure/retry-proof-learning-v3.jsonl and its log;
native command exit0. Versions1-2 preserve the initial eight-board audit and
the cross-store dominance check. No actor or default profile changed.
