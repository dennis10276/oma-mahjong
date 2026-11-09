# Leaderboard UI options and tablet portrait — 2026-11-09

Three standalone visual previews, with identical illustrative scores and names (not a live database export):

- A: warm family list, one cream panel, clear points and hearts.
- B: green podium for the top three, ranked rows below.
- C: personal weekly summary and progress bars relative to the leading score.

Open preview.html?v=a, ?v=b, or ?v=c. PNG screenshots were rendered in Chromium at 390x844. C naturally scrolls; the no-scroll requirement applies to home. These are design choices for selection, not changes to the released leaderboard. No production player data was written.

Android already declared screenOrientation=portrait. Added game app category and Android's documented compatibility opt-outs for orientation, natural-display orientation, and user full-screen aspect overrides. The signed APK builds with the existing certificate; inspected packaged manifest contains portrait and all three opt-outs. No physical tablet or emulator was available, so runtime rotation has not been verified. Android desktop modes or system-enforced settings can still override application preferences. Requires a fresh APK installation; the in-app web bundle cannot change native manifest settings. Not released.

References:
https://developer.android.com/guide/practices/device-compatibility-mode
https://developer.android.com/develop/adaptive-apps/guides/app-orientation-aspect-ratio-resizability

## Selected direction

Dennis selected A combined with Claude's existing pink family UI. Implemented in the actual leaderboard: one list, avatar profile button in the header, weekly and All-time tabs, and the original family palette (#ffe9f1 to #ffd6e6, #ff7aa8 border, #e85d8f shadow). The win screen retains its existing pink family panel. Small 320px phones place the ranking value under the player name so names stay readable.

New screenshots pink-a-week.png and pink-a-all-time.png are captures of the actual local app with illustrative scores, using the fake database; pink-a-small.png checks 320px width. No production player data was written. Ranking tests 6/6, screen tests 5/5, hearts 2/2 and language tests 4/4 passed. Portrait changes remain on this branch, unreleased.
