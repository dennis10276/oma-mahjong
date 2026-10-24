# Human-information reference: Dennis gate

Worktree: `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review`.
Branch: `wip/personal-bots`. Goal ACTIVE and UNMET.
Recent progress: causal transfer of actual safety memories improves the full
development result to141/155 with no previous pass lost. Fourteen still fail.
Do not redefine completion around a subset, a percentage, or an isolated pass.

## Contract and completion evidence

1. ONE game-state geometry gate; no screenshot/pixel/pose/dictionary track.
   Only actually visible or remembered pictures/roles and sound public deductions.
   Never read hidden pictures, the deck, the level seed or actual future reveals.
   Updated objective7af79a6f-2084-4990-8660-5048fc815147 explicitly allows the
   public fact that a geometrically free unclickable tile has ice or a lock.
   It also permits hidden-tile guesses that favor a still-winnable current state.
   Guesses are hypotheses, never observed facts, known-win routes or real loss
   certificates. They must not read actual hidden identities or future reveals.
2. Include EVERY Dennis first clear, plus later clears. Count actual starts and
   restarts. Dennis1 requires bot1; Dennis2+ requires strictly fewer tries.
   Initial134/141/143/147 fixes must remain clear. A bounded failure is not
   impossibility, hidden luck, or permission to peek.
   An impossibility report now requires the exact position, loss share for EACH
   possible move among consistent hidden fillings, and why none is known safe.
   Biased or bounded hypothesis samples do not establish those exact shares.
3. General planning only, never per-level policies, routes, seed choices or best-of
   merging. After development passes, freeze for the next20 untouched progression
   levels and compare against Dennis when played.157+ remains unopened.
4. Decisions under approximately2s. Shared1500ms search deadline includes guards,
   alternative roots and proofs; observed-frame projection is included in timing.
   The updated goal requires single-thread anytime sampling:stop and decide at
   the shared deadline. Extra computing speed buys better decisions, not latency.
5. Small curated commits; one short Markdown table per run, no large analysis logs.
   Final handoff, only when done: one-screen level|Dennis tries|bot tries table,
   planner changes and any required human decision.
6. User added15 special-heavy lab boards on2026-10-24. Imported exact
   `source/analysis/lab-clears.json` and the supplied quick baseline table from
   `origin/wip/level-variety` at7216ac148741593b815b535bf86d63b5509e3404.
   Keep all16 source rows; exclude ONLY10031 from scoring as explicitly requested
   because it has overlapping roles. The other15 join natural recorded clears in
   the development gate with the same tries, production replay, visibility and
   timing rules. Full combined CLI:`--development`; `--live` alone no longer
   claims the complete development gate. Final lab results need a separate block.
   Supplied baseline53f413b:7/15, equal10049, seven uncleared after12 attempts.
   Identical repeated failures need investigation; they do not establish loss.

The development gate and unseen20 gate are both still open. Do not mark complete
or blocked. There is useful algorithmic work available, not an external blocker.

## Latest full expanded development result

**141/155**, unchanged source, mean**85.1ms**, slowest**1505.7ms**.
Report:`HUMAN_REFERENCE_CATALOG_CAUSAL_AVAILABILITY_2026-10-24.md`.
Completed2026-10-24T07:52:26Z (canonical report timestamp); runtime3081a3a.
Natural**132/140**, lab**9/15**. New gainlab12try5 vsDennis6; no previous pass lost
against full140/155. Independent table/source audit found no other try-count change.
Original134/141/143/147 alltry1.
Natural failures:**81,93,99,102,107,112,125,137**.
Lab failures:**11,32,33,41,49,52** (encoded10000+id).
All155 unique rows, natural17–156, lab15, only10031 excluded, strict try scoring,
input hash, unchanged source, old labels/provenance and maximum timing were
independently checked from the canonical table. The unseen20 gate is not run.
The full goal is NOT complete; keep all14 failures in scope.
Previous full140/155:32f493a,mean85ms,max1505.4ms, report
HUMAN_REFERENCE_CATALOG_PLACEMENT_CONTRACT_2026-10-24.md.
Previous full139/155:d7778dd, mean80.7ms,max1506ms, report
HUMAN_REFERENCE_CATALOG_CLOCK_INFORMATION_2026-10-24.md.

## Previous full natural result before lab expansion

**130/140**, unchanged source, mean**151.5ms**, slowest**1529.9ms**.
Report: `HUMAN_REFERENCE_CATALOG_SHORT_ROLES_2026-10-24.md`.
Runtime checkpoint:`b2d3c5f`, using `passiveInformation:'shortRoles'`.
Fingerprint:`5df95cb01cd2179c69fa98495b1b500f69572ff1a8e83fd0f899247f9ac182af`.

Failures:**81,84,93,99,102,107,112,124,125,137**.
Classic35/35; current-fixed24/24; version-table20/24; recorded openings51/57.
Original134/141/143/147 all pass on try1.50/85/86/92/123/150 gains remain clear.
Recent131–156:25/26, failing137.151–156 all clear on try1.
111 now clears on try2 and121 on try3 in this complete run, improving the old
128/140 result.111's earlier screen/full disagreement still warns against
extrapolating isolated passes or merging different profiles.

Read-only metadata refresh2026-10-24T00:46:27Z:140 first clears through156, no later
clears, zero boards decoded. Refresh metadata only with selectedLevels:[].
Dennis authorized count comparisons without old17–99 recordings on2026-10-22.
Prefer exact opening, then original-version fixed table, current fixed definition,
then current classic/aspect1.5. The last two are explicitly NOT historical-identical.
Keep every unavailable board/label unresolved, never silently exclude it.
Old-level replays restart at try1 and do not replace first-clear targets.

## Current runtime and active experiment

Best full runtime:`3081a3a`; full141/155 policy includes causal memory.
Current optional hypothesis candidate adds narrow-first rollout and actual-state visit guards.
No new full score is claimed. Goal ACTIVE, UNMET. Guarded trial3967 exited0.
All earlier trial/diagnostic jobs are terminal. New structural legality cache is
integrated into hypothetical rollouts; comparative trial73067 is live. Keep its
loaded source unchanged until terminal; only one heavy simulation is running.
**86/86 offline tests pass** in9s, including7488 concealed-world controls,
675 accepted availability controls,380 cleared-role subset controls,144 local
recoveries,24 relief witnesses and original-production replay.

COMPLETED:session44060, started2026-10-24T05:49:18.275Z. Serial natural42 then lab15.
Reports:HUMAN_REFERENCE_PLACEMENT_CONTRACT_CHALLENGE_2026-10-24.md and
HUMAN_REFERENCE_LAB_PLACEMENT_CONTEXT_2026-10-24.md.
Source:`0c85b8bf0780c4566175c26b15a0afacc32ca4fc35a67520d00c3a87e72df364`.
Natural input:`c679dc1c90873909039749b8467970652c3973ec4b8c7f6d9f4624c327460ac5`.
Natural34/42, mean65.3ms, maximum1503.8ms; lab8/15, mean83.6ms,max1212.3ms.
Both source-unchanged. An independent parser checked matching profile, labels,
board sources, all lab try counts, strict PASS scoring and timing. No pass
regressions:124 nowtry2,121 improves3 to2,92 worsens2 to3 but still beatsDennis5;
147 remains1. No full155 score is extrapolated.

COMPLETED:session26989, started2026-10-24T05:57:39.306Z, full --development155 with
the unchanged profile below. Report:HUMAN_REFERENCE_CATALOG_PLACEMENT_CONTRACT_2026-10-24.md.
Source remains0c85b8bf0780c4566175c26b15a0afacc32ca4fc35a67520d00c3a87e72df364;
full input00883d1f307092113d611f10fc165a7a2e90aa071d6a5381332464530f026ee9,
identical to the earlier full155 input. Independent canonical-table audit verifies
155 unique targets, natural17–156 plus exact eligible lab15, unchanged labels and
provenance, strict try scoring, source unchanged, profile equality and maximum
timing.140/155,132 natural+8 lab; only new pass124, no pass regressions. The run
is terminal and its source freeze has ended. No CPU-heavy simulation remains live.
This is development, NOT unseen20;157+ remains unopened.

COMPLETED:session17435, started2026-10-24T06:35:00.383Z, runtime59d441f.
Source24948314e07715c5ab30b629db59c6d857d0f931697b028743a8758734e96443.
Serial phases:LAB_CLOCK_RETRY_CONTROL (15, actual retry learning, clock extension
off),LAB_CLOCK_RETRY (same15 with extension on),CLOCK_RETRY_NATURAL_CONTROL
(92/111/121/123/124/134/141/143/147/150 with extension on). All report stems start
HUMAN_REFERENCE_ and end_2026-10-24.md. The lab phases both completed8/15 with
source unchanged; mean/max84.3/1224.7ms off and84.8/1244.6ms on. The extension
reports ZERO audited-plan and adopted-plan decisions on all lab boards. Natural10
completed10/10,mean96.3ms,max1504.6ms,also zero clock audits/adoptions. Independent
table audit verified identical lab tries, source unchanged, strict scoring and
timing. No clock-extension campaign improvement is claimed. The source freeze is
over; no simulation remains live. Report:CLOCK_RETRY_NATURAL_CONTROL.

Now optionally integrated helper:public_availability_transfer.js.
Its standalone test passes4656 production-world proofs, including3108 transfers
beyond alive-mask subsets, and replays two different complete winning routes.
Original-rule safety while an actually known key remained alive excludes lock;
equal sufficient ice-neighbor removal counts can then replace exact removals.
If both actually known keys were gone, both must remain gone. Unknown second keys,
restored covers, insufficient ice removal and resurrection of initially absent
tiles are refused. Only the declared zero/two-key and at-most-two-hit contract is
used; no picture, role, deck or seed is read. Helper geometry is public and copied.
causalAvailabilityMemory requires exclusiveRoles:true and at least one actual
accepted/cleared safety memory. It feeds ONLY initialRoles' actually observed
immutable keys, retains after-relief rejection, old subset fallback and geometry
checks, and records no hypothetical query as an observation. The actual campaign
validates the supplied ice-neighbor graph against public geometry before play.
Debug counters report proof queries, including hypothetical positions, not learned
facts or wins. Standard closed-body certainty is checked before these callbacks.
The new real actor fixture loses on one route, takes a different thawing route on
retry, proves a closed tap without re-observing its role, and physically clears
both controls. The hidden initial ice stays unknown.76/76 tests pass, including
7296 concealed-world controls; no campaign gain is inferred before benchmarking.

Session11421 completed the causal-memory lab15 screen9/15 (new passlab12try5
vsDennis6), mean103.2ms,max1502.6ms. Report:
HUMAN_REFERENCE_LAB_CAUSAL_AVAILABILITY_2026-10-24.md.
Sourcea943da0ec0c91f46d8d122dbe1a41cb30d2a8e96a71a7b18b47c22f90d1a2e61;
input4e5a9c9870dac977f024c3700b6c4813b5cdf463f6f9b63dcd37ecbd1dde5d17,
source unchanged.264578 successful public transfer proofs in607076 queries;
these include hypothetical positions and are NOT observations. Existing lab passes
retain their try counts. This does not establish a new full155 score.

Its subsequent natural42 phase stopped before emitting any row:the strict
ice-neighbor validation compared sandbox array prototypes rather than just graph
values. Trusted audit of50 found ZERO neighbor-value differences, but native inner
rows versus sandbox inner rows. The validator now normalizes BOTH outer and inner
containers with Array.from before sorting/comparing. No graph edge or physics
assumption is weakened. A real sandbox-generated full campaign passes; a genuine
changed-neighborhood fixture still rejects.76/76 tests pass. The failed natural
phase produced no canonical table. Its replacement natural42 run, session25830,
completed34/42 with no previous pass lost, mean63.8ms,max1505.4ms. Report:
HUMAN_REFERENCE_CAUSAL_AVAILABILITY_CHALLENGE_2026-10-24.md.
Source3ee9ad33f605375dbb68b7db4fc376bea325c24b7436f7877daa11eb1407eb6e;
inputc679dc1c90873909039749b8467970652c3973ec4b8c7f6d9f4624c327460ac5.
466 successful public proofs in787 queries. Original134/141/143/147 stilltry1.
Keep lab9/15 at its recorded source; do not merge hashes into a full score.
Retry-risk and clock-learning options are OFF in the causal profile.

COMPLETED:session95132, started2026-10-24T07:29:58.786Z, unchanged-source full155.
Profile:the full140 policy below plus causalAvailabilityMemory:true, no other flags.
Source3ee9ad33f605375dbb68b7db4fc376bea325c24b7436f7877daa11eb1407eb6e;
input00883d1f307092113d611f10fc165a7a2e90aa071d6a5381332464530f026ee9.
Destination:HUMAN_REFERENCE_CATALOG_CAUSAL_AVAILABILITY_2026-10-24.md.
141/155,132 natural and9 lab; mean85.1ms,max1505.7ms. Independent canonical
audit checked all155 unique targets, unchanged human labels/provenance/input,
strict scoring, original134/141/143/147try1, exact profile, current source hash and
no previous pass lost. Only lab12 changes its try count, now5 vsDennis6.
265044 successful public proofs in607863 queries, not new observations.
No CPU-heavy simulation remains from this run.77/77 offline tests pass afterward.
Metadata refresh2026-10-24T07:17:56.699Z found140 natural first clears through156,
zero boards decoded and no newer clears.157+ remains unopened. The earlier
public-uncertainty diagnostic is no longer live, but its stdout was lost at context
compaction; no inference or result is claimed from that missing output.

New standalone helper, NOT imported by the frozen full155 runtime:
public_paired_picture.js infers one final unknown original identity only when
ALL other original tiles (including removed tiles) have remembered identities
and an explicit pairedInitialPictures opening contract applies. It uses original
memory, never parity of the remaining board/tray, which avoids assuming anything
about later Joker effects or arrivals. Multiple unknown positions remain unknown;
a known multiset alone does not assign identities to locations. No orientation,
role or takeability is inferred. No private inventory or future reveal is read.
Its registered standalone test passes35472 public-memory masks in588 exhaustive
paired worlds,3432 sound deductions including Jokers, and four complete routes
independently replayed through Hard.play. Standalone runtime0.37s. The latest full
suite now passes77/77 after the full run ended.
Committedacc751c, then d8ec5e6 rejects sparse memory arrays rather than skipping
missing entries; the same standalone controls and production clears pass again.
No campaign gain is claimed for the single-picture helper. All155 opening bounds
are now independently validated below, but the cold8 diagnostic shows no usable
single-unknown opportunity on those failing routes.
Earlier partial trusted opening audit2026-10-24:all15 eligible lab boards and118 cached
natural openings across63 levels(53–150) have even initial picture counts. No
picture, inventory or seed was supplied to a policy. This is NOT yet the full155
input audit. Layouts.makeDeal obtains paired faces from pairFacesFor and deal;
Hard's hdeal consumes a pair pool, and its optimization swaps preserve counts.
UI Joker replacement changes an exactly-two picture into two Jokers. These are
opening properties; no claim about parity of a later remaining board is needed.

Fresh cold8 baseline session80541 completed2026-10-24T11:12Z. All eight natural
failures still lose to tray pressure on try1. Metadata still140 first clears,
newest156, no newer clears and no157+ board decoded. Public-only diagnostic:
HUMAN_REFERENCE_COLD_UNCERTAINTY_2026-10-24.md. Every loss still has at least6
unknown alive pictures, so the final-single-unknown helper cannot fix these routes.
All last unrecovered third-carrier commitments occur after their clocks are gone.
Next work follows the new objective:negative mechanical observations plus bounded
public-only hypothesis sampling, preserving known physical witnesses and the same
shared deadline. Do not substitute more parity-only work for the cold failures.

New optional actor flag rememberBlockedTaps records only an actually rejected,
geometrically free tap, separately from picture/role memory. It does not label the
unseen obstacle ice or lock. A stored obstruction remains certain when no more
ice neighbors are removed AND a possible lock stays active, or both actually
observed keys were already gone at the original rejection. Facts can transfer
across actual retries and different removal routes; relief disables them. An
unrelated removal must not erase the observation, while a thaw/unlock may make it
uncertain again. Public frontier filtering happens before hypothetical relief.
The campaign validates ice-neighbor geometry for this flag and reports retained
actual fact counts. Default remains OFF until measured. Standalone proof suite:
5336 production-rule controls,4492 non-subset transfers. Real actor fixture retains
one rejected probe across unrelated moves and an actual failed attempt, then
physically clears both controls; all accepted taps independently replay. It never
learns the hidden original ice identity.79/79 offline tests pass in9s, including
7488 concealed-world controls. No new full campaign gain is claimed.

COMPLETED:session11316, started2026-10-24T11:26:07.269Z. Same full141 profile
plus rememberBlockedTaps:true on the eight cold failures and all15 lab boards.
Report:HUMAN_REFERENCE_BLOCKED_TAPS_CHALLENGE_2026-10-24.md.
Source21ca235aff2184e5e911b1fff17d0493a21ea343e93e4a5d2dac7f7a5845dc67;
input85df19d5b4f0f0a0d3d557cb0262e013675739a0a563dee72f69adc66e64b19e.
9/23,mean110.9ms,max1504.8ms,source unchanged. ALL try counts match the prior
full141 rows, with ZERO retained rejected-tap facts. Independent table audit
verified labels, tries, provenance, scoring and timing. This foundational feature
has no measured campaign benefit here; the eight natural failures remain.

Public sampling components, now used by the optional actor candidate:
public_paired_picture_sampler.js draws complete original-picture hypotheses only
from actually remembered identities, even initial counts and an explicit Joker
bound. It never accepts an inventory, deck, level or actual seed. Its prior is
explicitly nonuniform over distinct fillings, not a calibrated probability model.
6648 reproducible completion controls preserve observations, pair counts and Joker
bounds. public_anytime_hypotheses.js compares every candidate on the SAME sampled
filling, accepts statistics only from complete balanced batches, prefers fillings
with a constructed hypothetical clear, keeps capped worlds unresolved, preserves
the original choice on ties and stops at one absolute deadline. Incomplete batches
do not bias early roots. It never returns real knownWin/knownDead flags or exact
loss shares. Unit tests cover deadline exhaustion, incomplete batches, prior
conditioning, unresolved budgets, fallback ties and evaluator node limits.
The original scheduler tests remain contract checks; the following physics tests
now separately ground its evaluations in production.

Implemented98cb6de:public_hypothesis_physics.js completes unknown orientation and
initial obstacle roles under public bounds and the standard closed-tile placement
rule. Every hypothesis must replay EVERY actual earlier/current attempt prefix
through original Hard, with identical alive/tray/moves/peek/relief/arrival/tap
states. Every actually visible role and actual blocked probe constrains the
assignment. Picture guesses preserve all immutable observed identities. Every
hypothetical winning suffix is independently replayed in original production
before counting it. Inconsistent history, unsupported Joker transitions, caps and
deadline exhaustion remain unresolved, not real losses. Candidate roots share ONE
cached complete world; changing the filling inside a balanced batch is rejected.
Projection copies named public fields and never reads tile.face, deck or a seed.

Integrated093585e:hypothesisSampling requires public standard/lab mode and the
exclusive production bounds. Actual observation frames/actions are recorded
separately from all hypothetical state. Only actual observations update memory.
The primary planner runs first under the SAME1500ms deadline. Sampling uses time
left afterward, at roots with at least two carriers and unseen alive pictures.
It protects real known wins, safe clock exits and actual complete loss proofs.
Its random stream is derived only from public geometry/knowledge/state, never a
level ID, human label, actual seed or future value. A changed root executes ONE
actual tap and discards all guessed continuations. No changed hypothesis is
claimed as knownWin/knownDead. Actual choices still independently replay exactly.
83/83 tests pass in8s, including concealed-picture-swap invariance of active
sampling, production-grounded hypothetical and actual clears, protected real
winning/clock witnesses, contradictory-history rejection and bounded fallbacks.

COMPLETED:session36618, started2026-10-24T11:59:58.716Z, runtime093585e.
Natural18:81,92,93,99,102,107,111,112,121,123,124,125,134,137,141,143,147,150.
Profile:full141 plus hypothesisSampling:true,rememberBlockedTaps:true; default
maximum32 worlds and256 nodes per candidate action. Report destination:
HUMAN_REFERENCE_HYPOTHESIS_CHALLENGE_2026-10-24.md.
Sourceea57c84eb4c5edbbfbe6a54623ace90d100e9c9a9a09391271a8bd979c2f3f9a;
input02d7ec5d8e26fe7684c5b4473c631fe46e5933ea46083078a8044eadd4725a69.
10/18,mean695.2ms,max1508.5ms,source unchanged. Independent canonical-table audit
verified every human label, board source and try count against full141:ALL match,
no passes lost and no new pass.707 sampled decisions,one changed root on141,
1465 generated worlds,758 complete balanced batches,419 preferred worlds,
1963 independently production-replayed hypothetical clears. All eight cold
failures still fail. This is not a new full score and does not reject sampling.

Verified rollout-budget limitation:the new public synthetic40-tile control has a
straightforward40-tap clear. Beam24 misses it at256 nodes; narrow-first finds it
in20 nodes, and the entire route independently replays in unmodified Hard.play.
public_hypothesis_rollout.js now tries beam1 with half the node cap, then beam4
with the unspent nodes if necessary; both share the same absolute deadline.
Only counterfactual rollouts use this shape; the real primary planner is unchanged.
Its conditional winning route STILL requires independent production replay before
counting a clear, and capped or expired work stays unresolved. Aggregate reporting
now distinguishes unresolved complete worlds, unfinished batches, worlds excluded
only by the winnability preference, verified thin/wider wins and conditional loss
certificates.84/84 tests pass after integration, including the long-route control.
NEXT:compare the narrow-first candidate on the SAME18 levels and profile before
considering broader development validation. Keep all14 failures in scope. If no
complete batches fit, measure history-replay/verification cost; if all candidates
tie as winnable, investigate information-aware rollouts rather than promoting an
omniscient conditional upper bound to an actual success probability.

Interrupted narrow trial:session2256, PID12264, started2026-10-24T12:25:24.715Z,
runtimeeeaa906, source671a5beb04e4765dac7863ca8a5a2acf80fef1158be31a8da63f518c07925655,
same18-input hash02d7ec5d8e26fe7684c5b4473c631fe46e5933ea46083078a8044eadd4725a69.
It completed81(fail,122 sampled decisions/107 changed roots),92(try3),93(fail),
then was deliberately stopped during99 to diagnose excessive decisions. Process
identity was checked before Stop-Process; only this benchmark was killed, and its
exec handle returned terminalexit1. This was an explicit interruption, never a
timeout treated as terminal. Partial report:
HUMAN_REFERENCE_NARROW_HYPOTHESIS_CHALLENGE_2026-10-24.md.
The interrupted99 case and all unreached cases remain unresolved. No18-case or
full155 score is inferred, and no earlier/future profile's wins are merged.

Bounded public99 diagnostic49067 exited0:64 accepted taps,40 moves,32 left,
unresolvedBudget;9 repeated identical public-state/knowledge/action choices.
From53/54 onward it repeatedly selected known peeks29/6 instead of primary49,
without any new picture/orientation/role/safety fact or physical progress.
Read-only knowledge signatures and small sampled-plan summaries now accompany
captureDecisions; no private values are included and no large trace is written.

New public_action_visits.js records ONLY actually accepted choices, keyed by
physical state (including tray order, peek, arrivals/relief) plus actual complete
picture/orientation/role/accepted/cleared/blocked/loss memory. It omits tap count,
sampling results and query counters, which are not new game information. Sampling
cannot reselect an already tried alternative in that exact state/knowledge. The
real primary fallback remains eligible; real wins/exits/loss proofs are protected.
New knowledge permits reconsideration, and a real retry clears visit bookkeeping.
The production fixture demonstrates a zero-progress peek cycle, new-information
invalidation and a complete independently replayed clear.85/85 tests pass.

Guarded diagnostic12463 exited0:the SAME64-tap window has ZERO repeated identical
public choices,43 moves and29 left;6 repeated roots filtered on3 decisions.
Maximum1508.2ms. Both diagnostics independently replay all64 taps in original
Hard, and BOTH remain computation-censored, not physical losses or counted clears.
Report:HUMAN_REFERENCE_REPEEK_DIAGNOSTIC_2026-10-24.md.
COMPLETED:session3967, PID39684, started2026-10-24T13:00:43.320Z, runtimedfb33c4.
Report destination:HUMAN_REFERENCE_GUARDED_HYPOTHESIS_CHALLENGE_2026-10-24.md.
Same18 levels and same profile as the broad and interrupted narrow trials.
Sourcea239b8a91eb8cefb4596f6fd02b66c5a1f801b6039a09b27ea9693558cedbe3e;
input02d7ec5d8e26fe7684c5b4473c631fe46e5933ea46083078a8044eadd4725a69.
Terminalexit0 verified2026-10-24T13:37:26Z.11/18, mean745.6ms, maximum1509.4ms.
107 nowclears1;121 improves2 to1. All10 old passing cases remain passing.
An independent parser verified identical profile/input to the broad18, all labels,
provenance, strict scoring and timings against the complete141/155 table.
No new full155 score is extrapolated. Source unchanged confirmed by the runner.
11739 hypothetical winning routes independently replayed,2423 complete worlds,
1817 preferred,794 incomplete batches.7 natural cold failures remain in this subset.
Next candidate caches original known_tray_plan.legal results by alive layout,
relief and tray capacity, never guessed pictures.3840 exhaustive structural/ice/
lock/relief/capacity comparisons and fixed-node clock/nonclock route parity pass.
Initial cache timing exposed a regression from freezing search alive arrays.
The corrected cache leaves mutable arrays untouched, hashes their current values,
and uses identity memoization only for already frozen arrays. Mutation controls
pass. Four alternating fixed-work synthetic comparisons (72/120 tiles, with and
without obstacles,3 measured repetitions each) retain identical paths/node counts
and reduce total search time by21–36%. These are microbenchmarks, not game scores.
Budget-scheduler foundation committed10b1871. Standalone fake-clock tests also
reject a callback claiming a clear after its local deadline and verify separate
preparation for every world. It is not imported by the live actor or full test
registry yet. Add physics.prepare by factoring the existing cached world setup,
test physical history consistency, then wire an optional actor budget and register
its test after the current source freeze ends. Do not replace preparation with a
dummy evaluated action, which would mix preparation with rollout outcomes/stats.
RUNNING:session73067, PID15532, started2026-10-24T13:41:13.792Z, runtime06fec3d.
Report:HUMAN_REFERENCE_CACHED_HYPOTHESIS_CHALLENGE_2026-10-24.md.
Same18 levels/profile/input02d7ec5d8e26fe7684c5b4473c631fe46e5933ea46083078a8044eadd4725a69.
Source33ddd6f6db0af708ea6475e561b3616d71e49187a9443a886c1226f3a49a1c04.
Last verifiedlive2026-10-24T13:44:34Z, process204CPU seconds.81 still fails after
36 accepted taps, max1506.4ms; no other completed rows received yet. Not terminal.
NEXT:finish/audit the cache on the same18 before changing sampling policy; then inspect
sampling censoring and information dependence.93's7 verified hypothetical
clears all fell in unfinished batches, so preferredWorlds remained0. Consider fair
per-root/pairwise budgeting after measuring it. If loops disappear but policy
dithers between known peeks, investigate retaining a REAL known-safe prefix until
new actual information, never a continuation justified by guessed identities.

Complete trusted opening audit2026-10-24T11:36:47.303Z:
all155 development boards have even initial picture counts and at most two
Jokers (actual maximum0 in this corpus). Input hash matches the full141 run:
00883d1f307092113d611f10fc165a7a2e90aa071d6a5381332464530f026ee9.
No identity, inventory or seed was supplied to a policy. This validates the
source-declared opening bounds, not a known unseen inventory or a uniform prior.
Metadata refresh2026-10-24T12:17:46.918Z still finds140 natural first clears through
156,zero boards decoded and no newer clears.157+ stays unopened. The full run,
cold diagnostic, blocked screen, trusted input audit and first hypothesis
challenge all exited successfully. No CPU-heavy job remains from those runs.

Independent work during the completed freeze:public_clock_retry_exploration.js
was NOT imported by that full140/155 controller. It is now optionally integrated
after the run ended. clockRetryLearning requires actual retryRiskLearning. The helper permits
an earlier actual risk to change an active-clock root only if a lower-penalty
alternative has a known physical safe-exit prefix. It shares deadline/node budget,
protects known wins/exits/deaths, and rejects unknown transitions or expired clocks.
The real loss/retry fixture independently replays both physical routes and tests
both primary and alternative budget overruns. Standalone test PASS in0.2s.
Its test is registered;74/74 tests pass, including7104 concealed-world controls
and an actual complete clock campaign that wins without teaching a fabricated
loss. The actor now permits replanning at a learned active-clock risk while
protecting a retained safe-exit or winning witness. Default behavior keeps the
clock option off. Campaign/report clockRetry counters describe decisions using
audited or adopted plans, including retained steps; they are NOT fresh-search
invocation counts. No campaign gain is claimed before evaluation.

Fixed after the full source freeze:a physically replayed known winning route was discarded solely
when a compatible late roleNone becomes visible. The stacked closed-tile fixture
finds winning path[2,6,3,7,4,8,5,9,0,0,1], then searches again after actual tap9
reveals tile0's role, even though the continuation remains valid. This was wasted
proof work, not evidence of an actual lost game. The actor now keeps a knownWin
planner across compatible role additions; the planner's physical-state and
knowledge checks still invalidate incompatible continuations. Registered fixture
test_human_winning_role_retention.js failed2 searches versus1 before the fix;
now passes with1 search and the exact validated winning path. A separate real
retry deliberately takes another physical action and still replans exactly once.
Both failed learning attempts and both actual winning retries independently replay.
73/73 tests pass. No new campaign count is inferred for this post-full change.

Frozen current profile:
```json
{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true}
```
This adds actual accepted availability, actual cleared-role memory, actual complete
loss-proof memory and standard placement deduction to the full139/155 policy.
It does NOT enable recovery-aware ranking, breadth, headroom2 or earlier proofs.
Those variants remain available for later combinations; no mixed-policy score.

New source-backed rule:Hard.extras and UI addObstacles pass all original closed
indices to Layouts.obstacles' avoid set; its ok predicate excludes them from ice,
locks AND keys. usePlacementContract (defaultfalse) removes mechanical uncertainty
only for actually observed/remembered closed backs in public standard mode.
It reveals neither the picture nor the hidden role, never infers covered orientation,
and never bypasses geometry. The campaign validates the contract before any action.
screen sends only public standard/lab mode from recognized provenance, never IDs,
labels, seed or private roles. Unknown source provenance gets no deduction.

Trusted audit of all155 developed boards:4815 closed tiles,1751 special-role tiles.
Every natural17–156 board obeys exclusion; lab45 does not. ALL lab boards therefore
retain normal obstacle handling, including the14 that happen to satisfy exclusion.
No per-level exception. Tests reject closed ice/lock/key contradictions in standard
mode, preserve actual lab closed-ice play, replay a remembered closed-match win and
exercise24 real placement generations with all three obstacle types represented.
Null generations are valid and excluded from role-count coverage, not asserted bad.

Read-only metadata refresh2026-10-24T05:53:51.481Z:140 natural clears through156,
zero boards decoded, no newer clears.157+ remains unopened.
The unchanged57-task screen and full155 both gained without pass regressions.
Later research candidate, NOT running:placement profile plus
shortInformation:'recoveryAware',recoveryInformationMinTray:2,
recoveryInformationBreadth:true. The new sound deduction may interact with earlier
mixed-result routes; test the whole policy rather than merging past individual wins.

## Completed research evidence

All reports below end2026-10-24.md and startHUMAN_REFERENCE_. Full details and
historical diagnostics remain in the individual reports and this file at a4cb277.

| Variant | Completed result | Evidence/report stem |
|---|---|---|
| Key access + clock information |33/42 natural,8/15 lab; then full139/155 |CLOCK_INFORMATION_CHALLENGE;LAB_CLOCK_INFORMATION;CATALOG_CLOCK_INFORMATION |
| Actual retry risk learning |33/42,8/15; no count gain |RETRY_LEARNING_CHALLENGE;LAB_RETRY_LEARNING |
| Accepted availability |33/42,8/15; lab42 improves3 to2 tries |ACCEPTED_AVAILABILITY_CHALLENGE;LAB_ACCEPTED_AVAILABILITY |
| Previous + known-loss memory |33/42,8/15; no new pass |KNOWN_LOSS_MEMORY_CHALLENGE;LAB_KNOWN_LOSS_MEMORY |
| Previous + cleared-role memory |33/42,8/15; identical try counts; max1505.7ms |CLEARED_ROLE_MEMORY_CHALLENGE;LAB_CLEARED_ROLE_MEMORY |
| Previous + two-carrier continuation proofs |4/20; all16 failures persist, max1501.8ms |TWO_CARRIER_PROOF_SCREEN |
| Crowded recovery-aware information |8/22 versus control6/22; gains102/124/125, loses147; max1501.6ms |CROWDED_INFORMATION_SCREEN |
| Previous + available discovery preference |7/22; gains124 and lab12try3 vsDennis6, loses147; max1501.9ms |AVAILABLE_RECOVERY_SCREEN |
| Crowded recovery + safe discovery breadth |8/22; gains102/124/lab12 (try1), loses147; max1502.1ms |RECOVERY_BREADTH_SCREEN |
| Previous + early continuation proofs |5/7, identical tries to breadth;147 still fails; max1502.4ms |BREADTH_EARLY_PROOF_CONTROL |
| Breadth active from one carrier |5/10; gains102/124/lab12, loses121/123/147/150; max1504ms |SINGLE_CARRY_BREADTH_CONTROL |
| Information endpoint headroom2 |6/22; gainslab12try5, loses147; max1503.5ms |INFORMATION_HEADROOM_SCREEN |
| Public standard-game placement contract |34/42 natural,8/15 lab; gain124, no pass regressions; max1503.8ms |PLACEMENT_CONTRACT_CHALLENGE;LAB_PLACEMENT_CONTEXT |

These are whole-policy results, never a merged best-of. The two22-task policies
remain unpromoted. The next breadth experiment refines them rather than discarding
them after one failure. Full-role/short-role recoveryAware previously scored34/42
but lost121/123/147. Fixed-width1 and2 each achieved7/8 in DIFFERENT policies;
pair-headroom widened badly in42. None proves a released full-gate improvement.

Last full source:`a137a1aff7d6574fc2e626af4faa9e68e2538f0ccd732b038795f58fc06bc836`.
Full input:`00883d1f307092113d611f10fc165a7a2e90aa071d6a5381332464530f026ee9`.
Metadata refresh2026-10-24T03:13:40.853Z confirmed140 clears through156 with
zero boards decoded. The old lab-only26e875b6 input hash differs from4e5a9c98
ONLY because --development adds status:available to identical lab source rows;
both were independently reproduced. Natural challenge input remainsc679dc1c.

## Memory and information research facts

- Actual accepted taps prove conditional future availability only after all
  witnessed removals. Skip evidence after global relief. Do not assign pictures
  or initial roles. Runtime2f23e47 added the actor integration.
- Actual visible late none can also prove conditional obstacle clearance before
  the tile is ever tapped. Runtime7b53fa9. Read ONLY actual observeBoard.roles,
  require removal prerequisites and current geometry, skip relieved frames.
  Never turn late none into initial none. The replay test loses before tapping
  the thawed tile, then recognizes a known winning retry with its exact prerequisite.
- Known-loss memory f10d874 requires an actual fully exhausted supported public
  graph covering ALL current legal roots. Partial-root/bounded reports cannot
  become whole-position facts. Cache reuse preserves clock/arrival/relief state.
  A cyclic-trap test prunes a real losing two-carrier position without condemning
  an earlier state with a production-winning alternative.
- Retry risk learning0f529b0 penalizes only a real unrecovered third-carrier
  commitment before physical loss. Clears/caps and earlier recovered risks teach
  no loss. Its alternative-root wrapper shares nodes/deadline and protects clocks.
  The risk marker is a heuristic, never a losing-action proof.
- recoveryInformationMinTray (default0) scopes adaptive short-information ranking
  to crowded ROOT states. Threshold2 preserves ordinary empty/one-carrier behavior.
  Known local recovery and clocks keep ordinary ordering.
- recoveryAvailableInformation (defaultfalse) prefers a guaranteed available
  unknown picture before short-prefix length only during active adaptive ranking.
  That helped lab12 but did not preserve other gains. Availability is not a win proof.
- recoveryInformationBreadth (defaultfalse) counts up to two safe discovery
  candidates before short-prefix length, only during active adaptive ranking.
  A known-closed uncertain-role candidate may be rejected without a physical move
  or inspect without adding a fourth carrier. Exclude unknown orientation and
  unsafe face-up unknowns. Never sample either picture/role or cross that boundary.
- Renderer audit:board.js updateBlocked uses Layouts.isFree, not takeable.
  Its highlight reveals geometry, not a new hidden ice/lock availability signal.

## Matched actual diagnostics and corrections

147:baseline and both crowded policies share48 accepted taps, then tray[9,35].
Baseline59/59/0/54/40 reaches guaranteed available unseen pictures and clears in104
taps. Short candidate66/51 reaches an uncertain role and fails in51. Available-first
candidate36/11 reaches one guaranteed discovery but fails in64. Its first divergence
is STILL48, not merely a later decision. All three runs independently replayed.
102:short candidate84/67 uncertain-role route clears; available-first50/20 fails,
first divergence37. Thus certainty alone does not identify the best unknown result.
These diagnostics do not establish impossibility, uniqueness or hidden bad luck.

Latest breadth147 replay independently verifies63 accepted taps. It shrinks the
tray to[35] at51, then ordinary ranking commits58 (picture16) before54/0/41.
At55 it commits the now-seen21 to free33/16, leaving[35,21]. It peeks1 and10,
matches63, then at60 commits66/4 for discovery51. After that actual reveal the
position is knownDead and the final fourth carrier loses. Earlier proof threshold2
does not change these tries. The min1 experiment tests the earlier single-carry
decision instead of inventing a losing proof before an unknown observation.

Earlier rejected stories remain rejected:137's known14/known9 routes were BOTH
mechanically certain conditional recoveries;136 removed its clock correctly before
later mistakes; lab12's learned risk root was NOT already knownDead. Original
Hard exact-tray/open-twin/Joker order was verified, not the alleged twin bug.
Automatic relief requires the ENTIRE possible frontier empty, tray not full and
geometric freedom. Unknown obstacles prevent a relief/death proof. Pair/key/access
macro endpoints now receive the same continuation proofs as primitive removals.
Catalog/gate repair820e95a keeps unresolved lv17/no-version rows and refuses missing
requested levels, rather than silently dropping them. Lab31 is the only exclusion.

## Single visibility and information contract

`human_board_visibility.js:tileVisibility` is the only exposure gate.
Renderer geometry:height ratio1.24, up-left layer lift.14, z/y/x draw ordering.
Subtract the UNION of higher alive bodies. Opaque bounds cover side allowance
max(.085,3/20), assuming rendered tile width>=20px. Smaller viewports unsupported.
Inscribed body strips include solid beige/green borders: Dennis explicitly permits
face-up picture recognition from border alone. Rounded corners/shadows do not count.
Inner face inset.15 defines role visibility. A border does NOT reveal a covered role.
Exposed back orientation is public; closed/fully covered pictures remain unknown.
Open peeks follow the same gate. The covered clock badge's location/deadline is public;
its picture gets no exemption. `observeBoard` reads values only after gating.
No pixel readers, pose banks, joint dictionaries or future-value samplers in the bot.

Actual observer data, not trusted readers, enters search. Unknown picture,
orientation or mechanical role stops the hypothetical transition. Passive exposure
predicts readable INDICES only, never their unseen values.
`frontierRoles` changes reward eligibility, NOT visibility or actual memory.

## Memory, mechanics and physical validation

- Retry memory stays on the same exact board. Store actual pictures, orientations,
  observed roles and sound deductions. Late observed none is NOT initial none.
  Observed immutable keys/locks and observed remaining ice plus real removals can
  recover initial roles only under the declared production contract.
- Original ice budgets must not grow under occlusion. Actual immediately removed
  closed pictures can be inferred only from an unambiguous actual match to a
  previously seen tray/open picture;222 production controls guard this.
  Matching does not invent the removed tile's hidden starting role.
- Exclusive contract:zero/two keys, one/two-hit ice, no overlapping special roles;
  trusted environment rejects violations. Both actually observed keys removed
  plus two actual initial-neighbor removals can prove takeability for an unseen
  role. This does NOT assign its role or picture;264 public-world checks.
- Every accepted action independently replays through original `Hard.play`
  with identical physical log, trace and result. Trusted session physics is source
  anchored; policy geometry throws on private faces/down/deck/seed access.
  Physical seed20261111 and tapMs1000 belong only to the environment.
- A rejected uncertain tap changes no move/try and is blocked only for the same
  alive layout. A cap/frontier/timeout is unresolved, not a loss or free restart.
  Only actual tray/clock/stuck losses trigger the next attempt.
- A known-dead certificate requires exhaustive supported known graph, no reachable
  unknown or pruned/bounded frontier. Heuristic root exclusions need their own
  shared-budget proof. A missing bounded witness never proves impossibility.

## Search/cache facts to preserve

Shortest physical-prefix admission plus a UNIQUE keyed beam frontier replaces
longer duplicates without occupying two slots. Preserve the four-tap production
win/clock witnesses; don't revert to first-visit semantics to fit one level.
Known pair macros include inspect-first and face-up-first physical tap orders.
Known-key recovery is optional, observed-only, bounded and separately replayed;
one expanded node can construct4 face-up or6 remembered-closed taps where primitive
edges remain bounded. No actual unknown role or picture is sampled.

Inspection `'recovery'` plans first, retains the planner's own discovery and
a real non-losing neutral/reducing tray checkpoint, including consuming a known
open twin without adding carriers. Don't globally force/disable all peeks again.
A zero-removal peek is not universally dominant: auto-twins can spend useful copies.

Dependency route cache is recreated per synchronous search with fixed public
geometry/rules. Key only alive signature, relief and target; don't mutate cached Sets.
768 raw/cache checks and clock/nonclock fixed-node path parity validate it.
Generic reusable cache keys ALL settings and bypasses callbacks/live deadlines;
never reuse opaque observation callbacks or timed reports across actual frames.
Costs, overflow estimates, clock cones and pair debt are heuristics, not lower
bounds, route witnesses, safety certificates or hidden-role deductions.

Optional information-dominance stopping applies ONLY to raw short-information
ordering, nonclock roots with0/1 carried tiles, at least one unknown picture,
and a one-tap information prefix at minimal pressure/overflow. Unknown pictures
cannot disappear through a supported known-only winning route; longer prefixes
cannot beat that rank's path-length term. TWO complete layers are required:
a newly readable face-up boundary can credit a one-tap prefix in the second.
72 fixed-work comparisons retain decisions while avoiding2304 expansions.
Clock/fully-known/crowded/capped cases remain unshortened, and no death proof
or real-world optimality claim follows from this heuristic-rank bound.
Average decision time and dominance-stop counts now accompany the maximum;
they include the actual observation/projection, not independent replay time.

137's former known14/known9 routes BOTH had mechanically certain conditional
recoveries; do not revive the rejected unknown-role-penalty explanation.
136's old failing trace already removed its clock correctly; later commitments,
not its opening, caused that loss.

## Workflow and history

Use `$env:NODE_PATH='C:\Users\den_k\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'`.
Tests:`node source/tests/run.js human_reference`.
CLI screens take explicit17–156 or a documented subset;157+ stays unopened.
A new full score requires a full unchanged-source run, not extrapolation from42/8.
Preserve unrelated dirty/untracked ML, perception, ledger and Gemini files.
Stage exact reference paths only; no blanket add/reset/clean. No subagents authorized.
Detailed earlier chronology is preserved in git at417faac and per-run reports;
read it only when needed rather than appending another unbounded duplicate log.
