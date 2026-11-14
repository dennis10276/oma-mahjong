# Task 18 — Dennis’s verdicts, 14 November 2026

The forty-board catalogue is technically proved, **not approved as a 320+ run**. These eight exact-board verdicts supersede the original easiest/hardest ranking. Three traps were liked: 351 (count the clock/lookalike), 353 (self-locked twin/waiting clock), and 355 (three of a kind/lookalike). Keep their trap logic. 351 and 355 need a lighter finish. 353 is the strongest complete positive anchor: four stars, seven completed attempts, one win, explicitly 320+.

Single-idea examples 350 and 352 were too obvious and gave no AHA; 356 needs one more meaningful chain and a lighter finish. 354 and 357 are held for unreadable specials. The key-delay idea has no positive human verdict yet. A solver proof of a later lock effect did not establish a readable, rewarding chain.

## Exact-board findings

| Lab | Ideas / links | Stars | Completed / won | Dennis’s exact note | Decision |
|---:|---|---:|---|---|---|
| 350 | clockCount / 3 | 2 | 1 / 0 | No AHA really need more chains with diferent ideas, Easy to spot | Replace this single-idea example with a connected multi-idea chain; no 320+ approval. |
| 351 | clockCount + lookalikeChoice / 5 | 4 | 5 / 0 | Good AHA trap. Part after is too hard. | Keep the clock-count/lookalike trap; make the finish easier. |
| 352 | selfLocked / 3 | 2 | 0 / 0 | No AHA too easy needs more chains | Replace this obvious single-idea example with a connected multi-idea chain. |
| 353 | selfLocked + waitForTwin / 5 | 4 | 7 / 1 | Very good AHA moment. 320+  | Keep this exact five-link self-locked/waiting-clock trap as the positive anchor for 320+. |
| 354 | keysLater + savePair / 4 | — | 7 / 0 | The lock is not clearly shown so it doesnt feel rewarding to get the keys yet untill its too late. The locks should show. | Hold: the key-delay lock badge is completely hidden. Rebuild on readable geometry. |
| 355 | lookalikeChoice + savePair / 5 | — | 1 / 1 | Good trap! 320+  too hard after the trap. tune that easier. its more about the traps now. | Keep the three-of-a-kind/lookalike trap for 320+; make the finish easier. |
| 356 | keysLater / 3 | — | 1 / 0 | Trap is fine but a bit too easy. Make 1 more chain in it. After its too hard tune it easier. | Add a meaningful linked idea and make the finish easier. |
| 357 | clockCount + keysLater / 4 | — | 3 / 0 | This is very stupid. You cant see the honey under the tiles so you kind find the solution. Also the keys are just laying there. Not chained at all. | Hold: hidden ice and lock make the reason unreadable; loose keys do not establish a rewarding chain. |

Unselected stars are shown as “—”; no rating is invented. Completed attempts include restarts, not only terminal stuck screens. The original eight lab IDs, board hashes, notes and files are retained in VERDICTS.json. Verdicts do not transfer to siblings or retuned versions.

## Why the old checks were insufficient

The old observer accepted any visible piece of a generic central overlay. It did not measure the actual bottom-right lock/snowflake glyph. On 354 the lock glyph is entirely hidden. On 357 the lock glyph is entirely hidden and only about half the clock ice glyph is exposed. The new clear-specials-v1 gate measures the CSS badge region against higher tiles and their drawn sides, requires at least 65% exposure, and rejects face-down special tiles. New Task 18 construction uses it by default, rejects bad geometry before picture search, and stores the profile for independent final verification. It is a conservative construction rule; it does not move badges or change production rendering.

Under this deliberately stricter profile, 10/92 original checked boards pass all special badges; 2/40 pass in the original main catalogue. This flags rebuild/review work, not automatic human rejection of every flagged board. The old forty-board delivery must not be presented as forty newly readability-certified boards. The per-tile audit is preserved in VERDICTS.json.

The old pressure statistic is conditional on never making a losing choice. At 355 it was only 2.4 pressure parks, yet a natural greedy finish won just 3%; 356 was 2.4 parks and 1.6% greedy wins. Low pressure did not mean an easy finish. The explicit light-after-verdict revision profile lowers parks to 0.5–1.5, caps three-waiting decisions at 5%, and independently requires at least 55% natural greedy tail wins (800 fixed-seed continuations). These are tuning diagnostics, not bot difficulty ratings or predictions of Dennis’s win chance. Original proofs and acceptance bands are preserved.

## Recordings

Imported 31 original-lab attempts; 25 have an end event. The two agent QA attempts are explicitly excluded. Raw localStorage replay chunks and the append-only findings journal are archived under source/analysis/archive/new-ideas-2026-11-14/ (ignored); the derived attempt ledger is in VERDICTS.json. No Firebase writes.

| Lab | Replay attempts | Ended | Reached clock | End reasons |
|---:|---:|---:|---:|---|
| 350 | 2 | 1 | 1 | stuck, open |
| 351 | 6 | 5 | 2 | stuck, restart, stuck, stuck, stuck, open |
| 352 | 1 | 0 | 1 | open |
| 353 | 7 | 7 | 5 | restart, stuck, stuck, stuck, restart, restart, win |
| 354 | 8 | 7 | 5 | restart, stuck, restart, restart, restart, restart, restart, open |
| 355 | 1 | 1 | 1 | win |
| 356 | 2 | 1 | 1 | stuck, open |
| 357 | 4 | 3 | 2 | stuck, restart, restart, open |

The original lab stays at http://127.0.0.1:8266/. Revised examples use new IDs on /new.html so the original notes and results cannot attach to changed boards. No production level placement is made.
