# Dashboard game viewer

The dashboard broadcasts the selected player's recordings at their original event timing, one minute behind wall time. A requestAnimationFrame playback clock advances at 1x; receiving a Firebase batch extends the buffer without painting its final state. Attempt starts and endings are queued at their original wall times, including short retries. Only the selected player's current and upcoming attempts in this broadcast queue are subscribed to through read-only Firebase event streams. Switching players, hiding the dashboard and leaving the page close the relevant streams. The viewer never writes game data or controls the player.

Version 1.50+ recordings contain millisecond active-time events, initial geometry, faces, hidden flags, gold, tray, obstacles, clock and view settings. The renderer uses recorded screen and board proportions, tile size, theme, contrast, highlighting and tool visibility, with the tray above the board. It reconstructs the recorded board rather than downloading a video. Hidden faces stay hidden. Background selection, intermediate scores, menus, celebrations and exact flying-tile effects are not captured and cannot be reproduced from these logs.

The replay begins one minute behind the player. Uploads still batch every 30 seconds or 48 entries on the phone, but these batches no longer set display timing. Known coverage ends at the last contiguous recorded event, never at a batch upload timestamp: a drain can span several chunks. Late data pauses playback without skipping moves; the status reports the actual delay. It may rejoin the one-minute clock across a verified interval without events, but never across a move, pause, ending or attempt transition. The optional reset explicitly rejoins the one-minute position. Background tabs suspend playback and reconnect without silently seeking.

Active-time pause/resume events are mapped to wall time using the existing start/show-game summaries. Missing resume anchors stop the reliable timeline and show a timing warning instead of inventing a pause duration. Missing initial/view data, old unsupported attempts, sequence gaps and corrupt chunks have waiting or unavailable states. No state after a sequence gap is applied.

The tall left game panel sits below the KPIs, beside the activity heatmap, closeness chart and live feed. Leaderboard, hearts and full levels remain on the right. Narrow screens stack the panels.

Validation: `node tests/run.js t_dash` covers chunk validation, per-event timing independent of uploads, pause anchors, delayed level transitions, late batches, buffering, player switching, stale callbacks, unknown faces, recorded screen proportions, responsive layout and absence of database writes. Real recordings are used only for local read-only visual checks and are never committed.

## Watching a previous attempt

Each recent attempt with an `aid` has a numbered playback button in the levels table (start/end summaries are deduplicated by attempt ID). This also works while the player is offline. Selecting an attempt closes the live queue and subscribes only to that attempt. It plays from its first recorded event at 1x with original pauses, without waiting an extra minute. Pause/resume and restart control local playback; return-to-live explicitly rejoins the one-minute delayed broadcast. Dashboard refreshes preserve the selected recording. Switching players clears it. Old attempts without recording IDs and attempts beyond the 30-day retention have no playback button; missing/deleted recordings show an unavailable message. Historical playback never writes to the database.

The offline playback test covers separate attempts of one level, original timing, pause/resume, restart, end-of-recording, selection persistence on dashboard refresh, returning to live, unavailable and expired recordings, player switching and read-only requests.

## Script cache compatibility

GitHub Pages sends a ten-minute HTTP cache lifetime. The dashboard references its replay decoder, playback clock and viewer with content-hash query strings. Updating HTML cannot reuse an older unversioned viewer without `playAttempt`, which otherwise makes attempt clicks throw and appear unresponsive. Dashboard tests verify asset hashes and simulate a cached old viewer while exercising attempt selection. Regenerate these references whenever a replay script changes; keep published and source copies in sync. Hashes normalize line endings so Windows and Pages use the same versions.
