# Level-design measuring API and public-rule baseline

The API and CLI play unchanged boards on public policy salts1-3, without a Dennis
label. They accept encoded production games and the level builder's packed boards:
coordinate triples, face-down index lists and obstacle data. Explicit normalization
never reads a supplied solution or board seed. Historical VM arrays normalize to
ordinary data; provided neighbors must match production geometry.

The user changed visibility on2026-10-25: every geometrically free tile's current
takeability is public without a tap. The ONE observer supplies that vector. The
renderer attaches obstacle overlays beside the picture element, so visible overlays
on backs are public too. Back pictures and occluded roles remain hidden. Current
takeability is not queried for hypothetical future states. Observed non-relieved
safety is retained only under a constructive monotone-subset witness.

The default policy accepts arbitrary lab-role arrangements without assuming private
placement or exclusive-role contracts. Actual matching can supply certain picture
deductions; agreeing sampled worlds never become observed memory. Dennis additionally
permits a hidden picture with a proof valid in EVERY consistent possible board.

110/110 offline reference tests passed(12s), including86016 visibility comparisons,
hidden-world controls for all public salts, API/CLI production replay, back overlays,
current takeability, censored outcomes, tied Spearman and protected passing levels.
Old inference component fixtures explicitly withhold closed-role observations; the
actual campaign always consumes the full updated observer. Raw test logs remain in
.codex-runs/level-measure/measure-tests-04.log.

Fresh catalog:155 boards, natural17-156 plus15 recorded labs; hash
4ee62f8f40723e7f7de9f80a07b32db6e446648c46cb5cdc31891733825a34cf.
The new baseline starts with labs11,32,33,41,52, all previously failing targets and
20 fixed guards(34 boards), then covers the remaining121 without repeating cases.
No planner comparison uses the old public-rule baseline.

detbot2513920 is reviewed as a prototype. Its use of current free-tile legality is
allowed by the new rule and will flow through the observer. Its action-batch deadline
and proposed hidden-world/role assumptions still require audit before adoption.
No new-gate planner experiment or final freeze has yet completed.

The first full run is preserved as HUMAN_LEVEL_BASELINE_V1_ALL.md. It is physically
valid(149/155 boards clear on every salt,146/155 within Dennis+1), with nine open
failures. It is superseded because planner index tie-breaking bypassed the intended
salt priority. A new production integration test proves distinct tied winning routes
for public salts1-3; all111 reference tests now pass. The corrected v2 baseline must
finish before any planner comparison. The original unseen lab61 candidate was
measured from another working directory with no label:1/1/1,0.291 minutes,329ms
slowest move. Its supplied solution and seed are not consumed by the API.

Corrected v2 is complete:155 valid boards,148 clear every salt,145 meet Dennis+1
on every salt. Ten levels fail clearance or Dennis+1. Full totals and correlation
remain unresolved because some campaigns never cleared; cleared-only diagnostic
Spearman is -0.1611. Slowest move1523ms; mean0.839 minutes/board for three salts.
Source596e37bde6e1c996ad068614c888e30ac29d1d14e8670d6d4f7bddf876f48618.
Full report: HUMAN_LEVEL_BASELINE_V2_ALL.md. This is the algorithm comparator.

The opt-in retry-complete candidate preserves first-try decisions and existing
winning routes. With complete public picture memory, it adds at most250ms/2000
nodes to seek a constructive winning path within remaining actual taps. A cap or
failed search never proves death. Real actions and diagnostic counts are retained
in measurement records. All113 reference tests pass in12s, including independent
production replay of a failed attempt and its complete retry witness; raw log:
.codex-runs/level-measure/retry-complete-tests-08.log. Default policy is unchanged.

Standalone explorationWitness() searches known physical prefixes to a guaranteed
new public exposure or an actual required peek. It never supplies the resulting
picture. Unknown peeks require at most one tray tile and more than two remaining
clock moves; a pair can auto-remove two tiles. Tests enumerate all37 possible
ordinary/Joker pictures at that boundary and replay a deep stacked prefix in
production. The helper is not yet connected to the campaign. All114 reference
tests pass(16s): .codex-runs/level-measure/exploration-reference-tests-01.log.

retryInformationSearch() now supplies the opt-in intervention wrapper. It first
keeps the primary search unchanged, and only intervenes after an actual lost try
that learned no new picture, orientation or starting-role fact. It preserves known
wins and safe clock exits, shares an1800ms outer window, adds at most250ms, and
stops intervening immediately when the real observer learns a new fact. Unknown
boundary pictures remain null. The wrapper is not connected to the campaign yet.
All115 reference tests pass(14s), raw retry-information-reference-tests-01.log.

The opt-in retryInformationWitness flag is now integrated into the main campaign
and measure() diagnostics as runs[].retryInformation. Existing default profile is
unchanged. The actual controller keeps first-try decisions, distinguishes a lost
attempt that learned new facts from one that did not, and drops the intervention
after a real reveal. Two different hidden pairs give identical pre-peek decisions
after two actual losses. Every failed/successful tap independently replays through
production. All116 tests pass12s: info-campaign-reference-tests-02.log. Temporary
draft implementations were archived under .codex-runs/level-measure/information-drafts/.
