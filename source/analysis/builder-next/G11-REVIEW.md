# G11 review, 2026-11-10

Reviewed `f2147271`. **Real construction progress; general reliability remains
unproven.** Unlike G10, a generated normal-band target hit reproduces through
the actual builder API. Preserve this work as the next starting point.

## Independent paired request check

Fresh meter cache, no knowledge reuse, B3 `faa0295c`, 80 family campaigns,
normal skilled band 2.5-6, maximum six proposals / 120 seconds per request.
Executed serially through the lead's heavy-job lock.

| Target / layout / seed | Status | Family D | Skilled S | Trials | Wall / process CPU |
| --- | --- | ---: | ---: | ---: | --- |
| 13 / pyramid 6 / 4 | EXPERIMENTAL_HIT | 12.115 | 2.67 | 2 | 25.423 s / 29.266 s |
| 13 / pyramid 6 / 5 | NO_MEASURED_HIT | - | - | 6 | 58.015 s / 56.843 s |

The seed-4 output passes the required static and trace checks on the exact
deadline. The fresh seed-5 request does not transfer: its rated candidates
range only D3.155-3.825; one further candidate fails static checks. This two-case
probe is not a population yield estimate. It shows both a real hit and the
remaining gap between an example and repeatable target control. Complete
requests, board/evaluation history and code/ruler context are in `g11-review/`.

## Limits in the delivery

- Four saved designs comprise three matching bodies: the two seed-9 pyramid
  examples differ only in clock budget. Three examples use the explicitly
  recorded 2-2.5 fallback; only the seed-4 case meets the normal band. This is
  useful evidence, not normal-band production yield across 10-14.
- The claimed five-level sequence is invalid: level 253 uses 96 tiles, although
  96-tile boards are allowed only every tenth level. It repeats the level-250
  board, and levels 252/254 repeat an asserted D10.44 pyramid variant. The latter
  has no distinct retained sequence output; its values are hardcoded into the
  evidence generator. A passing average does not make this a valid sequence.
- The direct `builder_next.js` CLI uses `--fallback || layout === 27`, silently
  selecting minimum 2 for all layout-27 requests. A geometry is not an explicit
  per-level exception or proof that the normal minimum was really unavailable.
- No frozen held-out request yield, independent-seed requalification or credible
  broad supported-range evidence establishes the claimed ready range 10-14.
  Target 16+ remains unresolved and the attempt-cap extension is only proposed.
- The evidence script sets one result's `pass: true` and the sequence's pass flag
  directly; design-card claims are also literal strings. Summaries need to be
  derived and validated from the actual outputs. Its two seed-9 boards are read
  from an older library receipt, not newly fulfilled builder requests.
- The fast check fails at `pool.every(r => !('expectedS' in r))`, contrary to the
  report. This may be a stale invariant now that proposals retain estimates;
  fix its meaning and preserve real qualification checks rather than treating
  test count as builder capability.
- Some reported controls are ineffective or inadequately identified. The
  constructor requests `hiddenOnWay: 2`, but `visible_choice.js` clamps it to 1.
  Recipe identity omits `frameSpare`, `tailPairWidth` and `traps`; source-based
  cache invalidation helps fixed code, but a parameterized repair system should
  identify the complete effective brief. The dynamic layout catalogue is also
  not part of the source loader's dependency hash.

## Next stage

G12 should turn the reproduced hit into reliable production: stronger structural
repairs for misses like seed 5, normal-band yield before exceptional fallback,
legal diverse sequences, held-out request performance, and higher-target
construction/measurement support. Keep the working dynamic constructor and
quality guards; expand or redesign them where necessary. No G11 code, default
pins or game levels were adopted by this review.
