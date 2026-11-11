# Design Card: Level 253 (80 tiles, diamond)

- **Level Slot:** 253 (standard level slot)
- **Shape / Layout:** diamond (Layout 30, 80 tiles)
- **Target Difficulty:** 10.25 (Family bot D: 10.300, error: 0.050)
- **Skilled Bot Rating:** S = 3.33 (Normal skilled band [2.5, 6.0])
- **Clock Depth & Spare:** Fewest moves k = 14, Clock deadline n = 15 (Spare 1)
- **Board Key:** `00bde54bd9de61c11a62008dd31310141e1f64fd2aa8c205b4c281e8449ce569`
- **Static Gate Profile (e5-v1):** PASS (all required gates A1-A9 pass)
- **Trace Gate Profile (e5-v1):** PASS (B1-B6 pass, B7 uninflated)
- **Policy & Rationale:** Standard board (80 tiles). 96 tiles strictly forbidden. Normal skilled band S in [2.5, 6.0].
- **Readable Player Challenge:**
  - Authoring: A lock beside the clock
  - Summary: The clock needs 14 moves; taking the free pair in sight at move 5 before the clock costs 2 spare moves, and the free pair at move 4 loses the board.
  - Authored Traps: [[32,33],[53,54]]
