# Design Card: Level 250 (Big Board, Steps Layout 27)

- **Level Slot:** 250 (10th level big board slot)
- **Shape / Layout:** Steps (Layout 27, 96 tiles, 7 layers)
- **Target Difficulty:** 10.0 (Family bot D: 10.91 +/- 0.91)
- **Skilled Bot Rating:** S = 2.15 (Fallback selection band [2.0, 6.0] individually recorded)
- **Clock Route Depth:** k = 14, Clock Deadline n = 15 (Spare 1)
- **Static Gate Profile (e5-v1):** 100% PASS (A1, A2, A3, A4, A6, A9 all pass, shipSpares: [1, 2, 3])
- **Trace Gate Profile (e5-v1):** 100% PASS (B1=1.0, B2=0.476, B3=0.146, B4=3, B5=0.020, B6=0.491, B7=0.032 uninflated)
- **Physical Structure:**
  - 96 tiles, tile size >= 52px, 7 layers stepped island.
  - Visible locks and keys visible initially.
  - Decision trap authored at move 5: taking the tempting free pair before the clock route costs 2 spare moves; taking the free pair at move 4 loses the board.
  - Family bot first error occurred at the authored trap in 47.6% of lost tries (B2 pass >= 0.20).
