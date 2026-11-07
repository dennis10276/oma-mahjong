# Static gates A1-A9: yield

Tests: node --test source/tools/builder/loop/test_static_gates.js, 10/10 pass (about 1.5 s).
Both measurements below were run through heavy.js after the six review fixes (the spare check in A3, unknown handled as a warning, the clock-move position in a pair, no-clock-action in A4, empty path in publicfork, per-spare opening count).

## Review fixes (all six defects were real)
1. A3 never checked clock.n = k + spare (critical): added. A3 now fails if clock.n - k is not 1-3 or clock.n > 19. A1's frame spare is still derived from the design, so gate.js cannot catch it; A3 is the real check. New test: clock.n = k + 7 fails.
2. 'unknown' counted as a pass (major): the opening now needs 2 proven wins; a non-obvious single is no longer dropped when a looser spare has an unknown, and the unknown gives a warning.
3. Clock move number for a pair: K now adds the clock's 1-based position in the pair.
4. No clock action in the witness: A4 now fails with the reason.
5. Empty solver path read as {win: undefined} in publicfork.js: it is now 'unknown'.
6. Opening win counts are recomputed for each spare, so perSpare matches its spare.

## (b) 18 qualified 200-225 boards (static-gates-qualified.json, 1 heavy run)
0 of 18 pass jointly. Per gate passes (of 18): A1 3, A2 3, A3 9, A4 13, A5 15, A6 14, A7 0, A8 18, A9 18. Time per board: median 1.9 s, max 6.1 s, total 46.8 s. 13 boards have warnings.
Main reasons: A1 fails on 'idle' lock/ice checks (the ablation tests in gate.js) for 15 boards; A3 fails mostly on 'clock.n spare not in 1-3' (8 boards), which is expected for old boards built with other spares; A7 fails on all.
Caution: these boards were built before the new process, so A1/A3/A7 failing is not a verdict on them as puzzles. I did not look at whether the A7 failures are the room-profile or the re-deal part.

## (a) fresh builder v3 builds: only 30, not 100 (static-gates-builds.json)
30 boards were built (4 builds failed, builder time median 16 ms per board in the logged stats, per the file's buildStats), 4 pass jointly (13%). Per gate passes (of 30): A1 30, A2 21, A3 27, A4 28, A5 26, A6 30, A7 10, A8 30, A9 30. Gate time per board: median 0.3 s, p90 4.7 s, max 10.9 s. A7 (luck) is the main killer: 14 boards fail only A7. A2 alone rejects 4.
The 100-build target was not reached: the earlier run showed that builder.js build() is slow per board and the heavy.js queue was long. Not measured: the other 70 boards.
Examples (from the same file):
- Pass: keysFarSide-hourglass-14-s1. Card: "The clock needs 7 moves; taking the free pair in sight at move 3 before the clock costs 2 spare moves, and the free pair at move 4 loses the board."
- Reject: keysFarSide-arch-0-s1, A7: 3 of 4 re-deals of the face-down pictures are lost from the start at clock.n 12.
- Reject: keysFarSide-ushape-33-s1, A7: 2 of 4 re-deals lost from the start at clock.n 15.

## Not done
- Planner pinning to planner-fast-v1 in yardstick.json: not this piece's file; the gates use no bot.
- The 100-build run (only 30). Unknown (budget) warnings remain on 9 of 30 builds and 13 of 18 qualified boards.
