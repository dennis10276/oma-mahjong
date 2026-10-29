# Milestone requirement traceability

The overall goal remains ACTIVE and UNMET. Behavioral evidence must use the same
source/profile version. Tests alone do not establish human calibration.

| ID | Requirement | Evidence | Status |
|---|---|---|---|
|A1|Frozen policy40; no new WHEN rules|648172a/a9e541e; unchanged frozen manifest checks in175-test suite|VERIFIED|
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
|M2.a|Dennis50-55%,weaker family25-35% on92-163|Candidates4/5: Dennis51.39%,family29.17%; fixed full74-board campaigns|VERIFIED FOR C4/C5|
|M2.b|Loss shares clock55-60%,mid30-45%,late<10%|C4 clock55.41/54.57%; C5 clock50.40/54.57%; original phase targets under source audit|UNMET|
|M2.c|Risk/control gap>=10pp;132/135/142/144 majority clock|C4/C5 gaps11/9.5pp; several clock-case majorities fail; human evidence conflicts with case premise|UNMET|
|M2.keep|Retain d/e when releasing human-v1|Frozen v0 five-board release benchmark retained|REQUIRED|
|M3.f|Lab Spearman ranking,no per-board fitting|Recorded-target lab cohort still to evaluate under v0|UNMET|
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
Five bounded candidate trials are complete; score anchor4, no-progress counter1.
Research profiles are explicit options; default v0 and the frozen reference stay
unchanged. Trial5 restores all100 factory clears with hard-board mean3.6.
