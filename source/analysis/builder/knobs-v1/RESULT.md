# Level factory — levels 200–225

**20/26 slots qualified and assigned. Incomplete batch; missing slots remain explicit in coverage.json.**

The qualified levels file contains only passing, distinct original designs. The closest-assignment file also includes explicitly unqualified diagnostic proposals. Claude retains final selection and release control. No main, game sources, game level tables, Firebase or player data were changed.

Curve anchors: [[200,10],[224,12],[225,13]]. Skilled range: 2.5–6. Minimum tiles: 72. Discouraged shapes: block (fallback only).

Per-level family tolerance: ±1; independent seed uses the same bound. Every complete window of 5 consecutive levels must have mean offset within ±0.5. Missing-slot windows remain uncertified. Assignment maximizes qualified coverage, then prefers smallest total absolute family offset; bounded-search limits are reported.

Source: 6723c4a1122095c2261b44a73581085a94bdd743. Measurements: C:\Users\den_k\Idea\OmasMahjong\codex-level-factory\source\build\builder-knobs-v1\pilot\measurements.

## Per level

Pooled = equal mean of the two full family runs (4711 / 18427; 40 campaigns each). Tuned rows (including edits chosen from bot feedback) must also pass seed 29717, 40 campaigns, within 1 of the placed target and maximum pairwise seed gap 2. This reserved seed never feeds steering. Luck column = tight blind digs / relieved gaps between tight digs / unrelieved gaps. Specials show the family rating with that special removed and whether the factory deems it meaningful. An em dash means unmeasured.

Placement is the 0–100 Dennis round-2 authoring preference score (timing, clarity, visible route, fair clock, temptation opportunity, shape), not a difficulty rating. Details travel with every delivered row.

| Level | Target | Status | Pooled (both seeds) | Skilled | Luck/relief/unrelieved | At trap | Specials without | Recipe | Shape | Tiles | Placement | Warnings |
|---|---:|---|---|---:|---|---:|---|---|---|---:|---:|---|
| 200 | 10 | qualified | 9.64 (10.03 / 9.25); fresh 9.55 | 5 human (bot 5.15) | 1/0/0 | 0.885 | locks: 10.9 ✓; clock: 8.97 ✓ | deepKeys + clockBesideLock | castle · two islands | 84 | 55.846 | — |
| 201 | 10.08 | qualified | 10.05 (11.03 / 9.07); fresh 9.93 | 5.42 | 1/0/0 | 0.99 | ice: 5.53 ✓; locks: 1.15 ✓; clock: 2.92 ✓ | keysAcross + frozenGuards | vase | 76 | 78.719 | — |
| 202 | 10.17 | qualified | 9.915 (10.45 / 9.38) | 4.55 | 2/0/1 | 1 | ice: 8.6 ✓; locks: 1.77 ✓; clock: 1.48 ✓ | frozenGuards + deepKeys | steps | 76 | 57.965 | — |
| 203 | 10.25 | qualified | 9.99 (10.88 / 9.1); fresh 10 | 2.63 | 2/0/1 | 0.991 | locks: 1.27 ✓; clock: 3.1 ✓ | chainReaction | hourglass | 76 | 66.269 | — |
| 204 | 10.33 | qualified | 10.075 (10.5 / 9.65) | 2.55 | 1/0/0 | 0.746 | ice: 9.38 ✓; clock: 3.63 ✓; frozenGuards@0:ice: 9.38 ✓ | frozenGuards | letterH | 84 | 83.571 | — |
| 205 | 10.42 | qualified | 10.4 (10.2 / 10.6); fresh 10.72 | 3.42 | 1/0/0 | 1 | locks: 1.93 ✓; clock: 1.25 ✓ | clockOnTopLocked | twins | 84 | 88.416 | — |
| 206 | 10.5 | qualified | 10.775 (10.35 / 11.2); fresh 10.47 | 3.58 | 1/0/0 | 0.995 | ice: 11.1 ✓; locks: 2.35 ✓; clock: 5.88 ✓ | frozenGuards + lockedPartners | diamond | 80 | 64.644 | lateSqueeze |
| 207 | 10.58 | qualified | 10.585 (10.32 / 10.85); fresh 10.97 | 2.65 | 2/0/1 | 0.968 | ice: 20 ✓; locks: 1.32 ✓; clock: 4.92 ✓ | chainReaction | frame | 80 | 66.167 | — |
| 208 | 10.67 | off curve; blindObjectiveRoute; luck/relief | 11.825 (11.47 / 12.18) | — | unmeasured | — | unmeasured | trayJuggle | bowtie | 84 | 86.579 | — |
| 209 | 10.75 | qualified | 10.435 (9.8 / 11.07); fresh 11.68 | 2.55 | 1/0/0 | 0.992 | locks: 15.03 ✓; clock: 1.25 ✓ | keysAcross + frozenGuards | ushape | 80 | 79.722 | — |
| 210 | 10.83 | full two-seed rating unmeasured; blindObjectiveRoute; luck/relief | — (— / —) | — | unmeasured | — | unmeasured | trayJuggle | pyramid | 96 | 86.556 | — |
| 211 | 10.92 | qualified | 11.2 (11.45 / 10.95); fresh 11.03 | 3.33 | 3/1/1 | 0.858 | ice: 3.67 ✓; locks: 2.08 ✓; clock: 1.95 ✓ | keysAcross + frozenGuards | moon | 74 | 87.469 | — |
| 212 | 11 | qualified | 11.005 (11.63 / 10.38); fresh 11.13 | 3.4 | 1/0/0 | 0.864 | locks: 6 ✓; clock: 2.4 ✓ | lockedPartners + frozenGuards | heart | 76 | 51.831 | — |
| 213 | 11.08 | qualified | 11.025 (11.2 / 10.85); fresh 10.88 | 3.23 | 2/0/1 | 0.928 | locks: 1.05 ✓; clock: 1.15 ✓ | clockOnTopLocked | arch | 88 | 85.166 | — |
| 214 | 11.17 | qualified | 11.66 (11.35 / 11.97); fresh 12.1 | 3.98 | 2/0/1 | 0.892 | ice: 1.1 ✓; locks: 15.4 ✓; clock: 3.35 ✓ | iceLockClock | vase | 76 | 65.973 | — |
| 215 | 11.25 | full two-seed rating unmeasured; blindObjectiveRoute; luck/relief | — (— / —) | — | unmeasured | — | unmeasured | trayJuggle | bowtie | 84 | 81.579 | — |
| 216 | 11.33 | off curve; blindObjectiveRoute; luck/relief | 9.84 (9.68 / 10) | — | unmeasured | — | unmeasured | trayJuggle | pyramid | 88 | 86.556 | — |
| 217 | 11.42 | full two-seed rating unmeasured; blindObjectiveRoute; luck/relief | — (— / —) | — | unmeasured | — | unmeasured | trayJuggle | bowtie | 84 | 81.579 | — |
| 218 | 11.5 | qualified | 11.465 (10.93 / 12); fresh 12.28 | 3.63 | 2/0/1 | 0.623 | locks: 1.4 ✓; clock: 1.27 ✓ | clockOnTopLocked | frame | 88 | 73.319 | — |
| 219 | 11.58 | qualified | 11.59 (11.38 / 11.8); fresh 11.82 | 4.4 | 0/0/0 | 0.958 | ice: 10.6 ✓; clock: 2.65 ✓ | frozenGuards | cross | 84 | 72.952 | — |
| 220 | 11.67 | qualified | 11.415 (10.9 / 11.93); fresh 11.88 | 4.47 | 2/0/1 | 1 | ice: 11.5 ✓; clock: 1.75 ✓ | iceChain + blindTwins | star | 96 | 69.049 | — |
| 221 | 11.75 | off curve; blindObjectiveRoute; luck/relief | 13.625 (13.2 / 14.05) | — | unmeasured | — | unmeasured | trayJuggle | bowtie | 84 | 86.579 | — |
| 222 | 11.83 | qualified | 11.83 (11.53 / 12.13); fresh 11.55 | 2.7 | 2/0/1 | 0.954 | ice: 5.47 ✓; clock: 2.63 ✓ | trayJuggleFrozen | moon | 88 | 75.091 | — |
| 223 | 11.92 | qualified | 12.215 (12.3 / 12.13); fresh 12.3 | 4.45 | 2/0/1 | 0.708 | ice: 3.75 ✓; locks: 11.28 ✓; clock: 1.8 ✓ | iceLockClock | hourglass | 80 | 80.397 | — |
| 224 | 12 | qualified | 12.35 (12.13 / 12.57) | 5.75 | 3/1/1 | 0.85 | ice: 1.68 ✓; locks: 2.4 ✓; clock: 2.35 ✓ | iceLockClock | ushape | 76 | 75 | — |
| 225 | 13 | qualified | 12.74 (12.8 / 12.68); fresh 13.4 | 4 human (bot 2.08) | 2/0/1 | 0.996 | ice: 1.82 ✓; clock: 1.55 ✓ | trayJuggleFrozen | vase | 72 | 74.478 | — |

## Yield and failures

Pool 31; screened 0; full two-seed ratings 23; quality checks 31; quality passes 20.
3 fully rated candidates missed their initial slot target by more than 1; 0 disagreed by more than two tries between seeds. These counts overlap.
Assignment cost: 3.810000000000004 (sum of absolute pooled-family offsets).
Assignment explored 7 nodes; the relaxed coverage upper bound was 20. The bounded search finished.
Diagnostic proposal reasons: {"off curve":3,"blindObjectiveRoute":6,"luck/relief":6,"full two-seed rating unmeasured":3}.

## Rules and learning

All requested acceptance limits were retained. Extra candidate layouts provide alternatives without reusing one creation in multiple slots. Missing coverage was not repaired by weakening the curve, originality or quality checks.
The journal contains 746 parseable measured changes (0 malformed lines); 269 changed difficulty by at least three tries. Such cliffs make local steering difficult; the shared graded changes address this. No rule change was made.

## Validation and handoff

The 20 qualified rows were verified against the current calibrated bot cache and the original batch context. Full completion remains unachieved. Preview results and the cloud-tuned input status are recorded below when the run is finished.

## Task10 fresh checks on new raw constructions

| level | seed29717 | full seed spread |
|---|---:|---:|

## Task10 pilot outcome

No new slot qualified. Eleven of24 frozen requests built; all11 failed readable objective routes. Three full pooled checks missed their slot targets;8 stopped after20 campaigns. Confirmed first-check hits0/11; unknown full early-stop scores stay unmeasured. The original20 designs and gold are preserved exactly. Missing208,210,215,216,217,221 remain explicit.

168 builder/factory tests passed. Fresh phone previews and real-game stored solutions passed for all20 selected levels. Portable verification used0 new bot calls and166 cache hits. See summary-for-dennis.md, SPEED.md and pilot-evidence/.
