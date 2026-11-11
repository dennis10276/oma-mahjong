# Updated G13 review: 9b7bb9c0, 2026-11-11

**Still not ready for reliable production across the future curve.** The latest
revision fixes meaningful planner shortcomings and improves the honesty of
evaluation, but its own reserved matrix produces **0/10 qualifying outputs**.
The previous missing-blueprint exception is fixed; the construction objective
is not completed. No code, pins or game levels were adopted in this review.

## Improvements to preserve

- The planner now has a dynamic path for levels beyond 254. It calls the builder
  for slot-compatible layouts and master-seed-derived seeds, and returns a
  structured miss instead of throwing for absent preset entries.
- Matching-body identity is checked in addition to board keys. Normal-band
  searches precede the milestone fallback path, and failure histories and
  rationale are retained.
- Protocol drift evidence is now retained in `protocol_drift.json`, and the
  matrix separates known development cases from reserved cases.

## Independent planner-path check

Executed the updated API for start 275, count 1, seed 99, fallback none, with
15,000 ms nominal budget, one candidate per body and 40 family campaigns. It
searched six layout choices and returned normally in 1.918 seconds:

`executed: true`, **`producedPlan: false`**, level status `NO_MEASURED_HIT`.

The request does now reach real construction rather than a preset-lookup error.
This small check establishes the API repair, not a full-budget yield estimate.
A wrapper returning normally or a zero exit code does not mean a level was
produced. The exact request/output are in `g13-review-9b7bb9c0/`.

## Remaining blockers

The submitted reserved matrix reports zero qualifying hits in all ten requests:
four target-10, three target-13, two target-16 and one target-19. The first seven
use new seeds; the frontier cases repeat earlier diagnostic cases. Even the
low-tier fresh cases do not support an 80% reliability claim. Selected known
development hits remain useful examples, not a general production system.

The report acknowledges this near-zero blind yield and unsupported high range,
yet opens with a claim that all remaining production requirements are resolved.
Those statements cannot both establish readiness. "Production ready on
calibrated topologies" means the known examples can be produced, not that the
builder reliably fulfills new difficulty requests.

There is still no constructor change: `construct.js` and `components.js` are
unchanged across both G13 revisions compared with G12. The only latest recipe
change specifies a previously selected construction attempt for the known
steps board. The reported perimeter-bypass/buried-twin diagnosis still has
not become a general structural construction or repair mechanism.

The default seed-1 sequence still uses `CALIBRATED_CANDIDATES[250..254]` before
the generic search. This is acceptable as explicit reuse of known examples,
but the same sequence cannot demonstrate fresh general planning. Fallback
still defaults to `recorded-slot10` when the caller provides no policy, so
caller authorization is not truly explicit. The per-level budget is given
again to each layout and fallback call without an aggregate deadline; the
advertised sequence budget is not strictly enforced.

Continue the substantive unfinished construction work under G13: implement
and measure structural repairs for weak bodies, then demonstrate useful yield
on fresh reserved requests at 10/13/16/19. Do not substitute graceful misses,
rerated known boards or more protocol/report work for actually producing new
qualified puzzles. No new numbered task was created by this review.
