# Oma's Mahjong

Ad-free Mahjong solitaire for Android, in Dutch.

- `OmasMahjong.apk`: the app, ready to install
- `www/`: the game itself (HTML/JS, open `www/index.html` in a browser to play)
  - `tiles.js` tile pictures and themes, `audio.js` sounds, `layouts.js` piles and rules (solver, difficulty)
  - `js/` the game, loaded in this order (listed in the boot loader in `index.html`):
    `core.js` settings/state/helpers, `fx.js` particles, `update.js` self-update, `screens.js` menus and pop-ups,
    `board.js` playing a level, `extras.js` tasks/stats/special tiles, `telemetry.js` play log for the dashboard,
    `social.js` rankings, family, hearts, `win.js` the win screen and rewards, `main.js` start-up and buttons
  - `style.css` all styles, in numbered sections
- `site/dash/`: the family dashboard (live play data from the database): stuck alert with a
  "send a heart" button, desktop notifications, how close she got, all levels and a live feed
- `tests/`: the test suite (see below)
- `firebase/rules.json`: database rules
- `android/`: the small Android wrapper (WebView) + `build.sh` (aapt2/javac/d8/apksigner, no Gradle needed)
- `android/keystore/`: the signing key + password. KEEP THESE SAFE: updates must be signed with this
  same key or Android refuses to install them over the old version (and grandma would lose her progress).
- `site/`: the public download page (GitHub Pages)

To make an update: edit `www/`, then `python3 release.py <version> --deploy` (see below).
Building the APK needs Android SDK build-tools 35 + platform 34 (set ANDROID_SDK).

## Updates (from version 1.5)

The app updates itself: on start (and when it comes back to the foreground) it checks
`play/bundle.json` on the website. A newer version is downloaded and kept on the phone,
then used from the home screen on. If a downloaded version does not start, the app falls
back to its built-in version and skips that update.

    python3 release.py 1.6 --deploy   # phones update themselves, and the download page
                                      # always gets a fresh APK of the same version

## Extra help for grandma

Grandma (her player id, or any name starting with "Oma") gets help the others do not get
(`careMode()` in `www/js/core.js`):
- a full tray is not game over yet: once per level she can put the tiles back (costs one star)
- after failing a level twice, the next try quietly gets a deal with more matching pictures
  (`Layouts.ease`), and after four failed tries even more, without face-down tiles

## Tests

    cd tests && npm install          # once: Playwright (uses Chromium; set CHROME=... if needed)
    node tests/run.js                # all offline tests, with a fake database (about 4 minutes)
    node tests/run.js rescue         # only the tests whose name contains "rescue"
    node tests/run.js --online       # also the real-database test (test- players, cleaned up)

`release.py` runs the offline tests first and releases nothing if one fails.
