# Design Card: Level 252 (80 tiles, diamond)

- **Level Slot:** 252 (standard level slot)
- **Shape / Layout:** diamond (Layout 30, 80 tiles)
- **Target Difficulty:** 10.17 (Family bot D: 10.015, error: -0.152)
- **Skilled Bot Rating:** S = 2.70 (Normal skilled band [2.5, 6.0])
- **Clock Depth & Spare:** Fewest moves k = 14, Clock deadline n = 15 (Spare 1)
- **Board Key:** `b8f94a202bc292a2e8f7a09c75888d38e6c0233d765438d1d9aef20358faffad`
- **Matching Body Key:** `ef8148eeda69c7b5375785d498cd0105fcb7a4d65c3cb0da3aa1fecdfa5db71e`
- **Static Gate Profile (e5-v1):** PASS (all required gates A1-A9 pass)
- **Trace Gate Profile (e5-v1):** PASS (B1-B6 pass, B7 uninflated)
- **Policy & Rationale:** Standard level slot: qualified within normal skilled band [2.5, 6.0].
- **Readable Player Challenge:**
  - Authoring: A lock beside the clock
  - Summary: The clock needs 14 moves; taking the free pair in sight at move 5 before the clock costs 2 spare moves, and the free pair at move 4 loses the board.
  - Authored Traps: [[0,54],[34,68]]
