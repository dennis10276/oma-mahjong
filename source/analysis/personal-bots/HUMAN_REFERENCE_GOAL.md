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

Read-only metadata refresh2026-10-23T22:43Z:140 first clears through156, no later
clears, zero boards decoded. Refresh metadata only with selectedLevels:[].
Dennis authorized count comparisons without old17–99 recordings on2026-10-22.
Prefer exact opening, then original-version fixed table, current fixed definition,
then current classic/aspect1.5. The last two are explicitly NOT historical-identical.
Keep every unavailable board/label unresolved, never silently exclude it.
Old-level replays restart at try1 and do not replace first-clear targets.

## Current code, tests and active experiment

Latest runtime:`b2d3c5f`; baseline key recovery:`a5cb7db`;
dependency route cache:`0ead64d`; information audit:`2c10828`.
**52/52 offline tests pass** in approximately4s, including2688 concealed-world
clock/nonclock controls,37 real unseen-identity probes and a neutral-pair reveal.
The shortRoles policy has completed140 levels; the short-probe policy is still
running. The development gate remains unmet and the unseen20 gate is unopened.
An isolated `public_known_recovery.js` helper now constructs ordinary one/two-tap
tray matches, open twins and known pairs, including a mate thawed by the first
removal.144 standalone production/replay checks pass. It is NOT imported by
the running actor/search and no campaign gain is claimed. The new registry
test is staged; rerun the complete suite after the frozen full runs finish
(the last executed complete suite remains52/52).

The three-action role-payoff screen completed7/8, source unchanged, slowest
1504.5ms. It clears121 on try3 while retaining92try3 and50/147try1; only137
fails. This is an improvement over the six-of-eight controls, NOT a full score.
Both42-level runs finished with unchanged source: shortRoles32/42,
full-role short probes33/42. Tool session55597 is terminal, not a live runner.
Reports:`HUMAN_REFERENCE_SHORT_ROLE_CHALLENGE_2026-10-24.md` and
`HUMAN_REFERENCE_SHORT_PROBE_CHALLENGE_2026-10-24.md`.
Fingerprint:`e5c97c9a0d5d0beb06e08ee1befd7dc0923703a4a5ab0fb53add4f33b474588f`.
The dominance optimization is implemented, default off. Its seven-case serial
control completed5/7 both ways; every attempt's tap/remaining-tile/outcome count
matches. Mean decision time394.5→364.0ms (7.7% in this single control),53 actual
dominance stops, slowest1520.1→1516.7ms. This is measured scope, not a universal
speedup or proof that every timed action sequence must be identical.
Source:`5df95cb01cd2179c69fa98495b1b500f69572ff1a8e83fd0f899247f9ac182af`.
Reports:`HUMAN_REFERENCE_DOMINANCE_CONTROL_2026-10-24.md` and
`HUMAN_REFERENCE_DOMINANCE_OPTIMIZED_2026-10-24.md`.
ACTIVE: second full run, full-role short probes with informationDominance enabled.
Tool session35017; second worker PID39728, started2026-10-23T23:18:52Z.
Its140-case header matches the same5df95cb source. Last collected snapshot reaches
43; do NOT extrapolate a whole-catalog score from it. Pending report:
`HUMAN_REFERENCE_CATALOG_SHORT_PROBES_2026-10-24.md`.
Hold loaded runtime unchanged until it finishes. One CPU-heavy simulation at a time.
Never restart merely because a polling call times out; never kill app/Gemini helpers.

Research baseline settings (not a released/default/frozen winner):
```json
{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true}
```

## Current controlled evidence

| Experiment | Scope/result | Important limitation |
|---|---|---|
| Key recovery |31/42, unchanged; slowest1504.7ms |111 isolated try2, not a full129 score |
| Route cache |31/42, unchanged; slowest1510ms |No new count gain or measured full speedup |
| Role information |6/8;121try3,92fails |Tradeoff, not promoted |
| All-field information |5/8; additionally loses149 |Not promoted |
| Two-carrier proof threshold |6/8 with/without roles |Does not solve92/121 tradeoff |
| Frontier-only role information |6/8; restores92, loses121 |Not promoted |
| Short information, with roles |6/8;92try2,121try1,137try1 |Real tray losses on50/147 |
| Short information, without roles |6/8; same new successful-try counts |Also loses50/147, not a numerical cap |
| Carrier-aware short information, roles |6/8;92try2,121try3,137try1 |Still loses50/147; slowest1511.7ms |
| Carrier-aware short information, no roles |5/8;121fails again |Still loses50/147; slowest1507.8ms |
| Immediate role clues |6/8;92 restored,121/137fail |Slowest1506.2ms, not promoted |
| Three-action role payoff |7/8;121try3 and92try3 together |Only137fails; slowest1504.5ms |
| Three-action role payoff, challenge |32/42; no new losses in that42 |Slowest1504.4ms; not a full score |
| Full-role short probes, challenge |33/42;81/93/112/124/137 now clear |Loses50/138/147/152; slowest1515.6ms |

Corresponding dated reports:KEY_RECOVERY, ROUTE_CACHE, RECOVERY_ROLE_INFORMATION,
RECOVERY_ALL_INFORMATION, ROLE_DEEP_PROOF, DEEP_PROOF,
FRONTIER_ROLE_INFORMATION, SHORT_ROLE_INFORMATION, SHORT_INFORMATION,
CARRIER_ROLE_INFORMATION, CARRIER_INFORMATION, IMMEDIATE_ROLE_INFORMATION and
SHORT_HORIZON_ROLES,
all prefixed `HUMAN_REFERENCE_` and suffixed `_2026-10-23.md`.
Each preserves its exact settings, source fingerprint, provenance and slowest move.
The two42-level challenge reports use the2026-10-24 suffix. ShortRoles still
fails81/84/93/99/102/107/112/124/125/137. Short probes fail50/84/99/102/107/125/
138/147/152.111 clears in both screens but its prior full-run instability remains
unresolved. The other98 baseline-passing levels have not been revalidated, so
neither130 nor131/140 may be claimed from these challenge counts.

## What the public diagnostics actually establish

92: first attempt identical for all59 decisions with/without passive roles.
Second attempt:29 identical decisions before choice30, identical public projection,
clock already removed. Roles choose known13 tile55 (consumes open13 twin) on a
nine-tap information path. Roles17/23 become readable after5 taps;22/28 after9.
ALL FOUR remain geometrically blocked, not already deduced mechanically free.
Non-passive chooses known12 tile72, then remembered closed28 tile60;
the boundary is60's unobserved role after one known removal.
Never feed the later actually revealed picture back into hypothetical ranking.
Repeated43-tap losses with44 left do not alone prove identical later paths.

121: first23 decisions match, then roles choose65 while baseline chooses78,
with the clock already gone.65 reveals blocked role43 after ONE tap.
Thus neither a clock-only mode switch nor removing all blocked-role clues is justified.
No tile55/72/60/65/78 or level-specific preferences may enter runtime code.

Short-information ordering prioritizes a shorter safe observation prefix over
bulk heuristic pair progress, behind physical overflow and below constructive
win/clock witnesses. It clears121/137 on try1 but loses50/147.
Carrier-aware mode adds the existing two-point unseen-mate carrier penalty
to prefix length. This is a heuristic, NOT an optimal cost or safety proof.
Successful-tap availability memory was considered but no current regression
has been established as caused by its absence; do not claim it implemented.

Regression comparisons:50 diverges on its FIRST decision with empty tray:
short probes peek90; baseline takes the known28 pair91/93 first.147 has6
identical actions, then short probes overwrite open80 with82, while baseline
commits known10 tile80 then matches74. These first divergences guide diagnosis;
they do not prove that one action alone makes the complete board unwinnable.
Never encode these IDs in policy.

Immediate-role scoring keeps first-action readable TARGET IDs through a known
neutral recovery prefix. Its transposition identity includes that latent target
set; raw physical/metric/proof cache keys remain unchanged. It still yields6/8.
The current three-action payoff horizon is a global heuristic experiment,
not a level cutoff, optimality theorem or reduced known-route search depth.
ALL predicted new observations, even unrewarded ones, still count as unknown
for death-certification guards.51 tests include a four-tap delayed reveal that
must not become a known-world death claim merely because its reward is gated.
After this control, broaden the promising short-probe policy to all42 challenge
levels, even if50/147 remain regressions: do not confine optimization to this8.

Public audit tool:
`node source/tools/sim/refit/human_reference_information_probe.js LEVEL ATTEMPT PHYSICAL_TAPS PROFILE_JSON`.
It walks only known transitions; reports visibility indices, remembered values,
unknown roles and public availability; stops before unobserved values.
Diagnostic capture is not a canonical timing benchmark.
`human_reference_compare.js LEVEL profile CURRENT_JSON ATTEMPT ALTERNATIVE_JSON`
compares actual public decisions in fresh serial children; traces stay in memory.
An identical projected state alone does not prove identical internal pending plans.

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
