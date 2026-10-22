# Required next work after the v8 audit

This is an implementation assignment, not permission to promote verifier v2.
Read the full original contract and AGENTS.md first. Protected v1 remains the
acceptance authority. All existing candidate ledgers, including v8, stay unchanged.

1. Repair the actual human-action dataset and personal-policy evaluation. The
   current evaluator samples only the first 20/30 held-out decisions and its
   teacher-forced ranking path does not maintain legitimate observed memory.
   Evaluate later chronological blocks across multiple complete games, separately
   from development/tuning blocks. Preserve missing and ambiguous events and exact
   board/campaign/opening/completion/availability provenance. Use the same reviewed
   observer and persistent-memory mechanism as the production personal simulator.
2. Implement and measure the missing G3 behavior, not just above-random top-1:
   action probabilities and calibration, inspection/reinspection, clock/key
   preparation and abandonment, route/retry changes, risk choices and relevant
   timing. Compare generic/simple references and alternative personal models.
   Compare recency weighting, rolling windows and change-point adaptation on proper
   chronological validation. Do not infer these mechanisms from parameter bounds,
   pairing span alone, or the new component unit tests.
3. Use `independent_tray_metrics.js` to recompute distances from raw counts.
   Include sample counts, per-game records and independently held-out blocks.
   Its PASS proves metric arithmetic/integrity, not equivalence. Propose and justify
   a tray equivalence protocol before the final test block is inspected; do not
   resurrect the arbitrary TVD <= .50 / W1 <= 1.25 definition of fidelity.
4. Design a preregistered Monte Carlo precision protocol after policy development.
   `independent_mc_metrics.py` supplies a conservative fixed-sample, family-adjusted
   expected-score error bound and validates outcomes; it is a proposal, not a
   promoted criterion. Do not call the old half-split W1 <= 2.5 test convergence.
   The v8 6-16 adaptively stopped samples do not satisfy this fixed-budget protocol.
   Justify any alternative sequential procedure mathematically and preserve every
   seed/run, genuine loss, clear, no-clear and censored result. Do not launch large
   redundant simulations merely to appear active or improve an unvalidated policy.
5. Once a genuine improved policy and evaluation procedure are ready, create a
   distinct future candidate draft. Do not copy v1's cohort start or frontier
   blindly. The first-20 v8 cohort already has 7 Doubtfire, 5 PUK and 14 Gerda
   openings without eligible v8 before-opening forecasts. Later games cannot
   remove those missing forecasts; retain v8 as an incomplete/invalid prospective
   candidate, not a future success waiting only for data.
6. Integrate `register_personal_candidate.js` into the next generator. A draft has
   `generatedAt`, model/policy/protocol identity, source/input hashes, explicit new
   frontiers and at least 20 exact-board targets per person, but NO inherited
   `frozenAt` or `cohortStartsAfter`. After numeric generation obtain a fresh separate
   live opening export. Register only via the helper, which rebuilds that export,
   checks source bytes and unopened targets, sets the actual registration timestamp
   and a new cohort start together, and creates a new ledger exclusively. A stale
   snapshot is not proof of unopened status. Later evaluation must still detect
   race-opened cases and retain missing/pending first-20 games in the denominator.
7. Add requirement-specific adversarial and integration tests. The component
   isolation harness proves narrow parameter effects only; it does not demonstrate
   learned human behavior, all planning controls (including clockPatience), or close
   178 clauses. Submit proposed protected bindings individually with actual output,
   precise claims/limitations and source/input/commit provenance. Continue other
   meaningful offline implementation while independent promotion review is pending.

Keep appending honest experiments and failed variants. Do not edit generated RTM
statuses or protected files. The local installer now accepts a validated versioned
destination, but NO v2 payload or criterion is approved by this change. An
administrator must not install an unreviewed payload just to obtain green gates.

Run the absolute protected verifier after substantive changes. Report its actual
nonzero result, and distinguish passing infrastructure regressions from unverified
personal fidelity and unmet prospective accuracy. Stop only when the original
contract permits an explicitly incomplete external-dependency checkpoint, after
all meaningful independent work has been exhausted.
