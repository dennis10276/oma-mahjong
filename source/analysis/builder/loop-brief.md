# Builder loop: brief for each round (Claude, set up 2026-11-07)

Read this at the start of every round, then the latest entries of `loop-notes.md`.

## Task (Dennis)

Improve the level builder (builder v3) and judge whether bot ratings or a GPU pre-screen can move to
the GPU (RTX 3070). Each round: pick the most useful next improvement, build it, test it, measure it,
commit and push, then add a short dated entry to `source/analysis/builder/loop-notes.md` (what you
tried, the numbers, what's next).

**Goal:** a builder whose controls move the bot ratings predictably. Targets for levels 200-225:
family **10-13 tries**, skilled **2.5-6 tries**. Every board stays winnable, readable
(`placement_score.readable`), original, has at least 72 tiles, and has no idle specials.

**Good directions:** make `keysShown` a clean one-step control; real choices under pressure (the right
move that doesn't look right); a GPU proxy rater that pre-screens hundreds of candidates per launch;
a slope rather than a cliff in way length.

**Stop** and write a summary for Dennis in `loop-notes.md` when a round brings no real improvement
twice in a row, or when the builder hits the targets on at least half of its first bot checks.

## Where

- Worktree `C:\Users\den_k\Idea\OmasMahjong\cc-builder-loop`, branch `wip/cc-builder-loop`
  (tracks origin), based on `wip/level-builder` at 0e9d6479. Commit and push only here.
- Read first (in-repo copies match the external task files):
  `AGENTS.md`; `source/tools/builder/SPEC.md`; `source/analysis/builder/why-hard-claude.md`;
  `source/analysis/builder/knobs-v1/` (Task 10: tray pressure, luck and traps on the same puzzle do
  nothing; clock spare is about -1.1 tries per move); `source/analysis/builder/codex-review.md`;
  `source/tools/gpu-probe/gpu-probe.md`; `source/analysis/builder/codex-tasks/TASK-11-why-boards-are-hard.md`;
  `source/analysis/builder/gemini-tasks/TASK-G2-fast-rating.md`.
- Codex's latest Task 11 results (not merged upstream yet) are readable in
  `..\codex-level-factory\source\analysis\builder\why-hard-v1\` and its running notes in
  `..\codex-level-factory\source\build\TASK-11-RUNNING.md`. Read only.

## Rules

- Never touch `main`, the game's level table or Firebase. No releases.
- Don't edit the Codex or Gemini folders, or files they are working on. Treat as read-only here too:
  - Codex Task 11: the bot controller and memory (`source/tools/sim/refit/human_factory_controller.js`,
    `human_bot_key_memory_v1.js`, `human_key_memory_controller.js`, `human_key_memory_measure.js`,
    `human_key_memory_release.js`) and `source/tools/builder/task11_*.js`.
  - Gemini G2: `human_style_environment.js`, `human_board_visibility.js`,
    `production_physical_session.js`, plus files G2 has open edits in (2026-11-07):
    `source/tools/factory/meter.js`, `source/tools/sim/refit/human_bot.js`, `human_style_measure.js`,
    `source/tools/gpu-probe/{README.md,board_pack.js}` and its new `proxy_rate.js`,
    `prescreen_gpu.py`, `prescreen_kernels.cu`, `calibrate_prescreen.py`,
    `source/tools/factory/{verify,test}_fast_rating.js`. Wrap them, don't change them.
  - Put new loop code under `source/tools/builder/loop/` (or in `builder.js`/`describe.js`, which are
    ours) so merges stay clean.
- **One CPU-heavy job at a time on this PC.** Before any bot run longer than a minute:
  `node source/tools/builder/loop/busy.js` (exit 0 free, 2 busy; it looks at other node/python jobs,
  recent Codex/Gemini logs and CPU load). If busy, do GPU work or analysis, or wait.
  GPU work is fine at any time.
- A change to how the bots play must be a new bot version that matches real players at least as
  well as today (same fit gates Codex used: family-weighted MAE, planner live MAE, lab MAE).
  Otherwise report it, don't ship it.
- Use early stopping for bot ratings where full ratings aren't needed (the meter has none yet:
  build it as a wrapper in `loop/`, not inside `meter.js`).

## Bots and ratings

- `require('source/tools/factory/meter.js').createMeter()` -> `measure(board, { setting: 'family' | ... })`,
  default `{ runs: 20, seeds: 2, seed: 4711 }`. Cache: `source/build/factory-cache` (git-ignored),
  seeded on 2026-11-07 with Codex's ~22.7k cached ratings (keys include the bot fingerprint, so
  nothing stale can be reused by mistake).
- Reference family bot fingerprint `f32859281c74...`. Codex's candidate `family-key-memory-v1`
  (fingerprint `d362e85fba3d...`, `M.createMeter({ botVersion: 'family-key-memory-v1' })` on Codex's
  branch only) passed the fit on 2026-11-07 (family MAE 2.0812 -> 2.0794; others unchanged). It is
  not on this branch; say which family bot every number comes from.
- Codex's measure lines show family ratings take about 8-30 s per board and skilled (planner) 15-600 s.
  Pre-screen hard before calling the planner.

## GPU

- Own CuPy venv: `source/tools/gpu-probe/.venv` (git-ignored); path via
  `require('./source/tools/builder/loop/gpu_env.js').python()`. Rebuild commands are in `gpu_env.js`.
- Checked 2026-11-07: `gpu_playout.py --cmd run` on `qualified-200-225.jsonl` board 2, 20k games:
  kernel 0.9 ms, warm total 1.8 ms, **cold process start ~1.5 s** -> keep one warm Python process
  for many boards (one launch per batch of candidates).
- The G1 GPU bot is the *simple* bot (17-43x faster, but it doesn't play like people; it won 0/20000
  on that board). Real bots stay on the CPU; 85% of family-bot time is overhead (gpu-probe.md).
- Gemini G2 is building a GPU proxy rater (`proxy_rate.js` / `prescreen_gpu.py`, uncommitted on
  `wip/gemini-fast-rating`). Before building our own, check whether G2 has pushed it
  (`git fetch origin; git log origin/wip/gemini-fast-rating`) and reuse it read-only if it fits;
  if ours is different, give it a different name and say why in the notes.

## Each round

1. `git pull`; read `loop-notes.md`; check `busy.js` and whether origin `wip/level-builder`,
   `wip/codex-why-hard` or `wip/gemini-fast-rating` moved (merge `wip/level-builder` if it did).
2. Pick the single most useful next improvement; say why in one line.
3. Build it with tests (`node --test source/tools/builder/test_*.js`: 49 pass, ~25 s on 2026-11-07).
4. Measure it (pre-screen first, early stopping where possible, full ratings only for the decision).
5. Commit (small, clear message) and push `wip/cc-builder-loop`.
6. Add the dated entry to `loop-notes.md`: tried / numbers / next. Mark whether it was a real
   improvement (the stop rule counts rounds without one).
