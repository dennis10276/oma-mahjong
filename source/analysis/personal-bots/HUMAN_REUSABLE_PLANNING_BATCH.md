# Reusable public planning across retries: authorized batch32-39

Dennis explicitly authorized: "Authorize reusable planning across retries, with
up to eight new experiments." Prior unadopted24-31 remain in their stop report;
this is a new allowance, not a retroactive adoption or erased failure history.
Default23 remains. Goal A then B unchanged and unmet. No new measured trial yet.

The architectural change is to suspend and resume unfinished known-only search
frontiers instead of restarting their visited set and search stack on every
call. Keep multiple public-root jobs across intervening moves and attempts.
Never promote a suspended hypothetical state or an imagined picture to memory.

| Requirement | Required evidence | Initial state |
|---|---|---|
|Incremental work survives a bounded call|Small repeated budgets find a route a restarted budget cannot; counters prove resumed work|unit verified|
|Different roots coexist across moves/retries|Alternate roots, then resume the original job without discarding its frontier|unit verified|
|Knowledge and role changes invalidate reuse|Explicit public-model version; changed pictures, roles, legal roots or horizons cannot inherit stale exclusions|explicit-version/knowledge/root tests pass; real context pending|
|Only constructive routes can affect play|Revalidate every prefix under current public rules; information is not a complete win|win/exposure/peek and stale-route tests pass|
|Bounds remain honest|Unknown transitions, caps, deadlines and eviction stay unresolved; no inferred impossibility|unit verified|
|Actual physics and hidden invariance|Paired concealed fixtures and independent production replay|69 taps across49 concealed worlds/known controls verified|
|Persistent controller lifetime|Job store survives planner/attempt reset; capture actual cache hits on recorded histories|3 physical attempts prove8 unfinished resumes; real histories pending|
|Strict time and memory bounds|Single-thread cooperative steps, shared<2s deadline, finite job/state caps|unit bounds pass; real move timing pending|
|Adoption protocol unchanged|Same42 development/20 guards; full159/salts1-3; repair>=1 and no passing regressions|pending|

First implementation integrates with the existing stalled-retry/public-information
search. Its positive goals are a complete known win, known safe geometry exposure,
or a required actual peek preceded by a known safe prefix. No sampled board or
private inventory. A budget stop preserves the job rather than certifying failure.

The controller supplies a version of the PUBLIC transition context: remembered
pictures/orientations/roles, observed availability evidence, known keys, public
rules, actual root state and current takeability. Conservative version changes
restart a job. Verify real reuse before measuring; do not call an inert cache a
planning improvement. Jobs persist across intervening decisions, with bounded
eviction. Returned paths are rechecked under current capabilities before selection.

Keep primary complete wins/safe clock exits and the retained policy as controls.
Measure actual changed decisions, independent physical outcomes and hit/expansion
counters. The first campaign is32; at most eight newly measured trials before a
fresh continuation decision unless adoption changes the stated stop condition.
The final personal calibration and unseen20 are not replaced by this milestone.

## First implementation and verification

public_reusable_exploration.js owns bounded generator jobs. Each cooperative
step is a work unit, not a claimed entire graph-node expansion; returned nodes
charges those units to the existing allowance. The jobs retain stack, candidate
cursor and visited distances; alternate roots do not overwrite each other.
Job identity includes the public transition version, complete public root state,
allowed roots, horizon, geometry, rules and clock. The initial implementation
reuses an exact root, not an unvalidated reroot into a different knowledge model.
This distinction must remain visible in real reuse counters.

The retry-information object persists for the controller lifetime, surviving
resetPlanner() and beginAttempt(). Its new reusablePublicPlanning flag requires
the existing retry-information/full-public-exposure options and exposure-first
policy. It replaces only that secondary search; normal primary win/clock exits
and all default23 options remain. No new measured campaign is registered yet.

134/134 tests pass17s(native57710 exit0). One-unit resumption reaches a complete
known win while fresh one-unit searches never do. Physical integration across
three attempts records12 calls,4 jobs,8 unfinished resumes and4 expanded states.
The deliberately losing fixture tests lifetime only, not benchmark winnability.
37 concealed-back worlds and12 covered-geometry worlds plus controls replay69
physical taps. No hidden values enter planning, and proof routes stay separate
from picture memory. Current deadline revalidation and stale capability rejection
are tested, including changes without a correctly updated caller version.

Source834936f1b6607ccec6940fada54c9ac017ba33f46f6b9ff4ad9de376e815ed2e,
73 runtime files. Proposed diagnostic profileeecea0816bca9702e00c361f768811727434b7ec708a5c7d75bbd0033bc5075d:
retained23 plus reusablePublicPlanning:true only. Raw reusable-exploration-unit-
01/02/03.log and reusable-planning-suite-01/02.log in .codex-runs/level-measure/.
Real32 and passing clock-control histories must demonstrate useful reuse before
a campaign. If conservative versioning prevents hits, fix that rather than
spending a trial on an inert store. Freeze all73 actor files during comparisons.
