# Design Card: Level 251 (80 tiles, letterH)

- **Level Slot:** 251 (standard level slot)
- **Shape / Layout:** letterH (Layout 10, 80 tiles)
- **Target Difficulty:** 10.08 (Family bot D: 9.280, error: -0.800)
- **Skilled Bot Rating:** S = 4.85 (Normal skilled band [2.5, 6.0])
- **Clock Depth & Spare:** Fewest moves k = 11, Clock deadline n = 13 (Spare 2)
- **Board Key:** `14c1cb900b3c662d9a8cc4c660a3c7b3d0a0c185f46e62c9566cb46e512bd479`
- **Static Gate Profile (e5-v1):** PASS (all required gates A1-A9 pass)
- **Trace Gate Profile (e5-v1):** PASS (B1-B6 pass, B7 uninflated)
- **Policy & Rationale:** Standard board (80 tiles). Normal skilled band S in [2.5, 6.0].
- **Readable Player Challenge:**
  - Authoring: A lock beside the clock
  - Summary: The clock needs 11 moves; taking the free pair in sight at move 3 before the clock costs 2 spare moves, and the free pair at move 4 loses the board.
  - Authored Traps: [[53,76],[74,75]]
