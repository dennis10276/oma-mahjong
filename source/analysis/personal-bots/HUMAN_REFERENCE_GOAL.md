# Human-information reference: Dennis gate

Worktree: `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review`.
Branch: `wip/personal-bots`. Goal ACTIVE and UNMET.
Recent progress: public key preparation, catalog inclusion repair and a full
expanded155 result139/155 with no natural-level regressions. Sixteen still fail.
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

Runtime:`2f23e47`; last full139/155 policy:`d7778dd`; retry integration:`0f529b0`;
key-access helper:`1bb716d`, integration:`6655f50`; catalog/gate repair:`820e95a`.
**66/66 offline tests pass** in about4s, including5376 concealed-world controls,
675 accepted-availability production-rule controls,144 local recoveries,
24 relief witnesses and production-replayed preparatory key/clock routes.
Latest full score139/155 is recorded above; research helpers are not in that policy.
The goal is ACTIVE and UNMET. No research option is promoted.

| Unchanged policy | Completed scope | Evidence |
|---|---|---|
| Corrected conservative control |32/42 natural,7/15 lab |Macro proofs fixed without a count gain |
| Clock recovery, no carry threshold |32/42 natural,4/15 lab |Gains84,loses144; lab44/46/48 regress |
| Clock recovery after1 carrier |39/57:32 natural+7 lab |Gains84/lab49; loses142/lab15; max1505.5ms |
| Known key access preparation |32/42 natural,7/15 lab |Constructs new bounded key routes but no count gain |
| Key access + information before crowded exits |33/42 natural,8/15 lab |Gains84/lab45, no challenge regressions; max1504.9ms |
| Previous + actual retry risk learning |33/42 natural,8/15 lab |No measured count gain; max1505.3ms |

Reports respectively:
- `HUMAN_REFERENCE_MACRO_CONTROL_CHALLENGE_2026-10-24.md`,
  `HUMAN_REFERENCE_LAB_MACRO_CONTROL_2026-10-24.md`.
- `HUMAN_REFERENCE_CLOCK_RECOVERY_CHALLENGE_2026-10-24.md`,
  `HUMAN_REFERENCE_LAB_CLOCK_RECOVERY_2026-10-24.md`.
- `HUMAN_REFERENCE_CARRIED_CLOCK_EXPANDED_2026-10-24.md`.
- `HUMAN_REFERENCE_KEY_ACCESS_CHALLENGE_2026-10-24.md`,
  `HUMAN_REFERENCE_LAB_KEY_ACCESS_2026-10-24.md`.
- `HUMAN_REFERENCE_LAB_CLOCK_INFORMATION_2026-10-24.md`; natural report:
  `HUMAN_REFERENCE_CLOCK_INFORMATION_CHALLENGE_2026-10-24.md`.
- `HUMAN_REFERENCE_LAB_RETRY_LEARNING_2026-10-24.md` and
  `HUMAN_REFERENCE_RETRY_LEARNING_CHALLENGE_2026-10-24.md`.

COMPLETED:session58527, lab15 completed8/15 and natural42 completed33/42.
Mean60.9ms natural and68.9ms lab; no new losses against the corrected control.
Source:`a137a1aff7d6574fc2e626af4faa9e68e2538f0ccd732b038795f58fc06bc836`.
Input hashes:lab26e875b6bc204b952e47911465efddc103dd23e158695dcc921095a5cec54a83;
natural c679dc1c90873909039749b8467970652c3973ec4b8c7f6d9f4624c327460ac5.
COMPLETED FULL155:session81740, same unchanged policy and sourcea137a1af above.
Report:`HUMAN_REFERENCE_CATALOG_CLOCK_INFORMATION_2026-10-24.md`.
Full input:
`00883d1f307092113d611f10fc165a7a2e90aa071d6a5381332464530f026ee9`.
Metadata refresh2026-10-24T03:13:40.853Z confirmed140 natural clears through156,
zero boards decoded, then the full155 run began2026-10-24T03:13:50.101Z.
The155 source freeze has ended. No extrapolated or mixed-policy full score is valid.
One CPU-heavy simulation at a time. Never restart for a polling timeout or kill
app/Gemini helpers.157+ remains unopened.

Retry helpers14143f5 andc994ff5/25dc52a are integrated optionally by0f529b0,
but were NOT included in the completed139/155 policy.
Production-replayed loss/clear/capped episodes validate learning only an actual
third-carrier commitment whose pressure never recovers before physical loss.
An earlier recovered third carrier is not penalized, caps/clears teach no loss,
clock resources distinguish states, hidden getters throw and levels do not share
evidence. The wrapper shares one budget, protects active clocks and known wins,
and accepts only a known non-losing prefix ending at at most2 carriers. A final
unknown-role/orientation probe is allowed there, never a suffix beyond it.
Known-witness retention is reset at learned nonclock risks unless winning.
Real actor replay tests change a subsequent choice, but broad counts stayed
33/42 and8/15. This heuristic is not proof that the original action loses.

COMPLETED:session55779 ran matched124/lab12 controls with rememberAcceptedTaps
off then on, using the last full profile and NO retryRiskLearning. Runtime2f23e47;
sourcef68c38e22e473affc820b9f93c67595b9d6ae76737fcde584864577232288c14.
Reports:HUMAN_REFERENCE_ACCEPTED_AVAILABILITY_CONTROL_{OFF,ON}_2026-10-24.md.
Both policies scored0/2.124 still fails within2 starts; lab12 still fails within5.
The remembered policy changes actual retry routes (lab12 reaches36 tiles left on
try5 vs66 in control), not a pass or an accuracy gain. These are real starts.
Actual accepted taps now optionally
prove conditional availability on the same board and subsets of the witnessed
alive layout. Pictures/initial roles are untouched, after-relief evidence is
refused, and only actual accepted transitions record a witness.675 rule controls
and a production retry with hidden initial ice validate the prerequisites. The
actual blocked tile is NOT declared initially safe on the next try, but its route
after the observed thawing removal becomes a known winning witness. No campaign
gain is claimed from those two controls.

COMPLETED:accepted-availability broad screen session18460, runtime2f23e47,
sourcef68c38e22e473affc820b9f93c67595b9d6ae76737fcde584864577232288c14.
Reports:HUMAN_REFERENCE_{LAB_ACCEPTED_AVAILABILITY,ACCEPTED_AVAILABILITY_CHALLENGE}_2026-10-24.md.
Lab8/15, natural challenge33/42. Lab42 improves3 to2 tries; pass counts unchanged.
Mean/maximum:lab80.3/1231.9ms, natural62.8/1507.7ms. No full155 score is inferred.

COMPLETED:accepted-availability plus remembered known-loss screen session14585,
runtimef10d874, sourcea93e129a3c73fe7963d690dcd248780f16c3786f467a099cfe548095b5232db4.
Reports:HUMAN_REFERENCE_{LAB_KNOWN_LOSS_MEMORY,KNOWN_LOSS_MEMORY_CHALLENGE}_2026-10-24.md.
Again lab8/15 and natural33/42; lab42 remains2 tries. Mean/maximum:lab81.5/1210.8ms,
natural64.1/1504.4ms. Both serial runs finished, source unchanged. No simulation
process remains live. The known-loss cache retains only actual complete public
exhaustion proofs covering all legal roots, never bounded/partial-root reports.
Its unit test prunes a real cyclic trap at two carriers while preserving the
earlier winning alternative. It has not improved development pass counts.

Renderer audit:board.js updateBlocked uses Layouts.isFree, not takeable;
style.css shows that geometric blocked class through the optional highlight.
This supplies no additional public hidden-ice/lock availability signal.
Optional rememberClearedRoles now retains actually visible late none conditionally
across retries, without turning it into an initial none or bypassing geometry.
Only the ONE visibility gate's actual roles enter this memory. Original-rule
evidence is refused after global relief; reuse requires all witnessed removals
and current geometric freedom. No accepted tap of the observed tile is needed.
380 production subset controls cover ice, locks and their overlap; a real hidden
initial ice fixture observes a thaw, loses before tapping it, then plans a known
winning retry with the exact removal prerequisite. All actions independently
replay in Hard.play.69/69 tests pass, including5952 concealed-world controls.
COMPLETED:session56420 tested that option with accepted availability and known-loss
memory, runtime7b53fa9, sourcef1314d9780dee1437bb5c07f837869c997f77c52dc724c79f814ccb53e4bbc8f.
Reports:HUMAN_REFERENCE_{LAB_CLEARED_ROLE_MEMORY,CLEARED_ROLE_MEMORY_CHALLENGE}_2026-10-24.md.
Lab8/15, challenge33/42; every row's try count, label and board source equals the
known-loss-memory control. Mean/maximum:lab84.3/1277.5ms, natural64/1505.7ms.
Lab input4e5a9c9870dac977f024c3700b6c4813b5cdf463f6f9b63dcd37ecbd1dde5d17
differs from older26e875b6 ONLY because --development adds status:available to
each otherwise identical source row; both hashes were independently reproduced.
Source remained unchanged; no new pass-count gain or full155 score is claimed.

COMPLETED:session19374 tested the same source/profile plus continuationTrayMin:2
on all16 remaining failures plus original controls134/141/143/147 (20 total).
Started2026-10-24T05:13:10.139Z. This attempts complete known-continuation proofs
at two carried tiles rather than waiting for three. It shares the same1500ms
deadline, retains unknown/bounded positions, and never declares impossibility
from a budget failure. This is a focused development screen, not unseen20.
Report:HUMAN_REFERENCE_TWO_CARRIER_PROOF_SCREEN_2026-10-24.md.
Input243ddaf18ea5b0c5d20e01056247f2c50f560a9bb29283b0bb2e730f32c8190e.
Result4/20:only the four original controls pass; all16 failures remain. Every
try count matches the corresponding previous natural/lab table. Mean78.6ms,
maximum1501.8ms; source unchanged. Extra two-carrier proof work did not help this
screen and is not promoted. It remains available for future policy combinations.

The next optional recoveryInformationMinTray parameter (default0, range0–3)
limits recovery-aware short-information ordering to sufficiently crowded ROOT
states. This is a refinement of an earlier mixed-result route, not its removal:
with threshold2, empty/one-carrier roots retain ordinary ranking; crowded roots
without a constructive local recovery prefer shorter safe information prefixes.
Known recoveries, wins and clocks retain their previous treatment.69/69 tests
pass, including6144 concealed-world controls and threshold/replay checks.
No development improvement for this refinement has yet been claimed.

COMPLETED:session75598 tested that threshold2 variant on the16 failures plus
six controls121/123/134/141/143/147 (22). Runtime4787061;
source1d81237152e1cae95084a5b0383a15143862db62cce837a246a5df3ea2316863.
Report:HUMAN_REFERENCE_CROWDED_INFORMATION_SCREEN_2026-10-24.md.
8/22 vs matching control6/22:gain102try1,124try2,125try1; regression147 fails.
Mean76.3ms, maximum1501.6ms, source unchanged. This variant is NOT promoted.
An actual double replay of147 (104 versus51 accepted taps, both independently
verified) finds the first divergence after48 identical taps, tray[9,35].
Baseline59/59/0/54/40 reaches a guaranteed available unseen picture; candidate
66/51 reaches an uncertain obstacle role. After its actual reveal, that run
becomes known dead. This does not prove that earlier position or level impossible.

Optional recoveryAvailableInformation now prefers a guaranteed available unknown
picture/orientation over an uncertain-role boundary BEFORE shortest-prefix length,
ONLY while recovery-aware ordering is active. It is a ranking heuristic, not a
proof that the unseen picture will help. The option defaults false; clocks and
known local recoveries keep ordinary behavior. A synthetic stacked-pair fixture
demonstrates the same choice, independently replays the longer physical prefix
across changed concealed identities, and never crosses its unknown boundary.
70/70 tests pass, including6336 concealed-world controls. The first new fixture
needed progressiveReopens:true to admit its constructive remembered-closed
access route; this was fixed in the fixture rather than weakening the planner.
No score for this additional preference has yet been measured.

Research conservative control:
```json
{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles"}
```
The active candidate adds `keyAccessMacros:true,clockInformationBeforeRisk:true`.
No per-level policy or best-of merging. Gates include lab15 beside natural140.

Key facts:
- Pair/key macro endpoints now receive the same cached bounded continuation-loss
  checks as primitive removals (8055ad6). Public exposure prevents death proofs.
- Known key access prepares blocked observed keys via observed matching pairs;
  every witness is physical. It shares nodes/deadline and never fills hidden fields.
- Lab12 public root keys19/78 have real preparatory routes. The ordinary search
  already finds69/38/78/19/68/53/1; key access finds78/38/68/19/69/53/1.
  Both remove the clock with an unsafe tray. New route construction alone does
  not cure that ordering. No actual later reveal is fed to either search.
- Optional clockInformationBeforeRisk raises safe information to tier4, above
  a crowded clock exit3 but below a safe exit5 or win6, only with more than2
  clock moves remaining. It is opportunity ordering, not a future-outcome proof.
- Optional clockRecovery uses estimated spare moves and tray debt; urgent/nonclock
  defaults stay unchanged. Carry threshold1 passed84/144/lab44 but regressed
  elsewhere; do not combine isolated wins into a fictional all-board score.
- Gate repair820e95a preserves Dennis name/lv for unsupported old-format rows.
  The reproduced lv17/no-version record previously vanished in person filtering.
  Full selection now refuses unresolved or duplicated rows and missing requests.
- Protected open-twin widths previously completed33/42 (width1) and32/42 (width2);
  neither is promoted. Reports:`HUMAN_REFERENCE_OPEN_TWIN_WIDTH_{1,2}_CHALLENGE_2026-10-24.md`.
- Old raw-short full run was deliberately stopped after emitting69 ONLY for the
  reproduced relief bug (already failing46/50/52/69); no complete raw full score.

## Latest controlled evidence

All completed rows below retain unchanged-source checks and independent original
production replay.42 cases:50/81/84/85/86/92/93/99/102/107/111/112/121/123/124/125
plus131–156. Latest8 cases:50/81/92/121/123/137/147/150, NOT earlier different8-case sets.

| Profile | Scope/result | Remaining issue |
|---|---|---|
| Post-relief shortRoles |32/42;mean122.7ms,max1511.5ms |Same ten failures as old130/140; no new full score |
| Full roles + recoveryAware |34/42;mean118.8ms,max1509.4ms |Gains81/93/102/107/137;new losses121/123/147 |
| ShortRoles + recoveryAware |34/42;mean93ms,max1511ms |Same eight failures:84/99/112/121/123/124/125/147 |
| Previous + fixed width1 |7/8;mean163.8ms,max1516.5ms |Only123 fails;121try2,147try1,92try2 |
| Previous + fixed width2 |7/8;mean121.9ms,max1511.6ms |Only147 fails;121try2,123try1,92try1 |
| Pair-headroom width |6/8,then32/42;max1505.5ms broad |New losses136/143/150;not promoted |

Reports:`HUMAN_REFERENCE_RELIEF_CHALLENGE_2026-10-24.md`,
`HUMAN_REFERENCE_RECOVERY_PROBE_CHALLENGE_2026-10-24.md`,
`HUMAN_REFERENCE_SHORT_RECOVERY_PROBE_CHALLENGE_2026-10-24.md`,
`HUMAN_REFERENCE_INFORMATION_WIDTH_1_2026-10-24.md`,
`HUMAN_REFERENCE_INFORMATION_WIDTH_2_2026-10-24.md`,
`HUMAN_REFERENCE_PAIR_HEADROOM_CONTROL_2026-10-24.md`,
`HUMAN_REFERENCE_PAIR_HEADROOM_CHALLENGE_2026-10-24.md`.
Never merge the two7/8 runs into8/8 or extrapolate132/140 from34/42.

Relevant earlier evidence is archived in prior goal revisions/per-run reports:
- full128/140 recovery checkpoint preceded full130/140 shortRoles;
- unguarded full-role short probes33/42 gained112/124 but lost50/138/147/152;
- frontier-only roles restored92 but lost121; all-field information also lost149;
- widening two-carrier death proofs did not resolve the92/121 tradeoff;
- dominance seven-case control5/7 both ways retained attempt tap/left/outcome counts;
  mean394.5→364ms in that control only, not a universal speedup.

## Corrections and current hypotheses

**Public obstacle relief:** original Hard lifts obstacles when no legal tile
remains, a geometrically free tile exists and the tray is not full. The old public
callback omitted this and falsely called an all-visible four-tile win known-dead.
The callback now requires its ENTIRE possible frontier empty; uncertainty prevents
the proof. It returns relief and the known planner retains it; cache distinguishes
full/nonfull trays. Arbitrary restricted callbacks cannot invent relief.24 renamed
one/two-hit ice wins now construct/replay correctly; hidden pictures remain unknown.
See `HUMAN_REFERENCE_PUBLIC_RELIEF_FIX_2026-10-24.md`.
Old completed successful routes stay physically valid, but old death explanations
predate this correction. Post-fix32/42 preserved counts, not a new campaign gain.

**Local recovery:** `public_known_recovery.js` constructs actual one/two-tap
tray matches, open twins and pairs, including a mate thawed by the first removal.
144 production/replay controls pass. Optional recoveryAware retains ordinary
information ranking when a permitted local recovery is detected; otherwise it
tries short probes. No optimum/loss inference, hidden partner or extra deadline.
The full-roles comparison also changes information horizon, so its count delta
does not causally isolate the probe switch.

**Information width:**0/off or1..4 caps the count of mechanically guaranteed,
known-orientation tiles with unseen pictures, ahead of short-path tie-breaking.
Unknown-role tiles do NOT count. This is opportunity ordering, not a prediction
of identities/outcomes or a proof of recovery. Existing clock/win tiers stay intact.
Old one-tap information-dominance stopping is disabled whenever width is nonzero.
Synthetic broader-prefix controls independently replay and retain deadline guards.
Experimental `'pairHeadroom'` cap=max(1,floor((4-currentTrayLength)/2)) regressed
on broader testing; keep it optional, not a winner or a mixture of per-level results.
It does not mean that every peek physically consumes two tray slots.

**Ready open twin:** optional protectOpenTwin guards ONLY manual discovery fallback.
If it would overwrite an open ordinary picture with a mechanically guaranteed
matching partner, a single independently modeled tap consumes that actual pair.
It does not override the planner's explicitly selected discovery/known win/clock
route, infer hidden roles, or assert greedy pairing is universally dominant.
Regression uses a genuine production peek, verifies the two-tile transition and
original Hard replay; uncertain partners, automatic Jokers and clock loss are refused.
Natural-level gains are unmeasured until the current runs finish.

## Matched-state diagnostic facts

- 123's manual open-twin guard shares45 decisions with unprotected width2, then
 consumes24/open17 (picture11) while carrying33. The winning unprotected route
 discovers23, which actually matches33, leaving17/24 for later. This is evidence
 against compulsory pairing, not permission to know23 before its actual reveal.
- 147 raw short probing once replaced open80 by unknown82 after six shared actions.
 Full-role recoveryAware instead consumes80/74 first; a different divergence.
 Short-role recoveryAware shares48 decisions with control, then chooses66→51,
 carrying[9,35,4]. Its endpoint has ZERO guaranteed unseen-picture options, only
 uncertain-role51. Control uses59/59/0/54→40, carrying[9,35,20], retaining guaranteed
 closed unknowns1/40 plus passive field33. Both have three unseen tray partners
 and no local recovery. This audit uses no actual future values.
- Fixed widths1/2 share41 decisions on123 and147.123 then has an empty tray:
 width1 manually peeks43, width2 consumes a known open twin first.147 carries[6]:
 width1 takes79→71, width2 takes36→11. Those first differences alone do not prove
 the chosen action forces the later outcome; headroom-based switching indeed
 failed to combine their successes.
- 92's longer role prefix exposes17/23 after5 and22/28 after9 taps; they are still
 blocked, not already mechanically free. Filtering blocked-role information is
 not universally safe:it loses121. Clock-only switching did not solve the tradeoff.
- 137's old known14/known9 recoveries BOTH had mechanically certain conditional
 partners. Do not revive the rejected unknown-role-penalty story.
- 84/99/112/125 diagnostic losses occur AFTER their clocks are removed (first
 post-clock decisions17/12/6/6).136's old first seven clock actions also matched
 the human and removed its clock. Do not blame the active clock just because a
 board has a badge; this does not prove the earlier clock route strategically best.

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
