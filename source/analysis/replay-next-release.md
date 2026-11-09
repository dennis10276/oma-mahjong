# Replay fixes approved for the next release

## Authorization and delivery

On 6 November 2026 Dennis requested: "Let it get published in the next release by another agent".
This explicitly approves inclusion of the prepared replay changes in the next ordinary
release. No standalone release is requested. This document and the pending section in
`AGENTS.md` are the handoff to that release agent; the implementation was subsequently shipped in 1.66 (see Completion below).

Implementation commit: `c345840` (full title: "Bound replay storage at the source and
skip background gaps in saved playback"). It is pushed to
`origin/wip/replay-storage-guards`, based on version 1.63. Main was at version 1.65
(`9dc5e00`) when this handoff was written.

## What must ship

- Source recorder (`source/www/js/telemetry.js`): a 128 KiB serialized UTF-8 budget
  and 128-chunk limit per attempt, including metadata/envelopes/keys. Reserve space
  for an explicit cutoff marker. The budget/cutoff persists across resume, and play
  and saved progress continue after detailed recording stops.
- Saved dashboard playback skips app-background gaps using recorded active time.
  Live playback keeps actual wall-clock timing. Both viewer JS cache hashes in
  `source/site/dash/index.html` must match the final integrated contents.
- Regression coverage and findings in `source/analysis/replay-storage-2026-11-03.md`.
  Test timing fixes are included so replay checks await actual browser/game readiness.

These changes require no Firebase rule changes. Keep the 30-day retention policy.
There is no duration cap in minutes, and no existing player history is to be deleted
or rewritten. The recorder already writes only events, so background idle time does
not accumulate chunks. The duration display was the immediate confusing behavior.

## Evidence and validation

PUK's level 82 attempt 13: about sixteen hours of wall-clock pause, but only 78.214
seconds of recorded play and 4,460 bytes. The prepared archive timeline retains all
33 frames and the ending, with 78.214 seconds on its transport.

A read-only audit on 3 November found 2,194 stored player attempts, none exceeding
either new cap. Largest serialized attempt was 27,089 bytes; most chunks was 22.
Raw audit output remains in ignored local `source/analysis/archive/replay-storage-audit-2026-11-03/`.

Mrs. Doubtfire's level 175 attempt 2 (`ba82079c-9110-469e-9d19-208e1c0e24af`)
demonstrates the same issue in live 1.65: she left on 5 November at 13:45 Amsterdam
time, then resumed on 6 November at 21:36. The exported recording has 122.642 seconds
of active time and uses 13,096 bytes; the existing wall-clock timeline spans
114,771.058 seconds. It is unfinished at the inspected snapshot. Live dashboard
scripts were checked on 6 November and still lack the pause-skipping change.

Focused checks passed on the implementation branch: 20/20 replay/retention tests and
8/8 dashboard viewer tests. JavaScript syntax and diff whitespace checks passed.
These are historical focused results, not a substitute for checking integration with
current main and its newer level-replay features.

## Release agent checklist

1. Pull current main and integrate `c345840`, e.g. cherry-pick it from the remote branch.
   Preserve changes made since 1.63, particularly 1.65's player-facing level replays.
2. Regenerate the content hashes for `playback.js` and `watch.js` if integration changes them.
3. Run the full offline suite (`node source/tests/run.js`), including the storage-cap,
   overnight playback, source idle, offline resume and live timing regressions.
4. Include the changes in the next version using the normal `source/release.py`
   release process. Verify the deployed bundle and both dashboard viewer scripts.
5. Remove the pending section in `AGENTS.md` and record the actual version and
   deployment verification below. Do not request Dennis's approval for these changes again.

## Completion

Released in **1.66** on 9 November 2026, release commit `97891f2c`.

- Integrated `c345840` as `91e0bd21`, preserving 1.65 level replays; no conflicts.
- Full offline release suite: **159/159 passed** in 343 seconds.
- Built APK version 1.66 / versionCode 82; existing signing certificate and bundled assets verified.
- GitHub Pages deployment and APK workflow succeeded.
- Public `play/version.json` and `play/bundle.json` report 1.66.
- Live `dash/playback.js` and `dash/watch.js` match integrated source (normalizing line endings); their tested cache references shipped. Live APK bytes match the signed local release exactly.
- Pending approval section removed from AGENTS.md. No Firebase rule changes or player-history deletion.
