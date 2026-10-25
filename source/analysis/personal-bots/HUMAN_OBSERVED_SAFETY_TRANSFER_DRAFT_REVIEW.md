# Public safety transfer without placement or exclusive-role assumptions

Prepared separately while experiment10 runs. This is not an integrated actor
feature, an adopted strategy or a played experiment. No timed actor files changed.

Suppose the bot actually observed tile T mechanically available under original
rules, while a key it now positively knows was still alive. That witness proves
T was not locked: a lock would remain active with even one real key still alive.
It also proves T's ice requirement was at most the count of its starting
neighbors removed by that witness. These conclusions hold with composite roles,
unknown key counts and unknown ice strength. They use no hidden pictures.

On a different route or retry, the bot may therefore prove T mechanically safe
when T is geometrically free and at least as many starting neighbors are gone.
Their identities need not match the earlier removals. It may restore unrelated
tiles. The known key need not still be alive in the candidate position: its
presence at the actual safety witness already excluded a lock on T.

This is stronger than the current exact-removal-subset memory. It avoids the
existing causal-transfer feature's zero/two-key and at-most-two-hit declarations,
which measure() correctly forbids on arbitrary unlabeled boards. In particular,
use the full witnessed neighbor count; truncating it to two would be unsound.

Required restrictions: only actual accepted taps, observer takeability or drawn
cleared-role evidence; no safety witness obtained under automatic relief; same
board and salt; positively observed static key identity; original starting-alive
mask; current geometric freedom; no restoration of tiles absent at board start.
Without a positively known key alive at the witness, this rule returns no proof.
Other keys may remain unknown. Existing monotone-subset proofs still apply.

The raw prototype passed500 supported witness/key configurations and9000
production-rule transfer checks, including5652 that restore unrelated tiles and
100 with three-hit ice. Configurations include composite roles and one to four
keys. Two actual winning production routes on an eight-tile board with three
keys and an ice-covered key were independently replayed:16 physical taps total.
The routes exchange which ice neighbor is removed before the same target.
All checks exited0. These finite tests support, but do not replace, the reasoning
above. Controller integration and the development/full gates remain mandatory.

Potential integration: a separate optional observed-safety-transfer flag using
the existing accepted/cleared memory callbacks and retained positive key facts.
Keep it independent of speculative assignments, exclusiveRoles, board IDs and
the key-route ranking gate. Expose proof counters and test relief/retry isolation.
Do not alter experiment10's frozen source before its workers finish.

Raw prototype: .codex-runs/level-measure/observed-safety-transfer-draft.js;
test-observed-safety-transfer-draft.js and observed-safety-transfer-draft-test-02.log.
