# Design Card: Level 250 (96 tiles, steps)

- **Level Slot:** 250 (10th level big board slot)
- **Shape / Layout:** steps (Layout 27, 96 tiles)
- **Target Difficulty:** 10.00 (Family bot D: 10.910, error: 0.910)
- **Skilled Bot Rating:** S = 2.15 (Recorded fallback skilled band [2.0, 2.5))
- **Clock Depth & Spare:** Fewest moves k = 14, Clock deadline n = 15 (Spare 1)
- **Board Key:** `4fd388e56f36c417e4c239846599df35f8661ff519d43676f79e1e62cd37c432`
- **Static Gate Profile (e5-v1):** PASS (all required gates A1-A9 pass)
- **Trace Gate Profile (e5-v1):** PASS (B1-B6 pass, B7 uninflated)
- **Policy & Rationale:** Tenth-level slot; 96 tiles permitted. Recorded fallback skilled band [2.0, 2.5).
- **Readable Player Challenge:**
  - Authoring: A lock beside the clock
  - Summary: The clock needs 14 moves; taking the free pair in sight at move 5 before the clock costs 2 spare moves, and the free pair at move 4 loses the board.
  - Authored Traps: [[2,53],[3,4]]
