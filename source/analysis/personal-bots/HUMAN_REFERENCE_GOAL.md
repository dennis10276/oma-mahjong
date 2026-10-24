# Human-information reference: Dennis gate

Worktree: `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review`.
Branch: `wip/personal-bots`. Goal ACTIVE and UNMET.
The previous turn made progress: full-catalog evidence, constructive key recovery,
dependency caching, public information diagnostics and controlled experiments.
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

## Latest complete development run

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

Runtime:`8055ad6`; lab catalog/screen:`0bc0f3e`; manual twin guard:`cede8f0`;
public-relief correction:`2d6ec2f`; root adaptive probing:`80491b6`;
information width:`ae1753f`; experimental pair-headroom cap:`1fe9239`.
**59/59 offline tests pass** in about4s, including4416 clock/nonclock
concealed-world controller controls,144 local-recovery and24 relief witnesses.
No new post-correction full140 score exists. No research option is a released winner.

8055ad6 fixes a continuation-check gap: pair/key macro endpoints now use the
same cached, bounded loss proof as ordinary removals. A production-replayed
pair suffix demonstrates the prior missing check. Public geometry exposure is
an information boundary, never a known-dead certificate. No hidden role is read.
Completed57-case serial worker:session29442. Loaded source fingerprint:
`734e5ddec8c21ab07ad0649b6b252be6c4b981ec34a6ef08e674dd4182bc2110`.
Lab15 control COMPLETED7/15, mean66.3ms, slowest910ms; unchanged source.
Report:`HUMAN_REFERENCE_LAB_MACRO_CONTROL_2026-10-24.md`.
Natural42 control COMPLETED32/42, mean60.1ms, slowest1505ms; same ten failures.
Report:`HUMAN_REFERENCE_MACRO_CONTROL_CHALLENGE_2026-10-24.md`.
Lab remains7/15: the correctness fix alone does not improve the lab gate.
All eight failures remain, with repeated actual failures on several boards.
The expanded gate now requires natural140 AND lab15, then unseen20.

New OPTIONAL `clockRecovery:true` considers tray debt before active-clock digging
only while a public route estimate leaves more than two spare moves. It also
orders equal-room exit witnesses by that debt. Urgent and nonclock ordering is
unchanged, defaults remain off, and the estimate never prunes or certifies safety.
Tests include a production-replayed clock route, urgent/nonclock equality, private
getters and192 additional hidden-world controls. No campaign gain is claimed yet.

COMPLETED:serial8-case protected-width1 control, then42-case
protected-width1 challenge, then42-case protected-width2 challenge.
Runtimecede8f0; fingerprint:
`cd0cedc57a268e539245c20cfc69a9bca354f2ed438196c53d6c77d471eec168`.
Completed reports:
- `HUMAN_REFERENCE_OPEN_TWIN_WIDTH_1_CONTROL_2026-10-24.md`
- `HUMAN_REFERENCE_OPEN_TWIN_WIDTH_1_CHALLENGE_2026-10-24.md`
- `HUMAN_REFERENCE_OPEN_TWIN_WIDTH_2_CHALLENGE_2026-10-24.md`

The old shell handle is missing after the host changed; all three canonical
reports exist and confirm unchanged source. That old worker is terminal.
Protected width1:7/8 control,33/42 broad; protected width2:32/42 broad.
Neither is promoted. Width1 loses84/99/102/107/112/123/125/136/143; width2
loses50/84/99/102/107/112/123/125/143/147. Slowest1505.1ms across these runs.
The manual open-twin guard does not universally improve play: width2 previously
cleared123 without it, and now fails123. Actual trace comparison found45 equal
decisions; then protected24 consumes open17 (picture11) with tray[33], whereas
unprotected discovers23. The observed23 matches33, leaving17/24 available for
later. This is evidence against compulsory pair consumption, not proof of a
unique winning route or permission to know23's picture before its actual reveal.
One CPU-heavy simulation at a time. Never restart for a polling timeout, or kill
app/Gemini helpers.
The old raw-short full run was deliberately stopped after emitting69 ONLY for
the reproduced false-certificate physics bug. Failures already included46/50/52/69.
Session35017 and its owned worker39728 are terminal; no complete raw full score.
Its successful physical prefixes remain valid, but its explanations predate relief.

Research control settings:
```json
{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles"}
```
Active candidates add `shortInformation:'recoveryAware'`, `informationWidth:1`
or2, and `protectOpenTwin:true`. No per-level policy or best-of merging.

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
