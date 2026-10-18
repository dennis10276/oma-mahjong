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
4. The APK signing key (`source/android/keystore`) is never committed. Keep the same key, or
   installed apps cannot update (`android/build.sh` refuses any other certificate). Without the key
   on your computer (a fresh Claude or Codex session) just release as usual: `release.py` publishes
   the game, and GitHub builds and signs the APK right after the push (workflow "APK",
   `source/tools/apk.yml`, key in the repository secrets `OMA_KEYSTORE` and
   `OMA_KEYSTORE_PASSWORD`, added by Dennis). The Android tools are fetched by
   `source/tools/android_sdk.sh` when missing. Never copy the key into a session.
5. Write findings and plans to `source/analysis/`. Raw player exports go to
   `source/analysis/archive/` (ignored by git). Player data from the app is not secret: reading it
   from Firebase for analysis is fine.

## Levels and difficulty (decisions by Dennis, 2026-10-15)

- Latest decision (2026-10-16, release 1.54): levels 1-91 stay fixed; 92-269 are reordered using
  both fitted personal players, including retries, in five-point ease bands with smoothing.
  Each complete 1.53 board is preserved exactly, with large boards every tenth level. See
  `source/analysis/reorder-92.json`, its mapping/review, and `source/tools/sim/reorder_honest.js`.
  The offline calibrated engine is frozen in `source/tools/sim/honest/` at commit 316f3b1;
  experimental move-cloning models are not used. Saves through 91 retain generation 7;
  reordered levels use generation 8. Progress, stars and old recordings are not rewritten.
- Historical 1.53 decision: levels 1-105 stayed as they were (75-105: the 1.52 boards), except 94, 98 and 101: in 1.53 their
  pictures were swapped to make them fairer (strong player 10-19% -> 40-59%).
- Levels 106-269 were remade in 1.53 for a new curve, measured with the honest test player
  re-fitted to real play (branch `wip/honest-observer`, `source/analysis/honest-refit.md` there):
  the strong player (fitted to Dennisisdebeste) wins about 54% of first tries at 106, 45% at 150,
  then 40% to 269; no level below 20%. Each level is a 1.52 board with its pictures swapped
  (positions, face-down tiles, specials, clock and solution kept). Big boards only on every 10th
  level. Measurements: `source/analysis/remake-1.53.json`; tools: `source/tools/sim/refit/remake_*.js`
  on the branch. The stored chances in the table (fields 8 and 9) for 106+ are the new sensible
  and strong players; up to 105 they are still the old focused measure.
  In 1.54 these packed ratings travel with their boards: use `Hard.ratingModel(level)` rather
  than assuming the model from the level number. The new order uses separate personal ratings
  in `reorder-92.json`, not those legacy packed ratings.
- `Hard.target` / `strongCurve` in the game are the OLD measure (old test player); do not use them
  to judge 106+. Use the branch's test player.
- Keep the current skill level roughly (tray pressure as it is). The alarm clock stays as it is.
- Face-down share: measured later as a side project of the honest test player.
- Everyone plays the same levels (Dennis, 2026-10-16; from 1.55). Before, levels below 70 were built
  live for the screen shape (and the deal could stop early on a slow phone), so a level could be
  very different per phone (level 51: about 2% on Gerda's screen, 98% on PUK's).
  The family had passed level 52, so the change starts there: levels 51 and 53-69 of the normal track
  come from the ready-made table `www/levels-early.js` (`source/tools/build_early.js`, `--check`
  tests it); 1-50 and 52 are still made for each screen as before. The standard is the board Gerda
  played ("don't make it easier for her"): her recorded boards (`source/analysis/early-gerda.json`,
  from `source/tools/early_from_replays.js`), and for levels she had not played yet the board made
  for her screen shape (1.6). Her very hard 51 (strong test player under 1% first try; she needed
  17 tries) and her 53 are switched: level 53 is now her 51, level 51 her 53. The daily puzzle is made
  for shape 1.6 (`RULES.levels.aspect`). Grandma's own track still follows her screen. The
  extra-large tiles setting is removed (it changed the level). Keep the table: changing it changes
  levels people are playing.

- In progress, NOT live (Dennis, 2026-10-18; branch `wip/level-variety`): more variety. Levels
  157-269 (nobody has reached them) each get a new pile shape, unlike every other designed level,
  with the same difficulty as the board they replace (both personal players with the frozen observer,
  the 1.54 reorder measure). Everything needed to continue is in `source/analysis/variety-plan.md`;
  the work is resumable (`node source/tools/sim/variety/variety.js build 2`, progress in
  `source/analysis/variety-progress.json`). Do not publish until Dennis says so.

## Predictions on the dashboard

- Release 1.56 only improves tutorials; all boards are identical to 1.55. Current
  predictions carry the same numbers under version 1.56, with 1.55 registered as
  comparable on all levels and its original file preserved in `predict-1.55.json`.
- Release 1.57 adds actual help-message events to Live verloop; boards and
  prediction numbers are unchanged. The 1.56 file is archived as
  `predict-1.56.json`, and both 1.55 and 1.56 remain comparable on all levels.
- Release 1.58 only makes starting, matching and the lessons smoother; boards and prediction
  numbers are unchanged. The 1.57 file is archived as `predict-1.57.json`; 1.55-1.57 stay
  comparable on all levels.

- `dash/predict.json` (source: `source/site/dash/predict.json`) holds, per player, the prediction for
  their next 60 levels: first try, within 2 and within 4 tries. The dashboard shows it in the card
  "Voorspelling", with the real results next to it once played. It picks the file of the player's app
  version: older versions keep their own file (`previousVersions`, e.g. `predict-1.54.json`), and
  `comparable` lists older versions whose results still count for some levels (same boards).
- From 1.55 (2026-10-16): the move-based test player per person (`fit.model: 'move'`), made on
  `wip/honest-observer` (`source/tools/sim/refit`, notes in `source/analysis/honest-refit.md` there):
  their own habits from their recorded games (what kind of move per situation: turn a tile over, pair,
  single, fatal 4th tile; `kinds.js`), the engine's choice within that kind (care level 2), memory of a
  lost try 75/50/75%; then corrected for how it has gone lately (per person) with a slope shared by the
  family, plus how the family did on that exact board before (boards are the same for everyone).
  Steps: `dataset.js` (fresh data), `mimic_data.js`, `mbot_chains.js` + `dash_chains.js` per person,
  `mbot_recal2.js` (rolling test, `BOARD=1 SAVE=1`), `predict_mbot.js <name> <from>`,
  `finalize_predict.js`, `publish_mbot.js <version> <file> '<comparable>' '<previous versions>'`.
  Publishing it changes no game version: copy it to both places (`source/site/dash/` and `dash/`).
- A single first try stays close to a coin flip for this family (rolling test: first tries tell won
  from lost with AUC ~0.65); the chances are honest on average, not a promise per level.

## Drawing the board and the lessons (from 1.58)

- Board tiles live in one group per layer (`#board > .lyr > .tile`); `G.tiles[i].el` is the tile. A
  tile only rises above tiles of its own group: use `glow(i, 'lucky'|'nudge', on)` to show one above
  the pile. Classic faces on the board are shared pictures (`Tiles.boardFace`), not live SVG.
- Build the pile with `renderBoard` (positions first, one insertion); do not measure the page in
  code that runs on every tap. Sparkles are `FX.burst`/`FX.emoji` (graphics chip, `fx.js`).
- Lessons: `LESSON_SCENES` / `LESSON_STEPS` in `specials.js`. Findings and numbers:
  `source/analysis/smooth-1.58.md`; `tests/perf_probe.js` and `tests/perf_trace.js` measure.

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
