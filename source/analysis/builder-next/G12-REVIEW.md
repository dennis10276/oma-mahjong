# G12 review, 2026-11-11

Reviewed `906e9f61`. **Useful production examples, but not ready as a reliable
builder for the continuing curve.** The report's claim that all G12 requirements
are met conflicts with its own target-13 and target-16 yield results.

## Progress independently checked

The five saved sequence boards have legal actual tile counts for their slots
(96 at 250, 80 at 251-254), and five distinct matching bodies after ignoring
picture-name relabelling and deadline. Their recorded average family error is
0.133. Four are in the normal skilled band; level 250 uses the recorded S2.15
fallback. This is a real improvement over G11's invalid/repeated sequence.
The fast controller regression check now passes.

Two fresh-cache builder requests were run serially through the lead's heavy-job
lock: target 10, diamond/layout 30, normal S2.5-6, four proposals, 80 family
campaigns, maximum 120 seconds. Results and exact code/ruler context are retained
in `g12-review/`.

| Seed | Result | D / S | Trials | Wall / process CPU |
| --- | --- | --- | ---: | --- |
| 4, submitted example | EXPERIMENTAL_HIT | 10.30 / 3.33 | 1 | 17.099 s / 20.453 s |
| 11, independent seed | NO_MEASURED_HIT | - | 4 | 20.563 s / 21.890 s |

Seed 11's three original-seed candidates rate D4.20/3.705/3.545 and S1.05.
A documented derived-seed candidate (7930) rates D3.69/S1.05. This is not a
population yield estimate; it confirms a real example and an unresolved
construction-transfer failure. The hit passes the actual required static and
trace checks. The higher fresh-cache cost does not invalidate the result, but
must not be confused with the submitted warm/receipt timings.

## Why the full objective remains unfinished

- The submitted matrix itself reports target 10 at 4/5 normal hits, target 13
  at 1/3 and target 16 at 0/2. Only the first selected group reaches the declared
  80% bar. Its four target-10 successes are the same cases used for the sequence;
  there is no demonstrated pre-tuning held-out yield estimate. The later-range
  failure is explicitly acknowledged as unsupported, so readiness for levels
  after 275 is not established.
- `plan_sequence.js` contains five fixed, selected `SEQUENCE_SPECS`; it does not
  yet accept an arbitrary level plan and construct a varied sequence from it.
  The saved example is useful, but does not establish general plan fulfillment.
- `extended-40-v1` extends family rating calls, while unchanged `traces.js`
  captures `MAX_ATTEMPTS = 20` and counts uncleared campaigns as 20. Thus
  high-range D and quality traces do not use the same full campaign protocol.
  Keeping a first-20 diagnostic window could be deliberate, but it needs an
  explicit validated definition rather than a claim of a fully aligned protocol.
  Identical playing heuristics alone do not prove cap-20/cap-40 score equivalence.
- The high-tier matrix widens tolerance to 1.5, contrary to the settled +/-1
  rule. No high-tier success is thereby admitted, but this is not a valid
  future acceptance setting.
- Matrix export reads `res.history` and `res.candidate`; the actual builder
  returns `res.attempts` and `res.finalCandidate`. Consequently recorded trial
  counts default to 1 and recipe identities to null. It omits the complete
  per-request outcomes, failed-candidate histories and campaign evidence needed
  to audit yield, effects and protocol comparability.
- Derived seeds are a useful explicit bounded control. The added topological
  check protects witness ordering, but has not solved general target control:
  the submitted pyramid seed-5 miss remains and the independent diamond miss
  reproduces the same easy-body regime. This is a construction/repair problem,
  not evidence that the required trace gates are impossible at higher targets.

Keep the current passing outputs and gate guards. The next phase needs
structural target control at 13/16/19, genuinely reserved request performance,
a general slot-aware plan builder, and coherent extended measurement. Do not
loosen quality gates or change the family curve to hide these limits. No G12
implementation, pins or actual game levels were adopted during this review.
