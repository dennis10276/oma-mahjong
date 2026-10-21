# Exact small-game public-belief checks

Implementation checkpoint: `7cd692041473f5a8ea1f93ac6dd4270218abd3c8`.
The historical catalog and optimization measurements below bind their own
archived policy/source epoch. A later complete recheck in
`reference-exact-check-2026-10-21T17-19-00-981Z` evaluates all eight graphs and
1,783 worlds with legacy, canonical continuation-pruning and optional combined
information-escape policies. All 24 evaluations attain the exact initial
public-information optimum, with zero unresolved or strictly suboptimal
visited choices. This reuses already production-grounded graphs, not a new
all-branch physical replay. Canonical settings enable continuation pruning;
the more expensive information escape remains experimental.

## Purpose and boundary

These checks strengthen the existing reference's evidence, not a new
attempt-count predictor. They reuse the production physical session and current
reference policy. No production rules or concealed-picture access were added
to the reference.

The input is an explicitly declared **synthetic public inventory**, not an
inventory extracted from a real board. All distinct deals consistent with that
inventory and public opening constraints have equal prior weight. Opening
constraints must be initially visible, not covered or face down. Passing a
private game with a `faces` field is rejected. The reference itself receives
only public geometry, observed-picture memory, public physical state and legal
taps; reading its private-deck getter throws.

This prior is not asserted to be the app's actual deal distribution. In
particular, some synthetic clock deals are physically unwinnable even if the
real generator would reject them. Do not turn these results into personal
forecast accuracy, a claim that the real80% gate is impossible, or permission
to inspect a real hidden inventory.

Current exact scope: at most10 tiles, completely aligned stacks/separated
columns, perfect recall of observed pictures, fixed1000ms taps, no Jokers,
variable timing, obstacles or arbitrary partially exposed edges. Ordinary
public arrival flags are retained. This is a declared structural observation
contract, not a screenshot-perception proof. Other mechanics remain covered
by existing production/reference tests, not by this exact oracle.

## Why the optimum is exact

`public_belief_exact.js` enumerates the full public-belief transition graph.
Every world/action branch executes actual production `createSession` actions;
it does not reveal a particular actual hidden board in hypothetical planning.
Beliefs condition on the resulting public observation and remembered pictures.
The seed is the declared constant73, not a hash of a private deck.

Inspection loops are strongly connected components, not artificial game
losses. Within a component, a transition that preserves the whole belief is
deterministic; exits go to later components. Values are integer successful-world
counts over integer belief sizes, with no fitted threshold or floating-point
convergence claim. Node/hypothesis/replay limits return **unresolved**, with no
winning probability, rather than a physical defeat.

Three separate checks establish different parts of the evidence:

- `public_belief_support.js` independently checks conditional-multinomial
  cardinality, unique worlds, inventory membership and public opening
  constraints. A conveniently omitted hypothesis cannot improve the metric.
- `public_belief_certificate.js` does not use the solver's SCC implementation.
  It checks a rational Bellman upper bound for every action and an attaining
  policy whose rank decreases on every chosen branch. Together these prove
  optimal reachability on the supplied finite graph, including cycles.
- `public_belief_grounding.js` independently reconstructs observations from
  aligned geometry and earlier-only memory and replays every representative
  history and legal world/action branch through production. The unit test
  deliberately fabricates a graph that passes abstract Bellman checks but
  fails actual production grounding.

Reference histories are checked for legal graph traversal, correct terminal
outcomes, declared numerical censoring, and identical choices under identical
complete public histories across hidden worlds. An omniscient strategy is not
mistaken for an information-limited policy.

## Complete measured catalog

Source-bound eight-case run:
`source/analysis/archive/personal-bots/public-belief-exact-2026-10-21T16-16-59-640Z`.

| Case | Prior worlds | Exact public optimum | Current reference | Physically clearable with hidden identities |
| --- | ---: | ---: | ---: | ---: |
| clock-first-control | 1 | 1 | 1 | 1 |
| four-hidden-pairs | 6 | 6 | 6 | 6 |
| three-two-high-columns | 6 | 6 | 6 | 6 |
| three-deep-unknown-clock | 60 | 60 | 60 | 60 |
| mixed-peeks-clock | 60 | 60 | 60 | 60 |
| short-column-clock | 30 | 30 | 30 | 30 |
| four-deep-tight-clock-risk | 360 | 234 | 234 | 234 |
| two-unseen-kinds-route-risk | 1260 | 936 | 936 | 998 |

All eight completed, none capped or excluded. There are56,371 belief states and
1,783 distinct synthetic deals across the catalog. Independent producer-side
grounding checks297,221 world/action branches, using519,163 production prefix
replays and2,102,778 physical taps; repeated prefix taps are not independent
games. The current reference attains each initial public-belief optimum and
has no strictly suboptimal choices on its measured histories. This does not
prove it optimal on all counterfactual states, larger levels or other priors.

The final column is deliberately **omniscient audit-only** reachability,
computed separately by `public_belief_physical_bound.js`. It is never passed to
the policy. The tight-clock control has126 physically unwinnable deals, not126
avoidable bot mistakes. The last case has262 physically unwinnable deals and
a further62-world gap caused by hidden-information restrictions. Comparing
only with an omniscient winning route would misclassify that gap as bad play.

The original six-case run is retained at
`public-belief-exact-2026-10-21T16-13-47-149Z`. Its full separate-process
verification repeats production grounding for all5,602 states. The expanded
eight-case run additionally passes independent source/artifact/prior-support,
Bellman/policy and reference-history verification; that graph-only verification
explicitly does not claim to be a second physical replay.

## CPU profiling and source-pinned batches

Profile `physical-profile-2026-10-21T16-26-48-936Z` records an actual production
prefix-replay workload and raw V8 CPU profile.458/1110 self samples,41.26%, have
the physical-session `compile()` source-check function in their ancestry.
This includes repeated source reading/hashing and first compilation, not GPU
arithmetic.

`createSessionFactory()` now pins the already verified production engine for a
batch and provides explicit `verifySource()` validation. Standard
`createSession()` retains per-session source checks. Both construct independent
production sessions with identical rules, RNG, inputs, outputs and audits.
Changing the source causes factory validation to fail; a numerical limit is
still unresolved. The exact solver and independent grounding validate their
factory at completion, and the outer experiment independently checks its full
source closure.

Controlled profile A/B:
`physical-batch-ab-2026-10-21T16-31-01-644Z`. Each trial uses the same128 evenly
spaced states,1700 sessions and9965 taps, with both constructors warmed before
timing. Standard/bound times are1492/770ms and1484/772ms, approximately1.93x
throughput. Every selected physical result is checked against the archived
graph; raw sources and case hashes are bound before measurement. This is a
replay-kernel measurement, not yet an end-to-end whole-catalog speed claim.
CPU fallback remains available. CUDA has not been added without an appropriate
profiled numerical bottleneck or production-parity evidence.

A complete source-pinned eight-case repeat finishes at
`public-belief-exact-2026-10-21T16-31-38-141Z`. Independent archived-source,
input, whole-catalog and direct compressed-byte comparison confirms all eight
graph/certificate/grounding/reference artifacts are identical to the uncached
run, including every world history. Measured complete-case durations total
614,888ms before and265,508ms after: **2.316x** speedup on this workload, not a
general guarantee. The cached run separately passes prior-support, exact policy,
public-history and artifact verification. Standard constructor parity and
changed-source detection tests pass. Full offline personal-bot suite:201/201
in9 seconds, output `reference-exact-js-tests-2026-10-21.txt` in the personal-bots
analysis directory. All10 original reference-baseline source hashes still
match; no reference decision policy or production Hard physics was changed.

## Commands and outstanding scope

From this checkout:

```powershell
node source/tools/sim/refit/test_public_belief_exact.js
node source/tools/sim/refit/test_production_session_factory.js
node source/tools/sim/refit/personal_public_belief_benchmark.js
node source/tools/sim/refit/personal_public_belief_verify.js source/analysis/archive/personal-bots/public-belief-exact-2026-10-21T16-16-59-640Z --graph-only
node source/tools/sim/refit/personal_public_belief_compare.js source/analysis/archive/personal-bots/public-belief-exact-2026-10-21T16-16-59-640Z source/analysis/archive/personal-bots/public-belief-exact-2026-10-21T16-31-38-141Z
```

Verification writes exclusive new evidence files; existing verified runs are
not overwritten. Use a fresh benchmark directory for repeated verification.
Frozen verification sources are also retained beside each report. Full
physical replay requires the pinned engine/helper source closure, not a silent
mix of newer files with an old run.

Implementation remains uncommitted. There is no universal optimality,
human-possibility or future personal-accuracy certificate. Next work must extend
exact coverage to more mechanics and diagnose the six remaining real
research/control tray failures, while keeping screenshot evidence separate.
