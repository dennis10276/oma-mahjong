# PUK long recordings and source storage guards

Read-only investigation against 1.63 on 3 November 2026. Raw exports are in ignored
`analysis/archive/puk-storage-2026-11-03/`. No player records were changed.

## Findings

PUK's level 82 attempt 13 (`7fc7f543-19a6-49fa-8c9a-501fa1dcf66c`) has 78.214
seconds of recorded active time and six chunks, totalling 4,460 UTF-8 bytes in the
Firebase response. Saved playback instead spans 58,863.36 seconds because its
timeline includes the overnight background pause. No frames/video were being
stored throughout those sixteen hours.

An older example at level 58 spans about 40.6 hours of wall time but only 239.171
active seconds and 10,197 bytes. Both recordings have contiguous chunks and endings.
The recorder already limits event characters, pending rows, individual chunks, the
offline queue and retention. It did not separately cap total UTF-8 bytes including
JSON/envelope overhead or total chunks per attempt.

## Changes

- Source recorder: 128 KiB total UTF-8 data per attempt, including initial board,
  metadata, envelopes and chunk keys, plus a 128-chunk maximum. One chunk and 1 KiB
  are reserved for the cutoff marker. Budget is charged only when chunks commit
  locally; identical upload retries do not spend it again.
- The budget counter and cutoff persist in the existing saved game. Repeated
  resume/drain calls cannot restart recording once capped. Gameplay and saved
  progress continue. Old saves lacking a byte counter use a conservative upper
  bound; a legacy recording already above that bound stops adding data.
- No polling frames or idle heartbeats are introduced. Twenty idle hours with no
  changes/events consume zero extra replay chunks in the source regression test.
- Saved playback uses active event timestamps, so actual recorded moves remain
  watchable without replaying overnight background gaps. Live retains wall-clock
  timing. Existing stored recordings benefit without being rewritten or deleted.
- Viewer script cache revisions are updated with their contents.

## Validation

Browser regressions cover byte and chunk limits, UTF-8/JSON escaping overhead,
one cutoff marker, actual serialized database size, save/reload after cutoff,
continued play, idle storage, legacy budget handling and overnight archive seeking.
Viewer test clock steps now await animation frames instead of relying on a fixed
sleep; the previous approach could intermittently lose a step under test load.
All eight viewer checks passed, including unchanged live timing and transport.
All 20 replay/retention checks passed. The actual exported level-82 recording now
has a 78,214 ms archive timeline, with all its frames and its original ending
retained. JavaScript syntax and `git diff --check` passed. The offline-resume check
now waits for shuffle readiness and the recorded ending/uploads; the lost-connection
fixture restores its normal request timeout before the successful retry.

No Firebase rules, retention policy, boards or scoring changes are required.
