# Lab ranking preparation: no model score yet

Milestone3 remains UNMET. human-v1 (18f0348) now passes the amended calibration
and retained factory gates; the first actual lab baseline is complete and ranking remains unresolved. This preparation fixes
the future lab cohort and statistical protocol without evaluating a current
human controller on the lab boards.

| Item | Prepared contract |
|---|---|
|Cohort|All15 recorded positive Dennis lab targets;10031 excluded as explicitly requested|
|IDs|10011,10012,10015,10032,10033,10041,10042,10044,10045,10046,10047,10048,10049,10052,10053|
|Sampling|20 campaigns/board;seed20261029;up to12 actual attempts|
|Primary|Spearman of recorded human tries against the complete simulated averageTries|
|Threshold|rho>=0.5 across every board; tied values use average ranks|
|Incomplete/capped result|Primary unresolved; never drop a board or substitute the retry cap as its clear time|
|Secondary|First-failure and restricted-mean ranks are diagnostics only|
|Current model measurements|15 boards,300 baseline campaigns;9 means unresolved; no ranking pass|

The exact input/catalog hashes and settings are committed in
HUMAN_LAB_RANKING_CONTRACT.json. Newly recorded positive lab targets join through
preparation; IDs without a target do not. Unsupported-board flags cannot quietly
remove an otherwise eligible target. Duplicate target IDs fail validation.

These boards were used in earlier reference-bot research. This is a fixed
historical lab ranking benchmark, not a previously untouched prospective set.
No score for the current human-calibration round is inspected before milestone2.

## Commands

Prepare a fresh artifact directory:

    node source/tools/sim/refit/human_lab_benchmark.js --prepare source/analysis/lab-clears.json NEW_DIR

After milestone2 is actually passed and human-v1 exists, run:

    node source/tools/sim/refit/human_lab_benchmark.js --run PREPARED_DIR NEW_DIR CALIBRATION_DIR FACTORY_DIR

The run verifies the prior calibration from its complete underlying records,
requires retained factory gates and exact original factory-board identities,
and checks identical person profiles and source archives. Actual lab inputs pass
only normalized game data to measureHuman; human clear targets stay in the scorer.
The complete execution sources and measured campaigns are archived. The model
version, profile, seed and board identity must agree across every lab result.

## Verified now

The actual15-board preparation completed with modelRuns=0. Attempting a run now
exits1 before creating measurement output because human-v1 does not exist.
176/176 offline checks pass, including ties, constant rankings, missing/duplicate
boards, capped/null means, mixed model versions, wrong board identity, changed
thresholds, source-archive tampering and preparation without predictions. Existing
factory checks now call the same stable human_bot.js entry point as the factory.
The source-archive verifier also accepts the two actual trial4 prerequisite
archives; it rejects altered files and paths outside the archive.

Actual lab performance, the positive end-to-end prerequisite path using a real
passing milestone2 model, and the final prospective check remain unverified.
The preparation is not a claim that milestone3 or the overall goal is complete.
