# B1 adoption review, 2026-11-09

**Verdict: useful competence gain; keep experimental. Not yet reliable enough to
be the builder's sole reason to discard a puzzle.** Reviewed Gemini commit
`dad2fe45` on `wip/gemini-skilled-bot-b1`. No candidate code or builder pins were
changed or adopted during this review.

The central G9 improvement is real in an independent fresh-seed check. It does
not establish the broader requirement of matching Dennis's demonstrated ability.

## Independent paired check

Ran baseline and candidate serially through the lead's `heavy.js`, with seed
18427, 20 runs per block, two blocks, maximum 20 attempts. Each row's first-win
and uncleared counts below pool all 40 campaigns of the selected style. Source
hashes, settings, outcomes and runner are saved in `review/`.

| Exact board | Human result | Baseline S | Candidate S | Candidate first wins | Candidate uncleared |
| --- | --- | ---: | ---: | ---: | ---: |
| Frozen G9 | 1 completed winning try, easy | 10.15 | 1.05 | 38/40 | 0/40 |
| factory2-184, 34 face-down tiles | 1 try, easy | 3.80 | 4.03 | 2/40 | 0/40 |
| Qualified 201 | No human result attached | 5.92 | 6.30 | 0/40 | 2/40 |
| Qualified 223 | No human result attached | 5.42 | 3.45 | 0/40 | 0/40 |

G9 now behaves as an easy puzzle. The face-down human comparison remains a
clear unresolved mismatch; one human win is not a population probability, but
the bot has not demonstrated the competence Dennis requested on this board.
On the original seed 4711, factory2-184 went from S3.90 to S4.63. Its mismatch
therefore persists across these seed settings. Qualified 201 also remains
weaker. Qualified 223 reverses its reported regression (originally 4.45 to
6.15), showing why one seed setting should not justify construction changes.
These four checks are targeted diagnostics, not a new comprehensive benchmark.

## Concrete implementation defects

1. **The claimed target-specific tray relief is incomplete.** In
   `candidate_controller.js:418-452`, `targetFace` is checked in one branch, but
   is dropped from the recursive call at line 452, and the base case accepts a
   match to any waiting face. An isolated invocation of the exact extracted
   function, with orphan face 7 and two other tiles both face 9, returns `true`
   although no tile can match face 7. This preserves the kind of false relief
   B1 claims to eliminate. Fixing it requires proper tray transitions as well
   as carrying the intended target through the search.
2. **Unblocking ranking reads the wrong bit word.** The new heuristic at
   `candidate_controller.js:1314` tests `nw0 >>> (bTile & 31)` for every tile.
   Tiles 32-127 belong to `nw1`, `nw2` or `nw3`. For live tile 69 with word2 bit
   5 set and word0 bit5 clear, this guard returns zero. It can suppress a real
   unblocking bonus according to an unrelated tile's status. `isFreeBits`
   correctly checks the word afterward, but cannot undo this false negative.

Neither finding is evidence of hidden-picture cheating. The changes inspected
use observed memory and public geometry. This is a scoped code review, not a
full certification of every inherited planning or observation path.

## Evidence and report limits

- B1 measured 10 of the 24 saved exact human boards. Face-down boards are
  included, but the report shows no reserved structural holdout, fresh diagnostic
  seeds, or a frozen sample of previously rejected/high-S builder boards beyond
  G9. The 18 other builder cases were already qualified.
- The saved benchmark JSON omits campaign outcomes even though the runner asks
  for `allResults`. It retains aggregates and does not establish the report's
  claim of complete reproducible outcomes by itself.
- `expectedTries` pools two blocks, while `firstTryRate`, `unclearedAtAttemptLimit`,
  `cleared`, and the censoring component of `valid` use only the first block.
  The report's summed 9 versus 8 uncleared counts therefore cover 600 selected-
  style campaigns, not the stated 1,200. The first-try percentages likewise
  describe first blocks. This behavior is inherited but must be handled
  correctly by the new benchmark report.
- `valid === true` is a timing/censoring summary, not proof of full test-suite
  coverage. No focused regression tests or test-run evidence were delivered
  with the six-file B1 commit. Existing engine execution is useful evidence;
  it does not validate the new heuristic claims.
- The report's 15/18 acceptance-band statement is misleading: its own scores
  put 12/18 inside 2.5-6, four below and two above. A real competence gain may
  correctly make boards too easy for that band; do not weaken the bot to keep
  them inside it.
- Candidate mean runtime is the selected style's reported time. Adoption should
  also count both styles actually executed. Cache/pin adoption is not simply
  a report edit: this candidate is not registered in `meter.js`'s bot versions,
  and pins retain the old entry point/fingerprint.

## Most useful continuation

Repair the two demonstrated planning defects with small causal checks, then
diagnose the actual decisions on factory2-184 against Dennis's recorded route.
Run the remaining exact human boards and a small reserved sample of different
builder structures, retaining pooled outcomes and explicit CPU totals. Repeat
borderline or regressing cases with fresh seeds before concluding that the
board needs repair. This is a focused competence experiment; broad testing
infrastructure is unnecessary.

Keep candidate measurements explicitly versioned. Changing behavior again
invalidates candidate-v1 ratings. Requalification and a deliberate skilled-pin
update come after evidence supports adoption; family difficulty remains a
separate unchanged measure.
