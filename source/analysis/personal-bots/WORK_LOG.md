# Personal-bot research checkpoint

## Own-person causal 3-bucket physical factor count head and pre-opening forecast freeze, 2026-10-18

Implemented `ownCausalFactor3Bucket` (`personal_causal_factor_head.py`, `personal_causal_factor_data.py`,
`personal_causal_factor_sim.js`) and integrated it into `personal_fresh_count_fit.py`. Every player's
predictions use strictly their own earlier unassisted unchanged-board first-clear episodes (`end < target['start']`),
public opening geometry at `moves === 0` (`blockedFreeCount`, `takeableWithTakeableMate`, `meanMateDepth`,
`takeableWithVisMateFrac`, `clockSlackRatio`), and own-bot autonomous simulation chains (`peek: 0, end: 0`).
All four earlier forecast ledgers (`prospective-forecasts.json`, `count-profile-forecasts.json`,
`personal-plan-forecasts.json`, `personal-fresh-forecasts.jsonl`) are verified byte-for-byte unchanged.

- Stage 0 severe trap detector (`is_severe_trap` gated by own recent `wonOn >= 6` history) identifies
  6/6 (100%) of `wonOn >= 8` held-out episodes with 0 false positives across `HELD`, `RECENT`, and `PROSPECTIVE`.
- Within-`hasClock` regime standardization (`regime_zscore`, `win_size=25`, with a `<3` prior clock-board
  cold-start guard at the `lv 80` onset) removes secular `lv`-schedule confounding (`corr = 0.77..0.999`)
  and projects the 26 public opening + own-bot simulation features onto 10 orthogonal physical factors
  (`bot_surv, sf14_surv, mem_surv, base_solv, retry_jump, open_trap, shallow_large, buried_mate, clock_tight, p8_dec`).
- Causal Bucket `3+` representative (`choose_bucket3_action` from the player's own last 7 non-trap `3..7`
  episodes in `before`) selects `Action 3` for Dennis, PUK, and Gerda, and `Action 5` for Mrs. Doubtfire,
  scoring on 20/20 (100%) of non-trap `wonOn >= 3` held-out episodes.
- Evaluated under `attempt-tolerance-and-8plus-v2`:
  - Pre-held `DEV`: Dennis 17/25 (68.0%), Mrs. Doubtfire 17/25 (68.0%), PUK 11/17 (64.7%), Gerda 14/25 (56.0%) — 59/92 (64.1%) total.
  - Fixed 80-episode `HELD` benchmark (`ownCausalFactor3Bucket` and `selectedPrequential` both identical):
    Dennis 20/20 (100.0%), Mrs. Doubtfire 18/20 (90.0%), PUK 19/20 (95.0%), Gerda 20/20 (100.0%) — 77/80 (96.25%) total.
  - `RECENT` progression episodes (`ownCausalFactor3Bucket` and `selectedPrequential` both identical):
    Dennis 19/23 (82.6%), Gerda 4/5 (80.0%) — 23/28 (82.14%) total.
  - Completed post-freeze `PROSPECTIVE` episodes: Dennis `lv 151..155` 5/5 (100.0%), Mrs. Doubtfire `lv 104..106` 3/3 (100.0%) — 8/8 (100.0%) total.
  - Frozen 86 strictly unopened progression forecasts against read-only live check `live-openings-2026-10-18T23-41-28-691Z`
    in `analysis/personal-bots/personal-causal-factor-forecasts.jsonl`.
- Validation: all 210 Python unit tests and all 106 JavaScript tests pass; `git diff --check` is clean.

## Fresh personal fits, verified1.58 and predictive-tail correction, 2026-10-18

Previous goal turn was concrete progress (exact209-tap bee deferral, snapshots and tests). This
turn verified the SAME full job31465/PID8836 live, then terminal0; scoring/snapshot27487 also
completed terminal0 inside that copied closure. All276 original boards/80 held IDs at32runs/
32tries,276 full old-engine control chains, zero caps. Full outcome-style result STILL selects
alwaysFirst before held labels: Dennis9/20, Mrs7/20, PUK13/20, Gerda9/20. No method reaches80%.
All252 legacy controlForest points remain identical under v2. REJECT this candidate for the
objective; modest action NLL did not translate into count accuracy. Canonical scored snapshot:
personal-outcome-styles-scored-2026-10-18T15-48-20-154Z (309 files/360 dependencies), manifest
ca58688c83c8be932aa98f88801bae7c939f168a98dfa69a9479c216736eba61. No old job remains live.

Remote main is newer than the read-only local main checkout. Read immutable upstream commit
0514e550c7a77e8ecba19e7a41228e1ceb396266, not an assumed version. Core and play/version.json
identify1.58; all218 fixed boards51,53-269 match exact board IDs, physical neighbors and ice
neighbors against1.55. Source bytes match their Git blob IDs. Complete pre-alias proof is pinned
at app158-compatibility-2026-10-18T15-40-59-893Z (22 files). Only THEN registered1.58→1.55;
1.59 is still unknown/refused. Regenerated legacy attempts now665 matched of671, six unmatched;
do not misrepresent those remaining classic-record limitations as zero mismatches or complete
recording coverage. Exact replay-derived prefixes are independent of those table-count filters.

Fresh value-prefix generation12398 completed:445 prefixes (Dennis113, Mrs65, PUK57, Gerda210),
39,268 natural manual decisions. Preserved at personal-fresh-prefixes-2026-10-18T15-43-51-962Z
(319 files); its665-attempt context is nonempty and matches the completed regeneration. New
multi-version bank49641 completed using immutable old398/fresh445 sources. Identical versions
deduplicate; this real pair currently has ZERO changed-content versions of the sameAID. Do not
invent a live resumed-AID case. Synthetic resumed128 tests prove an older incomplete version
cannot acquire its later completion, target actions or winning label before its availability.

IMPORTANT availability correction: telemetry.js creates chunk t when putting it in a LOCAL
queue; PATCH/server receipt can occur later. Earlier reports' client-time gates are chronological
content controls, NOT independent server-upload proof. New strict FUTURE fitting additionally
requires a source snapshot actually observed before its request. Genuine old numeric forecasts
remain pre-opening and immutable; their score is unchanged. Historical client-time-only fits
are explicitly exploratory and cannot be promoted to genuine pre-start evidence.

Fresh fit47636 completed four independently fitted own actors/styles: Dennis113 versus74 own
attempts (+39), Gerda210 versus202 (+8); Mrs65 and PUK57 unchanged and BOTH exact static-weight
controls match (maximum difference0). No family prior or universal greedy rule. No synthetic
positive target is made from the bee feedback; its optional-pickup/capacity constraint remains
an own-person retrospective regression, including the actual mistake and subsequent recovery.
Bridge18389 completed445 fitting prefixes/78,536 base+style probability decisions and forward
posteriors to1e-12. These are TRAINING-prefix numerical checks, not held action accuracy.

Scheduled all29 newly available first-clear campaigns AFTER each person's frozen parent end:
Dennis128-150 (23, including hard132/150), Gerda63-68 (six, INCLUDING pending68). Replay99 is
not a primary recent target, but its behavior may inform Dennis's own actor. Recent fit8405
completed29 earlier-client-time models, explicitly historical exploratory, excluding every
target-campaignAID and later-created prefix. Also prepared95 future BOARD tasks: Dennis151-174,
Mrs104-127, PUK54-77, Gerda69-91 (already-open68 excluded). These are NOT numeric forecasts;
planning used the15:27 raw snapshot and live openings MUST be checked again before freezing.
Next count stage must measure both matching ownOutcomeBase0/ownOutcomeStyles0 profiles on the
29 recent/95 future boards, calibrate only earlier own outcomes, and retain all old misses/IDs.

Fresh actors/versions/request schedule/source proof were pinned BEFORE later count-head edits:
personal-fresh-own-fits-2026-10-18T15-59-12-900Z (364 files/31 dependencies). Use THIS immutable
fit source for loading models, not a falsely matching mutable root hash after the tail correction.
The current native/runtime78536 proof remains valid: the corrected count optimizer is not part
of that predictor's numerical implementation. Original full-count parents and model banks stay
separate. No new model is promoted or numeric future forecast frozen yet.

Fixed a real v2 optimization edge: analytic forecasters discarded remaining probability beyond
20/128 despite the authorized8+ bucket. best_prediction_with_tail now includes a wholly10+
tail for8+ decisions without crediting it to low-try tolerance or inventing a human winning
label. All raw/contextual/smoothed/mixture/survival candidate entry points use it. RF categorical
probabilities and scoring of frozen point forecasts are unchanged. Tail audit reproduces ALL
1008 old analytic numeric controls/252 campaigns before correction; this real cohort has ZERO
changed points, so selected scores remain9/7/13/9 and no performance benefit is claimed.

Do not introduce an oracle end-solver from the six-tile auto cleanup. Read game finishSafe:
automatic play requires EVERY tap order to be safe (plus no clock/ice/locks/Joker), not merely
one found winning path. With zero computation caps, it does not explain this candidate's early
tray losses; old Dennis failure audit also had no losses below24 remaining. The bee countercase
proves useful spare-capacity behavior, not a missing automatic-win exploit or universal solver.

Latest167 Python/98 named JavaScript tests and git diff --check pass. Genuine primary stays
Dennis10/20 first cohort and23/44 overall; level150 forecast1/actual3 remains a miss. Four ledger
hashes are unchanged. Goal remains ACTIVE and unmet; next work is fresh autonomous count
measurement and properly frozen future validation, not another claim from action likelihood.

## Level150 bee clarification and fresh scores, 2026-10-18

Human confirmed the bee at4:32 was an unnecessary SECOND-slot pickup, not either later third-slot
event or a confirmed motor misclick. Winning third attempt b104ad08-3921-4c92-8b7d-94e8c3d8f348
reconstructs all209 manual frames exactly, ending before automatic cleanup of six remaining
tiles. Android1.58 recorded board150 exactly matches the old verified1.57 board hash
611ba5caa68a67752f8b384970a951ac7fe221ba1dce263b676abb45351b56af. This is board-specific
verification, NOT a blanket1.58 alias or approval to invent every future1.58 board.

Bee28/picture1 is taken at272415ms (tap189), held32518ms, matched by31 at304933ms (tap202).
Exact constructive deferral: omit early28, keep all other actual taps, probe31 when the human
did; without a waiting bee it exposes its bee face. THEN tap the still-free visible28, pairing
atomically with peek31. No hidden future picture selects that inserted action. All209 light
and real-engine alternative frames agree. Same209 manual taps, same alive/tray/removal count,
same six-tile pre-auto position. Late-window maximum occupancy3→2; allthree third-slot states
in that window disappear. Whole-attempt maximum remains3 due earlier states: do not claim a
whole-game maximum reduction. This is an own-person feedback/regression case, not a pre-start
forecast, a universal optimal-policy rule or proof that the human never makes unnecessary picks.

The initial diagnostic looked at two later third-slot events (taps193/197). Keep them separate
from the human clarification. Their public recovery graphs contain unknown faces; no unique
full escape is proven. Unknown reveals are unresolved, not fabricated losses. Never populate
bot choice features from the complete hidden board used only to validate retrospective physics.

Read-only refresh45692 completed; new outcomes exported41675. Four ledger hashes unchanged.
Primary first20 Dennis stays10/20=50%; all44 qualifying completions now23/44=52.27%. Level150
was frozen as1 before opening and actually won on3: retain this genuine miss. New frontier is
150, nextNEW level151 (verify1.58 rules/board before a numeric freeze). Legacy dataset still
refuses unregistered1.58 tables; do not assume its645 matched/5 mismatched report covers all
new recordings. Exact replay-derived prefixes/outcomes include150 without that table assumption.

Outcome-style pilot82402 completed terminal0 in copied run
analysis/archive/personal-bots/runs/known-plan-2026-10-18T15-26-08-976Z:276 original boards,
80 fixed held IDs,276 full old-engine control chains,2runs/3tries paired current profiles,
zero caps. Action snapshot personal-outcome-styles-actions-2026-10-18T15-26-03-459Z has305
files/360 immutable dependencies. Pilot snapshot inside the SAME run is
personal-outcome-styles-pilot-2026-10-18T15-35-12-148Z (306 files/360 dependencies).
Full32/32 job31465 subsequently finished and was scored; see the newer checkpoint above. Root
refreshes never changed its copied inputs. Prospective80% remains unmet; these earlier case
tests were159 Python/98 named JS, with the later expanded validation recorded above.

## Outcome-anchored whole-attempt candidate, 2026-10-18

After the selective clock correction fitted zero rates, a different hypothesis is now tested:
own earlier natural success/failure trajectories anchor correlated behavioral experts for an
ENTIRE attempt, rather than independently resampling action quality on every tap. Each person
has their own28-feature residuals and separately shrunk initial-new/retry priors. Features add
kind-by-tray-pressure interactions to the16 public route/position features. No shared family
style, universal greedy finishing rule or target-outcome selector is introduced. A sampled
success-associated expert is NOT guaranteed to succeed. Earlier tool/shuffle/missing boundaries
are censored, not labelled losses; availableAt and immutable original AID versions gate every
training outcome. Each trajectory has64 effective decision mass before twenty-prefix decay.

Fit64843 completed terminal0: all138 frozen own actor identities/197 static-policy controls and
eight initial/retry summaries remain unchanged. Native/JavaScript parity matches38,028 held
probability decisions AND final forward posteriors to1e-12. New/retry action NLL respectively:
Dennis1.709515→1.694323/1.642094→1.632979; Mrs1.879650→1.868772/1.826384→1.811984;
PUK1.777165→1.784799/1.793173→1.800325 (WORSE); Gerda2.002004→2.000341/2.112140→2.108485.
Do not hide PUK's regression or interpret these action scores as winning-attempt accuracy.

Runtime samples a fresh seed-stable expert once per attempt, without inspecting target labels,
end events or human future actions. The paired zero-residual control uses the same physicalPlan0
lifecycle, so no generic clock controller can override the personal decisions. Count code uses
the immutable old copied reconstruction closure, not the refreshed working raw exports, and
must reproduce276 old full32-run/32-try control chains on the original276 boards/80 held IDs.
Pilot2runs/3tries is quality evidence only. Full32/32 and v2 historical scoring are predeclared;
future numeric forecasts/ledgers remain untouched. Current159 Python/96 JavaScript tests pass.
The prospective80% target is still NOT met; full count/pilot results are not yet established.

## Completed full counts,8+ scoring and selective no-change result, 2026-10-18

The full known-tray run87140/PID4416 has FINISHED successfully, not still live. Counts/scoring
completed inside its copied immutable closure:276 boards/80 unchanged held IDs,32 runs/32 tries,
zero computation caps,552 exact old-engine chains and252 unchanged numeric count controls.
Scored evidence was copied byte-for-byte to personal-known-plan-count-scored-2026-10-18T15-09-37-493Z
(286 files/36 dependencies; manifest d093f32610ffaa037cee5df4beb1a074a02f7d52a4bf5214a11d7128a7ca6160).
Pre-held selected methods remain alwaysFirst: Dennis9/20, Mrs7/20, PUK13/20, Gerda9/20. Reject
this candidate for the80% objective; improved action fit did not yield successful count forecasts.

The authorized shared8+ success bucket is added as a UNION with the original actual-dependent
tolerance: actual1-3 exact,4-5 within1,6+ within2, OR both forecast/actual>=8. Existing numeric
forecasts, outcomes, cohort memberships and four ledger hashes remain unchanged. Fixed rescoring
adds ZERO hits to the current genuine score reports: Dennis first20 remains10/20=50%, all34
18/34. The unchanged full-known-plan selected scores also remain9/7/13/9 of20. Legacy copied
run sources retain their original rule to verify252 old numeric controls; the new8+ comparison
is separate and never reselects methods on held labels. Prospective v2 score-only evidence is
pinned at prospective-score-2026-10-18T15-07-41-859Z (308 files).

Selective reconsideration fitting completed all138 own actors using an immutable source-aware
loader, not refreshed working-copy raw bytes. All197 auxiliary-policy action controls and eight
initial/retry summaries remain exact. Native/JavaScript audit matches38,028 probability decisions
to1e-12. Every fitted initial/retry rate is ZERO: this constrained correction is a no-change
result, not evidence that clock adjustment has been learned, not a count improvement and not a
candidate worth launching another hours-long count run for. Synthetic tests prove nonzero
transfer works when supported, so zero is not an empty-mask implementation failure. Earlier
recipient choices are present (Dennis weighted maxima4.456 initial/8.450 retry), but the auxiliary
policy's small bad-proposal mass does not justify further transfer with the declared shrinkage.
Do not tune that shrinkage against held actions to manufacture a positive rate.

The human clarification remains: dig for the clock first, reconsider when the tray crowds,
prefer pairing before clock removal if it leaves at mosttwo occupied slots within the budget,
or three with a known ready mate. Safe digging must not be replaced unconditionally by pairing.
Latest152 Python tests and96 named JavaScript tests pass, as does git diff --check. Work is NOT
complete: prospective80% has not been reached. Next research must address whole-attempt own
behavior and new own recordings, not equate these rare clock-cue tests with the target.

## Fresh genuine-score checkpoint and next priorities, 2026-10-18

Read-only refresh50401 completed terminal0, raw snapshot2026-10-18T11:50:29.173Z:643 attempts,
643 exact board matches, zero mismatches (previous617). All four forecast-ledger SHA-256 hashes
are UNCHANGED; no append, model promotion, new freeze, release or Firebase write. Scoring was
actually invoked through progression_forecasts.py score. IMPORTANT: progression_score.py is
an imported helper with NO scoring CLI; calling that file alone does not refresh the primary
report. Older checkpoint statements with Gerda0 were stale, not current primary evidence.

Current genuine primary first20 Dennis cohort remains10/20=50%, all34 completed qualifying
Dennis forecasts18/34=52.94%. Mrs2/11. Gerda opened6/completed5/correct3, with68 pending; PUK0.
No80% claim is supported. Original same-model misses remain in the cohort. Scores/raw/ledgers/
sources are pinned in prospective-score-2026-10-18T11-52-16-715Z (305 files). The preserver
recomputes ALLfour saved scores exactly from frozen ledgers/outcomes, checks frozenAt<opening,
and explicitly claims score-only evidence, not a new reconstructed-board simulation proof.

Fresh Dennis progress reaches140, although his latest actual end event is a REPLAY of99. Do
not predict100 as the next NEW progression target;141 is the next new level from the observed
frontier (confirm installed version/board before any numeric freeze). Latest Dennis event is
Android1.57; Gerda's pending68 is Android1.58, so do NOT assume the old1.57/main snapshot is
still the newest game code. Read main/version instructions and sources without editing/releasing.
The old 'Dennis128 try2 pending' wording confused a prediction with observed attempts: raw128
start/end are BOTH at1, sameAID across a long hide/resume. Its frozen prediction2 really missed
the relative winning try1. Do not relabel it or split the paused same attempt to improve scores.

Root raw/mimic inputs have changed, so old12-feature training fingerprints are deliberately
STALE in the working checkout. Authoritative feature/models/proofs were pinned BEFORE refresh:
personal-clock-crowding-cue-actions-2026-10-18T11-48-04-402Z (293 files,nine dependencies).
Use an immutable source-aware loader before fitting selective reconsideration on that old
398-prefix/138-model schedule; never silently bypass its hash guard or present refreshed root
bytes as its old source. New later plays can inform NEW future-request models, but must not
rewrite earlier actor memberships or old held-cohort predictions.

Priority: learn from the additional own later games for upcoming NEW levels while retaining
the unchanged80 development IDs/old138 causal models. Appended chunks can complete an old
previously incomplete AID (128 is an example): never merge old/fresh prefix versions solely by
AID and accidentally give an earlier actor later actions/availability. Preserve old prefix
snapshots; latest future actors can use the latest available completed/censored prefix version.
Then fit/test selective proposal reconsideration, not the overbroad cue that worsened held NLL.
Improve planning runtime with exact parity before many full count runs; keep forecasting scope
at new progression levels and retain every earlier genuine miss. Other persons, especially
no-clock PUK/Gerda, still require their own full-attempt behavior work, not Dennis's clock rule.

Negative mechanics evidence: in the frozen398 prefix bank, physics boundaries occur onlyONCE
each for PUK/Gerda, NONE Dennis/Mrs (PUK initial-new1, Gerda initial-new0). Dennis36 complete,
37 auto-stopped,1 incomplete; Mrs48/15auto/2 incomplete; PUK50 complete/4auto/2shuffle/1boundary;
Gerda172 complete/13auto/14shuffle/2conflicting/1boundary. A broad simulator-physics mismatch
is not established by their low autonomous win rates. Do not invent one or discard those rows.
Latest validation96 named JavaScript/143 Python tests, observer honesty and git diff --check
pass. The independent full known-tray job87140/PID4416 later finished; see the completed-count
checkpoint above for its unchanged controls, scored results and preserved copied evidence.

## Adaptive clock results and selective reconsideration, 2026-10-18

Adaptive fit80012 terminal0:138 independently fitted ownAll models,197 exact auxiliary/base
per-prefix controls, eight unchanged initial/retry summaries. Runtime proof matches38,028
control+personal probability decisions to1e-12. Actions pinned at
personal-clock-strategy-actions-2026-10-18T11-30-12-648Z (286 files,seven dependencies).
Initial NLL Dennis1.709515→1.701166, Mrs1.879650→1.872617; retry Dennis1.642094→1.635214,
Mrs1.826384→1.818521. PUK/Gerda unchanged. These are modest ACTION improvements, not winning
counts. Crucially, latest component-weight gaps are only0.001195 Dennis/0.001859 Mrs: modes
nearly collapse. Do NOT claim distinct adaptive strategies have been learned from this fit.

Adaptive count pilot53204/PID31288 completed terminal0:276 unchanged boards,80 held IDs,
552 old-engine full control chains, no generic clock decisions, zero computation caps, and
exact current paired no-clock chains. Two runs/three tries only; no human labels/accuracy.
Pinned at personal-clock-strategy-count-pilot-2026-10-18T11-44-28-497Z (279 files,622 immutable
dependencies). The original full known-tray run later completed; see the completed-count checkpoint.

Crowding diagnosis keeps ALL1111 observed clock states (137 prefixes/12,712 callback controls).
Dennis579 total,19 crowded; onlySEVEN crowded states on initial-new levels. Six of those select
a known pair: five BEFORE clock removal and one matches the clock itself. Found within-budget
two-slot/pair support exists in onlythree of those seven, and each selected a pair. Mrs has four
initial-new crowded states. This supports the human cue descriptively but is sparse evidence,
not an80% winning-count result or proof of a latent switch. Clock pictures are known in ALL1111
states: an unseen-clock-target theory is contradicted, not justification for a hidden oracle.

Added a simpler own-person crowding correction on the frozen auxiliary policy. Trigger is a
public currenttray3 OR a FOUND clock route ending at3 with no known ready mate; candidate known
immediate pairs must have a found within-budget exit≤2 or3 with a known mate. Independent own
initial/retry rates are shrunk with one current-baseline pseudo-observation. This is an output
correction over a causal auxiliary filter, not a newly identified generative latent strategy.

The first cue mask incorrectly used only F14/isPair: actual tray matches are single-tap actions,
with visibleTrayMatch atF64 or visiblePeekMatch atF66. It silently produced zero Dennis cue
counts. Rejected/no-op source/models are pinned at personal-clock-crowding-cue-failed-2026-10-18T11-41-55-048Z
(286 files,seven dependencies). Fixed the root pair definition and added a real single-tap tray
match regression. Refit keeps ALL138 identities/197 exact auxiliary controls; native/runtime
proof again matches38,028 probabilities to1e-12. Data include40 Dennis/45 Mrs cue opportunities;
other people's clock cue data are zero, so they remain unchanged.

This broader cue does NOT improve held action fit versus its auxiliary policy: initial Dennis
1.701166→1.702470/Mrs1.872617→1.873858; retry Dennis1.635214→1.635773/Mrs1.818521→1.820581.
Do not promote it or pretend it already improves winning counts. Its structural weakness is
that ANY bad alternative can trigger reweighting, even when the base policy favors a different
SAFE direct route; unrelated safe choices should not be treated as failures to reconsider.

Next candidate is SELECTIVE proposal reconsideration, not unconditional pairing. Implemented
and unit-tested personal_clock_reconsider.py: donate probability ONLY from a proposed known
three-slot/no-mate clock exit (or a known trap when currentlycrowded), to known immediate pairs
with found acceptable clock exits. Preserve all other safe/non-pair choices exactly. A single
per-person rate has a convex own-action likelihood with one baseline/no-change pseudo-vote;
unrelated safe choices provide no switching evidence. Three math/mask tests pass. This is only
a prototype: no138-model fit, JS runtime bridge, autonomous counts or80% claim for it yet.
Next goal turn should fit this selective rate causally, NOT run/promote the overbroad cue.

The current12-feature reference remains unchanged. Before a full32×32 adaptive/cue count run,
optimize repeated legality/step bookkeeping WITHOUT changing feature values, search order,
node counts or bounds; require all398/33,543 parity and the frozen276-board paired pilot chains.
Keep reference artifacts immutable and validate their pinned sources instead of claiming a
changed root is still fresh. Clock planning dominates throughput; do not launch many needless
hours-long full candidates while existing full measurements are live. New/recent progression,
not replays, remains the primary gate; all prior misses/forecast ledgers must remain intact.

## Tray-crowding clarification and adaptive clock fitting, 2026-10-18

Previous goal turn made concrete progress (clock-route personal fits, paired pilot and separate
dig prototype); both known-tray full and clock-route pilot handles were revalidated live at the
start of this continuation. The clock-route pilot subsequently completed, terminal0:276 boards,
80 unchanged held IDs,552 old-engine full control chains exact, two runs/up tothree attempts,
zero caps and zero generic-clock-controller decisions. Pinned at
personal-clock-route-count-pilot-2026-10-18T11-24-38-037Z (268 files,620 immutable dependencies).
No human labels or accuracy exported. Later test edits intentionally stale its ROOT fingerprint;
the archived source/dependency closure, not changed root bytes, is authoritative.

Dennis then clarified the adaptation cue: a crowded tray. Digging straight to the clock can
leave THREE occupied slots. If TWO occupied slots are possible within the clock budget, he
usually first matches a pair; reaching the clock with three can be reasonable when a known easy
tray match is ready. Treat this as an individual strategy hypothesis, not a universal greedy
finish rule or proof that every human clock route is fully planned before tapping.

Added public clock-strategy route descriptors for an at-most-two occupied-slot exit, three with
a known physically free tray mate, and pairing BEFORE the clock within the actual move budget.
Digging/probes plus urgency/crowding interactions remain separate, independently weighted
features. Search never supplies newly uncovered hidden pictures, and unknowns/bounds do not
become invented traps. All twelve features are zero after clock removal or without a clock.

First full feature run84017 failed an explicit [0,1] feature-range guard, terminal1, and emitted
no valid full artifact. An atomic known peek-pair can remove TWO clock-frontier tiles: the new
digging indicator accidentally preserved numeric2 instead of boolean1, doubling pressure.
The failed source/progress/pilot is pinned at personal-clock-strategy-failed-2026-10-18T11-21-53-591Z
(273 files,two dependencies). Fixed the indicator, added the actual two-tile regression, and
reran the SAME full cohort; no action, prefix, board or human label was dropped or relabeled.

Corrected65997 is terminal0:398 prefixes,33,543 exact base feature/action/frame/result controls,
1,111 clock states (Dennis579/Mrs532),954,085 nodes,3,180 bounded root unknowns,109.904 seconds.
All33,543 choices have valid represented indices, including all clock actions. This matters:
latent sequence fitting does not silently bridge an unobserved action. Feature source fingerprint
13e6394ff23c64f8284883ffbdfb21f6cd3033997f45f4e16e66cb51b150d58b.
Pinned at personal-clock-strategy-features-2026-10-18T11-26-26-994Z (278 files,two dependencies).

Implemented two exchangeable own-person strategies with learned context-dependent switching,
not a fixed whole-route plan. Context includes current public tray2/tray3, found exit support,
information/urgency, and PREVIOUS observed dig/pair/route loss. It uses kindContext for tray
pressure, not a tray field that exists only in followed logs. Fitting may smooth older own
training sequences; held scoring/runtime use causal FORWARD filtering only. Initial-new and
other-attempt priors are separately learned. All138 frozen ownAll memberships remain fixed;
boundary coefficient0, penalty20, bounds4, EM8, own-prefix half-life20, seed20261018 declared.
No family winning labels or target actions enter the fit. No-clock players remain unchanged.

Native tests compare forward/backward posteriors with exhaustive latent paths, finite-difference
transition gradients, own/future exclusion, no current-choice context leakage and crowding-led
switching capability. Native/JS bridge agrees to1e-12 without logged tray/moves, and attempt
factories return fresh selectors compatible with Hard.rateChain.95 named JS/137 Python tests
pass. This proves mechanics/implementation capability, not that fitted modes actually separate
or that winning counts improve. Native fit is LIVE in session80012; preserve its sources while
running, then require197 held action controls/eight summaries and native runtime parity before
pinning actions. Next verify learned mode separation and autonomous paired counts on all80 IDs.
The full known-tray run87140/PID4416 remains live inside its immutable copied closure; no restart,
release, commit, branch, Firebase write, new forecast freeze or80% claim occurred.

## Human clarification: clock-first probing, then adaptation, 2026-10-18

Dennis explicitly clarified: on a NEW clock level he digs for the clock first to see whether
that strategy is valid, then adjusts if digging is not working. Do NOT reinterpret this as
planning the entire clock route before the first tap, universal greedy finishing, or a shared
strategy for every person. This insight motivates a separate clock-probing/adaptation hypothesis.
Fit its preferences/switching from Dennis's earlier own choices; keep other people's fits separate.

The prior full-known-route candidate has completed138 frozen ownAll fits,197 exact per-prefix
controls and eight unchanged initial/retry summaries. Native runtime proof matches38,028
control+personal probability decisions to1e-12, with exact own-person availability/exclusions.
Initial action NLL: Dennis1.709515→1.705663, Mrs1.879650→1.876173; retry Dennis1.642094→1.638837,
Mrs1.826384→1.823285. PUK/Gerda no-clock residuals are zero, their scores unchanged. These modest
likelihood gains do NOT establish winning-count accuracy. No candidate has been promoted.
Matching action source/models/proof are pinned in personal-clock-route-actions-2026-10-18T11-10-23-797Z
(284 files,13 immutable dependencies); features previously pinned at11-06-02-179Z (277/8).
The first action snapshot was correctly rejected because its validator hashed contents without
the filename prefixes used by the runtime proof. Matching the actual filename+bytes protocol
fixed archival validation; fitting was rerun after the archival-helper source changed. No
numerical feature, model preference, human label or held cohort was edited to bypass rejection.

Paired clock-route count pilot is LIVE: session11556/PID9348, fingerprint
259bacbae535ead683b70b149ca9cf2f290a7bae44c14993ac1de9acf40f10c9.
It reconstructs the same276 tasks from the immutable copied input closure, keeps all80 held IDs,
checks552 old-engine full control chains, and compares two current own-person profiles at2runs/
3tries. Both DISABLE physicalPlan; an assertion rejects any generic clock-plan decision.
Do not change its declared root sources or frozen snapshots while it runs. New unrelated source
files are not imported by the pilot. Computation caps are censoring, never human losses; no
winning labels/accuracy are exported by a pilot. The separate full known-tray job87140/PID4416
continues unchanged inside its copied closure. Poll those handles; do not restart on timeout.

Implemented a distinct nine-feature public clock-dig prototype. It adds dependency-frontier
removal/probing plus urgency and tray-pressure interactions to found-route validity evidence.
This permits learned adaptation as observations/pressure change, but DOES NOT yet implement or
fit a complete adaptive strategy. The prior full-route candidate is not relabeled as this one.
Digging is a feature, not an imposed action: all eventual weights must remain independently
fitted per person. Covered pictures never enter these features. Unit checks include hidden-face
permutation, initial unknown probes, later pressure, actual known removal and no-clock neutrality.
Separate first/last pilot preserves8 prefixes/all712 original physical/feature/result controls,
39 clock-active states,11,651 nodes,7 bounded unknowns; all39 states distinguish digging options.
No winning-count score or80% result is claimed. Preserve the dig pilot source-hash closure before
changing those new sources, then test a genuinely adaptive own-person option policy, not just
another permanently fixed full-route plan. Existing validation93 named JS/131 Python tests,
observer honesty and git diff --check pass; the new dig unit/pilot additionally pass separately.
The source-matched dig pilot is pinned in personal-clock-dig-pilot-2026-10-18T11-14-10-852Z
(279 files,two explicit immutable dependencies). Its original source hashes are preserved; do
not silently replace them after editing. A non-blocking follow-up asks what usually triggers
abandoning the clock dig (tray pressure, budget, blocked route, or another cue). No answer has
been assumed and current features alone are not claimed to implement a fitted switching rule.

## Personal clock-route features and frozen full run, 2026-10-18

The full paired known-tray count job runs from an independently copied, hashed closure:
analysis/archive/personal-bots/runs/known-plan-2026-10-18T10-47-22-831Z.
Session87140/PID4416 started2026-10-18T10:52:30.276Z, fingerprint
447c1a8c7268eefa95b0e4346e326efba07079d12b56e8590d8e7624261ca52a.
All323 runtime inputs are frozen, including four legacy mimic JSON imports and copied TABLES.
Original-checkout edits/data refreshes do not change this run. Do not alter its inputs or restart
it merely because observation times out. After terminal0, validate all276/80 IDs,552 old-engine
chains, zero computation caps and252 old count-control predictions; score inside that copied
root, not against the subsequently changed working checkout. Terminal2 means censored: no score.

Read-only raw refresh82229 completed, exit0, snapshot2026-10-18T10:56:05.830Z. Rescoring all four
existing ledgers preserves their SHA-256 hashes exactly. Dennis's primary first20 progression
cohort remains10/20; all21 completed predictions are11/21. Mrs remains2/11; PUK/Gerda have zero
qualifying primary progression campaigns. Alternative/tiny/replay cohorts cannot replace this
failed primary cohort. No forecast was appended or promoted; no80% claim is supported.

The new clock-controller diagnosis retains all80 held boards and four declared first-try seeds.
Dennis's generic controller chooses489/551 clock-phase physical taps (88.75%), and clock routes
are identical across all four seeds on15/20 boards. Mrs543/650 (83.54%), also15/20 identical.
Dennis exits79/80 clocks: tray occupancy0/1/2/3 is5/17/36/21, with onlyONE tray failure within
two subsequent moves. Mrs exits78/80 and has12 such immediate failures. Thus generic clock
ownership is confirmed, but a bad immediate clock exit does NOT explain most Dennis failures.
Exact human opening diagnostics observe16 Dennis exits (tray0/1/2/3:2/5/4/5) and11 Mrs exits
(1/0/7/3); unavailable/censored prefixes remain explicit, never fed to autonomous bots.
PUK/Gerda held boards have no clock, so clock changes cannot explain their failure gap.

Implemented a separate public-known clock-route feature policy, not a universal safe/greedy
controller. Twelve actual taps,256 expansions per canonical root, known pictures only; unknown
inspections/Joker twins and bounded search remain uncertainty rather than invented traps.
Features describe found route, found exit room, proven known trap, information and boundary;
the boundary weight will remain zero. All other coefficients are independently fitted to own
earlier choices, may favor OR oppose route/room, and no-clock residuals are zero. Autonomous
evaluation must disable physicalPlan; otherwise the generic controller bypasses these choices.

Pilot8 prefixes/712 choices passed. Full55178 terminal0 preserves all398 original prefixes,
33,543 base feature/choice/physical-frame/result controls exactly:1,111 clock-active callback
states,637,700 expanded nodes,1,402 unresolved root boundaries,84.232 seconds. No rows dropped.
This is feature instrumentation, not a fitted action-policy improvement or winning-count result.
The old numerical conditional-softmax optimizer is reused with explicit clock metadata; no
winning labels or family weights enter its138 frozen ownAll memberships. Next: independent
own-person fitting, native/JavaScript probability parity, then unchanged-board paired counts.
No release, commit, branch, Firebase write or prospective model promotion occurred.

## Optimized paired count pilot completed, 2026-10-18

Full feature/physics bitset proof is pinned in
personal-known-plan-count-bits-2026-10-18T10-27-04-584Z (255 files,22 explicit dependencies).
It took133.958 seconds and preserves all398/33,543 planning values, node counts and unknowns.
Regenerated native likelihood proof again matches197 prefixes/38,028 control+personal probability
decisions. Validation91 named JavaScript/126 Python tests and git diff --check pass; one additional
frozen-runtime-dependency regression passed separately, bringing current expected Python total127.

Optimized paired pilot74647/PID32244 is verified terminal, exit0:276 unchanged campaigns,80 fixed
held new-level IDs,552 old-engine full chains and552 preregistered current-engine pilot chains
match exactly. Two runs/up tothree tries, zero computation caps; no winning-count accuracy exported.
Freeze matching sources before refreshing raw data or changing the current policy. The full test
still requires32 runs/up to32 tries and independent uncensored validation/scoring, including all
old labels/covariates and252 unchanged count-control predictions. 80% remains unproven.

A runnable copied closure will hydrate every declared immutable dependency and the four mimic
JSON files needed by an unused legacy import at entry time. They do not train or choose the ownAll
policy, but must exist and remain hashed in the run manifest. TABLES is explicitly directed to
the copied table folder. This permits original-checkout data refreshes without changing live
frozen simulation inputs. No Git worktree, branch, commit, release or Firebase write is involved.

Next diagnosis should distinguish early tray losses from their cause: a fixed clock route could
leave bad tray debt even when the terminal label says tray, not clock. Check clock-exit pressure,
route diversity and planner ownership before concluding clocks are already modeled faithfully.
This is an unverified hypothesis, not justification for a generic safer/greedy route or a hidden-
picture oracle. Later policy changes must remain separately fitted per person and validated on
unchanged new-level cohorts.

## Optimized feature parity verified, 2026-10-18

Corrected failed-audit source/note is pinned in
personal-known-plan-count-fast-failed-2026-10-18T10-22-27-183Z (252 files,two dependencies).
Worker entry guards now require require.main===module; importing any of the four worker helpers
posts no task rows. The earlier training-source snapshot remains immutable. A dedicated loader
verifies its old source fingerprint and golden feature-file hash, instead of pretending the
current root helper still has its pre-guard byte hash. No fitted weight or historical feature
value changed from this execution-only correction.

Bitset audit17164 is verified terminal, exit0. All398 original prefixes/33,543 planning vectors,
physical frames and non-planning results match exactly, as do12,148,494 search-node expansions and
299,034 bounded unknowns. The optimized solver caches public geometric legality and uses unsigned
tile masks; reference weights, tap budget, node budget, candidate order and policy semantics are
unchanged. Randomized and wide-tile tests include clock, ice/locks, peek-pairs and Joker finale.
This is runtime equivalence, not a new winning-count result or permission to reset a cohort.

Inference now uses the verified bitset solver through the same defensive public-state cache.
Regenerate native likelihood provenance, then rerun the same276-board pilot and require both
current-engine sampled chains per board to match the immutable slow pilot exactly. Only after
those controls pass should full32-run/32-try counts run. A frozen runnable input closure will let
later raw-data refreshes in the working checkout proceed without changing the measurement.

## Optimized runtime verification in progress, 2026-10-18

Completed paired pilot is pinned in personal-known-plan-count-pilot-2026-10-18T10-06-57-033Z
(269 files,15 explicit immutable dependencies). No accuracy was scored. The next implementation
only caches redundant legality/bookkeeping; it must preserve all old features and policy choices,
not change the goal or shrink the cohort. A second bitset implementation also passes randomized
public-state/ice/lock/clock/Joker tests, including unsigned tile lanes beyond32/64/96. A129-choice
Dennis L101 probe is exact and takes126ms versus744ms for the reference. Full parity is unproven.

Full optimization audit3974/PID36512 failed its total assertion (NaN versus33,543), correctly
preventing acceptance. A worker importing personal_known_plan_data.js unintentionally executed
that helper's unguarded worker entry, posting a different row shape before the intended audit.
The final CIM check found the process already absent and the original handle confirms exit1;
the conditional Stop-Process did not execute. The first failed snapshot's note overstates a manual
stop; its numeric assertion/source evidence remains, but use the corrected failure note for process
disposition. No successful feature proof or winning-count artifact was emitted. Guard every new
worker entry with require.main===module, test imports explicitly, then replay against the immutable
training-source snapshot rather than pretending a changed helper still matches the old root hash.

## Known-plan winning-count pilot, 2026-10-18

Previous goal turn made progress: full known-only feature parity,138 independent personal fits,
native probability parity and source-matched actions completed. Actions are pinned in
personal-known-plan-actions-2026-10-18T07-00-31-837Z (246 files,seven immutable dependencies).
Validation88 named JavaScript/119 Python tests, observer honesty and git diff --check pass.

Paired count pilot94042 is verified terminal, exit0, not restarted after an observation timeout:
all276 campaigns,80 unchanged held new-level IDs,552 exact old-engine full32-run/32-try control
chains, two current-engine runs/up tothree tries for both zero-residual and own-known-plan policies,
and zero computation caps. Original human labels are not exported in the pilot. Old retained
profiles are explicitly old-engine forecast features, not falsely claimed to reproduce repaired
retry physics. Current zero/personal comparison isolates the fitted route preferences.

Pilot plan-time sums across worker rows: Dennis839121ms,Mrs634041ms,PUK509379ms,Gerda980236ms;
zero controls9478/5821/2681/3591ms respectively. Planning cache hits/misses: Dennis29322/38732,
Mrs12806/23129,PUK1114/11447,Gerda1192/13967. Full counts at this cost are expensive; preserve
matching pilot evidence, then optimize only redundant physics/search computation, requiring exact
old feature/policy parity rather than changing the learned behavior or shrinking the winning-count
cohort. This pilot is not a winning-try accuracy result and no model was promoted.

## Completed known-only action experiment, 2026-10-18

Corrected full instrumentation99850/PID11692 is terminal, exit0:398 unchanged prefixes and all
33,543 original feature/result/frame controls,33,503 exact lightweight physical transition checks
plus40 explicitly unsupported automatic Joker transitions (no action rows dropped). It took
541.416 seconds,12,148,494 new search expansions and299,034 per-option bounded unknowns. Those
unknowns are planning uncertainty, not human failures. Matching sources/features are pinned in
personal-known-plan-features-2026-10-18T06-55-48-174Z (240 files,two immutable dependencies).

Own-person fit75056 is terminal, exit0:138 ownAll residuals with exact frozen memberships, older
availability and target-campaign exclusions. All197 held per-prefix controls and eight initial/
retry summaries remain exact. Initial held action NLL control→knownPlan: Dennis1.709515→1.702947,
Mrs1.879650→1.881689 (worse),PUK1.777165→1.765846,Gerda2.002004→2.005025 (worse). Dennis top-action
accuracy slightly decreases0.410279→0.408537; do not convert a small likelihood gain into a count
success claim. Retry NLL: Dennis1.642094→1.635004,Mrs1.826384→1.823023,PUK1.793173→1.793208,
Gerda2.112140→2.112636. Original held cohorts/assist boundaries are unchanged.

Latest Dennis coefficients (progress,clear,trap,information,boundary):
[-0.110768,0.374654,-0.083003,0.075780,0]. PUK's clear coefficient is0.632023 and Gerda's0.206667;
these descriptive fitted differences are not psychological proof or held method selection. They
reinforce why generic removal-maximizing finishing must not be forced onto Dennis. No model is
promoted; genuine v1 future winning-count evidence is still10/20 Dennis and2/11 Mrs.

New public-state inference cache stores only deterministic planning features keyed by the public
board, known pictures/orientations, physical state and exact candidate mask/order. It is bounded
to4096 entries, returns defensive feature copies and never carries observed hidden outcomes.
Cached and uncached seeded retry chains match; changed boards/knowledge/candidate masks cannot
alias. This reduces repeated simulation work without changing a personal policy or counting any
computation boundary as a loss.

Native/JavaScript runtime audit is terminal, exit0:197 held prefixes and38,028 probability decisions
(control+knownPlan) match frozen Python per-prefix scores to1e-12, with causal availability and
membership rechecked. Its full compact JSON proof is appended to personal-known-plan-fit-output.txt
so the actions snapshot preserves it without changing the already-hashed Python fit helper.
Autonomous winning-count measurement is still not run for this candidate. Do not claim80%, corrected
incoming-memory training, or adopt the policy for every person from these mixed action results.

## Known-only early tray-planning feature pilot, 2026-10-18

Previous turn was progress: completed/pinned full episode counts failed80%, then corrected terminal
physical observations with398-prefix parity. All jobs from that turn are terminal; no model was
promoted, no forecast/cohort clock reset. New work tests bounded known-only routes before early
tray traps, not a blanket greedy finishing actor. Unknown pictures and fully covered orientations
are masked in a frozen public snapshot; real simulated choices remain unchanged until own-person
coefficients are fitted. Clock-active features are zero, preserving the existing clock controller.

Five route fields describe known progress, a found empty-tray route, a proved known dead end,
an information opportunity and an unresolved search boundary. Unknown inspections and automatic
Joker twins terminate as uncertainty; they do not invent hidden knowledge or label unknown states
as losing. Search uses6 physical taps/256 nodes, target4 known removals. Boundary coefficients are
fixed0 in the personal fitter, so computation difficulty cannot become a learned playing habit.
The optional runtime interface preserves original seeded/followed actions and exposes neither
actual covered pictures nor covered orientation. Unsupported masked feature logs fail explicitly.

Pilot99192/PID17524 is terminal, exit0: eight predeclared first/last prefixes (two per person),
712 unchanged feature calls/physical transition checks, zero unsupported Joker transitions in
that small sample,747335 search nodes and5840 per-option unresolved planning boundaries. Those
boundaries are feature uncertainty, not censored/lost simulated games. No accuracy score is produced.
The pilot took58.864 seconds. Preserve matching sources before optimizing repeated search work;
the full398-prefix dataset must retain all33,543 original choices and explicitly count unsupported
Joker mechanics without dropping those action rows. Per-person residual fitting uses only frozen
ownAll membership/earlier availability and never a winning-count label or family prior.

The first pilot/source is pinned in personal-known-plan-pilot-2026-10-18T06-34-31-214Z (230 files,
two explicit immutable dependencies). Optimized planning then combines a known inspection with
its physical commit/known peek-pair in a two-tap macro. No-information inspection cycles cannot
invent progress or make path-dependent memo entries. Only complete suffixes are shared across
canonical root-index order; permuting candidate input order leaves per-candidate features exact.
The root action remains a single real tap, so abandoning an already-open known tile is supported.

Optimized pilot43100 is terminal, exit0: the same712 original feature/frame controls,175010 new
search expansions,5502 bounded per-option unknowns,9.508 seconds versus58.864 before optimization.
Still no winning-count score. The new Python/JavaScript residual bridge passes1e-12, analytic
gradients match finite differences, memberships/availability fail closed, and weights can favor,
ignore or oppose route progress independently per person. Full instrumentation and the138 ownAll
fits have not yet run; incoming carry-memory features are still not claimed corrected/refitted.

Optimized pilot/source is pinned in personal-known-plan-pilot-2026-10-18T06-37-32-787Z (234 files,
two dependencies). Full instrumentation22477/PID20208 is verified terminal, exit1, not timed out.
The independent lightweight transition check found moves84 versus83 at a final Joker: actual
Hard/UI Joker finale removes the last tile without a clock move. No canonical full data or model
was emitted. Failed stdout/progress are preserved separately as personal-known-plan-failed-*;
their header fingerprint matches the optimized immutable pilot/source. The transition now keeps
physical tiles-removed progress separate from clock moves, with a native-Hard finale regression.
Rerun the same398-prefix cohort after that correction; do not omit the failing recording or
treat a planning/physics failure as a human losing try.

Second full attempt43248/PID25164 hit an explicit retained-prefix counter assertion (162 feature
calls versus62 kept decisions), not an observation timeout. The failed sibling was stopped only
after the exact live process was confirmed, then source/data are pinned in
personal-known-plan-failed-2026-10-18T06-45-31-675Z (239 files,two dependencies). That failed snapshot
includes the older optimized pilot as prior evidence, not as a matching current pilot measurement;
its matching source fingerprint comes from the failed full progress header. No full data/model
was emitted. The issue was double instrumenting the initial full reconstruction plus its already-
validated truncated replay. Planning now visits only the control's retained action sequence and
preserves the original historical-physics-boundary metadata. A synthetic regression asserts two
kept choices produce exactly two callbacks, unchanged frames and no discarded suffix. Failed
workers now terminate their siblings rather than leave an already-invalid run using CPU.

## Terminal retry-memory repair, 2026-10-18

Completed episode counts are pinned in personal-episode-full-2026-10-18T06-19-34-227Z:259 files,
13 explicit immutable dependencies. Only after that archive, Hard.play's physical-mode terminal
observer was corrected. It records exposed, still-alive face-up pictures before returning from
clock/tray/stopped boundaries, without calling sees/looked or granting any new down/covered picture.
This fixes observation bookkeeping, not a shared greedy policy. Per-person choice fits remain own.

Repair comparison91343 is terminal, exit0. Against the immutable pre-fix engine, all398 prefixes,
33,543 action-feature rows, physical frames and non-memory results match exactly. Exactly38 real
exposed pictures are restored (Dennis7,Mrs11,PUK2,Gerda18); zero remain omitted. Their timestamps
are final moves+1; other seen entries are unchanged. Followed initial action features did not change.
83 named JavaScript/114 Python tests, observer-honesty regression and git diff --check pass.
Feature/runtime probability audits were regenerated against the new engine and again match all
398/33,543 feature controls and197/152,112/1,576/236 episode probability/retry comparisons.

Future autonomous retries can now differ. Historical incoming-memory features and carry fits have
NOT been regenerated; do not claim they were refitted on repaired observations. Root old full-count
fingerprints are now intentionally stale: use the matching full archive for old count evidence,
never silently reuse it with the repaired engine. This repair has no new winning-count score and
does not establish80%. Next useful investigation is earlier trap avoidance using only public
beliefs and each person's observed choices, not an oracle, generic late solver or forced finishing.

## Completed episode count experiment, 2026-10-18

Full episode job54066 is terminal, exit0:276 campaigns,80 unchanged held new-level episodes,
32 runs/up to32 tries,828 exact old control chains and zero computational boundaries. Independent
scorer14819 is terminal, exit0: every old label/covariate/cohort ID and all252 controlForest points
match the immutable context-full parent. Historical targetMet stays false; no model is promoted.

Earlier-development method selection remains alwaysFirst for each person, scoring Dennis9/20,
Mrs7/20,PUK13/20,Gerda9/20. The richer personal profileForest scores9/3/13/6 respectively, not80%.
Dennis's fixed-episode simulated first-clear mean rises from ownAllPlan8's0.220313 to0.251563
(carry0.262500), but that is a simulated rate, not winning-try prediction accuracy or proof of
human fidelity. Comparable fixed rates: Mrs0.096875,PUK0.223438,Gerda0.132813. Earlier-only profile
likelihood selects adaptive episodes for PUK and mixed step/fixed/adaptive profiles for Gerda;
none is selected for Dennis or Mrs. Do not impose the same strategy across persons.

The failed genuine v1 future Dennis cohort remains10/20 (all21 completed11/21);128 is pending
under its original frozen try2 forecast. Mrs remains2/11. No cohort clock, miss, old forecast,
training membership, assisted held episode or board ID was reset to make this look successful.
Archive this completed source-matched full experiment before correcting terminal observation
memory. Known-small late planning is not the dominant gap; the autonomous audit finds Dennis's
failures overwhelmingly early tray failures. A terminal-memory fix must not be presented as an
80% solution or allow unseen face-down/covered pictures into future choices.

## Episode runtime/count stage, 2026-10-18

Previous turn made progress:276 own-person whole-attempt mixture fits and older natural retry
transition models completed with better held coherent-vs-independent action likelihood. Matching
sources/models are pinned in personal-episode-actions-2026-10-18T05-33-43-593Z. These action numbers
are not winning-count accuracy; genuine first20 Dennis remains10/20 and no new model was promoted.

This turn adds an optional once-per-attempt physical selector factory. It receives only frozen
public run/attempt/seed/previous-simulated-failure metadata, never the board or future human choices.
Styles draw from a dedicated RNG stream before play; physical/memory randomness is unchanged.
Styles reset on each unrelated run, remain fixed within an attempt and optionally transition
after that agent's own natural failure. Censored computation boundaries cannot become natural
failure causes and are explicitly returned. Default/follow behavior remains unchanged.

Lifecycle/default-seed/follow/hidden-picture/censoring tests and native/Python/JavaScript feature,
component and filter bridge pass. Feature audit34225 is terminal and still matches all398 original
prefixes/33,543 actual choices. Episode probability audit is terminal:197 held initial/retry
prefixes,152,112 probability decisions,1,576 per-prefix method/scope comparisons and236 strictly
causal observed retry applications match frozen Python results to1e-12. Human sequences are
supplied for parity only, never used by autonomous count simulation.

Declared new variants: zero-residual legal repeats, independent per-step mixture, fixed episode,
failure-adaptive episode (ownAll), plus configured-memory fixed episode. The count pipeline checks
all276 boards against three immutable full controls (ownAll, plan8, context8-plan8), preserves all
80 held new-level IDs and all old labels/covariates, and independently rejects hidden per-row
censoring even if an aggregate flag says0. No success claim can come from pilot samples.

Pilot65674 is verified terminal, exit0: all276 campaigns,828 exact full control chains, two new
runs/up tothree tries, and zero computation boundaries in every declared profile. It exercises
actual retry transitions without exporting human winning outcomes or a winning-count score.
Runtime is pinned in personal-episode-runtime-2026-10-18T05-57-28-363Z (219 files,9 explicit
immutable dependencies); pilot in personal-episode-pilot-2026-10-18T05-57-35-072Z (246 files,13
dependencies). The first pipeline stopped before launching full simulation because runtime hashes
include filenames whereas count hashes include bytes only. Snapshot validation now distinguishes
these formats and has a regression test. Full count job54066/PID4888 is the first actual full run,
with directly flushed personal-plan-count-full-progress.jsonl. No restart was inferred from buffered
stdout. Do not change fingerprinted sources/raw inputs before completion and matching archive.

Read-only terminal-observation audit preserves all398 unchanged natural prefixes and features.
Exposed face-up pictures after the last tap can be absent from returned seenEver: Dennis7/74,
Mrs11/65,PUK2/57,Gerda18/202 (one picture each). Dennis has3 initial-new examples. Covered and
uninspected face-down pictures are excluded. UI failure modals are delayed, so this is a genuine
observation opportunity, not proof of human attention/recall. Gerda's three assisted/integrity
boundaries stay labelled rather than becoming natural failures. No runtime change during full run.
The separate autonomous failure-stage audit uses four fixed first-attempt seeds on all80 held
new boards; no human action sequence enters simulation. Before-final-tap known-small states are
diagnostic opportunities, not proof a solver could rescue them or that a human would use it.
Completed failure-stage audit1616 has320 first attempts: Dennis14 wins/66 failures (65 tray,
1 clock); Mrs7/73 (72 tray,1 clock); PUK16/64 (all tray); Gerda4/76 (all tray). Dennis has zero
failures with every remaining picture known and at most24 tiles left before the final tap.
Only one such clock-off state each occurs for Mrs and PUK, zero for Gerda. Thus an exact known-
small endgame solver cannot explain the dominant current gap; do not spend another full fit on
generic late finishing based on this diagnostic. These sample win fractions are not count scores.
Validation95529 is terminal, exit0:82 named JavaScript/114 Python tests and git diff --check pass.

Blocked-click xray preview found no new fully hidden face-up exposure in Dennis's initial-new
prefixes (two possible pictures in one old L96 replay only). Do not grant generic xray knowledge
or import other persons' blocked-tap habits into Dennis. Existing auto-finish is all-removal-order
safe, not merely pair-order safe; ignoring cleanup cannot by itself explain losing finite taps.
Recorded helper nudges are explicitly replay-marked and censored; none appear in these prefixes.
All original numeric forecasts and failed prospective cohort clocks remain unchanged.

## Coherent attempt preferences/retry transitions, 2026-10-18

Previous goal turn was progress: optional context runtime matched all33,543 recorded decisions,
removed a real legal-reinspection mismatch, and completed the full276-campaign/80-held experiment
with552 exact control chains,252 exact count-control points and zero computation boundaries.
It remains inadequate: before-held selectors give Dennis9/20, Mrs.7/20, PUK13/20, Gerda9/20.
Matching full sources/data are pinned in personal-context-full-2026-10-18T05-17-41-214Z. Original
genuine Dennis first20 is still10/20; no alternate model or new forecast was promoted.

This turn tests coherent whole-attempt preferences, not a stronger universal greed multiplier.
Two bounded16-feature components fit each person's older choices against the same pinned own
actor. Whole-trajectory EM captures across-tap correlation; an independent-step mixture with
identical fitted components is the declared ablation. Features use actual tap effects and frozen
knowledge, not anticipated followups, unknown pictures or target winning counts.

Initial-new style priors exclude replay/retry habits. Retry transitions use only adjacent same-
board campaign counters after older available observed natural failures. Assistance, auto wins,
incomplete/boundary prefixes, counter gaps/resumes, changed boards and late-upload pairs cannot
invent transitions. Typed matrices shrink toward each person's own aggregate, then independent
resampling; no forced stickiness/change or other person's style is imposed. Component IDs have
no claimed psychological meaning. Base membership/target exclusions remain unchanged.

Six focused tests pass for coherent-vs-independent likelihood, exact marginal trace identity,
monotone training objective, signed personal components, initial-new priors, learned retry changes,
strict past/memory/board/counter/censoring exclusions and target-outcome invariance. Supplied held
human choices are used only for causal sequential action diagnostics, not new-level forecasts.
Runtime/count scoring must still sample plans from older priors before the simulated attempt,
and transition only after its own simulated failures. No80% claim from action-fit numbers.

Fit job11032 completed, exit0. All276 models finished at05:30:05UTC and the action report completed
05:30:58UTC. All eight initial-action control summaries match the immutable parent to1e-12. It
uses immutable archived data/source provenance, not the stale root prefix fingerprint. No engine
runtime edit, raw refresh, release, commit, branch, Firebase write or original ledger change.

Held initial ownAll action log loss control /independent-step /fixed-episode: Dennis1.709515/
1.700858/1.690890; Mrs.1.879650/1.870882/1.859059; PUK1.777165/1.781329/1.765841;
Gerda2.002004/1.993742/1.990080. Coherence beats the independent-step ablation for all four.
Dennis top-action rate .410279→.418990→.420732. Configured-memory Dennis fixed1.691665 vs
control1.708918. These conditional action/trace likelihoods are NOT winning-try accuracy.

Held retry ownAll log loss fixed→failure-adaptive: Dennis1.631751→1.632152 (slightly worse),
Mrs.1.804830→1.803404, PUK1.789198→1.788071, Gerda2.101465→2.101635 (slightly worse).
Do not force a stronger retry transition onto Dennis because it slightly helps someone else.
Initial candidates retain20/14/20/20 prefixes; corresponding full campaigns retain42/54/40/61
recorded prefixes, with22/39/18/39 valid observed transition applications. Missing/censored/gapped
links reset to the older own prior, never invent a failure or drop a prefix. Original80 count
campaigns are separate and unchanged; no episode-style winning-count simulation has run yet.

Validation79 existing JS /110 Python plus the previously unchanged observer checks and whitespace
passes. Next implement the optional per-attempt runtime factory with a dedicated seeded style
draw, never reuse one latent component across unrelated simulation runs. Compare independent-step,
fixed-episode and failure-adaptive variants on full counts without selecting from held action wins.
Runtime may use only its own simulated earlier failures, never supplied target human actions.

Completed episode action fits and matching sources are pinned in
`personal-episode-actions-2026-10-18T05-33-43-593Z` (205 files,9 explicit immutable dependencies).
Fit11032 and snapshot are verified terminal; no job from this stage needs resuming. All four
original numeric forecast ledger hashes remain unchanged. Runtime/future-count work remains;
do not claim80% from these conditional action improvements or from the synthetic coherence test.

## Context runtime/count stage, 2026-10-18

Previous goal turn made progress:276 own nonlinear actor residuals, held action likelihoods and
restart-state diagnostics completed and were pinned. This turn connects those fits to optional
full physical choices. The selector receives only frozen F/context/actual-consequence arrays and
a seeded draw. Joint kind/within probabilities remain personal; no universal greed multiplier or
hidden board state is supplied. Zero/follow/default actors retain existing behavior.

Cross-language verification matches all24 held scope/method summaries to1e-12 (51,414 probability
decisions); the explicit float32 split-boundary regression also passes. All398 original followed
prefixes/33,543 decisions remain byte-for-byte feature/metadata/physical controls. Direct optional
runtime replay initially stopped in143 prefixes because the old two-reinspection guard masks
real legal human repeats. That numeric mismatch is preserved in repeat-guard-audit.json/output;
its intermediate source was not separately pinned, so do not claim complete source reproduction.

For contextual actors only, allow the same legal repeated inspections as the training traces.
A separate max(4096,32*tiles) computation boundary is explicit and counted, not disguised as a
human failed try. Full scoring rejects any such boundary. Default actors still use their old
two-reinspection safeguard and should reproduce the original seeded controls.

Corrected runtime audit job58561 completed: all398 prefixes/33,543 decisions execute through
the optional selector with identical physical frames, zero masks and zero unsupported prefixes.
Earlier audit job26720 is terminal. Python bridge/native precision, legal repeated inspection,
bounded-loop labeling, hidden-picture invariance, followed/default compatibility and invalid
selection tests pass. Validation job79161 is terminal:79 named JS /102 Python plus observer pass;
two additional count-boundary/coverage tests pass separately (104 Python total).

Count generator reads immutable context action fits and the immutable memory count parent, not
the now-stale root prefix engine fingerprint. Before old controls are reused, ownAll and plan8
32-run/32-try chains must reproduce every one of276 boards exactly. Declared new profiles are
ownAll context8/24 with physical plan8 and configured-memory context8 with plan8. All80 held
new-level IDs remain fixed; no replay scores or chosen easy subsets replace them.

Throughput/boundary pilot job18288 completed on all276 campaigns. Its handle is no longer registered;
authoritative process inventory has no related node process, and the complete report/log records
552 exact matched controls and zero computation boundaries. It was not restarted after the missing
handle. Contextual actors used two first tries; both controls used32 runs/32 tries. This is not
winning-count accuracy, cannot be scored as such, and exports no human winning outcomes.

Runtime sources/parity evidence are pinned in `personal-context-runtime-2026-10-18T05-02-16-024Z`
(206 files,9 dependencies). The matching completed pilot is pinned in
`personal-context-pilot-2026-10-18T05-02-46-442Z` (232 files,9 dependencies). The snapshot helper's
unmatched list bracket was fixed before either successful snapshot; no model/data changed for it.
Contextual pilot profile CPU wall totals are3.565/3.761/3.592 seconds across276 boards; these timing
diagnostics do not select an accuracy winner or substitute for the full test.

Full32-run/32-try measurement now runs as job96995. Do not refresh inputs or edit fingerprinted
sources while it is live. Scoring must reject computation boundaries, preserve all80 held IDs,
and verify the252 controlForest points against the immutable parent. No new forecast, cohort reset,
release or80% claim. Goal stays active; prior turn is concrete runtime/control/parity progress.

Latest validation is79 JS /104 Python plus observer honesty; diff whitespace passes and all four
numeric forecast ledger hashes remain unchanged. Full job96995 is now verified terminal, exit0;
node PID21804 no longer exists. During the run, three CPU-active worker threads confirmed real
progress despite buffered/empty redirected stdout. It was not restarted on an observation timeout.
The completed canonical file (made05:13:42UTC) retains276 campaigns/80 held IDs, reproduces552
32-run/32-try control chains exactly and records zero computation boundaries. An independent sum
over every row/profile also equals0, matching the aggregate flag. No censored file was scored.
Now run personal_context_count_fit.py, verify252 original controlForest points, then archive full.

Count-scoring job57952 completed, exit0. All252 controlForest points match the immutable parent
exactly. Coverage remains276 campaigns/80 held new levels,74 recorded openings plus6 tables,
including all8 assisted wins. All four pre-held development selectors still choose alwaysFirst:
Dennis9/20, Mrs.7/20, PUK13/20, Gerda9/20. Do not pick a different primary after inspecting held
results. Experimental profileForest gets Dennis10/20 (parent memory experiment11/20), Mrs.3/20,
PUK13/20, Gerda6/20. Recall-profile correction gives the same points. No80% success or promotion.

Simulated mean first-success probability ownAllPlan8→context8/context24: Dennis.220313→.234375/
.243750; Mrs..078125→.071875/.084375; PUK.184375→.167188/.214063; Gerda.073438→.054688/
.059375. These are simulation probabilities, NOT prediction accuracy. Legal-repeat repair and
slightly better action likelihood do not produce the requested winning-try accuracy. The genuine
frozen Dennis first20 remains10/20; this selected historical9/20 cohort is different. Existing128
try2 and all other original numeric forecasts are unchanged.

Next investigate correlated per-attempt plans rather than independent fresh noise at every tap.
An aggregate action softmax can explain individual choices while sampling incoherent multi-step
routes. Fit latent trajectory-level preferences independently from each person's earlier games;
choose a style once per simulated attempt and learn retry-style transitions only from earlier
observed failures, not target outcomes. Keep new/recent held scope, full count tests and frozen
future evidence requirements intact. Do not impose PUK's style or a shared greedy policy on Dennis.

The completed full context experiment and matching sources are pinned in
`personal-context-full-2026-10-18T05-17-41-214Z` (235 files,9 explicit immutable dependencies).
Full simulation96995, scoring57952 and all snapshot commands are verified terminal. No job from
this stage needs resuming. All four original numeric ledger SHA-256 values remain unchanged.
The latest root value-prefix fingerprint is intentionally stale after the optional engine edit;
future fitting must use the named immutable archived prefix/model provenance or explicitly rebuild
and revalidate data, never pretend that the pre-edit root fingerprint describes the new engine.

## Nonlinear personal-context choices, 2026-10-18

Previous goal turn was progress: all276 own value critics and independent value-preference fits
completed, all80 held count campaigns stayed scored, failed results were archived, and the next
hypothesis changed. Matching archives are `personal-value-2026-10-18T01-27-33-959Z` (217 files)
and `personal-value-alignment-2026-10-18T01-32-55-229Z` (222 files), with explicit parent hashes.
No genuine80% result or promoted value policy. All original numeric forecasts remain untouched.

This turn fits nonlinear contextual choice residuals separately for each person against unchanged
pinned personal actors. Trees can learn clock/key/tray-dependent preferences from actual choices,
not a universal greed setting or success labels. Inputs are the existing102 actual-tap/context
features with hidden pictures excluded. Twenty-four regularized depth3 trees start at zero;
8/24 are declared diagnostics, not a method selected after inspecting held results. Older own
availability, exact original actor membership and memory-source/target exclusions are enforced.

Six focused tests cover zero-change equivalence, native/export parity, opposite personal choices,
one person's clock-conditional preference, strict temporal/memory exclusions and invalid schema.
An explicit near-adjacent float32 threshold probe exposed an export bug before using any model:
native sklearn rounds inputs tofloat32; Python raw64 traversal could choose the other branch.
Two explicitly identified fitting processes were stopped and their handles verified terminal,
not restarted on an observation timeout. Fix inputPrecision=float32 and explicitly promote each
rounded scalar tofloat for comparison (NumPy scalar coercion otherwise re-rounds the threshold).
The boundary regression now matches native prediction. The first aborted output is retained.

Corrected context fit job5429 completed normally with276 own-person residuals. All eight pinned
control action summaries match to1e-12. No engine runtime or winning-count change is promoted.
Held ownAll action log loss control /context8 /context24: Dennis1.709515/1.700522/1.699055;
Mrs.1.879650/1.871513/1.869780; PUK1.777165/1.727418/1.694556;
Gerda2.002004/1.998470/1.997556. Configured-memory Dennis1.708918/1.699820/1.699463.
These are modest improvements in likelihood, not winning-try accuracy; Dennis's top-action rate
slightly falls .410279→.409408/.406359. Keep this distinction and all held prefixes explicit.
Next implement the optional known-feature-only runtime selector and measure full physical counts.

While fitting continues, audit natural r=restart endings instead of assuming these are irrelevant
or that every person stops the same way. Recorded prefixes contain Dennis11/74, Mrs.5/65, PUK1/57,
Gerda0/202. Latest initial-new held action prefixes contain Dennis2/20 and Mrs.1/14; these are
action-prefix denominators, NOT the80 count campaign cohort. All17 restarts have validated ordinary
physical handoffs and earlier own actors excluding their entire target campaign. No unsupported
states or missing models were discarded.

Sixteen diagnostic continuations per state, supplied with the actual human prefix: Dennis0/176
actor wins, Mrs.3/80, PUK15/16; plan8 gives the same aggregate. Dennis usually restarts with three
waiting tiles; continuations mostly fail soon, though level100 can continue for many moves. This
does NOT prove no human solution exists or that stopping is counterfactually best. It suggests
recognition/learning of a bad parked-tile route is more relevant for Dennis than applying PUK's
restart habit or arbitrary extra quitting. Supplied-prefix diagnostics are neither forecasts nor
training outcomes. Keep full autonomous count tests separate. The audit and denominator test finish.

Focused validation78 named JS /101 Python tests and observer honesty pass. No raw refresh,
release, branch, commit or Firebase write. Context fitting and restart diagnostics are terminal.

Completed action fits, restart diagnostics and matching sources are pinned in
`experiments/personal-context-actions-2026-10-18T01-55-11-704Z` (200 files,6 explicit parent
dependencies). Snapshot job56211 is verified terminal and all four numeric ledger hashes unchanged.
No jobs from this stage need resuming. Full context winning-count measurement has NOT run.

Runtime implementation must compare the full joint choice: disable early kind sampling only for
the optional contextual selector, include all physical flips, retain actual immediate features
without requiring a policy log in autonomous play, and multiply base hierarchical probabilities
by the exported residual. Respect inputPrecision=float32 with Math.fround before double threshold
comparison. Default/follow behavior must remain unchanged; no hidden game state may reach the
selector. Pin/control-check the engine change before measuring the same276 campaigns and80 held
IDs with older personal actors, declared8/24 stages, physical clock planning and matching memory.
The count generator must read models/prefix evidence from this immutable action archive rather
than pretend the old root prefix fingerprint stays current after an engine edit. Reproduce pinned
control chains before copying any previous control data; then run whole own-person count scoring.

## Personal route-value experiment, 2026-10-18

Continue with a separate natural-trajectory success critic for each person, not a universal
greedy finishing rule. No raw refresh, release, Firebase write or numeric forecast modification.
The original genuine Dennis first20 remains10/20; pending128 retains its original try2 forecast.

Optional analysis instrumentation records actual one-tap core/goal consequences before the
heuristic's unexecuted followups. Hidden pictures remain hidden. All398 original prefixes and
33,543 decisions in each of zero/configured memory match pinned control metadata, F, goals,
context, choices and physical outcomes exactly (67,086 comparisons). The value dataset omits
the full-memory ablation, not any controls or campaigns. All276 opening probes stop at moves0
with zero physical actions and include no target human choice or winning count in their features.

The critic fits only older own natural outcomes with normalized per-prefix temporal weights.
Guaranteed-safe automatic cleanup is success, restart/stuck endings are failures; assistance,
missing, unfinished and physical boundaries are censored. Original personal actor membership,
target-campaign exclusions and memory-source availability are preserved. Opening summaries
are tied to their exact earlier actor/critic, including when used as older count-training rows.
Rolling own-only count heads compare the pinned control with value-augmented alternatives.
Method selection uses only development before each person's fixed held cohort. This remains
historical exploratory evidence, not causal counterfactual proof or a prospective80% result.

Validation at this stage:77 named JS /92 Python tests, observer honesty and diff whitespace pass.
The opening job6752 and value/count job51556 completed normally. All276 earlier-own critics,
276 openings,252 scored rolling count rows and80 fixed held campaigns are measured. Every
controlForest prediction matches the pinned control exactly;74 held openings are recorded and
all8 assisted held wins remain scored. No omission, changing cohort or post-hoc held selection.

Held correct/20 for alwaysFirst /controlForest /valueForest /valueBoosted /valueOnlyForest:
Dennis9/6/5/6/5; Mrs.7/4/3/3/5; PUK13/13/11/8/11; Gerda9/10/7/8/7.
All four before-held development selectors choose alwaysFirst (ties retain the simpler method).
The value-augmented count predictors do not improve Dennis and are not promoted. Original genuine
prospective10/20 and the exploratory selected9/20 are different cohorts and must not be conflated.

Next test whether cross-fitted value differences explain each person's actual route choices.
Fit the value preference separately from their earlier choices, including a zero-change prior
and allowing no/negative alignment, instead of imposing a universal greedy value strength.
Only after held action evidence and full autonomous count evaluation could any policy be promoted.

The complete failed count experiment is pinned in
`experiments/personal-value-2026-10-18T01-27-33-959Z` (217 files plus5 explicit immutable parent
dependencies). Numeric ledger SHA-256 values remain exactly unchanged. Follow-up action alignment
job18840 completed normally; three focused tests pass for signed own preference, strict earlier/target
dependency exclusions and per-prefix weight normalization. Every older alignment-training choice
uses its campaign's earlier frozen critic, not a critic fitted on that choice's later outcome.
The current dataset contains zero negative/unmatched choice indices in either observation variant.

Action alignment fits all276 per-opening personal strengths from cross-fitted earlier choices.
All eight zero/configured-memory control summaries match the immutable parent metrics to1e-12.
Held ownAll action log loss (lower better), control→personal value: Dennis1.709515→1.710440;
Mrs.1.879650→1.880024; PUK1.777165→1.775006; Gerda2.002004→2.000682.
Configured-memory Dennis1.708918→1.709233 also worsens. Dennis's mean fitted strengths are
-.0762/-.0675, whereas PUK's are+.3206/+.2779. These small signed preferences describe how an
imperfect observational critic aligns with choices, NOT whether a human wants to finish or an
80% winning-try result. Do not infer Dennis prefers losing or impose the positive PUK setting.

Held action prefixes: Dennis20/2296 decisions, Mrs.14/1507, PUK20/1948, Gerda20/2818. All are
retained. Cross-fit availability covers all74/65/57 Dennis/Mrs./PUK observed prefixes; Gerda has
164/202, with38 lacking a parent campaign model explicitly marked no-campaign-model (not scored
as successes). No held prefix is lost. All80 original count campaigns still have their separately
preserved count scores. No autonomous value override or new forecast is promoted.

Final focused validation:77 JS /95 Python tests, observer honesty and diff whitespace pass.
Both new experiment jobs and the first value snapshot job are terminal. No refresh occurred.
Next investigate nonlinear own-person context/action interactions rather than another shared
greed multiplier or count-head retuning. A richer action model still needs held action checks,
full physical count evaluation and genuinely frozen new-level evidence before any80% claim.

## Persistent-target feasibility completed, 2026-10-18

Previous goal turn made progress: memory-consistent fitting and count evaluation completed and
were pinned in `experiments/personal-memory-2026-10-18T00-43-24-647Z` (216 files). All handles
were verified terminal before new changes. This turn does not refresh raw data, rewrite forecasts,
reset the failed v1 cohort or promote an unmeasured policy. Genuine Dennis first20 stays10/20;
128's existing try2 point is unchanged. Goal remains unachieved.

Add shared analysis helpers for persistent known blocked-mate goals. Intent starts only after a
real known take parks a picture whose known mate is blocked; frozen pre-tap knowledge excludes
newly uncovered pictures. Legal geometric routes, safe pair preparation and buffer clearing can
continue it across several taps. Unrelated choices abandon it. Active clocks, unknown hidden key
locations, terminal overflow and unsupported wildcard physics cannot invent a plan. Forced-only
choices advance goal age but cannot supply evidence about discretionary commitment.

The goal dataset preserves all398 old prefixes /33,543 decisions and both memory variants exactly,
adding only causal goal observations. Sessions29560 and91103 finished normally. Zero-memory
choiceful goal ages0/1/2+ total Dennis93/57/160 (continued59/41/132), Mrs.78/41/108 (42/31/82),
PUK88/47/62 (48/32/44), Gerda455/203/340 (205/152/252). These are route-category observations,
NOT winning-try scores or proof of private mental intent; forced completions are not a failure rate.

Session64545 completed the feasibility test using all542 pinned personal actor fits. Every old
control feature, metadata field, memory variant and fitted membership matches exactly. Own earlier
action choices fit a regularized residual to the actor's existing continuation probability, with
goal age/tray/depth/option share and a zero (no-policy-change) prior. No family data or target winning
count enters fitting. Prefix/memory source availability and target-campaign exclusions remain intact.

Held ownAll goal-category log loss (lower is better): Dennis.293770→.303685 (worse,93 choices),
Mrs..545238→.517545 (better,90), PUK.494111→.491387 (small improvement,54),
Gerda.519711→.517265 (small improvement,75). Dennis configured/full-memory variants also regress.
The original actor already predicts much of Dennis's goal continuation. Do not impose stronger
commitment on his bot merely because some other person's fit improves. No autonomous goal override
or winning-count measurement is implemented/promoted from this hypothesis.

76 named JS /85 Python tests and observer honesty are checked for this stage. Next investigate
the quality/value of alternative routes and longer-horizon personal consequences, rather than
merely increasing the frequency of goal-compatible actions. This evidence changes the next action;
it does not establish80% or make the original failed prospective cohort disappear.

All542 exploratory goal residuals are exported separately and linked by SHA256 to the report
and unchanged pinned actor bank. Session35779 regenerated those artifacts with fit-source guards;
every prior per-player feasibility score is exactly unchanged. This was an explicit export
repair after a verified terminal run, not a timeout restart. Sessions69581/35779 are terminal;
76 named JS /85 Python tests, observer honesty and diff checks pass. No research job remains live.

## Memory-consistent personal training completed, 2026-10-18

Previous goal turn made progress: the sequence experiment completed, failed the winning-try
target honestly, and was pinned at `experiments/personal-sequence-2026-10-18T00-22-44-838Z`
(210 files). All prior handles were verified terminal before source changes. No fresh raw download
or numeric forecast change occurred this turn; original v1 prospective Dennis first20 stays10/20,
with128's frozen try2 point unchanged. No80% claim or research-model promotion is supported.

Refactor prefix reconstruction into one validated path, retaining all398 original controls and
33,543 recorded choices exactly. Add configured phase recall `[.75,.5,.75]` and full recall
observation variants for fitting, without changing physical states or endings. These are declared
alternative assumptions, not fitted claims of perfect human memory. Each person's actor and
subsequent strategy selection still fit only their own earlier data.

Only actual observations in earlier natural uploaded prefixes of the same campaign and exact
board can supply memory. Upload availability must precede the retry opening; late uploads and
unmapped old campaigns carry no memory. Memory sources store attempt IDs and timestamps, enter
model identity and `trainedAids`, and cannot bypass target-campaign exclusions or availability.
Configured sampling is stable per source, and only observed pictures can be sampled. No later
win, assistance after the prefix boundary, unknown initial picture or another person's play is used.

The audit rejects the earlier tentative false-fatal-label hypothesis: zero fatal labels change.
Instead full recall recognizes328 Dennis reopenings and reclassifies27 unknown inspections as
known takes (Mrs.541/57, PUK355/59, Gerda1264/112). Full-recall feature decisions change
2078/2892/1777/7369 respectively, with all actual actions/physical results retained. Some prior
"blind" features genuinely concern an unknown mate, so merely remembering the chosen picture does
not resolve them. Feature correction is not evidence of winning-count accuracy.

74 named JS /81 Python tests and observer honesty pass. Current reconstruction audit matches all
old control features against the pinned sequence dataset. The planned seven-profile measurement
includes identical baseline/ownAll/ownAllPlan8/ownNovelPlan8 controls plus configured/full-memory
training, and a full-runtime-recall ablation. Use two fit workers to limit the larger dataset's
memory footprint. Preserve core sources/raw while fitting and counting; do not restart on timeout.

Session2700 completed normally: all542 earlier-policy fits, action evaluation, seven-profile
whole-count simulation, own-only count fitting and recent selection are complete. No research
process is live. All266 ownAll/ownNovel control fits match the
pinned sequence model weights/kind weights exactly, not merely approximately. Raw data and the
80-level comparison cohort are unchanged. Carry/full training gives only small Dennis action-loss
changes1.709515→1.708918/1.708594; Mrs./Gerda regress. These are not count scores or80% evidence.

The separate late-memory audit found zero additional causally earlier ended-prefix observations
excluded by the before-retry timestamp gate for all four people. No broader telemetry-time
imputation is currently needed. Source inspection confirms replay row.t is chunk creation time,
not proof of historical server receipt; these historical fits remain exploratory. Genuine later
pre-opening evidence continues to use immutable frozen forecasts and captured raw inputs.

Auto events were also checked against the game: this is automatic guaranteed-safe cleanup after
clock/specials are gone, not a discretionary help action. `finishSafe` requires every tap order
to succeed. Do not invent a personal assistance policy or remove those wins merely because the
natural action prefix correctly stops before automatic taps.

Measurement2026-10-18T00:40:26.093Z, fingerprint
`9cd48bbfbe20614ff09b117583d3eb6cc0923639fd3cb756369beeea97a3a102`.
276 campaigns /80 unchanged latest first-clear comparisons,74 recorded openings/boards and6 table
boards;8 assisted held wins remain scored. All1,104 matched baseline/ownAll/ownAllPlan8/ownNovelPlan8
chains exactly equal the pinned sequence experiment, isolating the memory training alternatives.

Earlier-development method selection still chooses alwaysFirst: Dennis9/20, Mrs.7/20, PUK13/20,
Gerda9/20. Recent selection gives10/6/13/9. Direct mixture9/80, personalBest8/80, calibrated22/80,
controlForest33/80, profileForest33/80. Dennis historical profile/recall forests give11/20, not80%.
No memory predictor is promoted, and the failed genuine v1 prospective10/20 cohort stays intact.

Memory-consistent training affects people differently. Dennis ownAllPlan8 mean first-try success
22.0%→configured22.5% /full22.3%; Mrs.7.8%→6.7% /6.4%; PUK18.4%→18.4% /22.0%;
Gerda7.3%→12.7% /10.8%. These simulation rates are not winning-try prediction accuracy. Earlier
own profile likelihood selects memory alternatives on10 Dennis,10 Mrs. and20 PUK held games,
but none for Gerda. Full runtime recall is a separate retry ablation; identical first-try rates
are expected because a genuinely new first try has no previous-attempt memory.

75 named JS /81 Python tests, observer honesty, diff checks and reconstruction/source checks pass.
The observation repair is real, but it is not the main performance breakthrough. Repeated small
local-action corrections have not closed the gap between learned actors and real whole games.
Next investigate persistent, goal-directed multi-action planning with personal choices among
viable plans, rather than another global greedy rule or a nominal recall threshold. Freeze and
evaluate any genuinely different predictor prospectively; never relabel this failed v1 cohort.

## Personal pair-plan continuation and version coverage, 2026-10-18

Previous work was progress: relation fitting/count measurement finished and was pinned; session84657
and the subsequent refresh snapshot were verified terminal, not restarted. A fresh read-only refresh
at2026-10-18T00:04:01.151Z reveals Dennis128, Mrs.104, PUK54, Gerda63. The original v1 first-twenty
prospective Dennis cohort is now complete at10/20 (50%), not80%. All21 completed qualifying Dennis
games give11/21;128 remains pending. Mrs. has2/11 completed qualifying games. No misses are hidden.

Recent1.56/1.57 attempts were missing from the old table-version whitelist. Main releasebc0c63f
verifies exact normalized source equality for hard.js, levels-hard.js and levels-early.js against
our1.55 archive; hashes are recorded in `BOARD_VERSIONS.md`. Shared explicit aliases now repair
dataset and progression coverage, including fixed early boards. Unknown later versions still fail
closed instead of silently substituting classic boards. Rebuilt dataset:617 attempts,617 matching
boards,zero mismatches, including Dennis through127 and Mrs. through103. Prospective scores stay
10/20 and2/11 after the repair; these scores already matched exact recorded board identities.

Session36507 completed:16 additional same-v1 future points were appended, Dennis143–151 and
Mrs.121–127, freeze1792282148422. Existing snapshots/numbers/cohort clocks remain untouched. This is
coverage only, not promotion of a new model. Refresh manifests now copy actual scored cohorts,
rather than a hardcoded obsolete8/12 summary.

The next candidate adds independent learned next-action continuation after known pair setup.
It does not force pairs at the start, discover unknown twins in advance, remove extra tiles or
prescribe a greedy strategy. Taking the reopened member into the tray is a valid continuation,
not a false abandonment; immediate automatic completion is recorded separately. Clock/key plans
retain priority, and any actual inspection expires an older tray cue. Defaults/followed actions
remain unchanged. New sequence files preserve earlier intent/relation experiments.

Fresh descriptive pair cues, by tray0/1/2/3: Dennis249/234/114/31 with157/150/87/19 continued;
Mrs.95/187/105/38 with51/101/59/25; PUK54/44/18/3 with41/34/13/1; Gerda293/291/188/25 with
137/149/102/12. These are action observations, NOT winning-try accuracy or pre-opening forecasts.
Own-only per-context fits use earlier available prefixes and Beta(1,1) priors with twenty-prefix
decay, never family data or target outcomes. 71 named JS /78 Python tests and observer honesty
passed before starting the seven-profile sequence experiment. No80% claim.

Session98955 completed normally: the seven-profile sequence measurement used the unchanged raw snapshot,
398 natural prefixes /33,543 decisions,266 earlier-available own-only models. All model fits and
action/cue likelihood evaluation and whole-count simulation completed. No research process remains
live. Preserve the source-matched results before further core changes or another raw refresh.
Latest ownAll pair-focus posteriors, tray0/1/2/3: Dennis.600/.635/.728/.628,
Mrs..512/.558/.587/.629, PUK.682/.736/.728/.487, Gerda.414/.418/.463/.379.
These are next-picture focus rates, not guaranteed safe completion. Taking the opened member
with an already-full tray can be a real fatal execution mistake; the personal kind model is
allowed to reproduce it, rather than a global safety override silently removing human mistakes.

A separate available-retry-knowledge audit identifies a stronger next hypothesis. Despite earlier
uploaded observations on the same campaign and exact board, the independent prefix reset calls
355 Dennis reopenings unknown and55 takes blind (Mrs.598/77, PUK414/33, Gerda1376/326).
The audit uses only actually observed pictures available before the retry, never full hidden
initial faces. It does not assume the human remembered every picture. Gerda has164 mapped
campaign prefixes out of202 candidates;38 are explicitly unmapped by the historical campaign
version gate. This diagnostic is not a forecast, and does not change the running experiment.
After the sequence measurement, investigate training/runtime memory consistency with strict
availability and explicit memory-source dependencies, rather than prescribing stronger greed.

Sequence measurement2026-10-18T00:21:36.592Z, fingerprint
`16b774eff242827be8235a0108dd4a514884e655aeef2f9c0b024a77f21f6cb4`:
276 campaigns,80 latest first-clear comparison levels,32 chains/profile and32 simulated attempts.
74 recorded openings/boards and6 table boards;8 assisted held wins remain included. All259 shared
baseline chains exactly match the pinned relation experiment, but the recent cohort has advanced;
do not compare the new80-level totals as if the old cohort were unchanged.

Earlier-development selected methods still choose alwaysFirst: Dennis9/20, Mrs.7/20, PUK13/20,
Gerda9/20. Recent selection gives10/7/13/9 respectively. Direct mixture10/80, personalBest11/80,
calibrated mixture31/80, controlForest33/80, profileForest32/80. Dennis post-hoc historical best is
11/20, not a prospective80% result. No sequence predictor is promoted and the failed original
prospective10/20 cohort is not reset. Dennis ownAllPlan8 first-try simulation is22.0%, pair-only
21.6%, novel pair22.5%, both cues19.7%; the change is mixed, not the required breakthrough.

72 named JS /78 Python tests, observer honesty, current source fingerprint and diff checks pass.
The next experiment must address memory-consistent supervised retry features, keep all memory
source timestamps/aids available before each fitted model cutoff, and evaluate on new progression.
Level128's existing frozen v1 point remains try2; no later research result overwrites it.

## Read-only refresh after completed relation experiment, 2026-10-17

Previous goal turn made concrete progress: the independent relation refit and full count experiment
completed, preserving evidence that better local action fit still misses the winning-try target.
Matching202-file sources/results are pinned in `experiments/personal-relation-2026-10-17T16-16-39-819Z`.
Its work-log typo for Gerda recent selection is corrected in the separate recent-score addendum;
numeric reports always showed9/20. No measurement is running. Session84657 also completed normally.

Live read-only refresh2026-10-17T16:17:50.930Z has576 attempts,576 exact board matches,zero mismatches.
Saved progress is Dennis119, Mrs.97, PUK54, Gerda63. Gerda won the already-opened62 on displayed14
at16:10:00.186Z; it does not become a newly opened prospective game after the fact. Primary Dennis
score remains8/12 with119 pending; Mrs. four misses and97 pending remain. No80% claim is supported.

Session84657 appended only the missing same-v1 Gerda86 forecast:try2, frozen1792253946392.
Existing predictions, original cohort clocks and all misses remain unchanged. No relation/intent
research predictor is promoted. Next measure pair-setup follow-through from actual consecutive
recorded actions before introducing any persistent-plan policy; do not assume universal greed.

## Learned pair preparation completed, 2026-10-17

Intent results are source-matched in `experiments/personal-intent-2026-10-17T16-03-55-614Z`,200 files.
No raw refresh or numeric forecast changes occurred. A verified observation alias prevented a
personal reopening policy from distinguishing a known free twin from a known covered twin: both
selected candidate features and move-kind context were identical before this change.

Append `knownPairPrep` and `knownPairPrepShare` to the policy/context schemas (68+8 features,
26 contexts). These freeze actual pre-action knowledge and legal free twins, including a closed
known twin that will auto-pair on its next real tap. Unknown, covered, iced and locked twins do
not qualify. No forced pair, extra removal, macro, hidden-location access or greedy prior is added.
Old generic actor behavior remains unchanged, and model identities now include observation schema.

69 named JavaScript tests,76 Python tests and observer honesty pass. The new regression proves
the old alias and its resolution, hidden-picture permutation invariance, actual separate taps,
locks/ice and zero-weight/default seeded compatibility. A one-off comparison against the pinned
intent engine also preserves20 seeds. Separate relation data and ownAll/ownNovel fits test six
focused profiles on the unchanged80-level cohort; completed winning-count results follow.

Session9408 finished the six-profile relation count measurement and own-only count fitting;
all235 earlier-available policy models and the action evaluation are complete. The dataset retains all356 prefixes /28,901
choices and exactly matches all old feature/context columns and physical reconstructions. New
pair-preparation opportunities occur in9,228 decisions. Latest ownAll learned preparation weights
are Dennis0.544, Mrs.0.581, PUK0.464, Gerda0.185, all fitted from own history against zero priors.

Matched held action loss (lower is better) changes Dennis1.670916→1.665484,
Mrs.2.091091→2.091799, PUK1.778776→1.777165, Gerda2.004019→2.002004. Dennis top-action
agreement changes40.69%→41.27%. These small improvements and one regression are not winning-count
accuracy. A separate descriptive observation file summarizes preparation choices by tray, without
using them as outcome labels or prospective proof. Positive and negative learned weights can
choose or reject preparation; defaults and zero weights never force a pair.

Measurement2026-10-17T16:15:40.646Z, fingerprint
`ed020b8d249da7e16d3485147c8ba295f56e869fe6d37361ed3a890e797a6a67`.
All259 baseline chains and80 cohort identities exactly match the pinned key experiment.
Earlier-development selection chooses alwaysFirst for each person: Dennis9/20, Mrs.7/20,
PUK13/20, Gerda9/20. Direct personal mixture13/80, calibrated mixture27/80, controlForest35/80,
profileForest34/80. Recent selection: Dennis9, Mrs.3, PUK13, Gerda9/20; mechanics-matched
Mrs.5 with others unchanged. Neither selection strategy reaches80%; no research predictor promoted.

The remaining gap is substantial: Dennis ownAll simulation first-try success is4.4% versus15.6%
with clock planning and49.7% for the legacy comparator, while actual held first-try wins are45%.
Slightly better recorded-action likelihood is not enough when independent local errors compound
over whole games. Next investigate coherent action sequences / persistent plans instead of another
global greedy override or reporting post-hoc best historical methods as prospective accuracy.

## Personal follow-through and recent selection completed, 2026-10-17

Previous turn made progress: the single-step alternative completed and was pinned, demonstrating
that literal immediate-state accuracy did not improve winning-count accuracy. Current research
jobs were verified terminal before new source changes. The next hypothesis restores anticipation
but fits whether each person actually follows through on its known-match cue.

Optional `physicalFollowThrough` applies only after a real known take leaves a known exact tray
match available, after clock clearing. The cue freezes knowledge before the take; newly uncovered
or blind automatic matches do not invent a prior plan. At the next manual decision, a fitted
per-tray probability gates matching versus nonmatching alternatives; the existing personal actor
still ranks the legal alternatives. This models the total conditional rate, not an extra override
probability added on top of baseline matching. If no other action exists, legal matching remains.
Clock/key routes keep priority. All choices execute separate real taps; no free pair is forced
at the start or elsewhere merely because it exists. Default/off/follow behavior is unchanged.

Earlier natural ordinary-picture cue samples are fitted independently per person and tray with
twenty-prefix decay and explicit Beta(1,1) priors. Same-campaign aids and later chunks remain
excluded before fitting; missing later actions are censored, not false non-follow-through labels.
Wildcard prefixes remain in action fitting and full count scoring, but are excluded from this
simple cue-rate extraction. Runtime cues only include exact known ordinary-face matches and use
real Joker/arrival/relief rules. Base action and conditional cue likelihoods are reported separately.

The intent dataset preserves all356 original recorded feature sequences /28,901 choices. Cue
counts: Dennis571, Mrs.307, PUK640, Gerda3454. Current all-prefix posterior rates for one/two/three
waiting slots are Dennis0.683/0.812/0.939; Mrs.0.730/0.790/0.771; PUK0.880/0.827/0.975;
Gerda0.748/0.745/0.887. These are conditional next-action rates, NOT winning-count accuracy.
Empty histories use declared0.5 priors, never later recordings or family habits.

68 named JavaScript /75 Python tests and observer honesty pass. A100-seed quantitative test
matches the requested follow-through probability exactly, proving it is not double-counted with
baseline matching. Tests also cover declined cues, forced legal fallback, unknown/covered pictures,
clock priority, unchanged followed actions, independent metadata identities and earlier-own fitting.

A separate recent/mechanics-aware method selector uses only earlier completed own first-clear
predictions, last20 with half-life10 and six comparable clock/key games before exact mechanics
matching. On the pinned single-step historical data it moves Dennis9→10/20 but hurts the other
three (recent20: Mrs.4, PUK11, Gerda8; mechanics-matched Mrs.5). Do not promote globally or
claim80%. No old forecast, miss, cohort clock or primary future score is changed by that analysis.

Session15451 finished successfully:235 earlier-available models,259 campaigns, ten profiles and
the same80-level cohort. Measurement2026-10-17T15:56:58.940Z, fingerprint
`553fba1292752c5a6d02e06b93e99a81464046791ed28ae78030e437d0c4a7b0`.
All1,036 matched baseline/ownAll/ownAllPlan8/ownNovelPlan8 control chains exactly match the pinned
key experiment. Earlier-development method selection gives Dennis9/20, Mrs.3/20, PUK13/20,
Gerda9/20. Intent recent selection moves Dennis to10/20 and Mrs. to6/20, still far below80%.
Fitted follow-through modestly changes simulation success but does not solve the forecast task.
Do not promote it or reset the genuine prospective8/12 score, existing misses or pending119.

Next investigate a representational blind spot: a known closed tile with a known free twin versus
a known blocked twin currently has identical reopening features. Add a learned observation of
pair preparation, not a forced greedy action, and refit each person's own earlier history.

## Non-greedy single-tap scoring refit, 2026-10-17

Previous goal turn made progress: key routing was implemented and the continued live measurement
was revalidated rather than restarted. Session35983 then finished successfully. Its full results
are pinned in `experiments/personal-key-2026-10-17T15-18-07-653Z` (195 matching files). They do not
reach80% and do not justify promoting a new prospective predictor.

The next hypothesis removes anticipated but unexecuted matches from a physical candidate's score.
Optional `physicalSingleStep` scores only the actual tap, including real automatic peek twins and
Joker physics; it does not perform later voluntary tray matches in the hypothetical score. This
is per-person feature fitting, not a prescribed greedy action override. Defaults are unchanged.
Normal and single-step prefix files/banks are separate, model identities include scoring mode,
spawned fit workers load the explicit dataset, and actors carry their fitted instrumentation flag.

The candidate retains all356 natural prefixes /28,901 decisions, timestamps, selected choices and
physical reconstructions. It changes23,995 option-feature rows. A direct real-state comparison on
14,342 recorded known takes now finds zero tray mismatches or unexecuted clock/key credit, versus
the earlier anticipated-followup mismatches. Two unmatched historical wildcard-boundary prefixes
remain explicit exclusions from this local diagnostic, not from count scoring. Automatic physical
twins and their real move costs still occur. This proves feature alignment only, not forecast accuracy.

67 named JavaScript /70 Python tests and observer honesty pass, including actual state/goal credit,
atomic clock-twin moves, hidden-picture permutation, unchanged followed actions, independent model
identity by scoring mode and explicit worker dataset loading. All existing numeric ledgers remain
unchanged since the append-only15:06 coverage freeze; the real v1 prospective Dennis score is still
8/12 completed new levels107–118 with119 pending. No live data refresh occurred during measurement.

Session99468 finished successfully, including all235 fits, nine profiles and whole-count scoring.
There is no remaining live measurement. It measured259 campaigns at2026-10-17T15:32:46.401Z,
fingerprint `254a7ac1853ccade11ac5a75db94dd5b3fa4062b21d467f04c6981fe92de71ae`.
All259 legacy baseline chains and the80 comparison identities exactly match the pinned key
experiment. All235 kind-model fits and earlier-training memberships match as well, isolating the
changed within-kind features/scoring rather than a changed cohort or future training.

Literal scoring does not improve the requested result. Earlier-development selection still chooses
alwaysFirst: Dennis9/20, Mrs.7/20, PUK13/20, Gerda9/20. Direct personalBest17/80, mixture19/80,
calibrated mixture34/80, own control forest36/80 and profile forest31/80. Different profile sets
(including finishing controls) mean mixture improvements cannot be attributed to scoring alone.
On matched all-prefix clock-plan8 actors, first-try rates fall from0.159 to0.134 Dennis,0.158 to0.097
Mrs.,0.197 to0.194 PUK and0.111 to0.073 Gerda. Do not promote the literal feature variant merely
because its immediate-state diagnostics are exact. It remains optional and off by default.

Action likelihood is also mixed: Dennis ownAll1.671→1.673, Mrs.2.091→2.061, PUK1.779→1.799,
Gerda2.004→2.029 (all same source-matched candidate prefixes). The stronger earlier anticipatory
score may model a real planned followup, but the stochastic actor does not commit to that plan.
Next meaningful actor hypothesis: optional completion of the known tray-match followups assumed
by the chosen action's score, fitted independently per person from earlier natural transitions.
This is not global greedy pairing: the original chosen move stays personal, only its anticipated
known followup is an optional intent. Preserve clock priority, separate legal taps, frozen knowledge
and actual automatic twins. Never feed target human paths into autonomous simulation.

Also investigate recency/mechanics-aware count-method selection: current selectedBeforeTest uses
all earlier own development games, so old easy levels can favor alwaysFirst despite later hard
clock/key levels. Any alternative must choose from strictly earlier outcomes per target, keep
replays diagnostic, retain existing frozen misses, and remain exploratory until later frozen proof.
Whole-count and later pre-start evidence still decide80%, not likelihood or feature alignment.

## Fresh progression evidence and physical key routing, 2026-10-17

Read-only refresh completed at 2026-10-17T15:02:48.030Z, after the joint experiment was pinned in
`experiments/personal-joint-2026-10-17T15-00-51-877Z` (187 source-matched files). There are now 568
attempts, all 568 board reconstructions matched with zero mismatches. Dennis's saved progression
is 119 (not 106 and not replayed53/54); PUK's is54. Mrs. remains97, Gerda62.

The unchanged earlier v1 forecasts genuinely scored 8/12 Dennis first-clear levels 107–118:
correct107,108,110,112,113,114,116,117; missed109,111,115,118. Level106 was opened before the
freeze and remains diagnostic only. Level119 is pending with its original pre-opening point1.
That is 66.7% on twelve completed future levels, not 80% and not a completed twenty-level cohort.
All thirteen opened Dennis levels have eligible forecasts; the original four Mrs. misses and
pending97 remain. A same-v1 coverage extension froze14 newly uncovered future levels at
1792249589815 (2026-10-17T15:06:29.815Z): Dennis130–142 and PUK77. Every earlier progression
snapshot compares byte-for-byte structurally identical; the other three numeric ledgers retain
their original hashes. The cohort clock and 8/12 score did not reset. New progression ledger
SHA256: `9b13073b3a19487c5e1d07260c72722cc9c0c4c5557f76db37c34ae6af7221c4`.

Optional `physicalKeyPlan` now routes to actual visible/identifiable keys with single physical
taps, including real down-tile inspection/reopening and automatic twins. It reuses frozen-known
bounded target search, never inventing pictures under covers. Unknown frontiers stop the route
until actual play reveals them. Cached routes avoid alternating reopens. Urgent clocks retain
priority; key planning waits when insufficient clock slack remains. It is disabled by default,
ignored in follow mode and does not impose greedy finishing after keys. Wildcard boards retain
their existing actor rather than using an invalid hypothetical wildcard route.

Tests cover known and unknown keys, blocking side tiles, individual move costs, actual automatic
matches, clock priority, hidden-picture permutation, wildcard fallback, unchanged follow/defaults,
and three fully remembered difficult boards without a key-route loop. Clock behavior with key
planning disabled matches the pinned joint engine on 48 recorded cases. 64 named JavaScript /
67 Python tests and observer honesty pass.

A fresh prefix reconstruction, own-only key bank and ten-profile count experiment completed
under exec session35983 (terminal success), after 235 earlier-available models for263 requests.
Coverage session9284 is also terminal success. No live measurement remains. No Firebase writes or release.

The key experiment measured259 campaigns /80 latest first-clear comparison levels with32 chains
per actor at2026-10-17T15:17:06.499Z. Fingerprint:
`0f7ddfd9b5bd83eaa06ae7b93ebbba481ab84c6cb2750717909bd67f351fd4aa`.
Recorded boards cover66/80, tables14; all8 assisted held wins remain scored. Key planning makes
only small changes: Dennis ownNovelKey8 first-try simulation rate0.163 versus NovelPlan8 0.142;
Mrs. key14-safe-exit0.198 versus NovelPlan8 0.194. Earlier-own-likelihood selection uses Dennis's
safe-exit key profile on14/20 and all-prefix clock-plan on6/20. It still does not predict counts
well. Earlier-development method selection remains alwaysFirst for all: Dennis9/20, Mrs.7/20,
PUK13/20, Gerda9/20. These are baselines, not personal-actor successes. Direct personalBest13/80,
mixture12/80, calibrated32/80 and profile forest35/80; no80% result or model promotion.

Two new source-matched mechanism diagnostics change the next action. Recorded first-clear retry
pairs: Dennis12 (8 repeat first take;5 share≥4 opening takes), Mrs.35, PUK23, Gerda94. None revisits
the previous terminal physical state; this does not prove the terminal action was the causal
mistake, and the first-retry-only Dennis sample is just5. The model's exact-last-state ban therefore
cannot be assumed to represent all of the user's learning. Do not infer psychological certainty.

The scoring diagnostic compares each recorded actual take with its chosen option features. It
finds deliberate heuristic followup credit: Dennis712/1971 takes have a different tray occupancy
in their score than immediately after the actual tap, with19 hypothetical clock and47 key credits.
Mrs.452/1259, PUK1135/2729, Gerda4267/8383. The score anticipates up to six known tray matches,
while the fitted physical actor does not necessarily execute them. This is not automatically
illegal physics, but is a concrete non-greedy modeling mismatch worth testing. Next: fit personal
actors on optional actual-single-step features, preserving automatic physical twins but removing
unexecuted greedy followup credit. Defaults and all frozen forecasts must remain unchanged.

## Joint personal decisions and human-state diagnosis, 2026-10-17

The previous turn made progress: independent per-person fitting and corrected campaign exclusions
completed, with a full 80-level count benchmark. The next action follows evidence, not the old
greedy premise. No research simulation remained live at continuation start.

A new pinned-engine handoff diagnostic deliberately supplies actual human past state to localize
failure, never to forecast. Every initialized state is checked for identical alive tiles, tray,
open peek and moves; no unsupported handoff was used. On Dennis's six recorded new-level openings,
ownAllPlan8 wins 14/96 simulations. After his actual clock clearing it still wins only 11/80;
greedy finish wins 5/80. After his move-40 state, ownAll wins 27/48 while greedy wins 17/48.
Thus fixing only opening/clock order does not explain his missing skill. These are small local
mechanism samples, not first-clear count accuracy or prospective evidence.

The two-stage actor selects a kind (flip/pair/single/fatal) before weighing the actual tap values.
It therefore cannot let the value of an unusually important match/key/clock tap overturn its
sampled kind. A new joint actor fits all legal taps together, using personal tile/goal features
and kind-by-visible-context interactions. It is fitted once on strictly earlier own prefixes;
no family prior and no prescribed greedy rule. One joint softmax replaces kind-then-tile sampling.
Optional joint policy rejects simultaneous kind masking. A joint flip now correctly receives its
learned spatial/picture/reopening weights, previously absent from the non-kind flip-score branch.

Recorded feature reconstruction is byte-identical for all 327 natural prefixes / 25,750 choices.
Neutral strong/average output matches the pinned earlier engine on 48 board/persona/seed cases.
Observer honesty and 63 named JavaScript / 67 Python tests pass. New tests cover cross-kind value
competition, learned flip positions, single-person fitting, unavailable history and hidden-picture
permutations. A new joint bank and full nine-profile count comparison completed with no live job
remaining. All measured inputs remained stable. No numeric forecast or release changed.

The experiment measured 246 campaigns / 80 comparison levels / 32 chains per actor at
2026-10-17T10:57:22.480Z. Fingerprint:
`1fad63d5ddbaa8a1f118c764553417b660cd0bd68660532f2b06ce92e2bc9efb`.
Joint choices are not a universal improvement. OwnJointAll action log loss is 1.838 versus ownAll
1.750 for Dennis; Mrs. 2.153 versus 2.091; PUK 1.737 versus 1.779; Gerda 1.974 versus 2.004.
The novel-only joint model is especially poor with Dennis's six recorded new-level first tries
(3.095 log loss). The change must remain optional, not replace his stronger two-stage actor.
JointAllPlan8 simulated first-try wins average 0.067 Dennis / 0.023 Mrs., versus two-stage NovelPlan8
0.111 / 0.194. PUK joint 0.320 improves on two-stage all 0.198; Gerda's joint remains about 0.105.

Own-only count selection using earlier development history chooses alwaysFirst for all four,
scoring 10/20 Dennis, 7/20 Mrs., 14/20 PUK and 9/20 Gerda. This is a baseline, NOT a successful
personal actor. Direct personalBest scores 11/80, mixture 8/80, calibrated mixture 32/80, and own
profile/control forests each 37/80. All still fail the requested 80% rule. No prospective model
is promoted or replaced. A quantitative unit test independently reconstructs joint softmax scores
from recorded features and matches the simulator's first tap for 100 deterministic seeds.

All twenty recent comparison levels for Dennis have keys and clocks; nineteen of Mrs.'s twenty
have keys. On the six recorded Dennis initial prefixes, keys remaining when the clock clears
are 2 on 100/101, zero on 102/103/105; 104 failed before clock clearing. Key planning can therefore
matter independently of clock planning, but it is not assumed to explain every failure. The next
safe mechanism test is optional legal single-tap key routing, selected per person, not global greed.

## Personal-first refit and campaign correction, 2026-10-17

The user explicitly prioritizes fitting each person independently; greedy finishing must not be
imposed on Dennis. Own-only action scopes now fit each person's available recordings once,
against a declared generic prior, not a family-fitted prior. Separate first-clear-only and
all-natural-prefix actors allow replay habits without letting replay wins inflate progression
accuracy. Count fitting has an explicit own-only mode: no family likelihood pseudo-episodes,
count-forest training, calibration or board recall. Strategy priors are equal in that mode;
planning, retry memory and greedy alternatives are selected using that person's earlier history.

An opening audit found real leakage in earlier physical experiments: Mrs. level 91 had a missing
first end, so its initial first-try prefix trained a target whose inferred opening was a day late.
Its winning count was mislabeled 20 instead of 21. Gerda level 56 had a resumed duplicate failed
end with a different aid; the split second episode trained on the first. Campaign reconstruction
now retains original starts, merges interrupted same-level attempts across other-level replays,
deduplicates resumed failures, and excludes every campaign aid. True counter resets remain
separate. Replay counts still restart locally at 1. Pending openings merge into completed
campaigns rather than remaining a separate pending/replayed episode.

Earlier archived physical results are preserved but are NOT clean evidence for these two cases.
The finish experiment completed before this discovery: greedy attention improved PUK/Gerda's
simulated wins but hurt Dennis; none achieved 80% winning-count accuracy. No greedy strategy is
promoted for Dennis. A new own-only eight-profile count measurement completed on corrected
campaigns. Its results remain exploratory, not an independent fresh holdout. All four numeric
forecast ledgers remain untouched, including the four existing prospective misses.

Regression tests now cover missing first ends, changed-aid resumes, local replay counters,
interleaved replays, own-only membership, single-fit training and family-independent strategy
features. 61 named JavaScript tests, 64 Python tests and observer honesty pass.

The corrected experiment measured 246 campaigns and the same latest twenty distinct first-clear
levels per person (80 total), with 32 seeded chains per actor. Fingerprint:
`81ac6880e4f09d5b81ee89ec26a72da0f578e6ece221f73ad1842cdd8a60ab69`.
The legacy baseline remains a control only: its family-informed choices are excluded from every
own-only strategy mixture, count feature and method selection. OwnAll provides the personal
count reference instead. Own-only likelihood chose Plan8 for all twenty Dennis levels, no greedy
finishers. It chose greedy alternatives for PUK's twenty levels and Gerda's fifteen, with phased
retry memory on the other five. Mrs. predominantly selected phased retry memory.

Winning-count results remain poor. The prediction method selected using earlier own development
history scores Dennis 10/20, Mrs. 4/20, PUK 14/20 and Gerda 9/20. These are not all direct actor
forecasts: the selected method for Dennis/PUK/Gerda was alwaysFirst, a diagnostic baseline.
The direct personalBest actor predictions score 24/80; personalMixture 22/80; own-only profile
forest 32/80 and control forest 37/80. No family-free model reaches the requested threshold, and
none replaces the old prospective predictor. Human action diagnostics support using replay habits
for Dennis: ownAll log loss 1.750 versus ownNovel 1.895 on six new-level first-try prefixes. That
is action likelihood, NOT 80% count accuracy, and the small sample cannot establish perfection.

The repaired campaign exclusions explicitly remove all 21 Mrs.91 aids and all three Gerda56
aids from all four bank scopes. The primary prospective score still retains Mrs.'s four misses
and pending97; all four frozen numeric ledger hashes are unchanged. No jobs remain after count
evaluation; no live data was refreshed during fitting. Next meaningful work is person-specific
clock/key route and retry planning, not a shared greedy finishing rule or cherry-picked scores.

The source-matched experiment is pinned in
`experiments/personal-first-2026-10-17T10-33-50-257Z` (183 files). After pinning, a further synthetic
missing-opening regression ensures a retry start after the first observed end cannot become the
campaign's original opening. Comparing old and guarded builders across every current raw player
produces identical campaign objects (zero affected players). The guard is not a new measurement;
the archived source remains authoritative for the saved fingerprint. Rebuild measurements before
promoting any later changed source. Current tests still pass; all numeric ledger hashes match.

## Finish-focused physical choices in progress, 2026-10-17

Previous goal turn is progress: physical clock planning reduced clock losses but the full count
comparison still fell short. A new pre-fatal audit uses the pinned 09:52 engine/data, not the
later refreshed current-path inputs. Knowledge is reconstructed from actual physical frames and
actual visibility, never future/hypothetical reveals. Wildcard boards are explicitly excluded
from this local diagnostic, not from the full count benchmark.

On 320 planned first tries each, Dennis has 284 tray losses: 73 with a known safe exit, 29 with
novel inspection available and 182 without either. Mrs. has 270: 86/31/153 respectively. Only
9/6 losses occur with at most 12 tiles left; 275/264 are earlier. An end solver alone cannot fix
the dominant problem. The clock clears into three slots without a known exit in 80/48 cases.
Ordinary-board PUK/Gerda diagnostics cover 112/224 simulations, excluding 208/96 wildcard runs;
their known-safe-exit fatal counts are 26/103. Passing a match is not automatically a mistake,
but overflowing with a legal known exit is a concrete actor failure.

Optional `physicalSafety` now models finish-focused attention after the clock is absent/cleared:
take a known immediate match, prepare a known free pair with separate legal taps, or inspect a
novel free down tile before a voluntary fourth tray tile. Pair choices never become atomic
macros; automatic twins retain the real move cost. Choices use visible/remembered pictures only.
Wildcard effects execute through the real physical transition, not a hypothetical wildcard plan.
The option is off by default and ignored in follow mode. Attention 0.8/0.95/1 are research
hypotheses, not measured per-person psychological truths or 80% accuracy claims.

A fourth profile enables `physicalClockSafeExit`: known clock routes must retain room or an
actually known legal exit, rather than saving the clock by knowingly deadlocking the tray.
Unknown pictures never count as guaranteed escapes. A regression demonstrates choosing the
blocker pair before the clock, preserving both the deadline and a usable tray exit. Root unknown
inspection caps are also respected by physical clock-prefix planning.

The existing visible-match error branch now excludes closed non-takeable tiles and immediate
open-peek matches from fatal candidates. Previously, combining physical mode with this optional
error model could directly take a closed tile or falsely label an automatic pair fatal. Neutral
legacy actors are unchanged. Tests cover this and legal known/unknown pair taps, clock priority,
wildcard target timing, hidden-picture invariance, default and follow-mode equivalence.

60 named JavaScript tests, 57 Python tests and the existing observer-honesty test pass.
The current 09:53 raw snapshot rebuild retains 327 prefixes / 25,750 choices. A new bank and
`physical_count_data.js 32 finish` are running with the nine earlier controls plus four predeclared
finishing profiles on all 250 episodes and the same 80 first-clear comparison levels. No current
measurement source/data may change mid-job. No numeric forecast, release or Firebase write.

## Physical clock-planning experiment, 2026-10-17

Previous goal turn is progress: it completed the 80-new-level count comparison and failure audit,
which demonstrated physical actors fail clocks much more often than recorded players. The next
safe action is implementing physical planning, not declaring 80% or replacing old forecasts.

Optional `physicalPlan` in `www/hard.js` now searches actual single-tap transitions. Known closed
face-down tiles need a real reopening; open twins and tray matches remove automatically and
consume their actual moves. The search freezes knowledge before hypothetical moves, stops at
unseen frontier pictures, and executes one real tap before replanning. Unknown reveals never
receive invented free inspection/removal outcomes. Journal rollback preserves open-peek, moves,
tray, alive, arrival and retry-observation state. Planning records pictures actually visible in
the real state, not pictures exposed only by hypothetical moves.

The initial count measurement was explicitly stopped after a termination diagnostic proved an
infinite retry-memory loop, not because an observation timed out. On remembered level 105,
reselecting only the first step of a valid route alternated known reopenings 78/1 at move 3.
The failed source, bank and prefix data are pinned in ignored
`experiments/physical-clock-aborted-2026-10-17T09-38`; no failed count result was saved.

The repaired planner retains its known legal route until actual knowledge changes, then replans.
This prevents rolling-horizon reopening oscillation without treating a pair as one physical action.
Root known reopening caps remain enforced. Planning now runs after the actual relief rule, so
an automatically unlocked/melted board can choose the clock immediately. A regression on real
remembered level 105 covers horizons 8/14/24; 72 remembered-board/seed termination diagnostics
pass. Tests also check relief and 32 hidden-picture permutations. The repaired experiment was
restarted only after the old process was confirmed explicitly terminated and sources rebuilt.

Clock searches include key frontiers when the clock is locked and obey ice/deadline rules.
They are node-bounded and disabled on Joker boards pending a faithful physical wildcard planner.
The old macro `plan`, `end` and `keyPlan` remain prohibited for autonomous physical actors.
The option is off by default and ignored in recorded follow mode. Tests cover single-tap blind
clock reveal/removal, unavoidable auto-match move costs, a full-tray open-twin clock removed as
the atomic second tile, locks, ice, hidden/down and covered-picture permutation invariance,
actual retry observation and unchanged follow/default behavior.

All 327 reconstructed prefixes and all 224 earlier-available policy vectors are exactly equal
to the pinned pre-planner experiment. Rebuilding updates only source/data provenance, not the
learned behavior. No raw refresh or frozen numeric forecast change occurred.

`physical_count_data.js 32 clock` completed nine predeclared profiles: the five original
controls plus physical planning horizons 8/14/24 and horizon 14 only after the first failure.
This is the same historical first-clear development comparison, not a new prospective cohort.
Optional planning must improve whole winning-attempt predictions, not merely first-try win rate.
58 named JavaScript tests, 57 Python tests and the existing observer-honesty test pass.

The repaired measurement completed at 09:48:34.819 UTC, fingerprint
`8054a9de6e1588454a794131b4796e2ef74b779b962b02517005c1b3b1740a9f`.
All 1,250 original-profile chains, board features/references and all 80 comparison memberships
exactly match the pre-planner measurement. New planner flags have exactly no effect on no-clock
boards. This is a controlled mechanism change, not a refresh to easier examples.

On 320 first-attempt simulations per person, novel planning at horizon 14 reduces clock losses
from 226 to zero for Dennis and 202 to zero for Mrs. But tray losses rise to 284/270 and wins are
only 36/50. The raw 32-run actor's count score improves Dennis 0/20 to 4/20 and Mrs. 3/20 to 5/20;
both remain worse than the old predictor. Horizons are reported, not chosen after target outcomes.

Earlier-development method selection remains Dennis 11/20, Mrs. 7/20, PUK 14/20, Gerda 9/20,
41/80 combined. The profile forest rises 37/80 to 39/80, still below controlForest's 41/80. One
gain is on PUK's no-clock levels, so do not attribute it to clock competence: duplicated profile
features can also perturb randomized feature selection. No person passes 16/20, no model is
promoted and the old prospective four misses remain. All four ledgers retain their original hashes.

Next: inspect physical actors' pre-fatal tray decisions, then add known-only sequential tray/end
planning if supported. Saving the clock while filling three slots without a usable exit can simply
move failures from clock to tray. Matching isolated taps is not enough to model a finish-focused
player. Preserve the tap/knowledge rules; do not make the legacy macro solver an escape hatch.

197 matching inputs, sources, results and immutable ledgers are pinned in ignored
`experiments/physical-clock-2026-10-17T09-52-02-603Z` with a SHA-256 manifest. Both the measurement
session and follow-on evaluation/audit session terminated successfully before any later refresh.

A subsequent read-only refresh completed at 09:53:30.133 UTC: 538 attempt boards match, zero
mismatches. Saved progression remains Dennis 106 / Mrs. 97 / PUK 53 / Gerda 62. Primary scoring
still has Mrs. 0/4 on levels 93–96, pending 97, and no completed qualifying cases for the other
people. Goal is not achieved. All four numeric ledger hashes are unchanged. Raw plays and Mrs.'s
replay export changed, so current-path physical measurement fingerprints are now stale; use the
pinned 09:52 experiment for the completed comparison and rebuild before further count fitting.
The refresh/scoring session completed successfully; there is no live measurement to restart.

## Physical-count comparison, 2026-10-17

The refreshed 08:43:57.950 UTC raw snapshot produces 327 natural physical prefixes / 25,750 choices:
Dennis 28/2,815, Mrs. 49/3,333, PUK 54/4,472 and Gerda 196/15,130. Two older Joker-rule boundaries
remain explicit truncations. New `initialNewLevel` membership uses initial attempt and earlier
regular clears, never target ending status. Latest own novel-prefix counts are 6/7/31/61.

`physical_policy_bank.py` completed 224 distinct availability models for 254 requests. Both
all-prefix and novel-prefix policies use strictly earlier available chunks and exclude every
target-campaign aid. Exact membership reuse is allowed; no coarse checkpoint or future fallback.
The bank fits kind-context and 75 within-kind visible features with bounded family evidence.

`physical_count_data.js 32` measured five predeclared profiles, each with 32 retry chains up to
32 attempts, plus strong/average references. It tests all/novel physical policies, learned fatal
mistake avoidance and switching from novel first-try to all-prefix retry habits. New optional
`retryPolicy` leaves default actors and first tries unchanged. No macro planner is enabled for
physical actors. Source/data fingerprints guard the complete measurement.

The historical comparison contains 20 DISTINCT completed first-clear levels each: Dennis 86–105,
Mrs. 77–96, PUK 33–52, Gerda 42–61. This is a new development benchmark, not the old mixed 80.
Dennis 104 changed board within campaign; it remains scored, but cannot fit natural profile
likelihood. Assisted held wins also remain scored. New-level histories/profile likelihood no longer
use easy replay counts to infer new-level skill. Prior immutable numeric ledgers are not changed.

The measurement completed at 09:20:51 UTC, evaluation at 09:21:23 UTC. It contains 250 episodes;
80 first-clear comparison levels include eight assisted clears, 53 recorded openings, 52 recorded
boards, 27 table boards and one classic reconstruction. Before-test method selection scores are
Dennis 11/20 (55%), Mrs. 7/20 (35%), PUK 14/20 (70%) and Gerda 9/20 (45%). This is NOT 80% for any
person. The profile forest scores 37/80 versus 40/80 for the legacy simulated baseline and 41/80
for the forest without physical-profile features. Post-outcome best-method selection is not used.

The fitted physical actors are substantially worse than the old actor at count prediction:
mean first-try win rates are only about 3% Dennis, 7% Mrs., 13–15% PUK and 8–9% Gerda. They often
predict far too many retries. Fatal-choice avoidance and all-prefix retry switching do not repair
this. Better action likelihood did not transfer to whole-game competence. Do not promote these
actors or change existing future numbers. The old model's four prospective Mrs. misses remain.

212 matching input/source/result files and all four ledgers are pinned in ignored
`experiments/physical-count-2026-10-17T09-23-06-644Z` with a SHA-256 manifest. Measurement fingerprint:
`c882246cadbfa09acd99fb8e58dd8166ce8401c9e5190d9a2e45177d178faf74`.
`physical_failure_audit.js` now separates simulated clock/tray failures, inspection loops and
known reopens before changing planning. Recorded failures are explicitly a different, incomplete
sample, not an invented matched win-rate denominator. Physical clock/key planning remains the
next mechanism to examine; never re-enable the legacy macro planner to disguise this failure.

The 16-run first-attempt mechanism audit completed successfully. On 20 levels / 320 simulations
per person, the all-prefix physical actor loses to the clock 223 times for Dennis and 214 for
Mrs.; its tray failures are 90 and 86. The old actor has only 16 and 0 clock failures respectively.
Mrs.'s separate complete natural recorded-failure sample has seven clock and 28 tray failures,
26 after the clock cleared. This identifies a planning mismatch, not evidence that she suddenly
lost skill. Dennis has only two usable recorded failures here, too few for a human rate claim.
PUK/Gerda physical actors instead lose to the tray 283/291 times, with no clocks on these levels.
They average about 13/22 known reopens per run. Fixing clock planning alone will not solve the
lower-level actor's sequential tray choices. These mechanism counts are not forecast accuracy.

57 Python tests and 57 named JavaScript tests pass, including exact availability membership,
target exclusion, novel scope, retry-policy first-try invariance and replay/board-change exclusion.
The existing observer-honesty test passes. `git diff --check` passes with usual CRLF notices for
regenerated JSON. These are correctness checks, not evidence of 80% winning-attempt accuracy.
The full browser suite was not run. No release, commit, branch or Firebase write occurred.

Goal is active, not achieved. Do not mark it complete or claim 80% without valid evidence.
Current scoring: actual winning attempt 1-3 exact; 4-5 allow ±1; 6+ allow ±2.
This is the user's latest goal, including later held-out games and forecasts frozen before opening.
The user explicitly permits building a new model instead of retaining Claude's approach.

## Checkout and scope

Research checkout: `C:/Users/den_k/Idea/OmasMahjong/personal-bot-review`, detached worktree at
`origin/wip/honest-observer` commit `41c3427`, created from `oma-mahjong-main`.
The Codex managed-worktree tool failed because the chat's root folder is not itself a repository;
the checkout was created with `git worktree add --detach`. No commits, branches, pushes, releases,
published dashboards, game levels or Firebase writes were made.

`dashboard-publish` is the latest main checkout (local one-commit UI change ahead of origin/main).
The old `oma-mahjong` folder is retired. Main's AGENTS.md was read. Research changes stay separate.

## What Claude built

Claude's final research commit fits per-person move-type habits by situation, with a 20-game
half-life and a small family prior. The tile within that type comes from a shared care-level-2
engine. Everyone gets 75/50/75% retry picture memory. A shared-slope logistic correction, recent
personal intercept/retry terms and residual family board effects produce the published 1.55
percentages. Clock and end-game planning bypass the learned action-type policy.

Thus these were partly personal hybrid players, not exact replicas of each person's thinking.
Claude measured rolling per-attempt probability loss, not accuracy of the exact winning attempt.

## Corrected defects

- `kinds.js` used future first recordings when no earlier recording existed, including other
  family members' future recordings. That fallback is removed. Recording completion times are used.
- `pdata.js` reused the first recorded board for every later attempt at the same level, despite
  version changes and replays. Matching now uses the exact attempt ID.
- Old board hashes ignored clocks, ice, locks and keys. New hashes include all of them.
- Research `layouts.makeDeal` ignored the third deterministic argument and stopped after a CPU
  deadline. Offline reconstruction now uses its own fixed-clock VM. Reconstructed historical
  classic boards are still approximate; recorded boards are preferable.
- Dataset refresh assumed arrays, but Firebase exports keyed objects. It also did not recognize
  1.55's fixed early boards. Both are handled.
- Version 1.54's table is missing on the research branch. Its levels 70-269 were verified identical
  to the 1.55 snapshot (all geometry, faces, down flags, obstacles and clocks); the offline loader
  aliases those designed boards accordingly.
- Original publishing rounded cumulative simulation results and reconstructed retry probabilities
  from them. The new driver retains exact conditional values and supports more than four attempts.
- App attempt counters persist across replayed levels. The count study retains logged counters,
  confirms new episode openings and translates to episode-local counts without changing hit labels.

## Experiments so far

Important later finding: the older probability/count chains described below predate an additional
observer-fidelity repair. With explicit flips enabled, unseen face-down singles were still offered
as takes, and the kind selector could classify their hidden matching/fatal result. The repaired
engine requires a flip before classifying that take. Clock planning also now requires knowledge
of a clock tile's picture. Legacy personal chains and fitted tile-choice artifacts need rebuilding;
do not treat their old accuracy or calibration as evidence for the current faithful bots.

Fresh local raw data were downloaded read-only from Firebase to ignored `source/analysis/archive`.
Move datasets were rebuilt. Current complete unassisted recordings: Dennis 20 games, Mrs. Doubtfire
28, PUK 45, Gerda 181. Prefixes from assisted/incomplete recordings give additional move examples
in the main mimic datasets. Fewer than twenty complete recordings exist for Dennis's newer play.

The separate personal probability driver improves probability loss on 449 historical attempts,
but this is not the user's target. See `evaluation.json`; do not substitute it for count accuracy.

Exact-attempt data contain 244 measured episodes, 231 confirmed completed openings, six censored
episodes and seven missing openings; 27 completed episodes used assistance. Every prediction is
frozen at the opening for the chronological checks. Latest twenty completed episodes per person
form the historical evaluation window. Harder boards are reported separately with a person-neutral
reference bot, so a run of harder boards is not automatically interpreted as worse personal skill.

Tested models include personal/family logistic calibration with jointly fitted board effects,
random forests, extra trees, multiclass logistic regression, boosted trees, ensembles, sequential
model selection, binary survival models, neutral cold-start move priors, a structural strong bot,
and per-person learned move-choice weights with spatial and known-picture features.

After the mistake-learning, limited-memory and contextual-hazard audits, the best pooled
exploratory result is 45/80 (56.25%, forest or online selection). Models selected using earlier
development results score Dennis 11/20, Mrs. Doubtfire 10/20, PUK 14/20 and Gerda 10/20.
Exploratory best for Dennis remains forest, 12/20. No model meets 80%.
Historical comparisons are exploratory because these data have been examined repeatedly.

The learned move model improves choices within a type: Dennis top-choice accuracy 45.9% vs
43.2% for the care-2 engine on 170 held-out decisions; his loss improves 1.342 to 1.120. Others also
improve top-choice accuracy, but these component gains have not translated to an 80% level-count
predictor. Position-only models were often worse; do not promote them on component results alone.

## Latest human clarification and work

Dennis: "it varies. I tend to not make the same mistake twice. The clock and the keys take some
lanning sometimes". Do not force identical retry openings. In paired complete recordings, Dennis
repeats at least four opening tiles on two of six retries and never repeats an identical losing
route. Other family members also vary their routes substantially.

New optional research-engine behavior now supports remembered losing branches, avoiding a known
fatal choice on revisiting the same state, a persistent stronger clock-planning horizon after a
clock loss, and short safe routes to visible/remembered keys. Default behavior is preserved. These
parameters were tested in `attempt_retry_eval.js` (learn, keys, earlyPlan, lowPictureMemory).
Raw profiles score 33-34/80. Limited-memory profiles in `attempt_memory_eval.js` score 34-35/80.
The difficulty-aware contextual hazard model scores 40/80. None establishes improvement to the
user's target. Do not promote the optional engine parameters on these results.

The compact contextual model uses a structural success baseline with regularized person effects,
personal difficulty sensitivity, retry learning and clock/key interactions. Censored failures
contribute negative observations only; a successful ending is never invented. Completed training
observations must precede the target opening. It does not use the target winning count as a feature.

The count dataset has 66 features. Central `attempt_features.js` now rebuilds them by named schema
after every stage, including relabeling. This repairs a stale-feature bug in audit reruns and the
old relabel script, which formerly dropped appended policy/retry/memory columns. Rebuilds also
order personal histories by completion, not opening. Prospective inputs reject stale schemas or
changed dataset/model/evaluation/source fingerprints before freezing. Old snapshots stay immutable.

Resolved user clarification on 2026-10-17: "Start at 1 for the new replay". Predictions and
tolerance bands use episode-relative tries, not the app's retained displayed counter. This confirms
the existing score; no historical results or immutable forecast snapshots change. A regression
test verifies that a replay won on local try 3 remains exact-only even when the app displays try 8,
and that local try 4 permits +/-1 in both aggregate and prospective-cohort scoring.

## Prospective evidence

Twelve immutable forecasts were saved in `prospective-forecasts.json`: Dennis 54-56, Mrs. Doubtfire
93-95, PUK 54-56, Gerda 63-65. All currently predict local try 1, with different selected models.
They were saved after the current games had already opened, so those current games are excluded.
Prospective results currently have zero completed qualifying games; targetMet is false.
Latest read-only refresh found Dennis's L53 win at 2026-10-16 22:28:45 UTC and L54 opening at
22:29:02 UTC (displayed try 3). L53 began before the frozen snapshot and cannot count. L54 has
not completed, so qualifying completed forecasts remain zero. The old historical count dataset
and evaluation predate the L53 completion; they are not a fresh post-refresh fit. Rebuild the
measurement pipeline before fitting forecasts from the refreshed recordings. Probability caches
also need fresh provenance checks after the refresh.

The scorer checks exact board identity and timestamp strictly before opening, uses the earliest
eligible forecast, and prevents an old forecast from being reused on subsequent easy replays.
It uses the user's tolerance rule based on actual winning attempt. Retained app counters are
translated only from an observed confirmed opening.

## Repaired context experiment (latest)

The previous goal turn made concrete progress: optional retry behavior, centralized feature
rebuilding, contextual hazards, source checks and measured evidence were added. This turn also
makes progress, not a wait: it repairs the remaining unseen-tile/clock oracle, fits a visible-context
move-type model, measures it against a repaired control, and freezes a new real-game test.

`personal_kind_fit.py` learns a twenty-feature residual on top of the coarse habit rates. Visible
clock budget/depth, keys/locks/ice, known pair and flip opportunities, tray pressure and progress
are used; unknown picture locations are not. Family and personal recordings must be available
before the cutoff, and historical simulations use the fitted model only after that cutoff.
Dennis's held-out kind diagnostic improves from 61.94% to 68.51% (289 decisions), loss 0.7172 to
0.6699. Mrs.'s loss improves slightly; PUK and Gerda do not improve. This is a component diagnostic,
not winning-attempt accuracy and not evidence of a perfect mental replica.

`kind_count_measure.js` records 245 episodes, including the new L53 completion, with 64 simulations
per profile. The same original eighty episodes are compared, rather than shifting to a new easier
window. Context is available in only 23/80 historical test episodes. Raw control scores 36/80;
raw context 37/80; control forest 43/80; context forest 44/80. Context forest scores Dennis 12/20,
Mrs. 9/20, PUK 14/20, Gerda 9/20. Models selected on earlier development remain always-first for all
four (11,10,14,9 correct out of 20). No repaired model meets the user's 80% requirement.

A separate immutable repaired-bot cohort was frozen at 2026-10-16 23:10:58.640 UTC:
`kind-prospective-forecasts.json`, 96 forecasts, 24 per person. Dennis 55-78, Mrs. 93-116,
PUK 54-77 and Gerda 63-86. Every primary forecast uses `honestContextForest-v1`. All point forecasts
are local try 1 except one Gerda try 2. These mostly-one predictions are NOT proof that the model
is sufficiently individualized or that it beats the baseline. They are a recorded future test,
not a successful result. Displayed-count predictions and their pre-freeze offsets are also frozen;
do not rebase those predictions after seeing later starts.

The earlier twelve prototype forecasts are untouched and scored separately. New inputs verify
the full measurement/source fingerprints before and after generation and again before freezing.
The latest scoring-helper change intentionally makes verification stricter: the prospective goal
cohort is the first twenty OPENED episodes per person after the first freeze, including unfinished,
missing-opening or unforecasted levels. Every one needs an eligible pre-start forecast and a known
outcome before the goal can pass. Do not choose twenty later easy completions while ignoring early
hard unfinished levels. `prospective_openings.js` now includes a first start before any end event,
so an ongoing first try cannot disappear from coverage. An unfinished matched episode also reserves
its forecast, preventing reuse on later replays. Synthetic tests cover these gates.
Prospective eligibility also requires an exact recorded opening linked to the attempt ID; an
opening inferred from duration is not proof that a forecast preceded the actual start.

Both prospective reports still have zero qualifying completed games. The earlier prototype has
Dennis L54 as one pending opening; the repaired cohort has no later opening yet. A new read-only
Firebase check after freezing confirmed no start/end newer than the local raw export for any of
the four people. This is not a completion claim or a blocked goal: meaningful research/validation
work remains, and real later games are necessary to prove the prospective requirement.

For the next turn, inspect actual state. Do not blindly rerun the legacy 66-feature pipeline or
promote its old results. Current repaired tools are `personal_kind_fit.py`, `kind_count_measure.js`,
`kind_count_fit.py`, `kind_prospective_data.js`, `kind_prospective.py`. The input fingerprints are
now stale for a new freeze because the stricter prospective scorer/outcome exporter changed after
the valid snapshot; rebuild inputs if making another snapshot. Existing forecasts remain valid.
If players jump outside the 24-level forecast range, coverage must report that missing prediction,
not silently omit the episode. Future snapshots could cover additional known fixed boards, but
cannot repair a level that has already opened.

## Clock-scoring and within-type goal audit

This continuation also makes concrete progress, not a wait/no-progress turn. No new start/end
events were found at its initial read-only Firebase check, and no prior research process was live.
It adds a measured within-type goal model and fixes a causal clock-scoring mismatch.

The scorer used to automatically take known tray matches after a hypothetical move even when the
clock's remaining slack was zero. It could label the correct covering-tile move fatal because of
follow-ups the human would postpone to reach the clock. The hypothetical follow-up loop now stops
when the clock is tight, matching the real policy's urgency rule. A regression test checks that
the good single remains feasible while a truly deadline-breaking pair is still penalized.
A matching clock tile itself remains a permitted urgent follow-up, so the fix does not block a
safe clock rescue. That exception also has a regression test.
Mrs.'s held-out within-type base loss drops from 21.896 to 1.467 under this repair (220 decisions).
Dennis's changes slightly from 1.323 to 1.332 (209 decisions). These are move-choice diagnostics,
not winning-attempt results. They do not justify an 80% claim.

Optional `goalWeights` have eight visible planning features: keys taken, exposing known keys,
unlocking visible locks, clock taken/exposed, clock urgency and explicit key/clock flips. Unseen
covered keys do not receive exposure credit. Zero weights preserve seeded moves and chains.
The base care-2 engine weights are held fixed; an eight-parameter family-shrunk residual is fitted
only on earlier recordings, conditioned on the actual safe move type (fatal choices are excluded).
Both family and personal final availability timestamps are verified before their training cut.
Learned goal preferences improve Dennis's held-out loss only 1.3318 to 1.3262 and Mrs.'s 1.4671 to
1.4594; PUK/Gerda do not improve. These parameters are not promoted.

`kind_count_measure.js 64 --goal` saves a separate current `goal-count-data.json` (245 episodes).
Its control is the clock-corrected context actor; its candidate adds the learned goal preferences
only after their training cutoff. Neutral strong/average reference chances are remeasured fresh
with 64 runs, not copied from the now-stale pre-clock-fix reference. The original raw context chains
are pinned in ignored `kind-pre-clock-fix-data.json`; do not overwrite that pre-fix comparator.
The default kind audit now also remeasures neutral reference probabilities rather than blindly
reusing stale caches after an engine change.

On exactly the same historical eighty-episode window: pre-clock-fix raw context 37/80, corrected
raw control 36/80, learned-goal raw candidate 38/80, calibrated control/candidate 42/80, and either
forest 43/80. Always-first remains 44/80. Dennis raw goes 7/20 control to 9/20 goal, but calibrated
and forest variants score 11/20, not 80%. No current model reaches the requested accuracy.
Do not present the optional preference fit as a reliable whole-game improvement.

The immutable 96 repaired-cohort forecasts and the twelve prototype forecasts are unchanged.
No new model was promoted or substituted for already frozen forecasts. Existing snapshots remain
valid evidence of their original predictions; current measurement/input hashes are stale after
this scorer change. Rebuild the corresponding measurements before freezing new forecasts.
The repaired cohort still needs real later games for prospective evidence. Covering additional
fixed boards before future level jumps remains a useful next action; missing hard-level forecasts
must not be silently dropped from the first-twenty-openings gate.

## Retry-memory action repair and inspection evidence (newest)

A further reproducible mismatch was found in the personal explicit-flip policy: retry memory
marked hidden pictures known in `sees()`, but `looked()` and the take/pair candidates still treated
them as unknown. The bot randomly inspected remembered tray matches instead of using their known
locations. A four-tile demonstration needed two inspection decisions both with and without perfect
recall. `looked()` now accepts remembered pictures, remembered reopens are not new information
decisions, and flip candidates exclude already recalled pictures. In that demonstration, perfect
recall now needs zero inspections versus two without recall, with the same physical moves.
Unknown non-recalled pictures still need observation; this is not an oracle shortcut.

The `--goal` measurement and count evaluation were rebuilt after this repair. The source/data
fingerprint matches the current scorer. Final results on the same eighty episodes: corrected raw
control 38/80, goal residual raw 39/80, calibrated control 37/80, calibrated goal 36/80, control forest
42/80, goal forest 43/80. The first-try baseline is still 44/80. Dennis raw control/goal score 9/20
and 10/20; the forests still score 11/20. The previous 36/38 raw and 42 calibrated results were
the intermediate clock-only revision, not the current version. No model reaches 80%.

`match_notice_audit.js` then reconstructed accepted HUMAN taps from the replay deltas, using only
face-up/currently open pictures and current ice/lock constraints. It distinguishes clock phases,
novel inspection and reopening already viewed pictures. The bot's forced immediate-match rule is
not a literal description of those taps. With the clock absent/cleared, Dennis took a visible tray
match 223 of 366 opportunities; 116 other taps were flips, but 86 were reopenings. Genuine new
inspection was 30 taps while a match was visible. When novel inspection was available, there were
143 direct match taps versus those 30 novel flips. Mrs.: 134/27; PUK: 459/7; Gerda: 2208/240.
These counts do not prove forgetting or a mistake; deliberate information gathering and other pair
plans also explain other taps. In particular, do not call every reopening new information.

This is actionable evidence for a next experiment: fit each person's probability of inspecting a
genuinely new free tile BEFORE taking an already known tray match, from recordings available before
the target opening. The current bot always takes that match outside urgent clock planning, so it
can stop gathering free information earlier than the human. Use a conservative family-shrunk
chronological estimate, condition on a novel free flip being possible, and compare whole winning
attempts. Do not label the measured difference 'inattention' automatically, add future recordings,
or promote a new profile merely because it increases simulated win share.

The latest read-only Firebase check still found no new start/end for any modeled person. The
earlier 96 plus 12 frozen forecasts remain unchanged. New actual games are still necessary for
prospective proof, but meaningful model work remains; this turn is progress, not a blocked turn.

## Personal before-match inspection experiment (2026-10-17)

Previous clarification turn was progress: the user's replay-local rule is recorded and protected
by a new regression test. The 80% goal remains active, not complete or blocked.
The next concrete behavioral experiment is implemented in `personal_inspection.js` and the optional
`scanBeforeMatch` actor. Fits use strictly earlier available replay chunks, twenty-game decay and
a twelve-choice leave-person-out family prior. Only no-clock/clock-cleared genuine novel flips
versus direct visible match taps enter this binary choice; reopens and competing other actions do not.
The actor chooses among genuinely unobserved takeable pictures without using their hidden faces.
Already recalled pictures are excluded, flips cost no physical move, active clocks suppress this
experiment and zero preserves seeded play. Immediate actual inspections are also now recorded in
`seenEver`: a followed inspection immediately before an early stop previously disappeared from retry
recall because the next scored decision never happened. Both experimental control and candidate
use that correction; previous measurement caches are stale.

The older-75% inspection diagnostic estimates Dennis 10.46% versus 37.21% observed in the later
conditional taps; Mrs. 16.34% versus 7.32%, PUK 1.90% versus 5.36%, Gerda 11.63% versus 19.07%.
These are conditional inspection frequencies, NOT level-success rates or proof of stable personal
parameters. The mismatch suggests that board/progress context may matter; do not relabel it as
declining skill or fit it to future target outcomes. The full 245-episode paired count measurement
completed with 64 retry chains and freshly measured neutral references, preserving the fixed
eighty-game historical comparison. No new forecasts are promoted based on component fits.

A read-only live check found new PUK normal L53 failures at displayed tries 6-9, ending
2026-10-17 00:22:51.799 UTC, plus six daily wins. Neither the normal level nor any later frozen-cohort
level is completed. Daily wins do not count as regular prospective level completions. The other
three people have no new start/end. Do not refresh input exports during the running measurement;
refresh and rescore both immutable ledgers after it terminates.

The completed inspection result at 2026-10-17 02:44:30 UTC rejects promotion: raw control 38/80
versus novel-inspection 35/80; calibrated 37/80 versus 36/80; forests both 43/80. Dennis raw
control/inspection are 9/20 and 7/20, forests 12/20 and 11/20. More faithful free inspection alone
does not produce better winning-count forecasts. Before refreshing, the input fingerprint matched
and all 245 own/family availability checks were strictly before the target opening. Measurement
inputs, raw exports, actor sources, evaluator sources and fitted results are pinned under ignored
`analysis/archive/personal-bots/experiments/inspection-2026-10-17T02-43-00-247Z` for reproduction.
The subsequent raw refresh at 02:46:01 UTC changes current cache fingerprints; do not freeze new
forecasts from the old measurement without rebuilding. Freshly rescored immutable cohorts still
have zero completed qualifying regular episodes. The prototype has Dennis L54 pending; neither
PUK's daily wins nor failures on the already-open L53 can count as new cohort completions.

## Explicit earlier same-board effort retrieval

A distinct gap was checked: a reordered level can be a board the SAME person already cleared.
Generic forest history features pool same-board results across people and may ignore a rare own
repeat. `board_recall_eval.py` retrieves only earlier completed unassisted own episodes on an exact
complete board hash, regardless of level number, with twenty-game decay and replay-local counts.
No target outcome, retained displayed counter, later completion or another person's result enters
retrieval. Two focused Python tests protect those restrictions and the unknown-board fallback.

This affects six of Dennis's fixed twenty historical tests, no tests for the other people.
His previous level 92 took five local attempts; the identical reordered level 91 again took five.
Retrieval correctly predicts local 4 under the user's +/-1 rule, whereas the control forest says 2.
The forest-plus-retrieval variant scores Dennis 13/20 versus 12/20, pooled 44/80 versus 43/80.
Retrieval plus first-try fallback scores 45/80 versus baseline 44/80. This is a ONE-episode
exploratory gain, not 80%, not an untouched test and not prospective evidence. Development-only
model selection still chooses the baseline for Dennis. No new variant or forecast is promoted.
Previous effort is also not destiny: old level 103 took one try but its reordered level 94 took
two; old level 105 took one but its reordered level 96 took four. Preserve those misses.

Next meaningful work should target the remaining failures on previously unseen hard boards, not
keep tuning an increasingly examined historical window or call a tiny retrieval gain success.
Audit actual decisive failed human taps against the actor's loss mechanism and visible planning
constraints, particularly after the clock is cleared; a level having a clock does not prove the
human lost to that clock. There is still useful model work, so this is progress, not a blocked turn.

## Recorded loss mechanisms and personal clock onset (2026-10-17)

Previous goal turn was progress: inspection behavior and own-board retrieval were implemented and
evaluated, not merely planned. This turn inspects actual decisive human taps before changing models.
`failure_audit.js` reads full unassisted regular failures, classifies clock losses from the recorded
clock flag/final state, and reconstructs the last physical action's visible or earlier-seen exits.
It never uses the locations of unseen pictures to label an available safe choice. Previously seen
does not prove that a person recalled it, and no local exit does not prove all earlier choices were
forced. Daily games, altered boards, partial recordings, helpers and truncated traces are excluded.

Recorded failures: Dennis 7 (4 clock, 3 tray), Mrs. 25 (5 clock, 20 tray), PUK 16 (all tray),
Gerda 120 (all tray). Of the tray failures, visible safe exits were present in 2/4/2/39 respectively;
an immediately visible tray match specifically existed in 2/1/1/27. Some visible safe pairs were
missed by double-tapping the currently open tile rather than its visible twin. This is not a UI
rule inconsistency: taking the twin would clear the pair; taking the open tile itself fills a slot.
The two Dennis tray-match misses occurred while the clock was still active and clearing the clock
itself filled the fourth tray slot. Final clock-cleared status alone must not be called a no-clock
choice. Most recent Mrs. losses are after clock clearance, not alarm failures.

`personal_clock_plan.js` measures five predeclared onset horizons (0/4/8/10/14) on 48 complete
recorded clock games, with 64 seeds. Each game's coarse/context actor uses only earlier available
habits. Planning depth is fitted at each target opening from earlier recorded clock-failure flags,
twenty-game decay and a two-observation equal-person family prior; the default 10 wins ties.
The older-75% diagnostic picks Dennis 10 (same as baseline), Mrs. 4 (held clock loss 1.095 versus
baseline 1.006, worse). These simulations start without actual previous-retry picture memory and
are explicitly mechanism diagnostics, not a complete retry calibration.

The full paired winning-count comparison still uses all 245 episodes and the fixed 80 tests:
raw control/candidate both 38/80, calibrated both 37/80, forests 43/80 and 42/80. Dennis forest
12/20 versus candidate 11/20. No personal-clock variant is promoted. Measurement inputs matched
the source fingerprint and all temporal availability checks passed. Inputs and fitted results are
pinned in ignored `analysis/archive/personal-bots/experiments/clock-2026-10-17T03-00-11-635Z`.
The later optional match-error actor changes source hashes, so old current-directory clock caches
cannot be used to freeze new forecasts. Live read-only checking found no newer regular start/end
for any person; qualifying completed prospective games remain zero.

## Fatal choices despite a visible tray match

The audit reveals a distinct actor impossibility: outside clock urgency, the existing bot forces
every known tray match immediately. Human fatal taps with visible matches therefore cannot happen
under it. `personal_match_error.js` fits a separate probability from physical human choices with
three waiting tiles, a currently visible takeable match, and no active clock. Earlier natural
choices from auto-finished wins are retained, but automatic actions never enter the denominator;
excluding all auto-finished wins would bias the estimate toward failures. Full altered/assisted
recordings remain excluded. Temporal fitting uses twenty-game decay and twelve-choice equal-person
family shrinkage, never target outcomes.

Optional `matchError` lets an all-moves explicit-flip actor occasionally choose a known nonmatching
tile despite a known match. It cannot classify or choose unseen pictures as known mistakes, is
disabled during active clocks, preserves seeded play at zero, and honors remembered fatal-state
avoidance when `learnFromLoss` is enabled. A fatal tap's psychological cause is not asserted.
Applying a rate fitted on immediately visible matches to recalled matches is an explicit model
hypothesis, not proven equivalence. Held mechanism estimates are Dennis 0.85% (observed 0/9),
Mrs. 1.99% (0/9), PUK 1.71% (0/11), Gerda 4.97% (6/132, 4.55%). These are choice error rates,
not winning-attempt accuracy. The full 64-chain paired count comparison completed separately as
`--match`; no forecast or immutable cohort has been changed.

The initial match-error actor omitted the ignored known match from `seenEver` when it failed before
the ordinary scored-decision snapshot. A seeded seven-tile test produced seen flags [1,2,3,0,4,0,0]
despite knowing index 3's match. The fatal branch now records all actually known current pictures
before committing; the test requires index 3 at observation move 4 and unknown indices 5/6 still
zero. The full measurement and count fit were rebuilt rather than reusing the pre-fix cache.
Initial data/results are pinned separately under `experiments/match-2026-10-17T03-06-46-297Z`.

Source-matched final result at 2026-10-17 03:12:15 UTC: raw control 38/80, match-error 37/80;
calibrated both 37/80; forests both 43/80. Dennis raw control/candidate 9/20 versus 7/20,
forests 12/20 versus 11/20. Gerda raw improves 9/20 to 10/20, forest 8/20 to 9/20, but this
does not justify global promotion, let alone 80%. Final inputs, raw exports, sources and results
are pinned under `experiments/match-2026-10-17T03-10-50-737Z`; fingerprint and all 245 temporal
availability checks pass. No new variant is promoted and both frozen prospective ledgers remain
unchanged, with zero completed qualifying games.

The next model experiment should fit personal engine quality and retry learning DIRECTLY to earlier
winning-attempt distributions, not keep improving an action diagnostic and hope counts follow.
The current fixed-care actor/calibrating forest largely misses exact second/third wins: Dennis has
4 second and 2 third wins in the fixed window, but the control forest predicts 1 eighteen times
and 2 twice. Gerda has 7 second and 3 third wins, yet raw control predicts 1 nineteen times and
the forest predicts 1 eighteen times. PUK's forest predicts 1 all twenty times. These are observed
model limitations, not an excuse to weaken the scoring rule. A small predeclared set of care,
retry-recall and failure-learning profiles can be fitted by past first-clear likelihood (including
censored failures) with family shrinkage and proper chronological availability, then compared on
the same historical window and genuinely future frozen forecasts. Do not choose a profile using
the target's winning count, silently drop difficult/censored boards or promote historical tuning
as prospective proof. Current work is progress; the goal is active and unmet, not blocked.

## Direct first-clear likelihood fitting (2026-10-17)

Previous goal turn was progress: actual human loss mechanisms were audited, two targeted actors
were implemented and measured, a retry-memory omission was fixed, and negative results were kept.
The 80% objective is still active, unmet and not blocked. A new live read-only check found no newer
regular start/end for any modeled person. No forecasts or immutable cohorts are rewritten.

`personal_count_profiles.js` predeclares nine complete actor profiles BEFORE measurement: baseline
care 2 with shared recall; care 0.7 and 5; each of those three care values with perfect retry picture
recall; baseline with failure learning/14-move retry clock planning; perfect recall plus learning;
and learned earlier visible-match errors plus failure learning. Each uses the same earlier-available
coarse/context habit actor. No profile is selected from the target's winning count. All 245 episodes
are being measured with 64 seeds, 32 retries and freshly measured neutral references. The exact
same fixed 80 historical comparisons are preserved. Fingerprints cover raw data, actor sources,
tables, board reconstruction, cached attempt metadata and comparison-membership inputs, and are
verified again after workers finish. Complete measured boards remain keyed by full identity.

`personal_count_fit.py` fits personal profile weights directly to earlier first-clear likelihood:
successful episodes contribute failures then a win; censored episodes contribute observed failures
only, never an invented win. Past unassisted confirmed episodes train the natural-actor profile
weights. Assisted held episodes are NOT dropped: all real completed comparison episodes remain
scored, and forests/calibration can learn from earlier real assisted outcomes. Own profile evidence
has a twenty-episode half-life, equal-person family evidence has two pseudo-episodes, and the
baseline profile has prior weight two. The mixture and best-profile forecasts use the user's
actual tolerance only for the point decision, not to fit profile likelihood.

Simulation probabilities receive Jeffreys smoothing from actual sampled reach/win counts. After
the 32 measured retries, analytic probabilities reuse the last sampled hazard out to 128 and
report remaining tail mass. This is an explicit predictive assumption, not additional observed
wins or proof that later retries were simulated. Conditional hazards sum remaining mass plus
the explicit tail rather than subtracting a nearly-one CDF; a regression test covers both tiny
late tails and large residual tails. Historical opening coverage and board sources are reported,
so inferred openings are not silently presented as prospective proof.

The existing `own_mode` comparator also now orders its recent window by completion, not opening
order. A regression test verifies overlapping/paused episodes completing out of opening order.
The person-isolation fixture now includes real required completion timestamps. No frozen forecasts
or old snapshots are changed by this helper repair. Other new tests protect target-label
independence, strict outcome availability, assisted/unconfirmed-first-attempt exclusion from natural-actor
training, censored likelihood and family-size balance. The initial pre-planner-repair result was
pooled 46/80 for profile forest plus own-board retrieval, 45/80 for the profile forest and 44/80
for control forest. Dennis best 13/20. The uncalibrated profile mixture was only 32/80. These
results and inputs are pinned under ignored `experiments/count-profiles-2026-10-17T03-29-38-531Z`.
They are not prospective proof.

## Clock information-planning repair exposed by count fitting

The proper first-clear likelihood revealed a physics/actor mismatch that the older zero-success
fallback had obscured: on some old clock boards the actor essentially never won, while Dennis
cleared them on his first local try. The clock search could not plan through currently unknown
blockers. The explicit-flip actor also did not proactively inspect free face-down clock blockers:
it fell back to learned coarse pair/flip rates and often spent the move budget on unrelated pairs.

The planner now prefers a full known safe route; if none exists it may return a known-move prefix
that reduces geometric clock depth and exposes previously unknown relevant information. Prefixes
reserve a free tray slot and enough physical moves for the remaining geometric route. No unknown
picture is read or taken hypothetically to establish a prefix. After real moves expose the next
tile, the actor observes/replans. Free unknown face-down clock/frontier tiles are inspected by
geometry before searching, only within the configured planning horizon. An already free unknown
clock cannot justify wasting a known physical move before inspection. Limited-memory inspection
bounds and previously recalled pictures are respected; flips still cost no physical clock move.

A six-tile three-layer regression previously died at move 3 because it paired the top blocker
with its twin, leaving insufficient moves for the two lower tiles. It now removes the top blocker
alone, observes the newly exposed middle blocker, removes that alone, and saves the clock as move
3. Hidden-picture permutations leave pre-observation choices unchanged. A face-down clock still
requires an actual inspection. These are observer-fidelity fixes, not a hidden-face oracle.

Mechanism examples on sixty-four first-try seeds, old 1.49 table boards: L94 went from 0 wins
(all clock failures) to 61 wins/3 tray failures; L98 from 0 to 64 wins; L96 from 0 to 31 wins,
24 clock failures and 9 tray failures. These are SIMULATED WIN SHARES, not winning-count accuracy
and certainly not a prospective 80% claim. The full nine-profile/245-episode dataset and neutral
references were rebuilt after the final repair; no stale cache was used.

Final count fit at 2026-10-17 03:55:17 UTC: first-try baseline 44/80, smoothed actor 41/80,
personal likelihood mixture 38/80, best personal profile 37/80, calibrated mixture 37/80,
control forest 44/80, profile forest 47/80, profile forest plus own-board retrieval 48/80.
The last variant scores Dennis 14/20, Mrs. 10/20, PUK 14/20, Gerda 10/20. Dennis therefore
improves from the earlier exploratory 13/20 to 14/20, still below 80%. Development-only method
selection instead scores 11/8/14/9. Do not present the better inspected variant as untouched
historical evidence or promote it as an achieved target. Eight held episodes were assisted;
all remain scored. Fifty-five of the eighty have exact recorded openings; board sources are
54 recorded, 23 table and 3 classic. These coverage limitations are explicit, not hidden.
Final matching inputs, raw exports, evaluator sources and results are pinned under
`experiments/count-profiles-2026-10-17T03-51-32-667Z`. Fingerprint and all 245 habit-availability
checks pass. There are still zero completed qualifying prospective games and no new model is
published or substituted into existing frozen forecasts.

Two further audits narrow the remaining work. Recorded consecutive retries use the same full
board in 12/13 Dennis comparisons, 28/28 Mrs., 24/24 PUK and 134/134 Gerda comparisons. The one
changed board is Dennis L104 across 1.50 to 1.52 (displayed attempts 2 to 4, with an unrecorded
intermediate try). Do not interpret that episode solely as changing personal skill or silently
remove it from the real winning-count score. Dennis's L97, L100 and L102 include voluntary
restarts before the eventual win; all successful count labels still include those tries. The
complete-only tile-policy dataset excludes these aborted openings, although the coarse mimic
habit dataset keeps natural prefixes. This selection bias is a concrete next modeling gap.

Next priority: freeze an explicitly experimental future cohort for the current profile-forest
plus own-board-retrieval pipeline before more real levels open. Keep the original prototype and
context cohorts immutable and score them separately. Include upcoming levels and previously played
fixed-board replay targets so old hard-level replays do not create avoidable coverage holes. The
model may be frozen experimentally without calling it promoted or proven 80%. Then rebuild the
full personal tile-choice data from natural replay prefixes, including early restarts and stopping
before assistance, rather than only complete unassisted games. These are concrete avenues toward
the original goal, so this turn is progress, not blocked and not complete.

## Experimental future profile cohort frozen (2026-10-17)

Previous goal turn was progress: direct count-profile fitting and clock information planning were
implemented, measured and checked against real loss mechanisms. This turn creates actual future
forecasts for the improved pipeline, rather than claiming success from the inspected historical
window. `count_profile_prospective.js` generates the same nine actor profiles and 54 forest features;
`count_profile_prospective.py` freezes a separate `countProfileRecallForest-v1` cohort. Its primary
is the pooled profile forest plus earlier unassisted own-board effort retrieval. The primary model
is fixed before future outcomes; alternatives are frozen for comparison but cannot determine the
pass gate. Selection used past exploratory development, not an untouched historical test.

181 predictions were frozen at **2026-10-17 04:26:13.752 UTC / 06:26:13.752 Amsterdam**, covering
24 upcoming levels per person plus previously started/finished fixed-board replay targets.
Counts: Dennis 55, Mrs. 65, PUK 26, Gerda 35. A coverage defect initially omitted fixed early
level 51 and currently open replay targets; it was corrected and all future inputs were rebuilt
BEFORE any predictions were frozen. Classic levels below 53 other than fixed 51 are not currently
precomputed. If they are opened in the first twenty episodes, missing forecasts remain in the
cohort and prevent a pass; do not silently omit them or substitute an unknown board/version.

Immediate next unstarted-level predictions at the input snapshot are Dennis L55 local try 1,
Mrs. L93 try 1, PUK L54 try 1, Gerda L63 try 1. These are experimental point predictions, NOT
80% confidence or observed success. The complete point histograms are Dennis 44 first/11 later,
Mrs. 43/22, PUK 25/1, Gerda 24/11: 136 of 181 still predict try 1. This does not by itself establish
adequate personalization. `FROZEN_PROFILE_FORECASTS.md` is a human-readable view of the frozen record.
Current already-open episodes are ineligible for this new cohort; their older forecasts still stand.

The new ledger is `count-profile-prospective-forecasts.json`. Atomic append/fsync and an exclusive
writer lock preserve earlier snapshots and prevent lost updates. Duplicate input snapshots are
rejected. Future rows reject outcomes/post-opening assistance metadata; training filters outcomes
strictly before the input cutoff, and the freezer rechecks complete source fingerprints immediately
before appending. Tests cover future-only labels, duplicate identities/inputs, existing writers,
Windows lock cleanup, fixed replay coverage, current-target selection and daily exclusion.
All predictions and tolerance bands use replay-local counts from 1. Retained displayed counters
are diagnostic only and never rebase the stored primary point after observing a real outcome.

Both earlier forecast ledgers are byte-for-byte unchanged (SHA-256 comparison against hashes saved
before the experiment). Matching inputs, raw data, actor/model sources, historical selection report
and the frozen ledger are pinned under ignored
`experiments/profile-cohort-2026-10-17T04-26-13-752Z`. The profile cohort is not a replacement for
either earlier cohort, a published dashboard update or a claim of 80%. The unchanged gate still
uses the first twenty OPENED episodes per person after the first freeze, retaining unfinished and
unforecasted games, with known outcomes and eligible pre-start forecasts for all twenty.
Latest live read-only checking found no new regular start/end. All three cohorts have zero completed
qualifying forecasts; the new cohort has zero opened episodes. Goal remains active and unmet.

That optional human question is now answered (17 October): Dennis mostly focuses on finishing,
not gold/combos. Do not assume score-chasing when interpreting risks or fitting the policy.

## Newly reproduced Joker defect / next modeling work

While checking remaining assumptions, a valid paired ten-tile synthetic deal exposed another actor
defect: with three ordinary pictures waiting and known Jokers available, the move-kind selector
declares a fatal tray loss without using a Joker. A Joker should clear a waiting picture instead.
`joker-full-tray-repro.json` preserves the exact board/persona/seed and observed failure at move 3.
No production or frozen prediction was modified. All 181 frozen future fixed boards were checked
and contain no Jokers, but older classic training boards can contain them.

The Joker reproduction is now a passing regression, not a remaining known failure. Wildcard
matching is shared by forced matches, kind/overflow classification, match-error candidates,
follow mode, depth and reveal features. Actual target selection agrees with specials.js: prefer
a waiting picture without a takeable twin; automatic twin selection uses geometric freedom,
including iced tiles, then height. Automatically removed twins enter actual at/seen history.
The last lone Joker clears without a physical clock move. Already removed recorded indices are
skipped rather than removed twice, and the exact ordinary solver can resume after all Jokers go.

Hypothetical Joker effects use a frozen known-picture mask. Known twins may be removed;
unknown twins consume aggregate virtual inventory/moves but no hidden index or geometric benefit.
Undo restores that inventory, clock accounting and geometry without writing actual observations.
This is an explicitly conservative observer approximation, not perfect prediction of an unknown
twin's location. A paired hidden-picture swap must produce identical entire candidate-feature
matrices. Actual chosen Joker effects still use the real game rules. Joker clock-search states
include actual hypothetical geometry and virtual inventory, not only the unordered tapped set.

The same audit removed the legacy search oracle: positive search samples free unseen candidates
before knowing their pictures, and zero search draws no randomness from hidden-face conditions.
Six added named regressions cover the full tray, hardest target/finale/auto-observation, hidden
twin feature invariance, match-error candidate, iced automatic twin, and zero-search equivalence.

`joker-engine-comparison.json` compares the frozen cohort's engine against the repaired engine
on all 245 reconstructed episodes: 46 contain Jokers, 199 do not. Eleven predeclared policies
(nine count profiles plus strong/average references), four seeded chains each, four attempts.
All 2,189 non-Joker episode/policy chain results match exactly. On the Joker subset the baseline
profile's first-try simulated wins change from 94 to 158 out of 184, while within-four simulated
wins change from 180 to 183. This shows a material physics/classification correction, NOT 80%
human attempt-count accuracy. Refit/re-evaluate the whole count predictor before making any new
accuracy claim. No numeric forecast was altered, and none of the 181 frozen target boards uses
Jokers. The report includes seed, run count, before/after chains and engine hashes.

All three frozen numeric ledgers are byte-for-byte unchanged. Source changes deliberately stale
the profile measurement fingerprint; the 48/80 result remains for its archived prior engine, not
a measured result for this new source. At 2026-10-17 05:15:55.893 UTC a read-only live check found
no newer regular start/end for any of the four people, so no qualifying future completion has
appeared. The 80% per-person goal is still active and unproven.

## Natural-prefix full-choice model

Previous goal turn was progress: the Joker physics/observer repair and its paired measurement
changed authoritative code and evidence. This turn replaces another training assumption rather
than merely restating the 80% target. `personal_prefix_data.js` reconstructs natural regular
prefixes from tap-associated state changes, retaining restarts, incomplete games and human choices
before assistance/auto-finish. It stops before missing/conflicting chunks, pictures changing or
unattributed actions; rejects partial/resumed boards, daily/other tracks and initially assisted
boards. Availability is the latest chunk, including later chunks past the chosen prefix boundary,
so a not-yet-uploaded recording cannot supply habits to an earlier forecast. Raw displayed `at`
is retained for diagnosis only, never converted into the new replay's local count.

The resulting 310 prefixes contain 13,563 decisions:
- Dennis: 28 / 1,314; six restarts and fourteen pre-auto-finish prefixes.
- Mrs.: 35 / 1,237; four restarts and three unfinished prefixes.
- PUK: 51 / 2,917; two pre-shuffle and three pre-auto prefixes.
- Gerda: 196 / 8,095; fifteen pre-shuffle, twelve pre-auto and two pre-conflict prefixes.
All 64 recorded natural wins reconstruct as wins, and no recorded stuck game reconstructs as a
win. Every selected action has a valid candidate index. One Gerda stuck game exhausts its follow
sequence with the diagnostic reason stopped rather than tray; this is not re-labelled as a win.

The old follow instrumentation silently skipped known tray matches. Research-only `logMatches`
now records those actual choices, including 1,057 selected known matches. An implicit blind
auto-match produces one unknown inspection choice, not a second invented known choice.
`forceMatches:false` allows an experimental actor to choose against a visible match instead of
hard-coding perfection. Default flags remain unchanged. `POLICY_FEAT` appends visibleTrayMatch;
`KIND_CONTEXT` appends hasTrayMatch/trayMatchShare, with absent old-model coefficients treated as
zero. Hidden-picture features remain masked. Gold metadata is retained, but the pending optional
gold/combos answer has not been assumed and no gold preference has been fitted.

`personal_full_choice_fit.py` fits an independent two-stage policy: contextual kind probabilities
plus ragged-softmax within-kind weights, with actual candidate masking, twenty-recording decay,
strictly earlier available own/family prefixes and equal-person family evidence. Family mass is
capped at 500 and the smallest nonempty person's evidence to avoid manufacturing confidence from
a tiny sample. Prefix status never supplies a fabricated success/failure label. Raw data, engine,
parser and fitting-source hashes guard reconstruction and fitting against concurrent/stale inputs.

Exploratory latest-quarter action diagnostics (NOT winning-attempt accuracy):
- Dennis 346 decisions: full-choice comparator joint log loss 1.735 -> 1.397; top action .400 -> .477.
- Mrs. 372: 2.070 -> 1.594; top action .292 -> .395.
- PUK 565: 2.046 -> 1.663; top action .380 -> .435.
- Gerda 2,419: 2.274 -> 1.829; top action .310 -> .366.
Selected known-match likelihood also improves for each person. The comparator is the predeclared
zero-context full-choice prior, NOT Claude's forced-match actor. These results are mechanism
evidence only and cannot substitute for the requested whole winning-count score.

Next concrete work: implement the matching physical inspection actor before count evaluation.
The current simulator can treat a first tap that automatically matches as a freely deferred peek;
the full-choice actor needs one actually open tile, mandatory first-tap auto-matching, and known
reopens as physical actions rather than novel information. Keep legacy actors/defaults unchanged
unless an explicit separately measured repair is warranted. Then fit an earlier-available model
bank per forecast opening and evaluate whole first-clear chains on the unchanged 80 episodes.
Do not apply the new late 75%-split models to earlier count targets: the fixed Dennis/Mrs. test
starts precede their first own recordings. Family fallback or genuinely earlier online snapshots
are required. No count model or frozen forecast is promoted or replaced by this action diagnostic.
The 80% per-person goal remains active, unproven, and has meaningful research work remaining.
Matching data, engine, fit sources, tests and report are pinned in ignored
`experiments/full-choice-2026-10-17T05-33-17-930749-00-00`. All three existing frozen forecast
ledgers were SHA-256 checked unchanged after this work. No processes remain running from this
turn, and no model/release/Firebase write was promoted.

## Current verification

## User priority clarification and new progression cohort

The user confirms finishing is his priority, not gold/combo chasing. He also clarifies that 53/54
were replays and his next progression level is 106. The 80% requirement applies to new/recent
first-clear progression; replay results are diagnostics only. This supersedes the earlier
all-opened-episode primary cohort interpretation without changing any frozen numeric predictions.
`EVALUATION_SCOPE.md` records the revised requirement before any new progression outcomes.

`progression_targets.js` uses saved campaign progress and highest regular cleared level, excluding
dailies/other tracks, so replaying 53/54 does not incorrectly move the next target to 55. Current
declared frontiers: Dennis106, Mrs92, PUK53, Gerda62. `progression_score.py` separates first-clear
campaigns at/above those fixed frontiers from replay/older-level diagnostics. Its unchanged
sample requirement is first twenty newly opened qualifying campaigns per person, all completed
with eligible pre-start forecasts, at least 16/20 correct for every person. Missing forecasts and
hard pending new campaigns remain in coverage. Twenty easy replays cannot pass the gate.

`progression_forecasts.js/.py` now freeze a separate first-clear-progression-v1 cohort. These use
the already measured pinned profile-forest engine/source from the earlier archival snapshot,
not the newer unvalidated physical policy. The 96 numeric predictions (24 per person) were frozen
at 2026-10-17 08:41:25.067 UTC / 10:41 Amsterdam, before reading any new live results. Dennis's
points are L106:1, L107:1, L108:2. L106's forest mass at try1 is .419766, not 80% confidence.
L106 was already opened without a completed attempt in the older logs; useful current predictions
for it do not count as clean pre-opening validation. Future newly unopened progression provides
the primary evidence. Initial scoring of the unchanged raw snapshot has zero qualifying opened
campaigns and targetMet:false. Earlier ledgers remain immutable diagnostics.

The new inputs, sources, ledger, original raw plays/scores and scope are pinned in ignored
`experiments/progression-2026-10-17T08-41-25-067Z`, referencing the earlier immutable measured
engine snapshot rather than editing or duplicating its original inputs.

## Physical one-tap policy progress

The previous goal turn was progress: it rebuilt natural-prefix learning and fitted a full-choice
model. This turn implements research-only physicalFlips: one actually open tile, mandatory
first-tap matches against the tray/open twin, known reopens as actions, no multi-tap pair macros,
atomic automatic twins (including the clock), and actual fatal physical takes rather than an
abstract pre-action failure. Per-move inspection caps bound reopen loops. Autonomous physical
actors require peek0/end0/plan0/keyPlan0, so no unmodelled solver/planner actions bypass the tap
rules. Legacy defaults remain separate. Hidden-picture permutation and future-tap timing tests
protect the observation boundary; undo restores open-tile and Joker-arrival state.

Known reopens/peek matches and visible key/clock effects enter fitted option features. Recorded
tap timing also reproduces the game's 230ms arriving-tray exception for Jokers; a newly arriving
Joker cannot immediately take an ordinary picture. The previously mismatching fast L45 sequence
now reconstructs all 128 physical choices. Two older Joker target behaviours still differ from
current rules (PUK L34 v1.50 and Gerda L44 v1.52). Their prefixes stop BEFORE the first mismatch,
with explicit historicalPhysicsBoundary metadata, rather than training a fabricated continuation
or relabelling the recorded win as a loss. Investigate historical target rules only as useful for
training; the clarified primary goal is new progression, and all frozen targets contain no Jokers.

The rebuilt corpus has 310 prefixes and 24,456 physical choices. Every retained actual action is
verified against the recorded index, take/flip kind, move count, full alive mask, ordered tray
pictures and open tile. Full physical-tap action diagnostics still improve for all people, but
are not whole winning-count accuracy: Dennis .210->.364, Mrs .230->.382, PUK .316->.432,
Gerda .183->.280 top action. Source/data/report are pinned in ignored
`experiments/physical-policy-2026-10-17T08-39-36-212724-00-00` before refreshing raw data.

Next model task: fit strictly earlier-available online physical-policy snapshots, simulate whole
first-clear chains and compare new/recent progression counts (not replay count accuracy). Never
apply the later 75%-split action models to earlier openings. New physical forecast versions must
be declared/frozen explicitly; do not replace the pinned profile primary after seeing outcomes.

The read-only raw refresh completed successfully (session81394 terminal); its new snapshot is
2026-10-17 08:43:57.950UTC. Attempts538 all match their boards. Current saved progression remains
Dennis106, PUK53, Gerda62; Mrs advanced to97 BEFORE the08:41 freeze. Prospect outcomes have been
regenerated from the fresh raw data. The physical data/fit above now has deliberately stale raw
fingerprints; rebuild it before an online fit. Matching pre-refresh sources remain archived.

IMPORTANT CORRECTION: same-model scope clarification/coverage expansion MUST NOT reset its
prospective clock. The initial08:41-only score of zero opened games was incomplete evidence.
`same_model_ledger` now includes the original profile-v1 ledger frozen04:26:13.752UTC and keeps
its earlier eligible new-level failures. Fresh first-clear Mrs93–96 began06:33–06:47UTC and won
on local tries2,5,2,5. The frozen primary predicted1 for each: FOUR MISSES. Mrs97 is a fifth
eligible opened campaign, still pending. Other people's qualifying new campaigns remain zero.
Thus the primary new-progression cohort has Mrs opened5/completed4/correct0/eligible5/pending1,
not a fresh perfect/empty score that discards the misses. No80% goal claim is supported.
Tests enforce that replay exclusions/additional coverage cannot reset unchanged model history.

The fresh progress update left fewer than twenty unopened Mrs targets in the old92–115 range.
The append-only generator now adds missing future boards only. Five more Mrs forecasts116–120
were frozen2026-10-17 08:54:58.826UTC, without changing the original96 progression records or
any of the three earlier numeric ledgers. Existing frozen coverage plus new DISTINCT levels must
still provide at least twenty upcoming targets per person; duplicate forecasts cannot satisfy it.
All initial frontiers remain fixed for scoring, even when future coverage advances. A logging
ReferenceError after a successful input write and the initial helper's append-coverage rejection
were repaired; no invalid input was frozen. Both computations were rerun with matching fingerprints.
All command sessions from this turn are now terminal; none needs resuming.
The append, fresh raw outcomes, corrected same-model primary score and matching sources are pinned
in ignored `experiments/progression-2026-10-17T08-54-58-826Z`. SHA-256 checks confirm the original
three ledgers unchanged; deep equality confirms all original 96 progression records unchanged.
Final validation: 54 named JavaScript tests, 51 Python tests and the existing observer-honesty
test pass. `git diff --check` passes. No release, commit, branch or Firebase write occurred.

The four actual new-level misses show the old predictor underestimates retries; prioritize whole
count evaluation of the physical actor and learned retry planning on these tougher boards, not
more replay-retrieval tuning. First-tap automatic matches can consume scarce clock moves that
the older free-inspection actor optimistically deferred. Quantify that mechanism against the new
recordings. A future physical planner must itself obey tap/peek/auto-twin rules, not simply enable
the legacy macro solver. Until then the physical actor's plan0/end0 restriction is intentional.

## Current verification (latest)

Fifty-four focused JavaScript tests and fifty-one Python tests pass, including temporal leakage, board
identity, counter normalization, scoring thresholds, prospective timestamps, key rules, fatal
mistake memory, bounded working memory, repeatable feature rebuilding, censored hazard observations,
stale forecast rejection, spatial policy use and no hidden-picture features. An existing pure-engine
observer-honesty test from t_hard.js also passes. Re-run it after engine planning changes.
After the new oracle repairs, neutral strong/average defaults match HEAD's retry chains on 24
recorded-board/persona combinations (four runs, four attempts each). The personal explicit-flip
policy intentionally changes. The pre-repair 36-combination check is historical, not a guarantee
that those personal policies remain unchanged. The existing observer-honesty test still passes.
New context/coverage tests verify hidden-picture permutation invariance, unavailable-kind masking,
clock visibility, early unfinished/missing forecasts and the whole four-person prospective gate.
Research JavaScript files pass syntax checks.
That neutral compatibility check predates the newer clock-scoring correction: clock choices now
intentionally change, and neutral difficulty must be recomputed. The observer-honesty test is
rerun separately. New goal tests cover known-only planning, seeded zero-weight equivalence and
conditional preference fitting without changing the base planner.
The standalone replay diagnostic test also passes (pre-action deltas, hidden/iced matches and
novel-versus-reopened picture counting). Memory-action tests cover both autonomous use and follow
mode. The source-matched final goal audit was evaluated at 2026-10-17 00:05:13 UTC.
`git diff --check` passes, with only normal Git CRLF notices on regenerated one-line JSON datasets.
The full browser/game suite has not been run; there is no release and this is offline research.

See `source/tools/sim/refit/PERSONAL_BOTS.md` for commands. Do not ask for approval to continue
authorized reversible research. Do not stop simply because the first models fall short. Never
claim the goal complete from training accuracy, a tiny chosen subset or a retuned historical test.

## 2026-10-18: confirmed4:32 bee and fresh own-count evaluation

The user's4:32 clarification identifies the bee at4:32.415, tile28, manual tap189
of the winning level150 attempt3. It fills the SECOND tray slot, not either later
third-slot event. Taking it felt unnecessary; a motor misclick is not established.
The exact209-tap counterfactual defers the bee until the5:04.933 mate reveal,
preserves the final six-tile state and reduces local late-window pressure3->2.
This is a constructive alternative, not a proof of a unique escape or whole-game
maximum reduction. Level150's previously frozen try1 versus actualtry3 stays a miss.

Fresh count transport now explicitly encodes/restores down flags and lock sets.
Lossy old JSON orientation objects or empty lock objects are rejected, not guessed.
All29 recent boards were restored from the pinned recordings/verified tables.
The separate read-only16:06:58 live opening check found Dennis151, Mrs104, PUK54
unopened; Gerda68 had already resumed and remains pending, so future tasks start69.
The future95 tasks are planning inputs, not pre-opening numeric forecasts.

An independent764-file runtime/input closure (819,528,096 bytes) was copied to
`runs/fresh-count-2026-10-18T16-12-34-747Z` before computation. Fresh fits keep their
actual15:59 fitting sources; changed current count-head libraries are not falsely
substituted into old model provenance. The two own-only profiles preserve real
tap physics, physicalPlan0, common controlled memory and simulated-failure learning.
Pilot124 boards x2 profiles x2 runs x3 tries completed with zero computation caps.
Full32x32 measurement is in progress, session56597; it reruns248 paired pilot chains.
Do not treat pilot completion or the78,536 training-prefix parity checks as accuracy.

The new head is independently fitted per person, with own earlier first-clear
outcomes only. No other player's calibration, replay wins, later completions or
future outcomes may enter. Its method selector is chronological prequential,
not chosen on held/recent target results. Forests and selector parameters are fixed
in source. Pending failures contribute survival likelihood, never invented wins.

A pre-full-result smoke test exposed one fixed held target (Gerda56) changing boards
within its campaign. The initial head incorrectly dropped it from the denominator.
The separately hashed scoring correction now RETAINS all80 fixed target IDs while
excluding changed-board episodes from training/selection. The original pre-pilot
scorer and raw measurement runtime remain immutable; the corrected scoring source
has its own provenance in `fresh-count-scorer-correction.json`. Do not claim its
hash was the original pilot scorer. No method was selected from that target outcome.

Experimental future numeric freezing now requires completed uncensored32x32 counts,
248 pilot controls, exact data/scorer hashes, a new live check after evaluation,
at least20 distinct unopened targets per person, and an append-only JSONL ledger.
Same-protocol updates preserve the earliest cohort clock and existing misses.
This new research protocol does not promote or replace the failed earlier primary.
The old genuine Dennis first20 remains10/20, not80%; targetMet remains false.

Full measurement is now terminal0:124 boards,32 runs x32 tries, zero computation
caps, and all248 pilot chains reproduced. The retained historical data has305 rows,
all80 fixed held targets score, and the29 additional recent targets have28 completed
and one pending. The corrected head's fixed20 selected scores are Dennis9/20,
Mrs3/20, PUK13/20, Gerda9/20. Recent Dennis is15/23 (65.2%); Gerda3/5.
This is exploratory and fails80%, not a promotion. The naive first-try control is
16/23 for recent Dennis; the selector is not yet reliably better even than that.
Raw own base/styles/mixture count predictions score0/23 on those same recent Dennis
targets, exposing a whole-trajectory problem rather than a successful personal bot.

A separate live opening check after evaluation at16:18:39.921 confirmed the same
unopened schedule. At16:18:44.191,95 numeric experimental forecasts were appended to
`personal-fresh-forecasts.jsonl`: Dennis151-174, Mrs104-127, PUK54-77, Gerda69-91.
All current primary selectors choose the always-first fallback; the saved alternate
bot predictions remain distinct. This fallback is NOT an80% confidence statement,
nor evidence that the fitted bots play like their humans. Older four ledgers/misses
are unchanged and remain the original failed genuine primary. This different
experimental protocol retains its own earliest freeze clock for future scoring.

The exact first32 seeds were replayed for both profiles on all23 recent Dennis
boards, matching46 previously measured first-attempt rates. Base wins31/736;
failures are531 clock and174 tray. Styles wins24/736; failures488 clock and224 tray.
Both fail with about70 tiles remaining on average; only1/2 losses respectively occur
with six or fewer remaining. Thus an oracle end-cleanup tweak cannot fix this gap.
Next priority is own learned public clock-route/tray-capacity planning and persistent
intent, not another count-head selection on these inspected targets. Keep occasional
unnecessary bee-like pickups possible; do not force universal greedy finishing.

Validation:173 Python tests,100 named personal-bot JavaScript tests, the existing
observer-honesty test and git diff --check pass. Only normal CRLF warnings remain.
Owned sessions83300 (pilot),56597 (full),26311 (scoring),46940 (tests) are terminal0;
do not restart or poll them. No release, commit, branch or Firebase write occurred.

## 2026-10-18: fresh causal clock-strategy update and rejection

The previous goal turn made concrete progress: exact board transport, complete32x32
counts, retained80 held IDs, an honest95-point future freeze and first-attempt failure
diagnosis. It was not a no-progress turn or a blocker. This turn follows its measured
clock bottleneck rather than retuning count heads on inspected targets.

The earlier adaptive clock strategy had only a2x3 autonomous pilot, not a completed
winning-attempt evaluation. Its public12-tap/256-node route/pair/exit features are
unchanged and source-identical to the11:26 immutable feature snapshot. All398 old
annotated prefixes match the445-version bank semantically. Reused those398 exact
annotations and reconstructed the47 new prefixes, preserving every action, full
physical frame and end result. The new47 contribute5,725 callbacks,267 active-clock
callbacks,233,509 search nodes and686 unresolved search boundaries. A bounded feature
search boundary is NOT a player failure or a computation-censored whole simulation.

The complete public annotation bank contains445 prefixes and39,268 decisions.
Fitted33 own-person clock strategies: four future actors and29 historical client-time
actors. Every fit checks exact own version hashes/rosters, excludes its target campaign
in recent diagnostics and retains original observedAt metadata. The clock model bank
records its actual request and later actual made time; inherited static trainingCut
is not falsely treated as clock-model readiness. Future freezing cannot predate that.
Training-prefix parity covers all39,268 probability vectors AND causal posteriors at
445 prefixes,1,378 clock-active choices; maximum native/JS difference1.11e-15.
These numerical checks are implementation evidence, not held count accuracy.

The next autonomous diagnostic retains all29 recent targets, uses32 initial seeds
per profile and reproduces29 frozen zero-residual first-attempt controls exactly.
No-clock outcomes match exactly; generic physicalPlan remains0; computation caps0.
Dennis baseline:31/736 wins,531 clock losses,174 tray losses.
Fresh adaptive clock:40/736 wins,473 clock losses,223 tray losses.
Gerda baseline/adaptive:39/192 wins and153 tray losses, identical no-clock controls.
Clock survival improves modestly but mostly exposes later tray failures. This does
not establish whole winning-attempt accuracy, and the candidate is not promoted.
There is no justification to call5.4% simulated first-try wins an80% count success.

Fresh future Mrs and PUK have unchanged training membership; their clock parameter
arrays match the immutable earlier own models exactly. PUK/Gerda have no recorded
clock-prefix choices, so no invented personal clock habits are attributed to them.
Dennis's113 own prefixes include846 clock-active choices. The two fitted latent
clock experts are almost identical (coefficient differences roughly.002), with only
small route/dig tilts. Updating these weak per-tap residuals is not enough to reproduce
human clock commitment. Next candidate should explicitly represent optional persistent
clock-dig/pair-first intents with own learned switching, instead of forcing universal
greedy play or repeatedly recalibrating away the trajectory defect. This is a next
research direction, not a completed or validated new controller.

Validation passes177 Python and101 named personal-bot JavaScript tests, including
semantic annotation identity, exact own roster/observation guards and import-safe
worker entry. Existing observer-honesty test is unchanged; no engine code was edited.
Sessions70346 (annotation),27807 (fit),50583 (native/runtime),16927 (first diagnostic)
are terminal0. All four original numeric ledgers and the existing95 experimental
forecasts remain unchanged. No new numeric clock forecasts, promotion, release,
commit, branch or Firebase write occurred. Goal remains active and below80%.

## 2026-10-18: learned persistent clock intents, live score retained

The preceding continuation made concrete progress (445 exact annotations,33 new
own clock fits, native/runtime parity and a completed first-attempt comparison),
not a verified wait/no-progress turn or blocker. Its weak residual controller was
not promoted. This continuation replaces that weak-only approach with optional
persistent intent components, not another count-head selection on inspected targets.

`personal_clock_intents.py`/`personal_clock_intents_choice.js` define three fixed
PUBLIC option emissions: ordinary own policy, clock digging, and pairing first
before a supported safe clock exit. Within an option, tile choice still follows
that person's own fitted policy. Empty masks fall back to the own policy; unknown
pictures/search bounds are not declared traps. Only own earlier natural actions
learn the option priors and context-dependent three-state switching. Ordinary
actions retain nonzero support, so a bee-like unnecessary pickup remains possible.
No-clock actions and actors with zero own clock evidence keep the exact base policy.
This does not impose a universal greedy finishing rule or invent PUK/Gerda habits.

The frozen445-prefix annotation snapshot and exact33 static-actor/version rosters
are reused. No winning-count target label enters intent fitting. EM settings are
predeclared (8 iterations, switch penalty5, bounds4, sticky reference intercept1.5,
20-prefix half-life and initial-prior pseudo-count1); objective monotonicity is checked.
Actual intent-fit request/made timestamps are recorded separately from inherited
static trainingCut. Human-state smoothing occurs only during fitting. Runtime uses
causal forward probabilities from earlier actions and a fresh state per attempt.

All445 training prefixes/39,268 decisions/1,378 clock-active decisions match native
probabilities and three-state posteriors within1e-12 (maximum8.88e-16). This is
implementation parity, NOT held count accuracy. Recent Dennis action loss improves
base1.68572 -> weak-clock1.68013 -> persistent-intents1.67009 over4,316 decisions.
Those chronological client-time action diagnostics remain exploratory.

The all29-target,32-initial-seed comparison completed uncensored. Dennis wins improve
31/736 base ->40/736 weak residual ->53/736 persistent intents. Clock failures fall
531->473->331, but tray failures rise174->223->352. Gerda remains39/192 wins and153
tray failures exactly. These are initial simulation survival counts, NOT 80% winning-
attempt accuracy. The current model still fails too often and is not promoted.
Next required work is personally learned tray/finishing intent and recovery after
clock removal, then full first-clear chains—not treating clock survival as success.

Control-scope clarification: the29 first-attempt comparisons reproduce arrays of
win/why/remaining/moves result records. The diagnostic code/report used the word
“trajectories”, but full tap logs were NOT retained and full path equality is NOT
proven. Preserve the original source/report hashes; the checkpoint manifest explicitly
corrects that wording rather than fabricating stronger trajectory evidence.

A separate read-only live plays/scores snapshot was saved at20:09:32.475. Dennis151
has already opened and remains pending after an initial loss; its previously frozen
try1 is not replaced or relabelled a win/miss before the actual clear. Mrs104 completed
on try1 (correct),105 on try2 (MISS); the new experimental cohort is1 correct of2
completed Mrs campaigns. PUK54 remains unopened; Gerda68 was already opened before
the new experimental freeze and remains diagnostic/pending. Current frontiers are
Dennis151 (open), Mrs106, PUK54, Gerda68 (open). A future new model may forecast cold
Dennis152 onward only after genuine availability/live checks, never retroactively151.

`personal_live_outcomes.js` keeps completed, pending and unresolved-board episodes
in a separate live artifact without overwriting frozen fitting raw data. The exact
earlier board or a verified fixed-table board is used; four old unresolved boards
remain explicit. `personal_fresh_forecasts_score.py` retains the earliest same-
protocol freeze/frontiers, pending/missing forecasts and new misses. Its current gate
is false. The four old ledgers and all95 existing experimental numeric points are
unchanged. New clock candidates never substitute their predictions after outcomes.

Validation:186 Python tests and101 named personal-bot JavaScript tests pass, including
three-state exhaustive forward/backward, transition gradients, own membership, causal
native/runtime parity, isolated attempts, unsupported-person fallback, differing own
intent preferences and unchanged prospective cohort clocks/misses. git diff --check
passes with normal CRLF notices. Sessions27256 (fit),73871 (native/runtime),25583
(first-attempt diagnostic) are terminal0. No release, commit, branch or Firebase write.
The goal remains active; neither historical fits nor the tiny new cohort prove80%.

## 2026-10-18: own tray/recovery intent fitting in progress

The preceding continuation made concrete progress: learned persistent clock options,
full numerical parity, completed first-attempt diagnosis and a real prospective score
that retains Mrs105's miss and pending151. It was not a no-progress/blocker turn.
This continuation targets the measured post-clock tray failure bottleneck.

All445 natural prefixes are re-instrumented with the verified public bitset tray
planner (six taps,256 nodes per root, progress4). Every original semantic version,
39,268 retained physical frames and result is preserved. Clock12 features stay
separate from new tray5 features. The finished annotation run used13,361,064 search
nodes and reported348,059 unresolved feature boundaries. These boundaries are NOT
human losses or whole-simulation computation caps. Session75677 is terminal0.

New optional tray intents are ordinary own play, a known match, and recovery. A
known short escape can guide recovery; otherwise a new inspection or known pair
preparation may preserve capacity instead of an optional unmatched pickup. The
ordinary component keeps unnecessary bee-like pickups possible. Three-state priors
and switching are fitted only from each person's earlier own actions, never target
winning labels. Original clock intents/parameters remain pinned unchanged. Public
clock/tray phases are checked not to overlap on all39,268 annotated decisions.
The combined runtime selects only the clock controller while the clock is active,
and maintains independent causal clock/tray state vectors and per-attempt resets.

A preemptive code review found that a recovery mask could repeatedly reopen a known
non-pair tile merely because OTHER actions still had reachable information/escapes.
The initial fitter was intentionally stopped after verifying its owned interpreter
PID31312/parent28976 and exact command. This was not an observation timeout or an
unexplained restart. Original source/progress is retained in
`experiments/personal-tray-intents-cycle-risk-2026-10-18T20-21-36-625Z`; no measured
caps or successful model are claimed for that retired partial fit. Session1597 is
terminal-1. Recovery now excludes known non-pair reinspection even when a later
escape exists, while allowing actual known pair preparation. Native/JS masks and
tests agree. Fitting was explicitly restarted with corrected sources in session93482.

Validation now passes191 Python tests and101 named personal-bot JavaScript tests,
including optional pickup support, differing individual match/recovery preferences,
unresolved-versus-known-trap distinctions, the reinspection guard, exact own temporal
membership, native/runtime synthetic parity and independent clock/tray state.
git diff --check passes with ordinary CRLF warnings. No engine code changed.

The corrected33-model fit is live; do NOT restart it because output is temporarily
unchanged. Poll session93482 or inspect its confirmed process first. Its current
sources/inputs are frozen by guards. Do not edit fitting libraries or refresh root
raw data mid-fit. After terminal success, run personal_joint_intents_bridge.py and
personal_joint_intents_runtime_audit.js for full445-prefix parity, then run
personal_joint_intents_first.js. That diagnostic is prepared but NOT yet executed:
it retains29 old clock-only result controls, adds per-seed active-clock prefix
hashes (actual taps through clock removal/failure), and compares new tray survival.
Whole winning-attempt chains and genuine future numeric freezes still follow.
No new candidate is promoted, no numeric prediction changes, and80% is unproven.

## 2026-10-18: joint intent fit/initial evaluation completed

The previous continuation made concrete progress (all445 exact tray annotations,
corrected optional recovery controller and a genuinely live guarded fit). It was
not no progress or a blocker. The corrected fit session93482 is now terminal0:
33 exact own-person model/version rosters, actual-ready timestamp retained, model
SHA626ba93f18f31dabf784dd6e818d9dd68fabb9b7bcb36c5a65d6c56f33dde06f.
Do NOT restart it. The retired cycle-risk session1597 remains terminal-1 by intent.

Session65752 (native bridge/runtime audit) is terminal0. All445 prefixes,39,268
probability vectors, both isolated clock/tray causal posterior vectors and1,378
clock-active choices match within1e-12 (maximum8.88e-16). Actual public phase flags
match the separate12/5 feature matrices on every decision. Native/training parity
still is NOT future winning-attempt accuracy.

The confirmed4:32.415 bee is now a small public-feature regression fixture. At tap189,
tile28 fills the second slot; it is neither a known match nor a known short tray
escape. Ordinary behavior retains support, so the test does not force infallible
greedy finishing. A second fixture verifies that immediately after this pickup the
bee’s later mate31 is not a known handoff target. No future hidden picture is used.
These fixtures are retrospective tests, NOT synthetic fitting target labels.

Session39924 is terminal0. The initial-play comparison retains all29 recent result
controls and adds exact736 per-seed active-clock prefix hashes through actual clock
removal/failure. New tray choices do not change those earlier taps. No computation
caps occur. Dennis initial wins: clock-only53/736 ->clock+tray75/736; clock failures
stay331, tray failures352->330. Gerda39/192 ->46/192; tray failures153->146.
These improve modestly but are nowhere near proof of80% winning-try accuracy. No
promotion or future numeric replacement is justified. Whole first-clear chains and
a genuine new prospective gate remain necessary.

Pre-action diagnostic contexts are saved, not fed into choices. Known available
tray matches were skipped1,426->1,164 times for Dennis; terminal tray losses with a
known match available decrease33->20. These are not automatically mistakes, since
key/route priorities can justify a different choice. Known non-pair reinspections
also must not be treated as mistakes merely by counting them: such inspections
are common in real human play and can refresh memory or prepare a later pickup.

A proposed shortcut (“always commit the same tile after a known reopening”) was
investigated and NOT adopted: immediate same-tile commitments are uncommon outside
clock phases. A more specific observed coupling gap is supported instead:
after starting a new tray pair and exposing its known free mate, Dennis follows
with that mate868/886 times (97.97%) outside the clock, versus the current model’s
mean67.46%. On the clock it is177/227 (77.97%) versus60.19%. Conversely, immediately
finishing an inspected free peek pair is only64.17% outside the clock, not98%; the
model is already slightly more eager (68.41%). This explains why generic greedy
matching is not an appropriate substitute for personal targeted follow-through.

Other own-person tray handoff rates are also distinct: Mrs91.46% versus model65.89%,
PUK96.90% versus76.80%, Gerda93.11% versus63.03%. These are DESCRIPTIVE training-prefix
behavioral rates from the existing445 prefixes, NOT held winning-attempt accuracy.
`personal_handoff_audit.js` saves exact cue membership and source hashes. Cue logic
uses only previous actual public choice and current known options; it refuses an
unknown/removed/ambiguous peek and does not invent a bee mate. The probability-
group odds primitive can favor or oppose a handoff and preserves zero-offset
controls exactly. No learned handoff modifier is fitted or promoted yet.

Next model step: fit a regularized own-only, chronological conditional handoff
modifier on these specific public opportunities. Separate newly started tray pairs
from free peek pairs and clock priorities; do not force every visible match. Then
evaluate full autonomous first-clear chains and freeze future numeric forecasts
only after actual model readiness and a new opening check. Keep all old forecasts,
including the already-open151 point and Mrs105 miss, unchanged.

## 2026-10-18 Conditional Own Handoffs And Whole-Chain Check

Fitter73445 is terminal0:33 separate own heads on exact earlier memberships. All
39,268 frozen joint-base offsets and both causal posterior vectors were verified
before reusing future-actor native offsets. Historical heads compute their own
earlier-only offsets; no target campaign or later prefix enters its own fit.
Actual readiness is2026-10-18T21:06:54.577150Z, not the old static actor timestamp.
Model SHA256:c33d1fdd812d02bd14b05fbcdf588340fed28b215d3739c252ef0ef902abdfd6.

Bridge/runtime session73586 is terminal0:445 prefixes,39,268 decisions,11,560 cue
opportunities and both causal state vectors/previous descriptors agree within
1e-12 (maximum8.88e-16). No unseen bee mate is invented. Positive and negative
odds shifts remain personal; zero/disabled controls and per-attempt resets pass.

Earlier-own recent recorded-choice diagnostics improve slightly: Dennis weighted
log loss1.64267->1.61972 and top-action accuracy41.68%->42.54%; Gerda1.82451->1.78434
and33.25%->33.75%. These are HISTORICAL ACTION diagnostics, not winning-try accuracy.
The small level150 fixture remains a retrospective physics/public-cue regression,
not a fitting target or evidence that the person should play flawlessly.

Initial diagnostic49593 is terminal0. All29 baseline result arrays and active-clock
prefixes match the immutable joint parent. Every first changed tap in928 paired
paths has an actual eligible public cue; full paired path hashes are retained.
No computation caps. Despite better action likelihood, Dennis wins75/736->71/736,
clock losses331->350 and tray losses330->315; Gerda46/192->44/192. This is NOT a
successful replacement, and no promotion or numeric forecast change is made.

Pilot58896 is terminal0 after a concrete harness repair: the attempt factory’s
planning property does not automatically configure Hard.rateChain’s persona.
The first pilot invocation exited1 with Invalid combined public intent features;
the persona now explicitly carries physicalTrayPlanning. The corrected2x3 pilot
retains all29 boards/two profiles with zero caps. Full chain session11182 was
then launched once, with source/input guards and paired pilot/initial-rate checks.
Do not restart a live run because the result file is not yet written.

Latest separate read-only live check is21:14:00.099Z. The existing95 experimental
numeric forecasts remain unchanged. Dennis151 predicted1/actual2 MISS;1521/2 MISS;
1531/1 correct;1541/3 MISS;1551/1 correct. Thus2/5 completed, not a full20-level
pass cohort. Mrs1041/1 correct,1051/2 MISS,1061/2 MISS:1/3. PUK/Gerda have no new
eligible completed games. Original Dennis first20 remains10/20; these new misses
are not erased by a different candidate. At this live check the next cold Dennis
level is156, NOT151. New candidate readiness cannot retrospectively forecast151–155.

Focused new tests cover first-divergence cue attribution and full-chain initial
rate controls, plus empirical count tails, target-label independence, per-person
coverage, pending/ineligible retention and refusal of caps/partial chains. Initial
suite42360 passed196 Python/104 named JavaScript tests before the additional four
count-scoring tests. Whole-count measurement/scoring and final validation follow.

Final validation74181 is terminal0:200 Python tests,104 named JavaScript tests,
the unchanged Hard public-observer test and git diff--check pass. Completed handoff
fit/parity/initial evidence is preserved in
`experiments/personal-handoff-first-2026-10-18T21-17-13-083Z` (412 files,9 pinned
ancestor dependencies). Its manifest explicitly says wholeCountMeasurementIncluded
is false. Live full-chain output is deliberately not copied as a finished result.

Full count session11182 remains LIVE after a bounded120-second wait; the latest
checked progress contains seven completed boards through21:18:48.643Z. The owned
Node process19484 is advancing CPU and progress. Do not launch a duplicate or
restart merely because personal-handoff-count-data.json is not yet written. On
terminal completion, run personal_handoff_count_score.py, retain any censoring
honestly, and preserve a separate full/censored checkpoint. Zero caps and all58
paired pilot/initial-rate controls are required before scoring.

Next mechanism to audit after whole-chain evidence: retry knowledge is still not
personally fitted. The actual fresh own actor explicitly has retryMemoryMode:none;
its action features were reconstructed without inherited pictures, whereas
autonomous rateChain uses the same[.75,.5,.75] recall assumption for all persons.
This is a known TRAINING/RUNTIME KNOWLEDGE-ASSUMPTION mismatch, not yet proof of
which recall setting is correct or of the cause of these losses. Older retry
audits already found previously observed pictures labeled unknown/blind in retry
features. Do not assume full human recall, use another person's memory, or alter
the running control. Fit any recall/avoidance behavior only from that person's
earlier natural retries, preserving public observations and upload/version
cutoffs separately. Finishing move/action likelihood research must not replace
the required whole-count and genuinely prospective tests.

## 2026-10-18 Fresh Consistent Recall Audit And User-Requested Git Checkpoint

Previous goal turn is PROGRESS:33 own handoff fits, numerical/physical controls,
rejected promotion after worse autonomous openings, and a still-owned full count
run. This turn verifies session11182 still live; it is not restarted or relabeled
terminal because a bounded observation yields no output.

Fresh recall audit2063 and preparation18193 are terminal0. All445 exact frozen
prefixes preserve natural physical frames and39,268 no-memory static decisions;
their aggregate scores match the immutable original native reference within1e-12.
Configured/full alternatives are measured assumptions, not facts about memory.
Dennis has51 prefixes with available prior observations; configured recall changes
3,080 decisions and recognizes335 formerly unknown reopenings. Gerda retains38
unmapped campaigns explicitly with no invented inherited pictures. Sparse feature
preparation retains478 configured/full alternatives with exact original version
links, source IDs/availability and physical controls. SHA256:
1c3d52cf78c8d85fa775761b1ae37834fbe4eac2f37bca4ab48245d689673f60.

Simply switching these features on under the old no-memory actor worsens recorded
likelihood, including earlier-own recent conditional action diagnostics. Therefore
the mismatch is NOT a license to assume perfect recall or a claim of a fix.
Consistent own fitter53134 is terminal0:24 independently own-person static models
(three recall assumptions, four persons, separate blocked calibration/future fits).
Every calibration block contains the person's latest20 natural prefixes; fitting
excludes ALL attempts on every level in that block, including earlier attempts and
memory-source dependencies. The generic prior is unchanged, with no family fit.
All four future no-memory refits match their original static weights exactly.

After refitting, each person's own blocked action likelihood still prefers none:
D1.68609 versus configured1.69734/full1.70443; Mrs1.84878 versus1.88796/1.90131;
PUK1.71900 versus1.79015/1.79883; Gerda2.10767 versus2.15201/2.15515. This is calibration
selection, NOT an independent selected-model test or whole-count80% gate. Nor does
it prove that these humans remember nothing: recall alternatives, timestamps and
the static model's representational limits remain hypotheses. Newly fitted model
readiness is21:27:08.835688Z, SHA256:
f887d4103cfbbbd0cb857733361150a6009ca1ef3c9e0d2749d7914878a07539.

Native/runtime93850 is terminal0:1,335 own future-training prefix references plus
240 blocked-calibration references,143,412 probability vectors and prefix scores
match within1e-12. No old clock/tray planning annotation is silently borrowed for
changed memory features. Final suite passes203 Python tests/105 named JavaScript
tests; all older numeric ledgers remain untouched. Goal remains active/unmet.

Human explicitly requests committing and confirms creation of wip/personal-bots.
The active working directory remains
C:\Users\den_k\Idea\OmasMahjong\personal-bot-review, now on that branch from41c3427.
The separate oma-mahjong-main checkout is not modified, merged, released or pushed.
Source/tests/docs/fixtures and stable research reports/ledgers are checkpointed;
large generated archives remain ignored locally. Live full-count output/progress
are left out of this commit rather than represented as completed evidence.

Next: retain ownership of full count11182; on real terminal completion inspect caps
and58 paired pilot/initial controls, score only valid complete32x32 chains and
preserve the full/censored result. A consistent no-inherited-picture runtime is a
possible separately tested hypothesis, not an established human trait or forecast
promotion. It can retain simulated-loss avoidance while matching the no-memory
training assumption; compare whole retry chains, not just action likelihood.
