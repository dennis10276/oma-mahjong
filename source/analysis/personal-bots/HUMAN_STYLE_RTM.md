# Milestone requirement traceability

ACTIVE and UNMET. All behavioral gates must pass on the same version and profile.

|ID|Requirement|Evidence|Status|
|---|---|---|---|
|A1|Frozen policy40, arbitrary boards,3-6 tries/salts1-3|Frozen manifest tests; no Track A edits|VERIFIED|
|B1|Human-visible pictures and actual earlier-try memory|Shared observer, hidden-getter and hidden-picture invariance tests|VERIFIED|
|B2|Production rules/replay; under2s/move|Latest slowest 10.88ms; every accepted tap replayed|VERIFIED FOR RESEARCH|
|B3|General planning, no level routes/settings|Actor receives public geometry/frames, scalar person profile, random seed|IMPLEMENTED|
|B4|Short clock planning sees visible sideways rows|Public geometry plus short action cone; factory2-192 passes|VERIFIED|
|B5|Limited tray planning, forgetting, randomness/retry learning|Validated horizons<=4; stochastic attention; no learned memory from censored runs|IMPLEMENTED|
|M1.API|Stable selected-setting measureHuman API|human_bot.js; null incomplete means; version/timing/results|RELEASED human-v1|
|M1.d/e|Four easy boards majority first; hard lower, mostly clock losses|Latest factory checks pass; all100 campaigns clear|PASSED|
|M1.time|20 campaigns per board<5minutes|Latest maximum 0.688minutes|PASSED|
|M1.release|Commit/tag and10-line API note|human-v0 bcac396; human-v1 18f0348 retains M1|VERIFIED|
|M2.a|Dennis50-55%, family25-35% first on92-163|54.79/33.96%|PASSED AND TAGGED 18f0348|
|M2.b|Approved before-clock Dennis20-30%,family35-45%; separate clock-contact|29.66/44.74%; disjoint contact diagnostics|PASSED AND TAGGED 18f0348|
|M2.c|Separate person top10-loss vs10-zero-observed-loss; gap>=10pp|23.50/11.50pp|PASSED AND TAGGED 18f0348|
|M2.142|Dennis majority first; family majority clear within12|Dennis 19/20first,20/20clear; family 2/20first,20/20clear|PASSED AND TAGGED 18f0348|
|M2.keep|Same candidate passes M2 and retained d/e; final default verification|Factory100/100 and source-exact default M2 pass; tag18f0348|PASSED AND TAGGED|
|M3.f|15 recorded lab targets, Spearman>=.5, no per-board fitting|Trial4 retains M1/M2; complete lab means9/15;6 unresolved; primary rank null|UNMET|
|M3.keep|Human-v2 retains all earlier gates|human-v1 tagged; v2 ranking not passed|UNMET|
|Final|Frozen next Dennis progression/factory validation|No prospective accuracy claimed|NOT STARTED|
|Stop|Stop after8 consecutive no-progress trials|M3 anchor retry-locked-carry-04-lab; counter2/8; trial7 preregistered; historical trials retained|ACTIVE|
|Housekeeping|Small commits, goal<80lines, tables/raw logs separate|wip/personal-bots; HUMAN_PHASE_V2_PROGRESS.md and results JSON|IMPLEMENTED|

The user approved amended targets on2026-10-29. No clarification is pending. Historical contract1 trials are preserved under their original contract; current scoring uses human_style_contract_v2.json. Raw immutable source snapshots, profiles, campaign results, preregistrations and native exits are under .codex-runs/human-style/phase-v2/.

Source8df9a86/baa07d1 repairs public clock/ice outs and exact event timing;9801bf5/6932e2e adds public mate-budget and personal clock completion/horizon behavior.183/183 offline tests pass (suite09).29 real recorded family choices on132/144 replay exactly. These tests and development outcomes do not establish future attempt-count accuracy.

Release proof: HUMAN_V1_RELEASE.md and HUMAN_PHASE_V2_RESULTS.json.releaseVerification.183/183 release tests;2960 calibration and100 factory campaigns; default outcomes exactly match the selected candidate. M3 and future frozen validation remain.

M3 research: HUMAN_LAB_V2_PROGRESS.md. Typed key-memory b2bc48f passes184 tests/M1/M2 and raises complete lab means to8/15. Learned locked-carry349fefb passes185 tests/M1/M2 and raises complete lab means to9/15. The release tag stays18f0348.
