# TASK G1 — Can the GPU play our games faster? (Claude → Gemini, 2026-11-06)

This is a new, separate assignment from Dennis. It does not replace your personal-bots assignment (`GEMINI.md`).

## Why
- **The bottleneck:** levels are now built by a level builder (milliseconds per board) and then rated by bots
  that play each board many times. A family bot plays 2 x 2 x 40 campaigns, and a skilled planner plays as well.
  Nearly all the time goes into those bot games, which run on the CPU in Node.
- **Dennis's question:** could the GPU in his PC do this faster? The games are independent, so thousands could
  run side by side. But every move branches (which tiles are free, the tray, memory, route planning), and GPUs
  handle that poorly.
- **This task is a feasibility probe only.** It decides whether a real port is worth it. Do not change the real
  bots, the meter or any rating.

## Where things are
- **Repo:** https://github.com/dennis10276/oma-mahjong. Make your own clone on Dennis's PC in a new folder
  `C:\Users\den_k\Idea\OmasMahjong\gemini-gpu-probe`.
  - Start a branch `wip/gemini-gpu-probe` from `origin/wip/level-builder`.
  - Do not use the Codex or Claude folders.
- **Game rules (read these first):**
  - `source/tools/builder/SPEC.md`, section 1: the board format and every rule.
  - `source/tools/builder/engine.js`: a clean model of the rules, and the reference for your kernel.
  - The rules are: free tiles; a tray of 3 (a 4th unmatched tile loses); ice (h neighbours must be gone); locks
    (open when both keys are gone); the clock (its tile must be taken within n moves); face-down tiles
    (turning one over is free); and the PEEK PAIR (a turned-over free face-down tile plus its free twin go
    together without a tray slot).
- **Test boards:** `source/analysis/builder/data/qualified-200-225.jsonl` (`design` field; 76, 84 and 96 tiles
  are all there).
- **The real family bot**, so you can estimate the full port: `source/tools/sim/refit/`
  (`human_factory_controller.js`, `human_style_measure.js`) and `source/tools/factory/meter.js`.

## Steps
1. **Check the PC.** Find out which GPU it has and what can drive it: `nvidia-smi`, the driver version, and
   whether CUDA, Python with CuPy/Numba/PyTorch, or Node WebGPU is available. Install only into a separate
   virtual environment inside your new folder.
2. **Write a GPU playout kernel** in `source/tools/gpu-probe/`:
   - It covers all the rules above.
   - The bot is deliberately simple:
     - take a tray match if there is one;
     - else take a free pair (a peek pair counts);
     - else take a random free tile;
     - turn over face-down tiles when they are free.
   - It plays many independent games of one board at once (one thread or warp per game) and returns the win
     rate.
3. **Write the same simple bot on the CPU** in Node, with worker threads on all cores, for a fair comparison.
   - Check that both give the same win rate on 3 boards, within sampling noise.
   - Also check that, for a few fixed move sequences, both agree with `engine.js` (`E.step`).
4. **Measure games per second,** GPU and CPU, on a 76-, 84- and 96-tile board, at 1k, 10k and 100k games.
   Include the start-up and copy time.
5. **Estimate the real family bot:**
   - What would have to move to the GPU: its memory of lost tries, route planning, look-ahead and caches.
   - What could not move.
   - How much speed is likely left once the branching is real.
   - How much work a full port would be, plus re-calibration so that ratings stay the same as today. Ratings
     must not drift: all current levels were judged with the current bots.
6. **Report:** write `gpu-probe.md` in plain language, with the numbers and a clear recommendation: worth porting
   or not, and if so the next step.

## Rules
- Never touch `main`. Never write to Firebase.
- Do not change files outside `source/tools/gpu-probe/` and your report.
- **Share the PC fairly:** Codex is running CPU-heavy level measurements (its Task 10).
  - Run your CPU benchmark only in short bursts of a few minutes, or when no Codex `node` measuring jobs are
    running.
  - GPU runs that hardly use the CPU are fine at any time.
- **Time box:** about half a day of work.
- **Results:** put the report and the measurements in
  `C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\gpu-probe\`, and commit and push your branch.
- **Hand-back:** say "Task G1 done", with the branch name and the report path. Claude reviews it.
