# Independent Gemini handoff audit

Audited checkout: `C:/Users/den_k/Idea/OmasMahjong/agy-personal-bots`,
commit `6628eab16ccf5c041464057e57f9b415641f26bd`.
Audit performed in `personal-bot-review` on 2026-10-19. No Gemini files,
existing forecasts, dashboard deployment or live game data were modified.

## Decision

The 80% future first-clear target is **not established**. Do not promote the
handoff's dashboard accuracy claims or overwrite existing numeric forecasts.
Its own-relative clock/nonclock difficulty factors remain a useful hypothesis
for a separately versioned, genuinely future shadow test.

## Reproduced retrospective scores

Running Gemini's evaluator independently produced
`gemini-reproduced-evaluation.json` at `2026-10-19T01:12:02.056458+00:00`.
The report's embedded `heldBenchmarkTargetMet` is the evaluated program's claim,
not this audit's acceptance of prospective success.

| Person | Retrospective held | Recomputed completed games |
| --- | --- | --- |
| Dennisisdebeste | 20/20 | 5/5 |
| Mrs. Doubtfire | 19/20 | 3/3 |
| PUK | 19/20 | 0/0 |
| Gerda | 20/20 | 0/0 |

`evaluate_causal_factor_head` loads already-scored completed games from
`personal-fresh-prospective-results.json`, then calls the current
`predict_causal_3bucket` on each target. It does not retrieve those predictions
from the causal-factor frozen ledger. Consequently its 8/8 is retrospective
recomputation, not eight forecasts frozen before opening.

The causal ledger was frozen at `2026-10-18T23:44:08.074Z`. It explicitly omits
Dennis151..156 and Mrs104..106 as already opened. Its 86 numeric entries cover
Dennis157..174, Mrs107..127, PUK54..77 and Gerda69..91. Those entries, not the
recomputed eight completed games, are the candidate's prospective evidence.
Their later openings/outcomes still need an independent ledger-based scorer.

The frozen Mrs107 forecast is **8**, whereas the later head/report claims **2**.
Both may be retained as different experiments only with separate readiness and
pre-opening provenance. The original 8 must never become a retrospectively
rewritten 2. The supplied freezer currently uses `write_text`, overwriting its
ledger; it also lacks a model-source hash. Do not adopt that lifecycle unchanged.

The handoff describes a Mrs102 rule refinement using its already-known actual
one-attempt clear, and a regression test for that held target. Strictly earlier
runtime history does not make thresholds tuned on held outcomes independent.
Treat the 78/80 as development fit, not untouched held evidence.

## Exact opening geometry check

The supplied JS opening function was run on our exact decoded 29 recent and
95 future boards from `personal-fresh-count-input.json` (SHA256
`e9968c817ebe64b49a02a9ac6eac702014d0f2f1023e02141f2133d22c66c835`).
All 124 boards have corresponding feature-table entries. Five public fields
match for every board: `n`, `blockedFreeCount`, `takeableWithVisMateFrac`,
`meanMateDepth`, `clockSlackRatio`.

`takeableWithTakeableMate` differs on 104/124 boards: the JS returns a tile
count, but the table is exactly **half** that count on all 124 boards (including
20 zero cases). This explains fractional table values without implying invented
data. The producer's units still need to be explicit; running the supplied
function verbatim does not reproduce the table's feature contract. For example,
Dennis128 gives JS4/table2, and Dennis131 gives JS6/table3.

The remaining simulation-feature producer and its own-actor IDs, fit cutoffs,
profile definitions, seeds and cap handling have not yet been independently
reproduced. The table's self-declared public/own-only flags are not sufficient
provenance. The JS encoded-input detection also accepts encoded lock arrays as
if they were Set-backed runtime games; callers here explicitly decoded first.

## Audited source SHA256

- `personal_causal_factor_head.py`: `f462c35d937fc4e521da3aa8638657fd2afb1b6836733a030c730a7eba6c7538`
- `personal_causal_factor_data.py`: `c9bf0735f4b92156e57a75a8167e956cb36381c50eaef790e182bbf0952027b0`
- `personal_causal_factor_sim.js`: `e46c8826461ff402cee27ea5f9ab18535049fc8f97bebd52668b594c71e62dc8`
- `personal-causal-factor-features.json`: `f203ef1a2a1a884bcdea4b4af605459ee596f023f6338eafdb7547649f6e7f2e`
- `personal-causal-factor-forecasts.jsonl`: `1a644b70df74eaa2847cdbdafcc513caaa5e22dd829a4d38fbf256308b6758d5`

## Next acceptance requirements

Reproduce simulation features from source-pinned earlier own actors. Make feature
units explicit and reject missing provenance instead of fabricating substitute
measurements. Freeze immutable, source-bound candidate forecasts only for unopened
levels; score the actual numeric ledger with original misses and cohort frontiers
intact. Keep model fitting separate from final future evaluation for each person.
