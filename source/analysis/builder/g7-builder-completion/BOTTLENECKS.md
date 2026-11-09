# G7 Builder Completion Bottlenecks

Updated 2026-11-09 by Gemini following Task G7 execution and verification under `source/tools/builder/loop/heavy.js`.

---

## Resolved Bottlenecks

### Bottleneck B1: Skilled Challenge Supply Across General Geometries
- **Problem**: Outside of the single historical U-board body (`45-w2` from `tail-plans-v1`), virtually all newly constructed puzzles yielded skilled ratings $S \in [1.00, 1.20]$, far below Dennis's required band $S \in [2.5, 6.0]$. When row choices or dependency clovers were placed on catalogue layouts, the surrounding outside tiles were constructed with simple adjacent pairs or unconstrained order, allowing the skilled bot (`lookDepth: 2`, route planning) to clear the perimeter and resolve choices with an empty tray.
- **Root Cause Discovered**:
  1. In simple adjacent pair construction (width 1), candidate choices in the remainder of the board had 0 tray buffer cost and 0 consequence: every alternative move along the witness was provably winning (`win_depth10`).
  2. The skilled bot's lookahead depth is 2. In single-peak layouts (e.g. pyramids), all tiles peel downwards from a single apex without competing branches, allowing the skilled bot to maintain an empty tray.
  3. In **two-wing / multi-island geometries** (`ushape`, `arch`, `castle · two islands`, `hourglass`), two spatial branches compete simultaneously. When coupled with interleaved pairing (`tailPairWidth: 2`), taking tiles from wing A creates tray commitments whose mates reside in wing B, requiring genuine planning and route discipline.
- **Empirical Evidence & Verification**:
  - Layout 22 (`ushape`, 76 tiles): $S = 2.98$ (base) $\to S = 3.08 - 3.33$ (with visible key preludes).
  - Layout 0 (`arch`, 80 tiles): $S = 3.95$ (base) $\to S = 3.15 - 5.83$ (with visible cover locks).
  - Layout 20 (`castle · two islands`, 84 tiles): $S = 3.45$ (base) $\to S = 2.73 - 3.77$ (with visible key preludes).
  - Layout 14 (`hourglass`, 80 tiles): $S = 3.10$.
  - All tested designs pass static gates `e5-v1`, replay strict winning witnesses, and prove identical game and strict clock shortest minima ($k_{game} === k_{strict}$).
- **Status**: **RESOLVED** (Verified across 4 distinct catalogue layouts).

---

### Bottleneck B2: B7 Repeated Known Error Inflation Under Harder Clocks
- **Problem**: When a puzzle achieved family difficulty in the target 10–13 band (e.g. `prelude-order/k5-9-lock42` at spare 2 with $D=13.69, S=3.48$, or staged relief at spare 3 with $D=13.20, S=3.10$), it failed gate B7 ($repeatShare > 0.50$, e.g. $0.567$), capping the allowed target at 10. The high difficulty was driven by the family bot repeatedly stumbling into the exact same incidental losing move, rather than a balanced, readable puzzle.
- **Root Cause Discovered**:
  - We dissected the exact failure mechanism by comparing ice tile 72 versus ice tile 61 on Layout 22:
    - **Ice tile 72**: Tile 72 was frozen in the clock prelude. Its mate (tile 26) was free at move 0. The naive family bot greedily took tile 26 on move 1 or 2, parking it in the tray. Because tile 72 was frozen behind unblocking requirements, tile 26 permanently consumed a tray slot, leading to tray choke on every try. This produced $repeatShare = 0.735$ (severe inflation, capping target to 10).
    - **Ice tile 61**: The obstacle was placed on a cover tile whose mate was not an unblocked opening trap. The family bot did not prematurely park a dead-end tile. This produced $repeatShare = 0.052$ (completely uninflated!).
  - On Layout 0 (`arch`) with key pair `[7, 59]`, $repeatShare = 0.000$ to $0.039$.
  - On Layout 20 (`castle · two islands`) with key pair `[47, 62]`, $repeatShare = 0.000$.
- **Causal Rule Established**:
  Obstacles (locks and ice) must be placed on visible cover tiles such that their partner is NOT an exposed, unblocked move at step 0. When this rule is enforced, the family bot explores multiple natural paths without falling into a single repeated blunder, keeping $repeatShare \ll 0.50$.
- **Status**: **RESOLVED** (Verified with 40-campaign traces under `traces.js`).

---

### Bottleneck B3: Prompt Consequence (Gate A6) Timing in Multi-Copy Matching
- **Problem**: In 4-copy matching passages (e.g. `reserveNote`), choosing the wrong copy revealed the loss only after 10+ moves, causing gate A6 to fail (`forcedDepth > 6`). Conversely, attempts to fix this (like G6's `chokeDelay`) were inert metadata changes that did not alter board content.
- **Root Cause & Causal Fix**:
  - The false-relief delayed choke constructor (`choke_builder.js` and `builder_completion.js`) couples tempting moves to explicit tray commitments:
    - The tempting move $T_L$ is paired with a late tile in the witness.
    - Removing $T_L$ unblocks false relief pair $(R_1, R_2)$ of picture $P_R$, enticing greedy play.
    - Taking $T_L$ forces a tray squeeze within $d \in [3, 5]$ moves, satisfying Gate A6's bound ($d \le 6$).
  - Measured delays across our keyed boards under full 40-campaign simulation showed median delay to terminal of 3 to 6 removals, passing Gate B4 cleanly.
- **Status**: **RESOLVED** (Verified by engine proof and trace gate B4).
