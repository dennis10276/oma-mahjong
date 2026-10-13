# Compact attempt recording — version 1.50

Recording is enabled locally for every named player, on every normal, care and daily level.
There are no player-facing controls or extra steps. Existing anonymous visitors do not get
detailed replay recording. Version 1.50 publishes the recorder with the replay database rules and daily cleanup workflow.
Past attempts cannot be reconstructed retrospectively.

## Recorded information

- A unique attempt ID, linked from existing start/end/help summaries and retained on resume.
- Initial tile positions, identities, hidden flags, tray, peek, obstacles, clock, move count,
  gold tiles, track, easing and effective help settings. This is an actual board snapshot,
  so replay does not depend on a later level table or random number generator.
- Timestamped accepted taps, blocked reasons, ignored taps, missed-board taps and touch position.
- State deltas after actions, including automatic matching, hidden-tile reveals and clock moves.
- Hint targets, helper reveals, shuffles with the resulting deal, rescue, obstacle relief,
  automatic finish, lucky-tile cues, clock tutorial acknowledgment and help-setting changes.
- Viewport, board size/origin, tile size, theme, contrast, numbers and available toolbar.
- Pause/resume and ending. Times are active elapsed milliseconds; they exclude background time.
- Counters now persist with the board across close/reopen. Older saves lacking a replay begin an
  explicitly partial recording at their saved position.

The initial snapshot includes hidden identities to establish the ground truth for later analysis.
An analyst must derive what was observable from hidden flags, peek/helper actions, occlusion and
covered-tile x-ray taps. Knowing the stored deal does not mean the player knew or remembered it.
The reader reconstructs states; it does not yet judge decisions or prove a guess was necessary.

## Phone work and delivery

On input the recorder appends a compact row and compares small board arrays to record deltas.
It runs no solver and starts no replay upload from the tap handler. The existing board save also
carries the pending replay tail and counters. No screen images or continuous capture are used.

Rows are queued after 48 entries or 30 seconds, and at start, pause, finish and page hide.
Each queue item is a separate small localStorage value; offline play does not repeatedly rewrite
the entire queue. Uploads run asynchronously in the background and retry after reconnect/startup
and every minute. Failed recording/storage/upload never blocks play or displays an error popup.

Phone limits:

- Offline queue: 524,288 characters including its index (roughly 1 MiB of UTF-16 value storage).
  Oldest replay chunks are removed when full. Dashboard summaries use their original queue.
- Attempt event payload: 65,536 characters; an explicit truncation row marks an unusually long
  recording. Initial board/envelopes are additional. At most 1,024 pending rows are retained.
- Individual chunk data: at most 16,384 characters and 48 rows.

The queued chunk ID stays constant during retries. Chunk sequence numbers detect gaps and
conflicting restored tails following an abrupt crash. Missing data, truncation, legacy partial
saves and unfinished attempts are reported; none count as a complete replay. An abrupt process
kill can lose the most recent unsaved tail, just as it can lose an unsaved move.

## Storage measurements

`tools/measure_replays.js` uses a fake database and archived live 1.49 boards (SHA-256
`79db375bc2ece069a0bc1224ebc4d9fd7722e4c979ddf6ce4e31ebdde579d305`). It replays stored winning
routes on levels 80, 84, 88, 90 and 150, with and without 100 additional legal free peeks.
These are scripted examples, not a measured population average.

| Example | Replay bytes |
| --- | ---: |
| Winning routes without extra peeks | 12,685–16,702 |
| Same boards with 100 extra peeks | 18,942–23,084 |

Bytes include chunk envelopes and exclude database keys, protocol overhead and existing summary
events. A separate integration test with resume, hint and shuffle used approximately 11 KB.

For planning, budget 25 KB per attempt:

| Total attempts across all players | Per day | Retained for 30 days |
| --- | ---: | ---: |
| 10/day | 0.25 MB | 7.5 MB |
| 100/day | 2.5 MB | 75 MB |
| 1,000/day | 25 MB | 750 MB |

Checked 2026-10-13: [Firebase pricing](https://firebase.google.com/pricing) lists **1 GB stored,
10 GB downloaded/month and 100 simultaneous connections** on the free Spark plan for Realtime
Database, which is the service used here. This is not a Cloud Storage bucket. Firebase's
[billing documentation](https://firebase.google.com/docs/database/usage/billing) explains that
download usage includes protocol/encryption overhead; raw JSON size is not the console usage meter.

A read-only aggregate check of existing live summaries on 2026-10-12 at 23:44 UTC found seven
registered players and 552 fresh attempts over six available calendar dates (2026-10-07–12).
That is 92/day, projecting **69 MB retained** at the 25 KB planning budget. The busiest observed
date had 171 starts; sustaining that rate projects **128.25 MB**. Existing scores/plays responses
were about 0.33 MB in total, but other branches, database indexes and overhead were not measured.
These are capacity estimates from current usage, not a Firebase console quota audit or a promise
for unlimited growth. At 1,000 attempts/day, 750 MB before overhead leaves much less headroom.

Replays live under `replays/<pid>/<attempt-id>/<chunk-id>`, with one immutable `createdAt`
timestamp alongside the chunks. This metadata adds only a few bytes per attempt to the estimates.
The dashboard only loads `plays/`,
so opening it does not download replay history. The local database rules permit bounded chunks
and identical retries, while preventing an existing chunk from being replaced with different data.
The replay database rules are deployed with version 1.50.

## 30-day retention

Detailed attempts expire **30 days after recording begins**. Each upload writes the unchanged
birth timestamp with its chunk atomically. Retries and resuming do not extend that deadline.
The phone discards expired queued chunks rather than re-uploading them after a long offline period.
Resuming a saved game after expiry preserves its board/counters and starts a new, explicitly
partial recording. Existing dashboard summaries and game progress have no new deletion policy.

`tools/prune_replays.js` lists player keys shallowly, then queries only expired attempts using
the `createdAt` database index, ten attempts at a time. It validates every response before deleting
whole attempts and stops on errors or after 10,000 deletions per run. Recent data is protected
independently by the Firebase server's clock and expiry-only delete rule. No admin credential is
needed for this restricted operation. Cleanup downloads each expired attempt once, rather than
downloading everyone's complete history; these reads also count toward monthly downloads.

The prepared GitHub workflow `tools/replay-retention.yml` runs daily at 03:41 UTC. `release.py`
copies it into `.github/workflows/` during a future deployment, alongside the cleanup script in
`source/tools/`. The GitHub repository is public; standard hosted runners are free for public
repositories ([GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)).
This avoids paid Firebase scheduled Cloud Functions and performs no cleanup work on phones.

Deletion occurs at the next successful daily run after expiry (normally at 30–31 days), rather
than at the exact expiry instant. GitHub jobs can be delayed or fail, and inactive repository
schedules can be disabled; retention depends on successful runs. Failed cleanup makes the job fail
visibly. The workflow and replay database rules are installed with version 1.50.

```text
node tools/prune_replays.js           # dry run; one batch/player, flags possibly incomplete counts
node tools/prune_replays.js --apply   # delete verified expired attempts only
```

## Responsiveness measurement and validation

A desktop Chromium test with 6× CPU throttling measured 200 recorder append/delta operations at
0.24 ms each on average. This excludes board drawing, local save/upload work and animation, and
is not a measurement on the players' actual phones. Results are in `replay-footprint.json`.

Offline browser tests cover resumed identity/counters, exact reconstructed final state,
shuffle/help/rescue, clock failure, empty-tray preservation, missing/conflicting chunks,
lost upload acknowledgments, offline eviction/truncation, anonymous exclusion and full storage.
All use FakeDB; no production player records are read or written by these tests.
The full offline suite passed 100/100 tests before the retention addition. After that addition,
all 11 replay/retention tests passed, including old offline uploads, unchanged saved boards,
the exact expiry boundary, pagination, dry runs, failed requests and unsafe-response refusal.
`node tests/replay_rules_emulator.js` also passed against Firebase's actual local Realtime
Database emulator 4.11.2. It compiles the rules and verifies atomic PATCH uploads, identical retries,
immutable birth/chunks, rejection of recent deletion, indexed cleanup without admin credentials,
and rejection of stale uploads after deletion. No production writes are used.

To inspect an exported single-attempt collection locally:

```text
node tools/replays.js attempt.json
node tools/replays.js attempt.json --frames frames.json
```

The reader reports completeness and can export every recorded board state for later comparison.
Version 1.50 includes a fresh APK. Game rules, level designs, clock budgets and player progress
are preserved from live version 1.49; the separate unpublished difficulty work is excluded.

Firebase console usage checked on 2026-10-13: Spark, 270.95 KB stored, 44.44 MB downloaded
this billing period, and six peak connections out of the free limit of 100.

Release verification: 103/103 offline tests passed on the preserved live 1.49 boards.
The published 1.50 app uploaded a complete winning replay to real Firebase; its temporary
test profile, summaries and replay were deleted afterward. The daily GitHub cleanup job
succeeded. Seven approved anonymous test histories (22 events) were removed; DennisTEST
and all seven named profiles were kept. See `release-1.50.json`.
