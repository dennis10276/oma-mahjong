# A second constructive search on fully known boards

Default remains adopted23. Trials24-27 are unadopted; consecutive count4.
This optional portfolio is not adopted and no campaign28 is registered yet.

## Strategy and bounds

Preserve the entire primary pipeline, including retry-information search and its
existing priority/budgets. If its result is neither a known win, safe clock exit
nor proved loss, and every remaining picture/orientation is actually known,
try a diverse-root beam using only the time left before the shared1800ms deadline.
The extra allowance defaults250ms and4096 reported search nodes. Unknown-memory
positions keep the primary result without a second search. Existing wins/exits
and death proofs are protected.

The secondary may replace the primary only after an independent known-only
walk verifies a complete win or a safe clock-exit prefix. Every step must be
legal, supported and non-losing. Incomplete routes, uncertain roles, clock loss,
invalid paths and deadline exhaustion never become wins. Otherwise retain the
primary move and record extra-work metadata. The secondary never changes actual
observations or supplies a hidden picture. Attempts still replay production.

Known-witness search now has an optional finishKnownMaxTaps, default96 exactly
as before. The secondary can use up to256 taps, capped by remaining physical
choices, so a complete remembered route longer than96 is not ruled out solely
by the old witness horizon. Node/time limits still bound the search. The clock
prefix validator also rejects an unavailable path step before advancing it.

knownWitnessPortfolio:true enables the component. Optional knownWitnessMs and
knownWitnessNodes require it. It wraps the full primary pipeline rather than
consuming the retry-information allowance first. Reported primary/extra nodes and
selected-witness metadata are separate. Optional run statistics reach measure();
the unlabeled API and default23 profile remain unchanged.

## Validation

132/132 human-reference tests pass17s(native91462 exit0). Focused unit02 checks
protected primary results, incomplete memory, invalid/uncertain witnesses,
expired time and physical-choice budgets, node accounting, a real safe clock
exit and the measured API.108 explicit physical taps independently replay,
including a fully public100-tile complete route beyond96 taps and a clock clear.
Supplied search reports isolate wrapper behavior; they do not prove a research-
level improvement. No proof or observation is obtained from fixture hidden data.

Current sourcec597e66f7b8ee0d70362f7078c347d7ccdb04c45d8aaadc622ac60b55be57a64,
72 runtime files. Proposed profile8cd636bf45c7cad75d8faf1fd2afb898606b5b7b8def763f0c276acbf15a69dc:
retained23 plus rememberProvedContinuations:true and knownWitnessPortfolio:true.
Unlike the prior cache-only diagnostic, continuationTrayMin remains the default3.
This tests a different search route together with retained public loss proofs.
No unadopted route preferences or inspection-successor option are enabled.

Next compare actual23 histories on86/salt3,32/salt1 and102/salt1. Require native
completion, zero baseline drift, independent production replay and<2s decisions.
Count verified secondary witnesses separately from physical campaign clears.
Freeze all72 actor files while these comparisons run. A later campaign still
uses unchanged42 development boards/20 guards and full159/salts1-3 before any
complete-target-repair/no-passing-regression adoption. The full goal stays unmet.

Raw .codex-runs/level-measure/: known-witness-portfolio-unit-01/02.log,
known-witness-portfolio-suite-01/02.log, compare-known-witness-portfolio.js and
compare-known-witness-portfolio-full.js. No forecast or personal accuracy claim.

## First real-history results: eligibility, not a failed secondary search

Native21786/97753/56045 exit0. The86/salt3,32/salt1 and102/salt1 comparisons
reproduce249/242/178 physical taps, zero baseline drift, and0/3/0 changed
suggestions respectively. The32 differences occur late, as in the cache-only
diagnostic. All669 taps independently replay; maximum baseline/candidate times
1552.7/1556.0ms,1642.5/1640.1ms and1292.5/762.4ms. They establish no target repair.

The portfolio searches zero times: every otherwise eligible decision is filtered
by incomplete memory(110/119/65 cases). The actual86/salt3 history ends try1 and
try2 at85/88 known pictures, and reaches88 only on its third, already winning
attempt. Therefore a fully known-board solver alone cannot address its earlier
failure; this result must not be reported as a failed diverse-beam search.

Next retain constructive validation while permitting a live public clock's
known safe exit even if unrelated pictures remain unknown. Separately investigate
the existing broader public-information frontier, rather than assigning those
unknown pictures or discarding the alternate strategy after it never ran.
No campaign28 has been registered for the original configuration.
