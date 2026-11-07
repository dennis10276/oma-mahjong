# Trace gates and counterfactuals: timing and checks (2026-11-07)

Pieces: `source/tools/builder/loop/traces.js` (B1-B7), `counterfactual.js` (C1-C4). Both ran through `loop/heavy.js --label trace-gates`.
Boards: rows 0 and 1 of `source/analysis/builder/data/qualified-200-225.jsonl` (ids 58a099f8cfe6eb4d, level 200, and 70bde28d4c0922c5, level 201), spare 2, one core, PC shared with other jobs.

## Which bot captures the traces
Capture calls the bot module directly, because the meter drops the per-tap decisions. It uses `family-key-memory-v1-fast`
(fingerprint 63be677e...), the pinned family ruler. Every result carries `ruler.fingerprint`, and both runs below printed 63be677e.
A yardstick pinning the slow 5372bd4e... or Codex's d362e85f... falls back to the fast bot (zero drift, Gemini Task G3). Any other pin is refused.
The captured D equals the meter's first CURVE call: board 0 gave D 9.5 from the trace (same as the meter's 9.5 in the check below).

## Wall time, 40-campaign captured family run (`node traces.js <file> <row> 2 40`)
| board | wall | capture | analysis (engine classify) | RSS | attempts |
|---|---|---|---|---|---|
| level 200 | 5.9 s | 4.5 s | 1.3 s | 365 MB | 380 |
| level 201 | 1.8 s | 1.1 s | 0.6 s | 250 MB | 228 |
Cost is a few seconds per board and spare, well under the 20-40 s the synthesis assumed. The analysis part grows with the number of distinct engine states.

## Wall time, counterfactuals C1 and C2/C3 (`node counterfactual.js <file> <row> 2 --nocache`, cold, nothing cached)
| board | total | C1 (80 campaigns x family + reference) | C2/C3 (planner-fast-v1, as is and face-up) |
|---|---|---|---|
| level 200 | 34.9 s | 17.6 s | 17.2 s |
| level 201 | 33.0 s | 3.9 s | 28.9 s |
The planner step now uses `planner-fast-v1` (fingerprint e686e095..., Gemini G4), 6-17 s per rating on these boards, and cached results are reused afterwards.
C4 (ablation, 160 campaigns per special) was not timed; it needs one rating per special on the ACCEPT block.

## Results on the two boards (spare 2). Not a calibration, just proof that the tools run.
- Level 200: B1 false (0), B2 false (0), B3 true (0.27), B4 true (1), B5 true (0.07), B6 false (0.95), B7 report 0.04. C1 true (key memory 9.6, reference 9.6), C2 true (planner 4.88, face-up 1.02), C3 false (0.21).
- Level 201: B1 true (1), B2 true (0.56), B3 false (0.05), B4 true (4), B5 true (0), B6 false (0.46), B7 report 0.75 (inflated). C1 true (6.46 vs 6.46), C2 false (planner 5.3, face-up 19.93: S untrusted), C3 true (3.76).
Source: `tr0.json`, `tr1.json`, `cf0.json`, `cf1.json` in the temp dir (stdout of the commands above, not kept in the repo).

## Checks and findings
- C1 gave identical D on both boards. This is not a bug: direct meter calls on 8 qualified boards at spare 2 show 5 identical and 3 clearly different (rows 3, 4, 5: 12.8 vs 15.43, 7.58 vs 12, 2.15 vs 11.43), so C1 does discriminate.
- Face-up is `design.down = []` with clock.n unchanged. Covered tiles still hide their pictures (geometry), so it is not omniscience. engine.clockShortest was the same face-up and as is on both boards (3 and 9).
- Level 201 face-up planner 19.93 is much worse than as is. Face-up removes the peek pairs the clock may need, so this is the "S untrusted" pattern C2 is meant to catch.
- Planner pin: library/yardstick.json lines 37-42 already pin 'planner' to planner-fast-v1 (fingerprint e686e095...). An earlier version of this report said otherwise; that was wrong. Review fix: counterfactual.js plannerRater used to ignore the pin whenever counterfactuals() passed its own yardstick; it now builds the planner-fast-v1 meter unless a test injects a fake yardstick. A test checks the pin.
- Thresholds in B1-B6 are uncalibrated (experiment E5). Default forks come from engine.classify on the witness when the caller gives none. Level 200 has none (forkStates 0), which makes B1 and B2 fail there for lack of designed traps.
- The meter's allResults opt-in is not needed: capture uses the bot directly.


## Review fixes (second pass)
- D for an unwon campaign now uses 20 (MAX_ATTEMPTS), as meter.js:116 does, not attempts.length (traces.js).
- Face-up check: meter.js:13 passes design.down into the board, and the planner reads game.down (factory/profile_planner.js:320), so down = [] changes what the bot sees. No separate unit test on the bot itself.
- C4 is unverified on real data: only fake-injected tests, no real ACCEPT-block run or timing. Do not use it for a decision before one real run under heavy.js.
- Tests: node --test test_traces.js test_counterfactual.js gave 16 pass, 0 fail. The timings above were not re-measured; the planner branch now taken is the same planner-fast-v1 meter that was used for them.