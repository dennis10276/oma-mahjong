# Required new-tile instructions — released in 1.68 (2026-11-12)

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


Release authorization: Dennis approved publication with "release" on 2026-11-12. Preparing version 1.68 from current main; final release checks and verification follow below.


## Release completion

Dennis approved release on 2026-11-12. Published **1.68**, signed APK **versionCode 84**, with `python source/release.py 1.68 --deploy` from up-to-date main. Release commit: `11f5386a`.

- Release gate: **162/162 offline tests passed in 440 seconds**, using FakeDB.
- Standard release refreshed the winning replay files before testing. Game boards and difficulty were not changed.
- Signed APK build verified the existing certificate and every bundled asset.
- [Pages deployment](https://github.com/dennis10276/oma-mahjong/actions/runs/43256089932) and [APK workflow](https://github.com/dennis10276/oma-mahjong/actions/runs/43256092174) succeeded.
- Public version and bundle report 1.68. All 27 versioned scripts/style assets and the bundle match source. Download-page version and web loader point to 1.68.
- Public APK is byte-for-byte identical to the verified local signed build. SHA-256: `70b56340f08c7913f04b09f633516ed4c65afe3b97369d2be8962bb62949a16f`.

- Live Chromium check at 360x640 passed: required ice/clock instructions, full playback, blocked Back/backdrop/taps, remembered completion and no automatic retry film. No browser errors. Firebase traffic was routed to FakeDB, so no player data was written. Verification reports and screenshots are in the ignored `source/analysis/archive/release-1.68/` folder.
