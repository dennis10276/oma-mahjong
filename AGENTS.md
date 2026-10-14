# Working on Oma's Mahjong (for Codex, Claude and anyone else)

Dennis (the owner) uses more than one AI agent on this project. Read this before changing anything.

## Where things are

- `source/` is the complete source: `www/` (the game), `site/` (download page and family
  dashboard), `tests/`, `tools/`, `android/`, `firebase/`, `analysis/`, `release.py`.
- The repository root (`play/`, `dash/`, `index.html`, `OmasMahjong.apk`) is the published site.
  It is written by `release.py`. Never edit it by hand.
- The old working folder on Dennis's PC (`C:\Users\den_k\Idea\OmasMahjong\oma-mahjong`) is
  retired as a source. Work in a clone of this repository instead.

## Branches

- `main` is exactly what is live. Releases are made only from an up-to-date, clean `main`.
- Unreleased work lives on its own branch (`wip/...`), one topic per branch. It goes into `main`
  only when Dennis has approved it.
- `wip/honest-observer`: the test player that no longer uses pictures a move would uncover, plus
  the draft level set built with it. Not live. Re-fitted to real players on 2026-10-15
  (`source/analysis/honest-refit.md` on that branch); the new level targets wait for Dennis.

## Working together

1. `git pull` before you start, and again right before a release. Look at `git log origin/main`:
   another agent may have released in the meantime. Use the next free version number.
2. Small commits with a clear message. Never force-push `main`.
3. Release: `python3 source/release.py <version> --deploy` from the checkout. The full test suite
   must pass (`node source/tests/run.js`).
4. The APK signing key (`source/android/keystore`) is local only and never committed. Keep the same
   key, or installed apps cannot update.
5. Write findings and plans to `source/analysis/`. Raw player exports go to
   `source/analysis/archive/` (ignored by git). Player data from the app is not secret: reading it
   from Firebase for analysis is fine.

## Levels and difficulty (decisions by Dennis, 2026-10-15)

- Levels 1-89 stay as they are. From 90 the shipped boards are ordered so that each level is at least
  as hard as the one before, by the current clock-focused measure (`tools/sim/reorder_levels.js`).
  Every 10th level is the only place for a big board.
- The current percentages come from the old test player, which could peek at pictures a move
  would uncover. Do not design or re-measure live levels with new targets until the honest test
  player (branch above) is re-fitted to real play. Nothing from that work goes live without
  Dennis's approval.
- Keep the current skill level roughly (tray pressure as it is). The alarm clock stays as it is.
- Face-down share: measured later as a side project of the honest test player.

## Firebase

- The database rules are `source/firebase/rules.json`. Dennis publishes them in the Firebase
  console (Realtime Database, Rules); agents cannot. A release that needs new rules must say so.
- The published rules match `source/firebase/rules.json` (checked by Codex 2026-10-15, including the
  `online` field for the online dots).
- Recorded tries (`replays/`) stay readable by anyone with the database address (option 1 in
  `source/analysis/replay-access.md`, chosen 2026-10-15); the dashboard game viewer relies on it.
  If people outside the family start playing, switch to option 2 (dashboard login). The daily cleanup
  then reads them with a key stored as the GitHub secret `FIREBASE_DB_SECRET`. The key never goes
  into code, the game or the dashboard.

## Players

- Resetting a player to a level: a settings event `{ k: 'cfg', t, redo: <level>, redoId }` in
  `plays/cfg-<pid>` (see `applyRedo` in `www/js/core.js`). Only when Dennis asks.
- DennisTEST (`pmuxw2uqkzcnbgx`) is a test account: it follows grandma's settings and is hidden
  from the rankings.
