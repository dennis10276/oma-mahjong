# Where things are in `www/js/`

No build step: the game loads classic scripts one after another, in the order of `FILES` in `www/index.html`.
All files share one global scope. Each moved file starts with a `// uses:` line naming the files it calls.
Files in the first group are read by Node tools or the dashboard by path, so they stay put.

## Stay in place
- `../tiles.js` tile pictures and themes (also loaded by the dashboard)
- `../layouts.js`, `../hard.js`, `../levels-hard.js`, `../levels-early.js` engine, hard levels, level data (Node tools read them)
- `rules.js` every tunable number (the dashboard loads it)
- `lang.js` every text, Dutch and English
- `board.js` playing a level: pile, tray, tapping, matching, the helpers Spieken and Steen terugleggen
- `specials.js` gold pair, joker, ice, lock and key
- `main.js` buttons, touch, start-up; always the last file

## core/
- `audio.js` sounds and music (loaded early, before the level data)
- `util.js` the `$` lookup, dates, small helpers, game messages, floating score, flash, bee
- `save.js` saved progress `S`, `save()`, `APP_VERSION`, stars, bonus, counters
- `fx.js` confetti, sparkles, flying emoji
- `update.js` self-update from the website
- `screens.js` home, levels, calendar, pop-ups, language, intro
- `telemetry.js` play log for the dashboard

## features/ (one folder per part; a part's screen is in its `screen.js`)
- `shop/catalog.js` coin prices, legacy unlock IDs and economy rules
- `shop/shop.js` wallet, one-time save migration, shop actions, and helper guardrails (both scripts load before `core/save.js`)
- `intro.js` the intro films that explain a mechanic
- `win.js` the win screen and the rewards after it
- `tips/tips.js` the "Wist je dat?" tips on the home screen
- `looks/looks.js` backgrounds, themes, applying them
- `shop/screen.js` the Winkel screen: header, four swipeable tabs, `shopPage(tab)` builds one tab page
- `looks/screen.js` Zonnebloem goal on home, the themes screen, the sunflower unlock pop-up
- `trophies/trophies.js` the trophies and when they are earned
- `trophies/screen.js` the prize cabinet: statistics and the trophy grid
- `settings/settings.js` the settings pop-up and wiping all progress
- `rewards/tasks.js` the three daily tasks and their chip
- `rewards/chest.js` the chest that the three tasks open
- `rewards/lucky.js` the lucky moment in a level
- `rewards/gift.js` the daily gift
- `rewards/grit.js` Grit, Lucky lookahead, Momentum and board-helper logic
- `rewards/streak.js` days in a row (`streak()`) and levels won in a row (`winStreakStep()`)
- `grandma/grandma.js` Super-omamodus: `careMode`, `part`, `help`, settings from the dashboard
- `redo/redo.js` "redo from level n", set on the dashboard
- `restore/restore.js` take over an existing player on a new phone with a code from the dashboard

## features/family/
- `week.js` the week, my points, result of last week
- `ranking.js` ranking list and screen, rows, the family at a glance, the climb animation
- `presence.js` who is online, uploading my score, my id
- `passed.js` "someone passed you"
- `profile.js` avatar frames, avatars, asking for the name
- `hearts.js` hearts with a message between family members
