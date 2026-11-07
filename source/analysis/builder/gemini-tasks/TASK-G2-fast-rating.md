# TASK G2 — Faster ratings: your zero-drift CPU fast path, then a GPU pre-screen (Claude → Gemini, 2026-11-07)

Thank you for G1: clear numbers, honest verdict. I've merged `wip/gemini-gpu-probe` into `wip/level-builder` and I
accept your recommendation: the real family and planner bots stay on the CPU.

The level builder is being revamped; that is the main project. Codex measures and Claude improves the builder.
Bot ratings are the bottleneck of everything we do with it, so this task has two parts, in order.

## Rules
- **Branch:** start `wip/gemini-fast-rating` from `origin/wip/level-builder`, in your own folder
  (`gemini-gpu-probe` is fine).
- **Hands off:** never touch `main` or Firebase, and don't edit the Codex or Claude folders.
- **Sharing the PC:** Codex runs CPU-heavy measurements. Benchmark in short bursts, or while no Codex `node`
  measuring jobs are running. GPU work is fine at any time.
- **Results:** `gemini-tasks/results/fast-rating/`. Commit and push your branch, then say "Task G2 part A done" or
  "part B done". Claude reviews and merges.

## Part A — Zero-drift CPU fast path (first; your own proposal)
Make the family and planner ratings faster without changing a single decision.
- **Untouched:** `human_factory_controller.js` (`decide`, `observe`, profiles) and the RNG stream.
- **Two ways to run:** add a fast measurement mode next to the current, unchanged path. The meter picks it.
  - Step the game state directly, instead of the patched generator plus `structuredClone` per tap.
  - Skip the second full replay (`verify()`) and the per-campaign SHA-256 source check in bulk ratings. Keep both
    in the tests, plus a random audit of about 1% of campaigns in the fast mode, which must fail loudly on any
    mismatch.
  - Precompute each tile's possible occluders once per board in `human_board_visibility.js`.
- **Proof of zero drift:**
  - On 100 boards, the fast mode must give identical results to the current mode for both bots: every
    `expectedTries` and `firstTryRate`, and every move, to the last digit. Take 30 boards from
    `analysis/builder/data/qualified-200-225.jsonl`, `analysis/builder/data/training-data.json` and
    `analysis/builder/knobs-v1/boards.json`.
  - Then register the hash pair in `FAMILY_CACHE_MIGRATIONS` in `meter.js`, so cached ratings stay valid.
  - All factory and builder tests must pass.
- **Report:** the speed-up per bot on the 76-, 84- and 96-tile boards, single core and all cores.

## Part B — GPU pre-screen for the builder (the GPU use Dennis asked for)
Task 10 showed that a board's difficulty for the bots comes from the puzzle's structure, and jumps. A way to the
clock of about 10 moves gives 2–6 tries; 14+ moves often hit the 20 cap. The builder therefore has to try many
candidates and measure each one, and a full bot rating costs seconds per board. Build a GPU proxy rater that scores
hundreds of candidate boards in one launch, so only promising ones go to the real bots.
1. **Batch kernel:** many boards × many campaigns in one launch. Your G1 kernel packs one board; extend it to a
   board array plus a campaign index. Campaigns must play sequential tries (up to 20) with memory between tries.
2. **A proxy policy with few branches and a few parameters,** for example:
   - take a tray match;
   - prefer tiles on a precomputed clock route while the clock is pending (the route is computed once per board
     on the CPU with `engine.js` `clockShortest`, and the kernel only reads it);
   - avoid a 4th tile with a one-step look-ahead;
   - pairs, with a temptation weight;
   - noise (temperature);
   - memory of seen faces across tries, with a retention rate.

   It does not need to copy the family bot. It needs to rank boards like it.
3. **Calibrate** the parameters on the GPU (grid or random search) against measured boards:
   - `analysis/builder/data/training-data.json`: 1,989 boards with family ratings; 992 also have skilled ratings.
     Use the current-bot rows; see `descriptors-report.md` on the two bot versions.
   - `analysis/builder/knobs-v1/boards.json`: Task 10's builder boards with ratings.

   Hold out 25% for testing.
4. **Report on the held-out boards:**
   - rank correlation with the family rating, and with the skilled rating;
   - how well it separates "in the band" (family 10–13) from "clearly out" (≤ 6 or ≥ 18);
   - the share of in-band boards it would keep if the cut throws away 70% of the candidates.
5. **A callable screen:** `proxyRate(designs)` from Node, via a persistent worker (CuPy server or in-process
   `webgpu`), returning a score per design. Add a test, and a small usage note for the builder.
6. **Verdict:** is the proxy good enough to pre-screen builder candidates? The bar: it keeps at least 90% of
   in-band boards while discarding at least half of the clearly-out ones. If not, say what limits it.

Time box: part A about 1–2 days; part B about 2 days. Report each part when done.
