# Human-information reference: Dennis gate

Worktree: `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review`.
Branch: `wip/personal-bots`. Goal ACTIVE and UNMET.
Recent progress: public standard-game placement deduction improves the full
development result to140/155 with no previous pass lost. Fifteen still fail.
Do not redefine completion around a subset, a percentage, or an isolated pass.

## Contract and completion evidence

1. ONE game-state geometry gate; no screenshot/pixel/pose/dictionary track.
   Only actually visible or remembered pictures/roles and sound public deductions.
   Never read hidden pictures, the deck, the level seed or actual future reveals.
2. Include EVERY Dennis first clear, plus later clears. Count actual starts and
   restarts. Dennis1 requires bot1; Dennis2+ requires strictly fewer tries.
   Initial134/141/143/147 fixes must remain clear. A bounded failure is not
   impossibility, hidden luck, or permission to peek.
3. General planning only, never per-level policies, routes, seed choices or best-of
   merging. After development passes, freeze for the next20 untouched progression
   levels and compare against Dennis when played.157+ remains unopened.
4. Decisions under approximately2s. Shared1500ms search deadline includes guards,
   alternative roots and proofs; observed-frame projection is included in timing.
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

**140/155**, unchanged source, mean**85ms**, slowest**1505.4ms**.
Report:`HUMAN_REFERENCE_CATALOG_PLACEMENT_CONTRACT_2026-10-24.md`.
Completion observed2026-10-24T06:20:27Z; runtime32f493a.
Natural**132/140**, lab**8/15**. New gain124try2 vsDennis3; no previous pass lost
against full139/155.121 improves3 to2 tries and lab42 improves3 to2. The earlier
42-task screen's92try3 is2 in this full run; do not substitute screen counts.
Original134/141/143/147 alltry1.
Natural failures:**81,93,99,102,107,112,125,137**.
Lab failures:**11,12,32,33,41,49,52** (encoded10000+id).
All155 unique rows, natural17–156, lab15, only10031 excluded, strict try scoring,
input hash, unchanged source, old labels/provenance and maximum timing were
independently checked from the canonical table. The unseen20 gate is not run.
The full goal is NOT complete; keep all15 failures in scope.
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

Runtime:`3081a3a`; last completed full140/155 policy:`32f493a`.
Goal ACTIVE, UNMET. Current full155 validation is source-frozen below.
**76/76 offline tests pass** in7s, including7296 concealed-world controls,
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

RUNNING:session95132, started2026-10-24T07:29:58.786Z, unchanged-source full155.
Profile:the full140 policy below plus causalAvailabilityMemory:true, no other flags.
Source3ee9ad33f605375dbb68b7db4fc376bea325c24b7436f7877daa11eb1407eb6e;
input00883d1f307092113d611f10fc165a7a2e90aa071d6a5381332464530f026ee9.
Destination:HUMAN_REFERENCE_CATALOG_CAUSAL_AVAILABILITY_2026-10-24.md.
One CPU-heavy simulation only; keep all loaded source unchanged until terminal.
Last verified live2026-10-24T07:36:52Z:node PID10800, session95132; output through
level49, all17–49 pass. This partial result does not replace the full140/155 score.
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
suite remains76/76 before this addition; do not claim77 until rerun after freeze.
Committedacc751c, then d8ec5e6 rejects sparse memory arrays rather than skipping
missing entries; the same standalone controls and production clears pass again.
Before integration, audit the public opening contract across supported generators
and all155 development inputs, then run the missing public-uncertainty diagnostic
after session95132 ends. No campaign gain or initial-contract coverage is claimed.

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
