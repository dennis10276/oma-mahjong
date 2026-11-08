# Task G5: build visible choices that survive the quality checks

Prepared by Codex, 2026-11-08. This is the next builder task for Gemini, not a continuation of the unrelated human-bot work in the existing `gemini-g5` checkout.

Integration update: the normal pipeline now supports `--gate-profile e5-v1` directly, and the library records the profile and thresholds. Use `assign_levels.js --allow-curve` for provisional selection and `accept_levels.js` for the final fixed-assignment checks. Read `PIPELINE-AND-ACCEPTANCE.md`; do not create a second acceptance implementation or duplicate the former E6 wrapper. This update supersedes the wrapper instructions below where applicable.

Further integration update: `pipeline-v4-skilled-spares` qualifies and stores skilled ratings/C2 trust separately at each eligible spare. It fixes lending spare 2's S to the spare actually selected. Keep already-running v3 experiments as historical evidence and use isolated v4 output when requalifying; do not mix the versions or overwrite raw ledgers. The lead is checking a frozen copy of the first pilot candidate independently; this does not modify your checkout or mark the candidate as an accepted level.

Lead evidence update: see `source/analysis/builder/g5-review/REVIEW.md` in `wip/cc-builder-loop`. Frozen pilot `7640c6...` fails B6 at 80 trace campaigns; normal candidate `1325d1...` fails B2 at 80. Do not retry these fixed candidates on alternate seeds to obtain a pass. The lead has verified the accepted fallback receipt for `7ce431...` at level 250/spare 2, retaining its A6 luck warning, and imported its used ACCEPT reservations into the lead ledger. Preserve those reservations when handing off/merging data. The A4 final-proof warning check has also been corrected: extra unresolved opening actions do not invalidate two already proven winners when every potentially forced witness state is resolved. No unknown action is promoted to win; zero-proven-win unresolved witness states are now explicitly counted.

Read `source/analysis/builder/LEVEL-DESIGN-FACTS.md` first. Dennis's latest decisions override older process proposals. The durable goal is a robust builder for future levels, not a handpicked batch.

## Starting point and ownership

Start from the latest pushed `wip/cc-builder-loop`, in a separate checkout/worktree on `wip/gemini-visible-choice-builder`. Do not reuse or modify `gemini-g5`, `gemini-g4`, or another agent's checkout. Keep the branch isolated and push it for the lead to inspect; do not merge to main.

Own a new opt-in construction module under `source/tools/builder/`, its tests, a small explicit integration into `builder.js` if needed, and new research scripts/output under `source/analysis/builder/g5-visible-choice/`. Preserve the default builder's deterministic output unless the new mode is explicitly selected. Do not edit the bot implementations, meter fingerprints, game, level tables, Firebase, or another task's raw results. No review agents. Run one heavy job at a time through `source/tools/builder/loop/heavy.js`, in resumable chunks of at most about 18 minutes.

## Why this task

E6 is complete: 500 attempted builds, 455 boards, 168 static passes, 32 screen passes, five planner passes, zero trace passes/library candidates. Cost: 863.422 CPU-seconds. The five finalists fail B2, B6, or, in individual cases, B1/B3/B5. A2 readability rejects 273 boards. See `process-v1/e6-yield.md/.json` and its source ledgers. This fires the supply stop rule; more rating-speed work is not the next priority.

Historical E6 used a mock screen 5.4-8.5 and an S >= 2.2 screening margin. It is not a comparison under the current requirements. Recovered curves for the five exact finalist content hashes cover spares 0-4, but do not satisfy the planned 30-curve experiment.

## Requirements

- New levels start at 250. Existing boards below 250 are not changed. Use `loop/policy.js`: family 10 at 250, 12 at 274, 13 at 275, then about +3 per 25 levels (16 at 300, 19 at 325). There are no repeating easier slots or difficulty peaks, including on big-board slots. The meter's cap is a measurement limitation, not permission to flatten the curve.
- Normal skilled band is 2.5-6 **per level**. Dennis permits 2-2.5 only if really needed. First report supply at the normal minimum; quantify the explicit minimum-2 fallback separately, showing why it is needed and which boards/levels use it. None below 2 or above 6; never average skilled ratings across levels. `run_pipeline` accepts an explicit `skilledFloor: 2`; assignment accepts `skilled: {lo: 2}` and flags fallback levels. No hidden 0.3 margin.
- Family tolerance is fixed ±1, including an independent fresh seed, and every five consecutive levels average within ±0.5. No relative widening. Pool seeds 4711 and 18427; keep ACCEPT seeds unused until selection is finished.
- Readable intent at the start: clock, locks, and keys in sight; no blind digging as the main puzzle and no luck-only losses. At least 72 tiles, recognizable original shapes, no blobs/blocks, and tiles at least 52 px. 96-tile boards only every tenth slot. Every special must demonstrably matter. Preserve the real game rules, including free inspections and peek pairs.
- Construct an actual early/mid-board decision and a fair alternative, with observable pressure and a learnable consequence. Avoid long free cruising with the only puzzle at the end. Each board gets a truthful card: its story, the tempting action, why it costs something, and the visible better choice. Unknown engine results are not losses or passes by invention.

## Work and evidence

1. Diagnose the 273 readability failures and five finalist trace failures. Inspect the actual witness/engine states before choosing the construction change. Do not simply relabel a trap or place a decorative special.
2. Implement one useful opt-in construction approach first: a visible pair that costs spare moves, a visible key/lock ordering choice, or a readable thaw order. Prove both the temptation's consequence and the viable alternative with the engine. Make visible intent reliable by construction. Keep the baseline mode unchanged and deterministic.
3. Freeze one seed/brief schedule before comparing. Run baseline and new construction under the **same current** screen [10,13], normal skilled band, E5 research gate profile, budgets, and seed schedule. Use separate output/library/reject/ACCEPT ledgers for each experiment; old rejects must not suppress a new policy's candidates. Record the complete profile and code hashes. E5 A5/A7 are report-only; use its proposed trace thresholds explicitly rather than changing defaults.
4. Pilot about 100 attempts per mode; then compare 500 attempts per mode if meaningful. Reuse cached ratings where valid. Count attempts, build failures, every gate's measured/unknown/pass/fail totals, actual library candidates, and CPU/wall cost. Aim for at least three usable candidates per 500 at normal skilled difficulty. Do not hide a zero result or imply library candidates are finished accepted levels. Report the minimum-2 fallback separately on the frozen schedule if normal supply is inadequate.
5. Measure spares 0-4 on survivors. If fewer than 30 survive, say the broad dial test remains inconclusive; do not run thousands of extra builds to disguise poor supply. Once enough candidates exist, make a provisional 250-259 assignment on the approved curve, retain holes, then use fresh acceptance ratings and an independent seed. Keep all raw measurements. No game publication.
6. Add focused tests for causal construction behavior, deterministic builds, readable intent, legitimate engine play/peek pairs, meaningful specials, and no mutation of frozen designs. Run affected builder tests and the loop suite. Do not require Dennis to routinely playtest.

Deliver code, reproducible commands, source-bound JSON/JSONL, a concise report including failed approaches, and a comparison that distinguishes normal supply, explicit skilled fallback supply, provisional slot matches, and final accepted levels. Put a copy of the report in the shared `gemini-tasks/results/visible-choice-builder/` folder. Commit and push the isolated branch, then report the commit and task status to Dennis. Do not launch another agent or assume approval to merge, deploy, or edit levels.
