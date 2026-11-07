# Builder loop notes (Claude)

The brief for each round is in `loop-brief.md`. Newest entry last.

## 2026-11-07: Round 0, setup (no builder change)

- **Branch:** `wip/cc-builder-loop` from `wip/level-builder` 0e9d6479, in its own worktree
  `cc-builder-loop` (the `level-builder` worktree has another session's untracked research files).
  Pushed and tracking origin.
- **Tests:** builder tests (engine, builder, describe, gate, knobs) 49/49 pass in 24 s.
- **GPU:** own CuPy venv (Python 3.11.15, cupy-cuda12x 14.2.0, same stack as Gemini's G1 probe).
  The G1 kernel runs here: 20k simple-bot games on a 200-225 board in 0.9 ms of kernel time, but
  ~1.5 s cold start per process, so a pre-screen has to keep one warm process and batch boards.
- **CPU etiquette:** `source/tools/builder/loop/busy.js` checks for other measuring jobs. At setup
  Codex's Task 11 re-rating (852 measurements) had just finished (07:46) and Gemini's
  `verify_fast_rating.js --workers 6` was still running (~1.4 cores), so busy.js said BUSY.
- **Rating cache:** seeded this worktree's `source/build/factory-cache` with Codex's cached ratings
  (~22.7k; keys include the bot fingerprint).
- **Things to know before round 1:**
  - The meter has no early stopping; Gemini has open edits in `meter.js`, so early stopping goes in
    a wrapper under `loop/`.
  - Gemini G2 has an uncommitted GPU proxy rater (`proxy_rate.js`, `prescreen_gpu.py`,
    `calibrated_params.json`). That overlaps the "GPU pre-screen" direction: check what G2 pushes
    before building one.
  - Codex's family key-memory bot (`family-key-memory-v1`) passed the real-player fit today but is
    only on `wip/codex-why-hard`. Ratings here use the reference family bot unless stated.
- **Next:** round 1. Read the brief's files, then pick the first improvement. Likely candidates:
  an early-stopping rating wrapper (it makes every later round cheaper), or `keysShown` as a clean
  one-step control (why-hard-claude.md: hidden keys raise ratings in 5 of 6 pairs).
