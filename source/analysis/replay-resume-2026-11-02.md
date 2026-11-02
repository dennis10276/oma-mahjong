# Replay investigation: Mrs. Doubtfire, level 158

Investigated against live 1.62 and main commit `458cbb0`, using read-only Firebase
requests. Raw exports are in the ignored `analysis/archive/replay-158/` directory.
No production player records were changed.

## What happened

On 2 November 2026 (times below are Europe/Amsterdam), level 158 has three replay IDs:

| Start | Attempt | Recording | Result |
| --- | --- | --- | --- |
| 21:23:29 | 1 | `212e0016-125b-4b35-b034-4b3f0e38fc48` | Complete loss: 73 taps, 5 chunks, 58 of 86 tiles left |
| 21:45:01 | 1 | `68bc3948-64b7-4ac2-a016-093baeb8099b` | Partial duplicate loss: zero taps, starts and ends with the same 58 tiles |
| 21:45:03 | 2 | `75d1469d-108b-4ff7-8c6b-30e764159245` | Complete win: 176 taps, 10 chunks, all 86 tiles removed |

Both real attempts have contiguous chunks, initial boards and endings. The odd
recording is an ended board reopened after leaving the app, rather than evidence
of missing uploads. The decoder's generic "older saved game" warning also covers
closed recordings rejected by `replayBegin`; it does not establish an old app version.

## Cause and fix

`endLevel` closes the replay, but a loss keeps its board visible for the retry/review
dialog. `G.done` remains false. `saveCur`, including the calls from hide/pagehide,
therefore persisted that terminal board with `rp.closed: true`. On reload, `begin`
treated it as a resumable board, retained the attempt number/counters and logged a
resumed start. `replayBegin` correctly rejected the closed recording, but created a
new partial recording instead. `checkStuck` then logged the same loss again.

The fix clears the resumable save on every ending and prevents a logged attempt
from being saved again. The loader also rejects existing closed saves produced by
older builds. A return after a loss starts a fresh board and increments the attempt
number. Active unfinished games continue to resume normally.

A separate connection weakness was found in code: a hanging replay fetch held
`replaySending` until the browser eventually failed it, suppressing all retries.
Replay uploads now abort after 15 seconds, retaining the identical queued chunk
for retry. Returning to the foreground also triggers an upload attempt. Existing
stable chunk IDs, immutable timestamps, queue limits and retention are preserved.
This weakness was not demonstrated as the cause of the level-158 anomaly.

## Verification

Regression coverage in `tests/t_replay.js` exercises:

- Level-158 full-tray loss, pause/pagehide, reload and fresh attempt, with no duplicate loss.
- Rejection of an existing closed save from a previous build.
- An actual stalled fetch with AbortSignal, preserved queue content and identical foreground retry.
- An unfinished game played with database requests failing, saved and reloaded while
  disconnected, then reconnected and completed with exact final-state reconstruction.
- Existing lost-acknowledgment, expiry, storage limit, clock, help and anonymous-player cases.

Validation on Windows with installed Chrome: all 149 offline tests passed (384 s).
The focused recorder suite also passed 10/10 after strengthening the resume test
to fail database requests through reload. `git diff --check` and JavaScript syntax
checks passed. An initial combined replay run hit a dashboard timing assertion;
the unchanged dashboard check passed in isolation and in the full suite.

No replay schema or Firebase rule changes are required. Existing historical duplicate
records are left intact; this fix prevents new ones. The original level-158 loss and
win are already available as complete recordings.

## Follow-up: Dennis, level 161

Read-only inspection of Dennisisdebeste's five attempts found a different case.
Raw exports are in ignored `analysis/archive/replay-dennis-161/`.

- Attempts 1, 3 and 4 have complete losses; attempt 5 has a complete win.
- Attempt 2 (`23cc69be-0d5c-4229-ae5e-214c8e4e5a3d`) has all ten chunks,
  sequences 0-9, and 153 taps. It ends with a pause on 26 October at 01:40:20
  Europe/Amsterdam, with ten tiles remaining. Neither summaries nor replay contain
  an ending, so it cannot honestly be classified as a completed win/loss.
- On 28 October, the next recorded starts are levels 50, 61 and 23, followed by
  level 161 attempt 3. Starting another level uses the single resumable save slot.
  There is no recorded resume of attempt 2.
- The dashboard decoder and wall-clock timeline both accept every recorded frame
  from all five attempts: no missing/conflicting chunks, truncation or missing
  pause/resume timing. Attempts 3 and 4 include actual background pauses.

The finished-board fix applies to all players, but does not change this abandoned
attempt into a completed recording or recover an ending that was never recorded.
There is no evidence of missing network uploads in these level-161 records.
