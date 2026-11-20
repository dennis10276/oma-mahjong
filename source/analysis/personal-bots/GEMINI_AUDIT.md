> **Gemini's assignment changed on 22 Oct 2026 (Dennis).** Gemini now works only from agy-personal-bots/GEMINI.md: predictions locked in Firebase forecasts/ and scored by the dashboard's Voorspeltest card, which is the referee. Codex: do not write new tasks, contracts, gates or protected verifiers for Gemini, and do not hand it TELEMETRY_DISCOVERY_TASK.md or GEMINI_NEXT_WORK.md again. The audits below are history.

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

## Independently implemented and measured follow-up

`personal_causal_handoff_audit.py` preserves the handoff and original opening
snapshot in a new immutable audit bundle, then scores the **numeric ledger**
through the existing progression scorer. Current recomputation is diagnostic
only. Tests cover changed forecasts, late/equal freezes, replay exclusion,
pending/unresolved/unforecasted episodes, individual 20-game gates and changed
audit/live inputs. The original ledger is never rewritten.

At the separate live observation `2026-10-19T01:16:15.712Z`, the actual causal
ledger has **0 opened, 0 completed post-freeze primary games for every person**.
Thus the genuinely prospective score is **0/0**, not the handoff's 8/8. The
new scorer also finds two additional changed current projections: Gerda84
frozen8/current1, and Mrs109 frozen2/current1. Mrs107 remains frozen8/current2.
All original numbers remain the prospective points.

`personal_public_opening.js` implements the verified geometry with explicit
pair-equivalent units and strict encoded-board decoding, including lock Sets.
`public-opening-geometry-audit.json` reproduces all six table fields on all
124 exact boards with **zero differences**. Hidden-down-picture invariance is
checked across every board; focused tests also check covered pictures, ice,
locks, fractional support units, input immutability and malformed transport.
This adopts a verified useful component, not the unverified simulation table
producer or the hand-tuned prediction head. Depth/slack remain heuristics, and
the no-visible-mate depth sentinel is explicitly diagnosed.
# Generator follow-up: commits05e48e0/c9d8be0

The user supplied the generator/profile/seed follow-up. Inspected actual HEAD
`c9d8be07466ad73864673268d3334bb7ee7ce846`; source changes are committed, while
the unrelated evaluation JSON is dirty and remains untouched. The generator SHA
is `a919cfdd1732fd4491141614f543b13fde39852e1412ed0c6142a09da53cccc3`.
The feature archive is unchanged at
`f203ef1a2a1a884bcdea4b4af605459ee596f023f6338eafdb7547649f6e7f2e`.

Direct benchmark execution independently reproduces Mrs34,84,102,107 exactly.
This supersedes the earlier statement that no generator exists for the five
implemented simulation fields: `sf14_w3/w5/w8`, `s14_t1Left`, `p8_t1Dec`.
However, the other eleven simulation fields are only described in the handoff;
`simulateTaskFeatures` does not generate them. Nor does this CLI verify generic
reference rates or solve the earlier frozen-ledger/retrospective tuning issues.

Independent audit snapshots pin32 actual runtime/input dependencies, use exact
person/start/board tasks, retain all400 archive records and count computational
caps explicitly. The literal cache-first resolver cannot supply all29 recent
Dennis/Gerda models because matching cache tasks lack fresh model IDs. A distinct
29-record documented-recent-model supplement reproduces every one of those
records' eleven checked fields exactly withzero caps. The full literal audit
is still running at this note's observation; neither benchmark nor supplement
is claimed as complete26-field or80% pre-opening evidence.

The full literal audit is now terminal (nonzero because discrepancies remain):
369/400 match all eleven checked fields,29 lack a literal recent model and2
historical Dennis records differ only in meanMateDepth (65/73:archive10 versus
generator6, the no-visible-mates sentinel). All five simulation fields match in
those two records as well. Together with the separately retained documented
29/29 recent-model supplement, the FIVE implemented simulation fields reproduce
exactly on ALL400 records, withzero caps. Geometry matches398/400. The combined
summary records original failures and source hashes; it does not rewrite either
audit. No remaining eleven simulation fields or retrospective accuracy claim is
certified by this result.

Ported only these verified five calculations as personal_verified_factor_features.js.
First-trial left/decision statistics require only independently seeded first
attempts, but full retry rates retain the original32-attempt horizon because the
memory RNG stream affects later runs. All computation boundaries are refused.
Actual four-person parity against pinned originals matches all five fields
exactly, including the per-attempt style factory. These measurements are not a
new count head, frozen forecasts or an assertion of generic greedy human play.

# Full16 generator follow-up: commits2d1e579/7caabcb

The clean external HEAD7caabcb3d9b1d01c068df62814ee14459f1e22d7 passes its five
benchmark examples independently. This supersedes the earlier missing-eleven
generator statement, but not the earlier frozen-ledger/retrospective-tuning audit.

The immutable independent full26 audit is terminal:
gemini-generator-full26-audit-2026-10-19T13-36-26-045Z, made13:45:07.654UTC.
It pins34 runtime/input dependencies, retains400 exact person/start/board tasks
and uses the actual assembleTaskRecord interface without supplying expected
reference or physical metadata. All16 simulation fields reproduce400/400;
str/avg/hasClock/n also reproduce400/400. No current simulation computation caps.

However, only236/400 complete dictionaries match literally. The openPairs fallback
uses half the count of supported takeable tiles, but the archived field counts
disjoint identical-picture pairs among geometrically free face-up tiles. Those
are different quantities, especially with ice/locks or three copies of a picture.
The fallback differs on162 boards, including12 recent and46 future-planning
boards. The independently implemented openingPairCount reproduces archived
openPairs on400/400. Applying only that public correction gives398/400 complete
matches. The remaining two discrepancies are the earlier Dennis65/73 no-mate
sentinel10 versus generated6; the old archive and raw audit are not rewritten.

Historical276 secondary chain variants are pinned cached lookups, not fresh
independent resimulations by the new generator. Recent29/future95 all substitute
the SAME Plan8 chain for six missing variant policies. This reproduces the table,
but cannot be presented as six independently fitted future behaviors. No effective
latest-bank follow-through override is used by these inputs. The independent
summary rereads actor bodies and preserves29 historicalExploratoryOnly flags;
the initial driver used the wrong flag spelling in provenance, explicitly
corrected by that summary without modifying its immutable inputs.

The newly available11 fields are added to a separate24-feature own count
development experiment, excluding generic reference scores and the inconsistent
openPairs fallback. All305 exact own boards and80 fixed reused targets remain.
The same forest settings and strictly earlier own likelihood selection give
40/80 versus34/80 with only five simulation signals (always-first38/80).
Per-person selected scores: Dennis11/20, Mrs7/20, PUK13/20, Gerda9/20.
Dennis's later reused cohort remains16/23; Gerda's is1/5. These are development
scores with cached/aliased source-shift and exploratory actor caveats, NOT a
validated80% result or new frozen numerical predictions. No head is promoted.

# Genuine source-bound future hypothesis

The original86-point ledger remains unchanged at SHA
`1a644b70df74eaa2847cdbdafcc513caaa5e22dd829a4d38fbf256308b6758d5`.
Its missing model-source binding cannot be retrospectively repaired by attaching
the later01:18 head snapshot. The three original/current numerical drifts remain
visible and the original family is independently scored.

The unchanged pinned head is now tested as a DISTINCT fixed-source hypothesis:
`source-bound-handoff-factor-future-v1`. The new ledger freezes96 actual points
at2026-10-19T14:58:46.082UTC, after actual computation and a separate fresh
opening check. All24 consecutive levels/person are covered, not just Dennis's
original18. Original frontiers and an empty original cohort anchor are retained;
actual numeric eligibility uses the real NEW freeze time. An eventual late
arrival describing a race-opened campaign therefore remains a missing forecast,
not a disappeared case. Every old numeric point remains in its own original family.

Sources, own actor bodies,313 earlier history records, all26 factors and fixed
boards are bound.86 feature records were independently reproduced; ten new
boards receive full simulation. Cached historical variants and six aliased
future variants remain disclosed. The frozen head cannot silently access a
synthetic feature fallback. The new hypothesis is declared before observing
validation outcomes, not selected after seeing which forecast family won.

Independent post-freeze scoring at14:58:46.660UTC still gives0 opened/0 completed
primary validation games for EACH person, for both families. No80% result or
promotion is asserted. The old97.5%/8-of-8 claims remain retrospective/unsupported
as described earlier; they do not become valid merely because this trial exists.
