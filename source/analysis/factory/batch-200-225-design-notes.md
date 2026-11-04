# Original levels 200–225

User decisions: 200 starts at seven family-bot tries, rising to nine at 224 and ten at 225. Only 210 and 220 are big boards. Every new level must feel original; cropped or reskinned big boards are excluded.

Each slot has a whole freshly generated catalogue layout. The factory rejects inventory seeds and compares all eight rotations/reflections against the existing campaign and every other new layout. It checks overlap in both directions so differing widths do not hide a shared pattern. Layouts stay fixed throughout puzzle tuning, and only one sibling per creation ID can enter the final batch.

The family profile and learned traps stay frozen in human-g6.2. Difficulty uses equal weighting of two fixed 40-campaign runs (80 total; 20-try cap), target tolerance 0.5, seed disagreement at most two tries. Puzzle checks include a valid complete solution, skilled bot at most six tries, trap attribution at least 60%, meaningful specials, and at most one unrelieved blind dig.

Status: construction and difficulty tuning are in progress. No complete batch or game-table replacement is claimed yet. Current resumable work is in ignored source/build/batch-200-225-original-v6. Raw experiments based on earlier inventory/trim ideas are excluded.

Validation: 22 factory tests passed. Five representative fresh layouts (200, 210, 212, 220, 225) fit a 390×820 phone and their stored routes won through the real game. Visual inspection showed distinct silhouettes and readable tiles. The broader offline suite passed 145/146 tests; the unrelated existing English win-message popup size test failed (and failed in isolation) under the installed Windows Chromium. No game UI files were changed.
