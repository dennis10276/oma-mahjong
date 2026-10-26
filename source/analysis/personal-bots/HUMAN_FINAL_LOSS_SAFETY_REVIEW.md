# Final tray losses and immediately safe alternatives

Replayed adopted08 salt1 histories on its eight open boards plus passing
controls150,10041,10045, through the ONE observer and original fact operations.
All2724 recorded taps independently replayed. There were66 physical losses;
52 were tray losses. In all52, the final selected picture was already known.
Thus these final taps are not unobserved-picture guesses, although earlier
decisions and incomplete obstacle information may already have stranded the game.

Fourteen tray-loss positions also offered a legal tile with a known ordinary
picture already in the tray. Seven were excluded because taking that match
would still expire the active clock. Seven alternatives survived both immediate
tray and clock checks:

| Board | Earlier attempt numbers | Immediately safe matching alternatives |
|---|---|---:|
|10032|9,11|2|
|10049|7,10,11,12|4|
|10052|8|1|

Each of these seven public prefixes was independently replayed with one
alternative tap. All seven survived that tap, with193 independently replayed
taps total. No continuation was planned or played. This is not proof of a clear,
lower attempt counts or an incorrect dead-position certificate. A safe immediate
move can lead to a later unavoidable loss. Remaining-clock time and the matching
tile's public clock identity were included in the check.

Possible later strategy: when the selected physical prediction is a certain
immediate loss, consider a currently legal known ordinary tray match whose public
physical prediction is neither uncertain nor losing. Keep this separate from
the prepared observed-safety-transfer experiment. First inspect the planner's
actual public report at these positions; retained plans, bounded searches and
constructive dead certificates need to be distinguished. Do not label all seven
cases mistakes or assume a one-step veto will improve a campaign.

Any eventual policy must use only the generic public state and predictions,
without these board IDs or routes. It needs meaningful clock, Joker, uncertainty
and winning-route controls, then development/full comparison. No policy changed
for this audit and no measured strategy experiment is counted.

Raw evidence: .codex-runs/level-measure/retry-final-public-loss-v1.jsonl,
retry-final-public-loss-v1-summary.json and
retry-final-public-match-alternatives-v1.json. Both native audit commands exit0.

A separate component prototype is now prepared in the raw directory. It replaces
only a certain immediate losing prediction, while preserving uncertain choices
and constructive winning/clock-exit plans. Alternatives must be currently legal,
have a remembered matching tray picture, and produce a definite nonlosing public
physical prediction. Among them it prefers taking the visible clock, then the
existing public action order. It clears stale route/death metadata on an override
and retains the nodes already spent by the original search.

Four synthetic planner/clock controls pass: no clock; an urgent clock with no
surviving match; an urgent clock rescued by taking its known matching tile; and
clock removal preferred over another surviving match. There are15 counted
preservation controls, including missing pictures and uncertain obstacle roles.
Three resulting winning physical routes and one unchanged unfinished prefix
independently replay27 taps total. Private game fields throw if read. Native
test command exits0. These synthetic controls do not claim the current planner
naturally chooses the supplied bad action on those small boards.

This remains outside the active actor and all recorded benchmarks. Controller
integration and development/full performance checks are still required before
any adoption. Do not confuse the prototype's small
fixture wins with a winning continuation at the seven audited real positions.
Raw files: immediate-match-safety-draft.js, test-immediate-match-safety-draft.js
and immediate-match-safety-draft-tests-02.log under .codex-runs/level-measure/.

Four additional Joker component controls now pass(native exit0), independently
replaying16 physical taps through production. A matching Joker pair may replace
a certain losing tap; an unknown Joker picture cannot. A wildcard that would
automatically take an unobserved twin is not certified as a safe alternative.
An uncertain original tap remains untouched even when an ordinary matching
alternative exists. Matching Jokers still cannot rescue an expiring clock on
another tile. Private picture/deck/seed getters throw if accessed.

The settled-Joker control explicitly uses custom settleBefore timing. The first
raw test failed because the campaign convenience replay does not copy that
custom timing onto its replay game. The corrected supplemental test supplies
the identical timing to a direct independent Hard.play replay and compares the
physical log and trace; no production or actor code was changed. This is a test
fixture correction, not evidence of a failure in the active fixed1000ms campaign.
Both failed and passing logs are preserved as immediate-match-safety-jokers-tests-01.log
and -02.log; the test is test-immediate-match-safety-jokers.js in the raw directory.

Combined component coverage is43 independently replayed taps. These components
alone do not establish controller behavior or recorded campaign performance.

## Isolated controller draft

The prototype is now wired into a separate raw copy of the frozen14 runtime,
without changing the active benchmark actor. The optional immediateMatchSafety
flag applies the check after sampling finalization, clears retained planner
state on an override, marks the replacement as a manual choice before the
actual acknowledgment, and reports considered/override/clock-removal counts.
The per-salt measurement API carries those diagnostics only when enabled.

The isolated component controls pass43 replayed taps. Four controller wiring
controls pass24 additional independently replayed taps: enabled rescue and
subsequent production clear; disabled preservation; expiry of an unrelated
clock; and rescue by taking the matching clock tile. The initial bad planner
choice is deliberately injected on these toy boards, so these controls prove
wiring and continuation, not a naturally occurring current-planner failure.

An arbitrary unlabeled four-tile board additionally passes the measurement API
with the flag absent/false/true across three salts:36 independently replayed
taps, identical winning actions in all modes, zero overrides, and diagnostics
only in enabled runs. These isolated checks total103 production-replayed taps.
Both native commands exit0. Current actor source remains120aee30205ecb739ccec79c640414b017e304044cd73d8816526f7d5b78f8a0;
isolated draft source is717628eacc48859c09f5078869332c4707b9bf9e94a43d91d7bd1cfb0432e476(71 runtime files).

Raw draft, manifest and API results are in immediate-match-safety-integration-draft/;
preparation script is prepare-immediate-match-integration.js; API log is
isolated-immediate-match-api-tests-01.log, all under .codex-runs/level-measure/.
The prototype still needs a recorded-decision audit and development/full
campaign tests before adoption. No measured strategy experiment is counted.
Rebase the draft on the retained profile after14 finishes before measuring it;
its current origin is the frozen14 actor with the prior adopted10 default.

## Retained10 three-salt opportunity audit

The updated audit covers all eight full-salt failures in catalogv2, including
newly recorded157. It replays176 recorded attempts and6655 original physical
taps. All162 final losing choices have definite losing one-step public
predictions; none need a guessed hidden picture to diagnose the immediate loss.
The prototype identifies16 matching alternatives that survive the next tap.
Their449 prefix/alternative taps independently replay as well(native exit0,
about7s). No continuation after an alternative tap is played or claimed.

| Board | Recorded attempts across3 salts | Physical losses | One-tap opportunities |
|---:|---:|---:|---:|
|86|5|2|1|
|144|7|4|0|
|157|10|7|0|
|10011|24|21|0|
|10032|36|36|6|
|10033|22|20|0|
|10049|36|36|0|
|10052|36|36|9|

This audit uses only the normal observer, actual current takeability, retained
observed pictures and previously validated match deductions. Counterfactual
one-step legality uses the same current public takeability snapshot; no future
legality or private obstacle rule is supplied. Automatic Joker effects remain
uncertain and ineligible. Raw board inputs belong only to the production
environment and independent replayer.

Original per-decision winning/clock-exit plan flags are absent from the compact
measurement records. Therefore16 is an opportunity count before those guards,
not a demonstrated count of actual controller overrides. It does not show a
recorded planner bug, winning continuation or improved campaign performance.
A policy-decision audit is still needed after the active timed run completes.
Lab10049 no longer has such opportunities on the retained10 histories; the
older08 salt1 opportunities must not be carried forward as current evidence.

Raw records and summary: adopted10-immediate-match-opportunities-v2.jsonl,
adopted10-immediate-match-opportunities-v2-summary.json and corresponding.log
under .codex-runs/level-measure/. Source actor97f6aa2ca756fd64e249945053bc3a352d89d1a764bad4212d7d81d5f23db675;
profile6b6094dc0a84e0e1988a9f3e3585863da68ddc0a2a00d554d8214c18b7bb21a1.
No actor changed and no measured strategy trial is counted.
