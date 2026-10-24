# Human-information reference: Dennis gate

Worktree: `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review`.
Branch: `wip/personal-bots`. Goal ACTIVE and UNMET.
Recent progress: public standard-game placement deduction improves the natural
challenge34/42 with no pass regressions; a full155 validation is running.
The last completed full score remains139/155; sixteen fail that policy.
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

**139/155**, unchanged source, mean**80.7ms**, slowest**1506ms**.
Report:`HUMAN_REFERENCE_CATALOG_CLOCK_INFORMATION_2026-10-24.md`.
Completed2026-10-24T03:35:02.853Z; runtimed7778dd.
Natural**131/140**, lab**8/15**. Natural gain84, no previously passing natural
level regressed. Lab gain45try1 vsDennis6. Original134/141/143/147 alltry1.
Natural failures:**81,93,99,102,107,112,124,125,137**.
Lab failures:**11,12,32,33,41,49,52** (encoded10000+id).
All155 unique rows, natural17–156, lab15, only10031 excluded, strict try scoring,
input hash, unchanged source, old labels/provenance and maximum timing were
independently checked from the canonical table. The unseen20 gate is not run.
The full goal is NOT complete; keep all16 failures in scope.

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

Runtime:`32f493a`, diagnostic context fix:`b1bdbec`;
last completed full139/155 policy:`d7778dd`. Goal ACTIVE, UNMET.
**72/72 offline tests pass** in6s, including6912 concealed-world controls,
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

RUNNING:session26989, started2026-10-24T05:57:39.306Z, full --development155 with
the unchanged profile below. Report:HUMAN_REFERENCE_CATALOG_PLACEMENT_CONTRACT_2026-10-24.md.
Source remains0c85b8bf0780c4566175c26b15a0afacc32ca4fc35a67520d00c3a87e72df364;
full input00883d1f307092113d611f10fc165a7a2e90aa071d6a5381332464530f026ee9,
identical to the earlier full155 input. Header confirms155 targets. No other
CPU-heavy process is live. Hold loaded runtime fixed until this run is terminal;
poll its actual handle, never restart just for an observation timeout or kill
app/Gemini helpers. This is development, NOT unseen20;157+ remains unopened.

Independent work while this freeze runs:public_clock_retry_exploration.js and its
standalone test are new, NOT imported by the frozen controller. The helper permits
an earlier actual risk to change an active-clock root only if a lower-penalty
alternative has a known physical safe-exit prefix. It shares deadline/node budget,
protects known wins/exits/deaths, and rejects unknown transitions or expired clocks.
The real loss/retry fixture independently replays both physical routes and tests
both primary and alternative budget overruns. Standalone test PASS in0.2s.
No campaign score or main-suite increase is claimed. After full155 finishes,
register its test, integrate optionally with actual retry learning, and test whole
policies. Do not modify the frozen actor before that run ends.

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
The unchanged57-task screen gained without pass regressions; full155 is now
running before promotion. Next research candidate, NOT running:placement profile plus
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
