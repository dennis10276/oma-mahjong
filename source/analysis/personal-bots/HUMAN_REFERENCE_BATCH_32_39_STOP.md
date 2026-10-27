# Eight-trial planning batch finished: decision required

STOP new experiments. All eight newly authorized trials32–39 ended unadopted.
Default retained23 unchanged. Goal remains ACTIVE and UNMET,not complete or
paused. No40 implementation or scored conditional run is authorized yet.

## Complete batch

|Trial|Strategy|Final scope|Complete target repairs|Target regressions / material clearance losses|
|---|---|---|---|---|
|32|Dependency-validated reusable unfinished search|Dev42|0|0|
|33|Continue after information and prepare earlier|Dev42|10011|10033|
|34|Preparation only tray2,active clock20–40|Full159×3|0|0|
|35|Necessary continuations and three retained branches|Dev42|0|0|
|36|Backtrack after a failed continuation|Dev42|0|0|
|37|Bounded early-fork retry allocation|Dev42|0|Lost10011's clear|
|38|Pre-clock preparation with early retry branches|Dev42|0|0|
|39|Clock recovery at occupied tray and slack30+|Full159×3|10032|10041;lost10011's clears|

Prior24–31 and stop report2b122e7 remain. Adoption does not replenish the
eight-trial authorization. A WHEN-condition measured trial also counts.

39 genuinely repairs32 across all salts:5/5/3,within Dennis+1=6. It also loses
41 on salt2 and all11 clears. Overall156/159 clear every salt versus157/159
retained;both154/159 meet Dennis+1 every salt. Do not adopt the mixed result.
150 improves4/1/2→2/1/2 and45 improves3/3/3→1/1/1;other154 vectors unchanged.
Earlier development notes misstated those two old salt1 counts; actual23 records
are4 and3 respectively,corrected by the full audit. No metrics were changed.

## Retained open targets and the candidate tradeoff

|Level|Dennis|Retained23 tries,salts1/2/3|Trial39 tries,salts1/2/3|
|---|---:|---|---|
|86|1|1/1/3|1/1/3|
|10011|2|8/8/8|—/—/—|
|10032|5|—/—/—|5/5/3|
|10041|7|3/3/3|6/—/5|
|10049|2|5/3/5|5/3/5|
|10052|3|—/—/—|—/—/—|

— means no verified clear within12,not13 or impossibility.10041 remains passing
under retained23;the other five are its open targets. TrackB calibration and
the final unseen20 have not started; reference performance is not personal
forecast accuracy,and no80% personal gate is claimed.

## Verification

39 supervisor19962 and all six native dev/full workers exit0. Independent full
audit recomputes159 records against actual23,checks all76 current/frozen source
hashes,profile,evaluator and unchanged retained profile. All runs valid;slowest
1719.6ms,mean0.679122min/board for3 salts,CPU/wall mean1.04002,min0.98989.
143/143 tests pass18s on unchanged runtime. All benchmark/comparison jobs terminal.
Source e4085f9243f55fb0a39cd5febd76740a8af3b298493454df0ed915f5fbfe1bd8;
unadopted profile9662aac6e321b77dad7ac47e9432d59b5d81b5744e0f9f7051ab965c01554e5f.
Raw experiment-39/negative-result-audit.json and supervisor-native-exit.json.

## Actual changed decisions and a proposed WHEN condition

Fresh independent production replay of BOTH recorded actual campaigns verifies
2409 taps for32/salt1,41/salt2 and11/salt1. The first different actual tap after
each paired attempt's common physical prefix is listed completely in
trial39-actual-divergences.json. Examples:

|Case|First different actual tap|Public state at that tap|Baseline→candidate choice|
|---|---|---|---|
|32,try1|tap1|tray1,clock43,48 unseen,3 visible locks|74→73|
|32,try3|tap0|tray0,clock44;candidate remembers76 pictures|83→31|
|41/salt2,try1|tap11|tray1,clock50,51 unseen,1 visible lock|78→80|
|41/salt2,try3|tap3|tray1,clock58;candidate remembers76 pictures|75→78|
|11,try1|tap2|tray1,clock36,43 unseen,6 visible locks|64→83|
|11,try8|tap3|tray1,clock34;candidate79 vs baseline84 known pictures|75→77|

Later retries remember each side's OWN earlier observations. They do not assert
equal knowledge or isolate one parameter causally.32's additional learned
pictures matter;do not fit a selector to the baseline's64-picture memory and
pretend it describes the candidate's77-picture state.

A separate forced-history comparison reproduces41/salt2 exactly:176 taps,
22 changed suggestions,native exit0,maximum candidate1462.7ms.32 and11 finish
physical replay but their old baseline choices drift6/4 times;natives exit1.
Their394/565 taps and30/53 suggestions are retained but EXCLUDED from reliable
policy attribution/WHEN fitting. Wrapper52701 exit1. No favorable rerun hides
those failures. The actual-trajectory audit above does not require policy
reproduction and remains independently verified.

Proposed condition for the NEXT authorized trial:

**Use trial39's planning only when the public starting clock budget is at most
50 moves AND at most3 drawn lock symbols are visible in the opening observer
packet. Otherwise use retained23. Latch the selection for the whole campaign.**

Two public features,round thresholds,no level IDs or per-board routes. A public
initial-observation inventory gives32=(44,3),11=(37,6),41=(61,1). It covers37
boards:13 development and24 others. The simpler40–50 clock bucket covers only
two development boards and offers no matching out-of-development coverage,so
it is weaker. The inventory reads no target counts and computes NO selector
performance. Opening-latched selection avoids resetting valid prefixes as clock
or lock counts change within a route,an earlier failure mode.

This is a postmortem HYPOTHESIS,not implemented,tested,adopted or claimed to pass.
It must get fresh fixed42 salt1 development and full159/salts1–3 execution with
new source/profile hashes,independent replay/audit,strict<2s,at least one repair
and no passing-target OR clearance regression. No retrospective splicing of
existing records substitutes for that evaluation. Preserve the eventual next20
check. Further two-feature fitting also consumes the next authorized allowance.

## Requested decision

Authorize a new batch of up to8 conditional-planning trials focused on keeping
the32 repair while restoring41/11,or keep retained23 and stop experiments.
The reason for this decision is the user's objective section6:after8 unadopted
experiments,"stop and report the table and the open failures. I decide."
No automatic continuation past that limit is authorized.
