# G7 Builder Completion Bottlenecks

Initial status recorded 2026-11-09 by Gemini following Codex's Task G7 specification and Dennis's level design directives.

## Active Bottlenecks

### Bottleneck B1: Skilled Challenge Supply Across General Geometries
- **Problem**: Outside of the single historical U-board body (`45-w2` from `tail-plans-v1`), virtually all newly constructed puzzles yield skilled ratings $S \in [1.00, 1.20]$, far below Dennis's required band $S \in [2.5, 6.0]$. When row choices or dependency clovers were placed on catalogue layouts, the surrounding outside tiles were constructed with simple adjacent pairs or unconstrained order, allowing the skilled bot (`lookDepth: 2`, route planning) to clear the perimeter and resolve choices with an empty tray.
- **Supporting Evidence**:
  - `choice-motifs-v1/REPORT.md`: Reconstructed adjacent pairs on layout 22 dropped skilled from $2.98$ to $1.13$. Transfer to 9 catalogue layouts gave $S \in [1.00, 1.20]$.
  - `dependency-choices-v1/REPORT.md`: Corrected clovers on 8 recipes scored $S \in [1.00, 1.13]$.
  - `four-copy-correctness-v1/REPORT.md`: `coupledRowChoice` on 6 layouts gave $S \in [1.00, 1.02]$.
  - `g6-puzzle-balance/LEAD-REVIEW.md`: All 40 trials of `chokeDelay` produced $S \in [1.00, 1.02]$.
- **Expected Impact**: Unlocking genuine tray commitments and interleaved dependency structures across multiple catalogue layouts will provide the candidate supply needed to populate levels 250–275+.
- **Next Action**: Analyze what made `45-w2` succeed: necessary shared tray commitments with interleaved pairing (width 2) on the path to the clock/keys, versus trivial adjacent pairs. Construct an explicit causal mechanism that couples outside unblocking into tray commitments before the fork, and test on at least three distinct catalogue layouts.
- **Status**: ACTIVE (Priority 1).

### Bottleneck B2: B7 Repeated Known Error Inflation Under Harder Clocks
- **Problem**: When a puzzle achieves family difficulty in the target 13 band (e.g. `prelude-order/k5-9-lock42` at spare 2 with $D=13.69, S=3.48$, or staged relief at spare 3 with $D=13.20, S=3.10$), it fails gate B7 ($repeatShare > 0.50$, e.g. $0.567$), capping the allowed target at 10. The high difficulty is driven by the family bot repeatedly stumbling into the exact same incidental losing move (e.g., tile 50 prematurely parking a tile whose mate is locked), rather than a balanced, readable puzzle.
- **Supporting Evidence**:
  - `dependency-choices-v1/REPORT.md`: 28 of 37 first errors were on tile 50 (21 repeated same losing move). Repairing tile 50 collapsed family difficulty from 13.69 to 5.335 (an overshoot).
  - Trace B7 rule in `traces.js`: $repeatShare > 0.50$ sets `inflated: true`, capping `maxTarget: 10`.
- **Expected Impact**: Puzzles that present multiple plausible, readable options or gradual tray pressure will allow the family bot to explore without getting stuck on a single catastrophic blunder, passing B7 at target 13+.
- **Next Action**: Ensure forks have visible, goal-directed winning alternatives with short forced loss depth ($\le 6$ moves) and without hidden lock dependencies that trap naive play into repeated single-move blunders.
- **Status**: PENDING verification of B1.

### Bottleneck B3: Prompt Consequence (Gate A6) Timing in Multi-Copy Matching
- **Problem**: In 4-copy matching passages (e.g. `reserveNote`), choosing the wrong copy reveals the loss only after 10+ moves, causing gate A6 to fail (`forcedDepth > 6`). Conversely, attempts to fix this (like G6's `chokeDelay`) were inert metadata changes that did not alter board content.
- **Supporting Evidence**:
  - `four-copy-correctness-v1/REPORT.md`: All reserveNote variants failed A6 because the loss was delayed $> 6$ removals.
  - `g6-puzzle-balance/LEAD-REVIEW.md`: `chokeDelay` did not change board tiles, pictures, or consequence depth.
- **Expected Impact**: Puzzles will have prompt, readable consequences ($\le 6$ moves from error to forced loss) that satisfy gate A6 without relying on deep attrition.
- **Next Action**: Tie the incorrect fork branch directly to an immediate tray squeeze (e.g. requiring an unblocking move that introduces a 4th unmatched picture within 1–3 moves).
- **Status**: PENDING verification of B1.
