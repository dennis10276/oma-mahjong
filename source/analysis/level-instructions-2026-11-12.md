# Required new-tile instructions (unreleased, 2026-11-12)

Requested by Dennis: remove unused tips between levels, introduce new tiles with instructions that cannot be skipped, and do not release yet.

Worktree: `level-instructions`, branch `wip/level-instructions`, based on live 1.67 (`52346774`). No release/version bump, deployment, push or changes to published files.

Automatic retry reminders and coaching films have been removed from restart confirmations, full-tray losses and clock timeouts. Those screens retain their normal retry/menu controls. The help menu still offers the existing tips and tile explanations. The separate dashboard-enabled winning replay feature is retained.

At the first encounter with ice, locks, the clock or the level-50 face-down pair trick, the example must play completely once before the confirmation button unlocks. Pausing, hiding the app and reduced-motion playback do not count as watching the example. Reduced motion starts paused and lets the player press Play. Replay restarts the example. Golden tiles, jokers and the first face-down tiles have required written explanations with explicit confirmation.

Introductions run in sequence when a level contains multiple new kinds. Board taps and active play time are blocked until all introductions finish. Back and backdrop taps cannot dismiss them. Completion is saved only after confirmation, so reopening the app during an unfinished introduction shows it again. Existing completed introductions remain completed. Optional winning replays are checked after the introduction sequence.

Dutch and English previews at 360x640 were rendered and inspected: ice, lock and clock examples, captions, text and controls fit. Preview files are in the ignored `source/analysis/archive/level-instructions-2026-11-12/` folder.

Verification includes browser regression checks for sequencing, reopening, early confirmation, Back/backdrop, blocked taps, paused play time, reduced motion, manual help and absence of automatic tips at the former 3/9/21-loss thresholds. Existing automatic-tip tests were replaced with the requested behavior; common test players explicitly mark introductions completed.

Validation completed:

- Full offline suite: 157/162 initially passed. The five failures were existing tests attempting gameplay with unfinished introductions; their player fixtures were updated to state that instructions were already completed.
- Reruns after those fixture updates: `node source/tests/run.js t_hard` — 4/4; `node source/tests/run.js t_rules` — 5/5; `node source/tests/run.js t_replay` — 16/16. All previously failing checks passed.
- The four new instruction tests passed in the full run, including all former automatic-tip thresholds. The updated clock, manual-help and telemetry tests passed too.
- `git diff --check` passed. Visual inspection confirmed Dutch/English small-phone layouts.

No real-player data was written. Tests used FakeDB. Nothing was released.
