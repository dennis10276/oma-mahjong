# Oma's Mahjong

Ad-free Mahjong solitaire for Android (and the web / iPhone), in Dutch or English.

- `OmasMahjong.apk`: the app, ready to install
- `www/`: the game itself (HTML/JS, open `www/index.html` in a browser to play)
  - `tiles.js` tile pictures and themes, `audio.js` sounds,
    `layouts.js` the engine: piles, deals, difficulty, solver, ice/lock placement (also runs in Node for tests)
  - `js/` the game, loaded in this order (the list is in the boot loader in `index.html`):
    | file | what |
    |---|---|
    | `rules.js` | **every number you may want to tune** (see below); also used by the dashboard |
    | `lang.js` | every text of the game in Dutch and English (`tx('key')`), the language switch; `fx('key')` + `fitTexts()` keep English in the exact Dutch layout (smaller font instead of an extra line) |
    | `core.js` | saved progress (`S`), dates, small helpers, backgrounds, prizes |
    | `fx.js` | particles: confetti, sparkles, flying emoji |
    | `update.js` | self-update from the website |
    | `screens.js` | menus, calendar, themes, prize cabinet, pop-ups, settings |
    | `board.js` | playing a level: the pile, the tray, tapping, matching, hint, shuffle |
    | `help.js` | extra help (grandma): gentle/adaptive deals, tray rescue, the helper, no early shuffle |
    | `specials.js` | gold pair, joker, ice, lock & key |
    | `rewards.js` | statistics, daily tasks and chest, lucky moment, daily gift |
    | `telemetry.js` | play log for the dashboard |
    | `social.js` | ranking: family online, computer players, the weekly challenge, profile, climbing |
    | `hearts.js` | hearts (with a message) between family members |
    | `stories.js` | the made-up neighbourhood stories (Dutch), about the computer players |
    | `village.js` | grandma's news after a won level: real Apeldoorn news + story parts, Het krantje, 💬 in the ranking |
    | `win.js` | the win screen and the rewards after it |
    | `main.js` | buttons, touch, start-up |
  - `style.css` all styles
- `site/dash/`: the family dashboard (live play data from the database): stuck alert with a
  "send a heart" button (with a message), desktop notifications, how close she got, her difficulty
  step, all levels and a live feed. It loads `play/js/rules.js`, so it always matches the game.
- `tests/`: the test suite (see below)
- `tools/news.py`: collects friendly local news from Apeldoorn (Samen1, Apeldoorn Direct, Stedendriehoek)
  into `news.json`; `tools/news.yml` is the GitHub workflow that would run it every two hours and
  publish it on the `news` branch (not switched on yet: see "News from Apeldoorn" below)
- `firebase/rules.json`: database rules
- `android/`: the small Android wrapper (WebView) + `build.sh` (aapt2/javac/d8/apksigner, no Gradle needed)
- `android/keystore/`: the signing key + password. KEEP THESE SAFE: updates must be signed with this
  same key or Android refuses to install them over the old version (and grandma would lose her progress).
- `site/`: the public download page (GitHub Pages)

To make an update: edit `www/`, then `python3 release.py <version> --deploy` (see below).
Building the APK needs Android SDK build-tools 35 + platform 34 (set ANDROID_SDK).

## Changing the rules (`www/js/rules.js`)

- `RULES`: from which level the tools, the Zonnebloem prize, gold pairs and jokers come; points per
  pair, combo, stars, gold, lucky moment and joker finale; the win-streak bonus; the chest; the daily
  gift; hearts (how long the pop-up stays; the ready-made messages are in `lang.js`, `quickMsgs`).
- `RULES.autoFinish`: from level 50, when no order of the remaining taps can fill the tray any more
  (checked exactly by `finishSafe` in `board.js`, trying every order; not while ice, locks or a joker
  are left), the last tiles play themselves. In practice that is the last 4-7 tiles.
- `HELP`: the help per kind of player, `care` (grandma) and `normal` (everyone else): combo time,
  lucky moments, a gentler deal, easier after N failed tries, putting the tray back, the helper and
  its timings, no shuffle at the start, and the adaptive difficulty. To give someone else a kind of
  help, change it under `normal` (e.g. `rescue: true`).
  `toolsGoneFrom`: from that level on Hint/Schudden have to be earned (normal: 50; grandma mode: always
  there). The levels go in blocks of `RULES.tools.earn.every` (5): 50-54, 55-59, ... In a block you have
  them when every level before the block has `earn.stars` (3) stars; playing a missing level again for 3
  stars brings them back right away. Without them the toolbar is hidden and the pile gets its space. A
  popup tells it at every new block and whenever it changes (`S.toolsSt` = what was told last).
  `jokersGoneFrom`: from that level on no jokers are dealt (normal: 50; grandma mode: never).
- Planned: a shop where hints, shuffles and jokers can be bought. A bought joker used on a pair costs a
  star, one that finishes the level does not; the stars are counted in one place (`starsFor` in
  `win.js`) for that.
- `GRANDMA`: grandma's player id (or a name starting with "Oma"); `like` = players who always get
  exactly what she gets (DennisTEST, to see what she sees).
- `CARE`: who else has Super-omamodus by default (nobody now; Mama is not in grandma mode).
- `VILLAGE`: grandma's news after a won level: 1 in 5 a story part (`storyShare`), how old news may be,
  when stories may fill in because the news file is old, the star for a memory question.
- `START_ENGLISH`: player ids that start in English (Mama). Anyone can switch in the settings
  (🌐 Language); that choice is saved in `S.lang` and always wins.
- When ice and locks start is in `layouts.js` (`MECH`), the tray size there too (`SLOTS`).
- The tests can change these per test: `t.phone({ tune: { HELP: { normal: { rescue: true } } } })`.

## Updates (from version 1.5)

The app updates itself: on start (and when it comes back to the foreground) it checks
`play/version.json` on the website and then downloads `play/bundle.json`. A newer version is kept on
the phone and used from the home screen on. If a downloaded version does not start, the app falls
back to its built-in version and skips that update. New files in `js/` only need to be added to the
`FILES` list in `index.html`.

The web / iPhone version reloads when `play/version.json` is newer. Each version's scripts, style and
fonts are in their own folder `play/v/<version>/` (`index.html` points there; the last 5 stay online),
so a page or a kept `index.html` never mixes old and new scripts (that gave "Can't find variable"
errors in 1.26). The reload goes to `?v=<version>` so the browser fetches the new page.

    python3 release.py 1.6 --deploy   # phones update themselves, and the download page
                                      # always gets a fresh APK of the same version

## Grandma's own levels (grandma mode)

Everyone in grandma mode plays a separate, gentler set of levels (`forCare` in `layouts.js`, track
`care`; the level numbers, stars and prizes are the same):
- the difficulty climbs at a quarter of the normal speed (her level 35 plays like a normal level 13);
- piles of 64-80 tiles in their own shapes, a party pile of 96 every 10 levels; points are scaled so a
  level is worth the same as the normal level (`ptsScale`);
- few face-down tiles: none before level 10, then 2, one more every 15 levels, at most 6, only on tiles
  with nothing on top and never both tiles of a picture (`careDownN`);
- ice and locks at the same level numbers as everyone (35 and 45);
- deals are picked so a sensible player clears ~90% first time (tested for every 3rd level up to 100);
- on top of that her usual help below (one step gentler, adaptive, easier after 3 failed tries).
A level saved from the other set of levels is not resumed (it starts fresh). The dashboard shows
"Hulpje per poging" and "In één keer goed" for the last 7 days.

## Extra help for grandma (`HELP.care`)

- a full tray is not game over yet: once per level she can put the tiles back (costs one star)
- every level is dealt a bit gentler (`Layouts.ease` 1); after failing the same level 3 times the
  next try gets more matching pictures (one more step)
- her difficulty follows her own results: her last 10 tries on levels are kept on the phone (win 1,
  win after putting tiles back 0.5, stuck 0; starting over within 30 s does not count). When a new
  level starts and 5+ tries were played since the last change: under 60% won -> half a step easier,
  over 85% -> half a step back. Steps -2..+2 mean ease 0..2 (`Layouts.ease` takes half steps). Easier
  steps also get less ice and fewer locks. The dashboard shows her step ("Moeilijkheid").
- the helper: when nothing moved for 6 seconds and a free pair includes a face-down tile, that tile
  is turned over and the pair glows until it is matched; a visible pair glows after 14 seconds
- no shuffling until 8 tiles are gone or 2 wait in the tray (it would waste the good deal)
- more lucky moments (from level 1, up to twice per level) and 10 seconds to keep a combo going

## Closing levels (`RULES.levels.blockedFrom`)
- A level number closes that level and everything above it for everyone (also saved games; the
  daily puzzle and earlier levels stay open, progress is kept). `null` = all open (now). Used from
  1.42 to hold 75+ while the harder levels waited for approval; opened in 1.43.

## The test player and the harder levels (`www/hard.js`, `RULES.hard`)
- **The test player** plays like a person: it only knows a face-down tile once it can turn it over,
  cannot see under a tile lying right on top, respects ice, locks and the alarm clock, takes a
  tray match at once, and otherwise weighs each pair and each tile it could park (how full the
  tray gets, how deep the twins of the waiting tiles lie, how much is free afterwards). It makes
  human mistakes (`temp`) and plans the last tiles exactly when it can see them all (`end`).
- **Fitted to real players** (`tools/sim/calibrate.js`, data in `tools/sim/real.json`): their levels
  50-74 were made again as their phones made them. `strong` plays like Dennisisdebeste (won 89% of
  his tries, the test player 87%), `average` like Mrs. Doubtfire (43%; test player 33%, and it finds
  the same levels hard). `sensible` sits between and is the yardstick.
- **From `measureFrom` (70)** every level is designed (`Hard.make`) so the sensible test player wins
  about `sense` (0.69, what it wins on the old levels 65-74) of first tries.
- **Two targets from 75**: the sensible player (0.55 at 75 to 0.35 at 150) and the strong player, who
  plays like Dennisisdebeste (`strongStart` 0.75 to `strongEnd` 0.55). A level that only suits the
  middle player can be a coin flip or a walk-over for a good one, so both count. Every level is
  measured on fresh games while it is built; one that misses by more than 0.1 is made again
  (up to 3 tries, the closest is kept).
- **Tile size**: a pile from 75 must give tiles of at least `minTile` (54) pixels on a typical phone
  (`minTileBig` 48 every 10th level, which may hold up to 96 tiles).
- **Redo from a level**: a settings event `{ k: 'cfg', t, redo: 75, redoId }` in `plays/cfg-<pid>`
  sends that player back to level 75 once (stars, points and tries from there wiped).
- **From `from` (75)** the levels get harder: target from `start` (0.62) to `end` (0.45) at
  `endLevel` (120). Deals along a known way through, often with a tile lying on its own twin;
  face-down tiles (same share as before) only on tiles you can see but not take yet, never on the
  way out of a "3 waiting" moment; tray pressure kept near the old levels (`risky`); improved step by
  step against the test player. Fair: the strong test player must win at least as often as the
  sensible one. Fewer choices: of 8 piles for the level, the one with the fewest free tiles at the
  start (13 options per move instead of 19). Tower piles (`pile: 'tower'`, tiles right on top of each
  other) were tried too: fewer choices, but more luck than skill, so they are off.
- **The alarm clock (from `clockFrom`, 80)**: one tile shows ⏰ with the moves left; every tile taken
  is a move; at 0 with the clock tile still there, the level is over (logged as `end` with `ck: 1`).
- **Made in advance, the same for everyone**: designing takes seconds, so the levels are designed once
  on the computer (`node tools/sim/build_levels.js 70 269 2`, a few minutes) for one screen shape
  (`Hard.ASPECT`; the pile is fitted to every screen) and ship in `www/levels-hard.js`. They start at
  once. Past the last one, the levels from `cycleFrom` (120) come round again, mirrored and with other
  pictures. After changing hard.js or `RULES.hard`: run the build again (and `GENV` + 1).
  The start of a level logs `pr`, the test player's chance, so real results can be compared later.
  `node tools/sim/measure.js` measures the shipped levels with the three test players (other games
  than the designer used) and prints the curve per band (`tools/sim/measure.json`).
- An easier try (help after losing) plays the usual level made easier; grandma's levels are her own.

## Special tiles and mechanics (everyone)

- level 20+: a gold pair (double points)
- level 30+: the joker 🃏 fits every picture: it takes a tile from the tray away together with its
  twin (with an empty tray it waits and takes the next tile); as the very last tile it gives a bonus
- level 35+: ice 🧊: a frozen tile can only be taken after a tile next to / on / under it is gone
  (thick ice ❄️❄️: two). Level 45+: lock 🔒 and key 🔑: locked tiles open once the key pair is played.
  Placed from a known solution (`Layouts.obstacles`), so every level stays solvable; if nothing at all
  can be taken the ice melts / the locks open by themselves.
- a face-down tile whose twin waits in the tray matches as soon as it is tapped

Piles (1.26): many different shapes, roughly the screen's shape (a random pick among the good fits, so
every level looks different); a pile that comes out too flat is built again. The board is sized on where
the tiles really are and centred: even space left and right, and between the tray and the buttons. Messages while playing show in the title spot of the top bar, so the pile gets all the room.
An upper tile never sits exactly on one tile. Each layer first tries to rest every tile
on 4 tiles below (half a tile shifted both ways, the stepped pyramid look), otherwise on 2 (shifted
sideways or down), so taking a tile always uncovers part of several.

Level difficulty: each deal is judged on 24 computer games and checked with 400 more; if it is far
from the level's target the dealing is tuned (fewer/more "parked" tiles, fewer/more pictures), within a
0.4 s limit. Schudden tries 8 new deals and keeps the one the computer clears most often.

Hearts can carry a short message: from the dashboard (type it, or pick an idea) or in the app (four
ready-made lines, no typing). The heart stays in `hearts/<to>/<from>`; the message goes to
`plays/msg-<to>` (pieces m0..m2 of at most 40 characters, so the database rules allow it) and is
matched to the heart by sender and time.

## News from Apeldoorn (grandma and DennisTEST)

After every won level grandma gets one item: about 4 in 5 are real local news (headline + the short
summary the site puts in its feed, and its photo; the app shows no source or date), 1 in 5 is the next part of a made-up story about
the computer players in her ranking, ending with a little cliffhanger; the next level's top bar
teases what comes next. Before part 5 of a story she gets a memory question (right = a bonus star).
Everything read is in Het krantje (📰 on the home screen), and 💬 next to a computer player in the
ranking shows its story so far. When there is no fresh real news, nothing is shown, unless the news
file has not been updated for 2 days; then the stories fill in.

The real news is filtered on purpose: no accidents, fires, police, illness, politics or columns
(`SKIP_CATS`, `SKIP_IN`, `SKIP_START` in `tools/news.py`; also inside longer words, and no photo whose file name says police or accident). The game reads `news.json` from the `news` branch.
That needs `tools/news.yml` as `.github/workflows/news.yml` in the GitHub repo (a scheduled job).

### Switching it off, or removing it

- **For one player:** on the family dashboard, pick the player and use the ⚙️ settings card
  ("📰 Nieuws uit Apeldoorn" Aan/Uit). The phone picks it up within half a minute.
- **For everyone, keeping the code:** set `VILLAGE.enabled = false` in `www/js/rules.js` and release.
- **Stop collecting news:** in the GitHub repo, Actions → "Apeldoorn news" → Disable workflow
  (or delete `.github/workflows/news.yml`; the `news` branch can then be deleted too).
- **Removing it completely:** delete `www/js/village.js` and `www/js/stories.js` and take them out of
  `FILES` in `index.html`; then remove the few lines that call it: `villageOn()` in `win.js` (the
  `village` reward) and `board.js` (the teaser), `loadNews`/`openPaper` in `main.js`,
  `renderPaperChip` in `screens.js`, `chatBtn`/`.vg-chat` in `social.js`, the `#btnPaper` button in
  `index.html`, the `vg*` texts in `lang.js`, the `.vg`/`.paper-chip` styles in `style.css`,
  `VILLAGE`/`getsNews` in `rules.js`, and `t_village.js`. Remove `tools/news.*` and the copying of
  `tools/` in `release.py`.

## Settings per player (family dashboard)

Grandma mode is made of parts (`PARTS` in `rules.js`), each switchable per player on the dashboard's
⚙️ card: own easier levels, one step gentler, follows the results (last 10 tries), easier after 3
misses, putting tiles back, the helper, no shuffle at the start, more lucky moments, keeping Hint /
Schudden / jokers after level 50, and the news. **👵 Super-omamodus** turns them all on (default: only
grandma; DennisTEST follows her); a part can still be switched off for her, or on for someone else on
its own (PUK: only "follows the results": easier when he loses a lot, never harder than normal).
Each switch is a small event in `plays/cfg-<pid>` (the newest counts; `playerCfg`, `partOn`,
`helpFor` in `rules.js`); the app reads it at start, on return and every 30 s. Combos last 10 s for
everyone.

## The helper's pace (`HELP.care.nudge.pace`)

The glowing pair waits longer when she wins easily (×2.8: about 40 s for a visible pair) and comes
sooner when she struggles or the level already went wrong once (×0.7), based on her last 8 tries.

## Tests

    cd tests && npm install          # once: Playwright (uses Chromium; set CHROME=... if needed)
    node tests/run.js                # all offline tests, with a fake database (about 3 minutes)
    node tests/run.js rescue         # only the tests whose name (or file) contains "rescue"
    JOBS=1 node tests/run.js         # one at a time (default 3 at once)
    node tests/run.js --online       # also the real-database test (test- players, cleaned up)

| file | covers |
|---|---|
| `t_layouts` | the engine (in Node): every level solvable, easier deals, ice/locks, even difficulty |
| `t_play` | tapping fast, face-down tiles, winning levels and the daily puzzle |
| `t_grandma` | tray rescue, easier retries, adaptive difficulty, no early shuffle; none of it for others |
| `t_joy` | messages in the top bar, the helper, win streak, daily gift, face-down match, see-through |
| `t_mech` | gold, joker (also as the last tile), ice, lock & key |
| `t_progress` | tasks and chest, the weekly reset, unlocking backgrounds and the prize, wiping progress, resuming |
| `t_rules` | changing `rules.js` really changes the game |
| `t_ranking`, `t_hearts` | computer players, climbing, hearts with messages |
| `t_screens` | every screen opens, themes, nothing needs scrolling on small phones |
| `t_log`, `t_dash` | the play log and the family dashboard |
| `t_lang` | every text in both languages, the language switch, Mama starts in English, equal layout |
| `t_village` | news for grandma and DennisTEST only, dashboard settings per player, 80/20 news/stories, memory question, Het krantje, 💬, the helper's pace, the news filter |
| `t_finish` | auto-finish: the exact check, the end playing itself from level 50, speed |
| `t_update` | self-update from an old 1.5 app and the current one; a broken update is thrown away |
| `t_online` | (with `--online`) a heart and the play log through the real database |

`release.py` runs the offline tests first and releases nothing if one fails.
