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
