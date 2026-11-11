# Design Card: Level 254 (80 tiles, diamond)

- **Level Slot:** 254 (standard level slot)
- **Shape / Layout:** diamond (Layout 30, 80 tiles)
- **Target Difficulty:** 10.33 (Family bot D: 9.660, error: -0.673)
- **Skilled Bot Rating:** S = 3.45 (Normal skilled band [2.5, 6.0])
- **Clock Depth & Spare:** Fewest moves k = 14, Clock deadline n = 15 (Spare 1)
- **Board Key:** `30c86befd28a0cc0bd87a58b2c41c88e6dee9776024421da3b2642c3f3e27468`
- **Matching Body Key:** `cf3d69073d51d7c35bc7fc052b29d94a71d5ab64219df512608f8ec776dffb83`
- **Static Gate Profile (e5-v1):** PASS (all required gates A1-A9 pass)
- **Trace Gate Profile (e5-v1):** PASS (B1-B6 pass, B7 uninflated)
- **Policy & Rationale:** Standard level slot: qualified within normal skilled band [2.5, 6.0].
- **Readable Player Challenge:**
  - Authoring: A lock beside the clock
  - Summary: The clock needs 14 moves; taking the free pair in sight at move 5 before the clock costs 2 spare moves, and the free pair at move 4 loses the board.
  - Authored Traps: [[0,54],[32,33]]
