# Dashboard game viewer

The dashboard follows the selected player's latest normal or daily attempt using the `aid` in its start/end summaries. It opens one read-only Firebase event stream at `replays/<pid>/<aid>`. Switching players/attempts or hiding the dashboard closes that stream. It never subscribes to the replay root, downloads a player's replay history, writes to Firebase, runs the game engine, or controls the player's game.

Existing version 1.50+ recordings provide initial geometry, faces, hidden flags, gold, tray, obstacles, clock, theme/view settings and subsequent state deltas. The renderer preserves the whole original board footprint and only displays identities the player could see (hidden faces stay hidden unless peeked). The first image waits for recorded view settings rather than guessing the theme. This is a board reconstruction, not a pixel-perfect video capture; transient celebrations and flying-tile animations are not replayed.

Uploads normally batch every 30 seconds or 48 recording entries, plus level start/pause/finish. Offline delivery can take longer. The viewer labels the last update age, pause/end states, truncation and missing chunks. A snapshot is labelled active only while the selected recording is connected, not paused/ended, contiguous, and younger than 45 seconds. Older app attempts without `aid`, expired recordings, missing initial snapshots and corrupt/conflicting chunks have explicit waiting/unavailable states. No state after a sequence gap is applied.

The layout places the game in the tall left panel below the KPIs, with the activity heatmap, closeness chart and live feed stacked beside it. The leaderboard, hearts and full levels table keep the right column. Screens below 700px stack these panels.

Validation: `node tests/run.js t_dash` runs decoder, live-stream lifecycle and existing dashboard checks using synthetic data/FakeDB. New tests also verify stale/late callbacks, background disconnects, unknown faces, missing view settings, pauses/endings, corruption, responsive layout and absence of database writes. A read-only check against an actual ongoing recording confirmed theme, board, tray and incoming state updates.
