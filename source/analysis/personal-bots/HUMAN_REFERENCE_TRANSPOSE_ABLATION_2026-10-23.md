# Public-policy transposition/bounds ablation

Diagnostic tool: `human_reference_ablation.js`, committed in `4d38bfd`.
Same base planning profile as the full `6d7b837` screen. Each mode runs in a
fresh process and independently replays every accepted tap in unmodified production.
These are explicitly injected helper ablations, not an unchanged canonical-policy claim.

| Mode | Level | Dennis tries | Bot tries | Pass | Slowest ms |
|---|---:|---:|---:|:---:|---:|
| First-visit only; retain public bounds | 85 | 1 | 1 | yes | 912 |
| First-visit only; retain public bounds | 111 | 3 | 2 | yes | 1501.7 |
| First-visit only; retain public bounds | 123 | 1 | 1 | yes | 1111.6 |
| Shortest prefixes; disable discharged bounds | 85 | 1 | >1 | no | 451.5 |
| Shortest prefixes; disable discharged bounds | 111 | 3 | 2 | yes | 595.3 |
| Shortest prefixes; disable discharged bounds | 123 | 1 | 1 | yes | 1502.1 |
| First-visit; disable discharged bounds | 85 | 1 | 1 | yes | 1421.7 |
| First-visit; disable discharged bounds | 111 | 3 | 2 | yes | 591.4 |
| First-visit; disable discharged bounds | 123 | 1 | 1 | yes | 1502.3 |

The regressions involve shortest-prefix admission;111/123 also interact with
the bounds-enabled search. The next correction deduplicates each beam frontier
by physical state while retaining its shorter prefix, rather than letting both
old and replacement candidates consume beam slots.45/45 offline tests pass.
Campaign results for that correction are pending. No per-level policy selection.
