# Task 23 — tower-free candidate and shape bench

2026-11-16. Nothing released. No main/Firebase changes.

## Result

26 ordinary refits are accepted; the five already-fitting ordinary levels remain unchanged. Thus **31 of 45 ordinary slots fit**, while **14 ordinary slots retain their released geometry**. Two additional held rows are the tenth slots in the deferred swap pairs. All 250–300 boards in this candidate have zero straight-on towers. This is not a claim that all 251–299 levels were refitted.

Compared with Task 20 d17984f0, nine accepted boards are revised, 17 refits are retained, and 16 earlier proposals return to their exact released rows. The 260/262 and 277/280 swaps are deferred **atomically**, because their compact halves still fail; no duplicated source board is introduced. The earlier approval for those swaps is recorded as deferred, not silently treated as approval for a weakened board.

Builder branch: wip/codex-towers (from a92ecb35). Candidate branch: wip/codex-towers-candidate (from d17984f0). Live baseline: a99b338e. Final commit IDs are in the shared codex-tasks/results/towers/COMMITS.md.

## Validation

- All 26: Task 23 geometry gate **and the unchanged Task 20 mechanics certificate**, MECH=1 NARROW_TRAP=core. Exact clock minimum/spare, special ablations/prerequisites, wrong moves, authored proof where source roles exist (recovered contract otherwise), full strict win, readable badges and twins pass. No clock-number adjustment or spareCertify used.
- All accepted refits: 72–88 tiles, supported integer grid, zero straight stacks on every layer, at most 6.5 columns / 8 rows, reference fit >=58 px. Mixed row parities are displayed for review rather than falsely rejected as towers.
- Real game: 26/26 wins at 392×730, minimum actual pitch 58.57 px. Lab: 26/26 wins, 126 cards across 42 slots; sunflower theme, CSS viewport 392, working clock-route button tested on 279. QA feedback/replays were intercepted.
- Full offline release-candidate suite: **172/172 passed in 396 seconds**. Four bench regression tests pass (low-layer tower, brick support, initial free IDs/peek actions, stale saved proof).
- Unchanged rows are byte-identical packed live rows; held saves retain generation 9, accepted refits use 10; repeats, progress and stars tested. No future 301+ builder table copied.

## Per-level disposition

These are all 42 slots in the earlier candidate; the other five ordinary levels and unchanged tenth levels keep their previous rows. A fallback is a bounded-search outcome, not a mathematical impossibility proof.

| Level | Decision | Shape / reason |
|---|---|---|
| 251 | Tower-free refit | 76 tiles, 58.6 px, clock 14+2. Earlier certified tower-free refit retained. |
| 252 | Tower-free refit | 72 tiles, 59.1 px, clock 8+2. Earlier certified tower-free refit retained. |
| 253 | Tower-free refit | 80 tiles, 58.6 px, clock 10+2. Claude: bands slid inward, all 80 tiles retained. |
| 254 | Tower-free refit | 76 tiles, 58.6 px, clock 10+2. Earlier certified tower-free refit retained. |
| 255 | Exact released row | The compact attempt changes the clock route and special effects. |
| 256 | Tower-free refit | 76 tiles, 63.3 px, clock 8+2. Tower-free bands; move tiles 45/75 so the original visible 45+65 finish pair stays exposed. The old saved penguin fix still had six towers. |
| 257 | Tower-free refit | 74 tiles, 58.3 px, clock 8+3. Earlier certified tower-free refit retained. |
| 258 | Tower-free refit | 76 tiles, 59.1 px, clock 10+2. Earlier certified tower-free refit retained. |
| 259 | Exact released row | Trimming the staircase changes the clock route and wrong move 71. |
| 260 | Exact released row | The 260/262 swap is deferred as a pair until compact 260 passes. |
| 261 | Exact released row | The editor arrangement takes 17 clock moves; the clock allows 16. It also has one tower. |
| 262 | Exact released row | Compact source 260 has not passed without towers. Both original slots stay. |
| 263 | Tower-free refit | 80 tiles, 63.3 px, clock 13+2. Claude: inward bands and closed gaps; all 80 tiles retained. |
| 265 | Exact released row | In the compact attempt, removing ice 72 no longer helps: the ice becomes ineffective. |
| 266 | Tower-free refit | 76 tiles, 63.3 px, clock 11+1. Earlier certified tower-free refit retained. |
| 267 | Exact released row | The needed trim cuts a special or wrong move in the ice/key chain. |
| 268 | Tower-free refit | 76 tiles, 63.3 px, clock 7+1. Earlier certified tower-free refit retained. |
| 269 | Tower-free refit | 72 tiles, 59.1 px, clock 19+0. Claude: five dropped pairs returned on brick spots; 72 tiles. |
| 271 | Exact released row | The needed trim cuts a special or wrong move in the trap band. |
| 272 | Tower-free refit | 84 tiles, 59.1 px, clock 40+3. Earlier certified tower-free refit retained. |
| 273 | Tower-free refit | 76 tiles, 59.1 px, clock 24+4. Earlier certified tower-free refit retained. |
| 274 | Tower-free refit | 84 tiles, 58.6 px, clock 9+1. Claude: outer-column tiles returned inside on brick spots. |
| 277 | Exact released row | Compact source 280 has not passed without towers. Both original slots stay. |
| 278 | Exact released row | Removing the left staircase exposes the clock twin early (13 moves become 1). |
| 279 | Tower-free refit | 76 tiles, 58.6 px, clock 10+2. Claude band/row compaction plus ordinary-tile position exchanges: restores all seven visible finish pairs at the clock. Both wrong moves still cost 3. |
| 280 | Exact released row | The 277/280 swap is deferred as a pair until compact 280 passes. |
| 281 | Tower-free refit | 80 tiles, 58.6 px, clock 12+2. Earlier certified tower-free refit retained. |
| 282 | Tower-free refit | 80 tiles, 63.3 px, clock 5+2. Claude: cheese tile 65 shifted half a tile off straight support. |
| 283 | Tower-free refit | 72 tiles, 59.1 px, clock 21+3. Earlier certified tower-free refit retained. |
| 284 | Tower-free refit | 80 tiles, 58.6 px, clock 9+2. Earlier certified tower-free refit retained. |
| 286 | Tower-free refit | 72 tiles, 59.1 px, clock 11+2. Earlier certified tower-free refit retained. |
| 287 | Exact released row | The needed trim cuts a special or wrong move in the top trap band. |
| 288 | Exact released row | Tower-free attempts reached 57.5 px, below the 58 px floor. |
| 289 | Tower-free refit | 80 tiles, 59.1 px, clock 5+1. Earlier certified tower-free refit retained. |
| 291 | Tower-free refit | 78 tiles, 58.6 px, clock 1+17. Earlier certified tower-free refit retained. |
| 292 | Exact released row | Moving the cheap thaw neighbor makes tempting tile 74 cost 0 instead of 3. |
| 293 | Tower-free refit | 76 tiles, 58.3 px, clock 11+1. New: use the right-side trim, then return 20+59 and 33+67 as held brick modules. Wrong tile 73 still costs 2 and remains above its control. |
| 295 | Tower-free refit | 76 tiles, 63.3 px, clock 7+1. Claude: inward bands and closed gaps; all 76 tiles retained. |
| 296 | Tower-free refit | 80 tiles, 59.1 px, clock 14+3. Earlier certified tower-free refit retained. |
| 297 | Exact released row | The needed trim cuts a special or wrong move in the trap band. |
| 298 | Exact released row | The compact attempt remains below 58 px and obscures a special badge. |
| 299 | Tower-free refit | 78 tiles, 58.6 px, clock 12+2. Earlier certified tower-free refit retained. |

For 262/277 the retained released boards are nine rows and about 52.7 px, rather than the common 54.5 px of the seven-column/eight-row originals. They are explicit fallbacks; the tests require their original hashes/counts, not the 58 px refit rule. The source tenth boards at 260/280 also remain intact.

Dennis's saved editor arrangements and notes remain untouched at port 8282. Rechecked 261: true strict clock minimum **17**, allowed **16**, plus one tower. 292 still loses its cheap second thaw beside ice 65: wrong tile 74 becomes free in clock cost (3→0). 278's removed left staircase exposes the clock twin early. 288 still has three erased editor tiles (35/65/75) that could not all return with unchanged trap holds. Its earlier complete attempt was 57.5 px. For 298, all 576 half-row slice variants failed support, footprint or tower checks; its complete seed was 57.53 px.

## Difficulty evidence and limits

No personal-player bots or human win predictions were run. The measurements use the exact clock and forced-capacity portions of finish_ten_measure.js (Tail.cappedTail), plus bounded engine proofs of available finish actions and actual visible face-up offers. Unknowns remain unknown. At the tested shortest strict clock boundary, each accepted board has the same proven one-/two-waiting-tile capacity outcomes as its released source. These facts do not establish identical human win rates.

The nine revised boards have the following natural visible offers (safe / losing; face-up pairs and visible-twin singles). They are described separately from uniform legal-tile counts.

| Level | Opening before → after | At clock before → after |
|---|---|---|
| 253 | 4/0 → 4/0 | 7/0 → 7/0 |
| 256 | 2/0 → 2/0 | 1/0 → 1/0 |
| 263 | 2/0 → 2/0 | 1/1 → 1/2 |
| 269 | 0/0 → 0/0 | 1/0 → 1/0 |
| 274 | 1/0 → 1/0 | 1/4 → 1/4 |
| 279 | 4/0 → 3/0 | 7/0 → 7/0 |
| 282 | 3/0 → 2/0 | 1/4 → 1/3 |
| 293 | 3/0 → 3/0 | 1/2 → 1/4 |
| 295 | 0/3 → 0/3 | 1/3 → 1/2 |

256's lost obvious pair was a real structural warning and is restored. 279 now retains all seven safe visible finish pairs at the clock (previous compact draft had four); its opening has three safe pairs instead of four. 293 retains its one safe visible finish offer and the bait's exact cost, but exposes two additional losing visible offers. These are remaining shape/choice differences for Dennis to judge in the lab, not disguised claims of equal human difficulty. Across all 26, per-tile winning/losing/unknown counts and capacity proofs are in levels/level-N.json. The older 291 source has an unresolved bounded finish-action query; it is not counted safe. Its true clock minimum is 1, not its stale stored 16-move route.

279's global mirror score remains 0.16. The mirror search preserving trap holds and the initial free set found no certifiable improvement. 293 also has unequal band centers (global mirror score 0); its local brick modules are supported and logical, but visual symmetry remains a review limitation. The task's preference for symmetry was not used to weaken the trap.

## Bench changes

- towers_proof.js adds the actual all-layer tower/grid/width/rows/tile-count/58 px gate around Task 20. The old z>2-only test is not sufficient.
- shape_bench_tools.js: geometry, original-ID holds and initial free sets, heldSpots for a whole module (optional all-tile hold invariance), exact pressure/capacity readout, and layered SVG pictures with roles/IDs/faces. Exposed on B as geometry(), invariants(), heldSpots(), pressure(), picture().
- B.load(record) imports a proved board and keep map. prove() caches identical input results, clears stale results on a failed proof, and save() rejects edits made after its certificate. Route/trap pictures and their other copies are protected during untwinning.
- detower.bandRun can favor the opposite trim side and examine more trim options. This found 293's better right-side trim.
- Fixed broken relative imports in the existing per-level bench scripts. Bounded row, mirror, module and alternate-trim investigations are retained in the towers scripts and result JSONs. No search result below the floor, weakened trap, unauthorized same-spare certificate, or unresolved proof entered the candidate.

Example (from codex-towers; heavy wrapper required for pressure/proof/search):

```js
const {bench} = require('./source/tools/builder/bank/shape_bench');
const B = bench(293).load(require('./source/analysis/builder/footprint60/bench/level-293.json'));
B.geometry(); B.invariants();
B.picture('board.svg');
B.heldSpots([20, 59], {all:true, ms:10000});
B.prove(); // calls Task 23 + Task 20; B.save('note') only after a current passing proof
```

The bench deliberately retains the Task 20 module dependency on sibling codex-finish-ten, as in Claude's handoff. Use bench(sourceLevel) with source IDs; do not load source-260 tile IDs into bench(262).

## Labs and handoff

- Compare live / earlier / decision for all 42: http://127.0.0.1:8283/ . Offline, sunflower, notes + moves recorded locally, Show the way to the clock. Uses the current candidate renderer (the inherited old lab snapshot drew smaller phone tiles).
- Existing four-level placement editor, Dennis's saved notes preserved: http://127.0.0.1:8282/ . It remains an experimental editor using the older checker; its pass alone is not Task 23 adoption. Run towers_proof before accepting an editor result.
- Earlier labs 8275–8282 remain available; no user server was killed.
- Candidate manifest: codex-towers-candidate/source/analysis/refit-251-299.json. Packed board hashes, held hashes, save revisions and deferred pairs are explicit.
- Proofs/pressure: codex-towers/source/analysis/builder/towers/levels/. Figures: level-N-final.svg and phone-279.png. Inputs: pack.json; output hashes bind every board.

Do not merge/publish without Dennis's release approval. cc-builder-loop, cc-tray-gap and cc-refit-shapes were not edited.
