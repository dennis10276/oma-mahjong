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
- `wip/honest-observer`: the honest test player (no peeking at pictures a move would uncover, smart
  guessing, clock planning), re-fitted to real players on 2026-10-15, and the tools that remade
  levels 106-269 for 1.53. Its code is not in the game; only the level table it made is.

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

- Levels 1-105 stay as they are (75-105: the 1.52 boards), except 94, 98 and 101: in 1.53 their
  pictures were swapped to make them fairer (strong player 10-19% -> 40-59%).
- Levels 106-269 were remade in 1.53 for a new curve, measured with the honest test player
  re-fitted to real play (branch `wip/honest-observer`, `source/analysis/honest-refit.md` there):
  the strong player (fitted to Dennisisdebeste) wins about 54% of first tries at 106, 45% at 150,
  then 40% to 269; no level below 20%. Each level is a 1.52 board with its pictures swapped
  (positions, face-down tiles, specials, clock and solution kept). Big boards only on every 10th
  level. Measurements: `source/analysis/remake-1.53.json`; tools: `source/tools/sim/refit/remake_*.js`
  on the branch. The stored chances in the table (fields 8 and 9) for 106+ are the new sensible
  and strong players; up to 105 they are still the old focused measure.
- `Hard.target` / `strongCurve` in the game are the OLD measure (old test player); do not use them
  to judge 106+. Use the branch's test player.
- Keep the current skill level roughly (tray pressure as it is). The alarm clock stays as it is.
- Face-down share: measured later as a side project of the honest test player.
- Everyone plays the same levels (Dennis, 2026-10-16; from 1.54). Before, levels 1-69 were built
  live for the screen shape (and the deal could stop early on a slow phone), so a level could be
  very different per phone (level 51: about 2% for Gerda's long screen, 98% for PUK's wide one).
  Now levels 1-69 of the normal track come from the ready-made table `www/levels-early.js`, built
  by `source/tools/build_early.js` for shape 1.6 (`RULES.levels.aspect`); `--check` tests it. For
  levels where shape 1.6 gave an outlier, another deal was chosen (a salt per level; measured with
  the average test player over shapes 1.0-2.2: `source/analysis/early-salts.json`). The daily level
  is built for the same fixed shape. Not covered: grandma's own track (still built for her screen)
  and the extra-large tiles setting (builds its own board). Keep the table: changing it changes
  levels people are playing.

## Predictions on the dashboard

- `dash/predict.json` (source: `source/site/dash/predict.json`) holds, per player, what their own
  test player predicts for their next 60 levels: first try, within 2 and within 4 tries. The dashboard
  shows it in the card "Voorspelling", with the real results next to it once played.
- It is made on `wip/honest-observer` (`source/tools/sim/refit`): `dataset.js` (fresh data from
  Firebase), `player_fit.js` (one test player per person), `predict.js`, then
  `publish_predict.js <version> <file>`. Publishing it changes no game version: copy it to both places.

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
