# B3 adoption review, 2026-11-10

**Not ready for sole autonomous rejection authority.** This agrees with B3's
own verdict. Reviewed commit `7cf39383`. B3 remains experimental; no adoption,
code or pin change was made during this review.

Ran the candidate independently through the lead's heavy-job lock at fresh seed
424243, two blocks of 20 campaigns, maximum 20 attempts. Saved settings, source
hashes and both-style per-block outcomes are in `review/`.

| Case | B3 S | First wins | Uncleared at 20 attempts |
| --- | ---: | ---: | ---: |
| Qualified 223 | 4.80 | 0/40 | 0/40 |
| blind1-185 | 17.43 | 0/40 | 31/40 |

The qualified-223 improvement is real on this fresh check. The central human
comparison remains unresolved: Dennis has a recorded win on blind1-185 in six
tries, while most B3 campaigns still fail to clear it within twenty. A single
human result does not establish his true mean, but this remains a substantial
competence gap requiring decision-level resolution.

The saved B3 benchmark also leaves factory1-189 at 60/120 first wins and
factory3-176 at 51/80, below the declared 80% easy-board criterion. The report
correctly acknowledges that the readiness goal is unfinished. It reports real
broader progress: uncleared campaigns fall from B2's 192 to B3's 96 across the
same 4,840 selected-style campaigns. These aggregates agree with the saved
records; they do not remove the unresolved per-board failures.

There are additional regressions to retain in the next comparison: qualified
204 goes from S1.15/zero uncleared under B2 to S3.38/10 uncleared out of 80, and
factory6-184 from S4.21 to S7.91. The latter human record is non-winning and
must not be treated as a demonstrated five-try human win.

The delivered causal script runs successfully. Some checks still evaluate
standalone expressions rather than the live heuristic, so passing it is not
a complete behavioral certification. Code inspection confirms changes to lock
usability, projection of remembered keys, initial relief arguments and the
default beam width. The report's claimed new peek-bonus adjustment is absent
from the B2-to-B3 controller diff. Its blind1-185 narrative also describes
76 tiles, four locks and deadline 12; the actual frozen board has 80 tiles,
two locks and deadline 17. Treat the detailed proposed cross-wing explanation
as a hypothesis until checked against actual observations and legal traces.

The useful next work is to resolve the failed planning/learning decisions on
blind1-185 and the remaining human comparisons while preserving the gains and
addressing regressions. Another benchmark report alone will not complete this
objective. No new Gemini task has been prepared by this review.
