# Tablet tapping and portrait handling — 2026-11-09

Status: implemented on `wip/leaderboard-options-portrait`, **not released**. No published files were edited. Physical iPad and Android-tablet testing is still needed.

## Wrong-tile report

The code has a reproducible cause, shared by every platform rather than specific to iPad Safari. `pickTile` previously redirected a direct hit on a blocked tile to a nearby free tile. In empty space it preferred the greatest drawing order rather than the nearest tile. Its assistance radius scaled to 16% of tile width (24 CSS pixels at the 150px tile-width cap), including a square corner allowance.

`www/js/main.js` now keeps direct hits on the uppermost tile, including blocked tiles, so the existing blocked-tile explanation runs instead of an unrelated move. Only empty-space taps receive assistance: the nearest free tile within a circular 6–10 CSS pixel allowance, with drawing order breaking equal-distance ties. Pointer-down timing and independent fingers are unchanged.

`tests/t_tapping.js` covers blocked and overlapping direct hits, removed tiles, nearest/tied candidates, blocked candidates, corner misses, and small/large assistance distances. Running the two geometry tests against the previous picker reproduces four failed assertions; the updated picker passes all assertions. A Chromium touch test checks visible tile centres and the actual pointer listener at 768×1024, 1024×768 and 820×1180, including live resizing. This establishes the selection defect and coordinate behavior; it cannot establish how often people mistap on a real iPad or validate Safari-specific behavior.

## Android portrait

The existing portrait opt-outs were on this branch already. Two had been nested under `activity`; Android documents them as application-level `PackageManager.Property` settings. Moved both to `application` alongside the existing user-fullscreen opt-out:

- `android.window.PROPERTY_COMPAT_ALLOW_ORIENTATION_OVERRIDE = false`
- `android.window.PROPERTY_COMPAT_ALLOW_DISPLAY_ORIENTATION_OVERRIDE = false`
- `android.window.PROPERTY_COMPAT_ALLOW_USER_ASPECT_RATIO_FULLSCREEN_OVERRIDE = false`

`MainActivity` retains `android:screenOrientation="portrait"`. The current build targets API 34, so no API-36 migration flag was added. Android desktop windowing and future target-SDK policies still have their own orientation rules; these settings cannot promise portrait in every system mode. Android manifest changes require an APK update and do not affect iPad.

References: [compatibility behavior](https://developer.android.com/guide/practices/device-compatibility-mode), [application-level property definitions](https://developer.android.com/reference/android/view/WindowManager#PROPERTY_COMPAT_ALLOW_ORIENTATION_OVERRIDE), [display-orientation property](https://developer.android.com/reference/android/view/WindowManager#PROPERTY_COMPAT_ALLOW_DISPLAY_ORIENTATION_OVERRIDE).

## Validation

- Targeted tapping/covered-tile checks: 4/4 passed.
- `python source/tools/build_apk.py`: built and verified with the existing signing certificate and matching bundled assets.
- `aapt2 dump xmltree`: verified portrait and all three false-valued properties under `application` in the packaged APK.
- APK candidate: `source/android/build/OmasMahjong.apk` (ignored build output). It retains the current 1.66/82 metadata; this is a development candidate, not a new published release.
- Full offline suite: `node source/tests/run.js` with local Chrome, **162/162 passed** in 355 seconds. Fake database only; no production player data was written.

Before release, test real finger taps near blocked/free tile edges and gaps on iPad Safari/home-screen mode and an Android tablet. On Android, check cold start in both device orientations, rotation during a game, return from the background, and available OEM compatibility settings. Progress and board identity should survive. Release/versioning and distribution remain separate work.
