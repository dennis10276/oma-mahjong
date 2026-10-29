# Milestone requirement traceability

The overall goal remains ACTIVE and UNMET. Behavioral evidence must use the same
source/profile version. Tests alone do not establish human calibration.

| ID | Requirement | Evidence | Status |
|---|---|---|---|
|A1|Frozen policy40; no new WHEN rules|648172a/a9e541e; unchanged frozen manifest checks in176-test suite|VERIFIED|
|A2|measure() arbitrary boards;3-6 actual tries, salts1-3|Default3 retained; maxTries6 supported; false is bounded failure, never impossibility|VERIFIED|
|B1|One public observer and actual earlier-try memory|Shared observeBoard/session; hidden-getter tests; inference requires a real observed match|VERIFIED|
|B2|Production rules and replay;move<2s|Every accepted tap replays through original engine; release-check max6.34ms|VERIFIED FOR v0|
|B3|General planning;no per-level routes/settings/tries|Controller receives geometry, public frames, scalar person profile and random seed; factory labels stay in benchmark|IMPLEMENTED|
|B4|Short clock action planning still sees side access|Whole visible row geometry plus short cone; no exact route solver; factory2-19220/20 release clears|VERIFIED FOR v0|
|B5|Limited tray planning,forgetting,randomness|v0 tray3/2 taps; research<=4,beam6; bounded profile validation; forgetting and independent stochastic attention|IMPLEMENTED|
|M1.1|Stable selected-setting API/output|human_bot.js; same board normalizer as measure(); numeric runs, shares, null capped means, timings/version|VERIFIED|
|M1.d|Most first tries on four easy factory boards|15/20,15/20,19/20,20/20; fixed predeclared thresholds|PASSED|
|M1.e|Hard factory2-175 lower and loses mostly at clock|8/20 first;19/23 losses at clock (82.61%); at least35pp lower than each easy|PASSED|
|M1.time|20 runs per board<5min|Release1.4-4.1s/board, up to12 actual tries; no censoring|PASSED|
|M1.release|Commit/tag human-v0;10-line API note|Human-v0 release check passes; goal-file API note; tag human-v0 points tobcac396 after verified release|RELEASE VERIFIED|
|M2.a|Dennis50-55%,family25-35% on92-163|Current exact-timing candidate51.18/29.51%; full fixed cohort|PASSED FOR RESEARCH|
|M2.b|Approved before-clock shares Dennis20-30%,family35-45%; disjoint clock-contact report|Current50.94/50.39%; exact removal order and counts validated|UNMET|
|M2.c|Per-person top10 vs10 observed-zero-loss controls;gap>=10pp|Current Dennis35pp passes; family3pp fails|PARTIAL|
|M2.142|Repair public clock failure; majority Dennis first wins and family clear coverage|Current Dennis19/20 first,20/20 clear;family18/20 clear within12|PASSED FOR RESEARCH|
|M2.keep|Retain d/e when releasing human-v1|Frozen v0 five-board release benchmark retained|REQUIRED|
|M3.f|Lab Spearman ranking,no per-board fitting|15-target protocol/scorer prepared;actual run requires passed M2;0 lab predictions|UNMET|
|M3.keep|Human-v2 retains all earlier gates|Milestone2 prerequisite unmet|UNMET|
|Final|Frozen check on next Dennis progression/factory games|No prospective success claimed; development boards explicitly labeled|NOT STARTED|
|Stop|After8 no-progress trials on current milestone|Six authorized19-24 retained; factory22 baseline,23 side-access progress,24 tradeoff; audited external adoption passes M1|ACTIVE|
|Housekeeping|Small commits;goal<80lines;one table/run;raw logs separate|wip/personal-bots;62-line goal; JSON ledgers and factory report; .codex-runs/human-style|IMPLEMENTED|

Source lineage:238f5ec supplies the new limited behavioral controller. We adopt its
useful strategy and repair its closed-tile tap model and evaluation through the
shared reference infrastructure. We do not adopt its README replacement, capped
mean accounting, missing independent replay, or an unverified calibration claim.
Its escape-aversion estimate is a heuristic, not an exhaustive death certificate.

M2 target clarification: HUMAN_PHASE_TARGET_AUDIT.md. Clock logs record saving
the clock. Original gates are unchanged while the user question is pending.
Eleven bounded candidate trials are complete; score anchor10, no-progress counter1.
Research profiles are explicit options; default v0 and the frozen reference stay
unchanged. Trial10 retains all100 factory clears with hard-board mean3.55.

Lab preparation: HUMAN_LAB_RANKING_PREPARATION.md and the preregistered JSON
contract.177/177 tests pass;M3 actual ranking and prospective validation remain
unverified. No calibration trial or stop-counter reset was claimed for preparation.

Authorized batch6-11: HUMAN_V1_BATCH_06_11.md. Trial10 passes M2.a/b for
both settings and retains M1; M2.c remains UNMET. Six completed, no new release
tag, no actual lab score, no frozen prospective claim. Test suite177/177.

Dennis approved audited phase/cohort targets on2026-10-29. The historical
batch6-11 results above retain their original contract; current requirements
are HUMAN_PHASE_V2_CONTRACT.md and human_style_contract_v2.json. No previous
score is relabeled as passing the amended goal. Shared-ice factory100/100 and
d/e pass;179/179 tests; full cohort and M2 gates remain unverified.

Current verified state: HUMAN_PHASE_V2_PROGRESS.md / HUMAN_PHASE_V2_RESULTS.json.
Source8df9a86 and baa07d1;181 tests; all100 current factory campaigns clear.
The invalid worker-exit2 run is retained; five caps never become losses.
Exact clock timing preserves2960 legacy outcomes; default v0 preserves100
release outcomes. Approved-v2 counter1; score anchor key-outs-repair-full.
No human-v1/v2 tag, actual lab ranking or prospective success is claimed.
