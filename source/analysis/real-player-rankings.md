# Real-player rankings and home layout — 2026-11-09

Dennis approved removal of fake players, a single family leaderboard, inline win rank celebrations, and a home screen that fits without scrolling. Use All-time as the tab label; preserve the existing win styling.

Implemented on wip/real-player-rankings. All-time still sorts by level then points; weekly still sorts by points. Fictional village stories retain their characters independently of rankings. Existing progress and earned rewards are preserved.

Historical weekly standings are not stored: scores only contain each player's latest week. The rollover popup therefore reports recorded personal points without awarding an unverifiable weekly victory. Existing week victories and trophies remain. Reliable future week-winner awards need historical weekly score storage; this change introduces no database writes or rule changes for that purpose.

Released as 1.66 on 9 November 2026 after Dennis requested release. Release commit: `97891f2c`.

## Verification

- Full offline suite: 154/155 passed (368 seconds). The only failure used an earlier test expectation (always three family rows) already loaded by that run before the responsive test was updated.
- Final targeted real-ranking tests: 2/2 passed, including three nearby rows at 375x560 and six after resizing to 390x820, and an inline real-player overtake without a separate popup.
- All five screen tests passed, including no home overflow at 320x480, 375x560, 390x664, 390x820 and 740x360; compact win screens also fit.
- Heart/message tests, weekly rollover, gameplay, replay and language checks passed in the full rerun.
- Visually inspected home, ranking and the final win popup at 375x560. `git diff --check` passes.

Playwright used the installed Chromium 1234 through the CHROME environment variable. No live database tests were run.

## Release verification

Full integrated release suite: **159/159 passed**. The public web bundle reports 1.66 and contains no botEntries generator. Live ranking source matches the release (normalizing line endings). The signed APK (versionCode 82) matches the public download byte for byte. GitHub Pages deployment and APK workflow succeeded.
