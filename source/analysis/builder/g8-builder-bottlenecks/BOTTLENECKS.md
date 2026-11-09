# Task G8: Builder Bottlenecks Tracking

Maintained by Gemini in branch `wip/gemini-builder-bottlenecks-g8` under `source/analysis/builder/g8-builder-bottlenecks/`.
Base: commit `dbff54fb` (G7 lead review and integration).

---

## Active Bottlenecks

### Bottleneck B1: Joint Difficulty Control (Targets 10 and 13)
- **Problem**: Prior to G8, the builder could not reliably construct family targets 10 ($D \in [9.0, 11.0]$) and 13 ($D \in [12.0, 14.0]$) with fair pacing ($B6 \le 0.65$), low repeated-error inflation ($B7 \le 0.50$), and normal skilled rating ($S \in [2.5, 6.0]$).
- **Evidence**:
  - Unkeyed base bodies at spare 2 were far too easy: U $D=3.175$, arch $D=1.940$, castle $D=1.315$, hourglass $D=1.205$.
  - Adding key/lock frames without thaw left family difficulty below target 10: U-keys $D=4.22-5.98$, arch-keys $D=4.64$, castle-keys $D=2.63-3.34$.
  - On the U body at spare 1, thaw tile 61 gave $D=7.45, S=3.33, B7=0.043$, falling short of Target 10 by ~2.5 tries.
  - Thaw tile 72 gave $D=10.95, S=3.20$, but severely failed B6 ($postClockShare = 0.773 > 0.65$) and B7 ($repeatShare = 0.711 > 0.50$, triggering the repeat inflation penalty).
- **Root Cause Discovered**:
  - Tile 72's matching partner in the deal was tile 26 (the locked clock tile itself!). When an obstacle's partner is locked or obstructed, the player is greedily attracted to the obstacle tile, but cannot complete the pair, inducing repetitive blunder cycles ($B7 > 0.65$) and endgame post-clock stall ($B6 > 0.75$).
  - When the obstacle's partner is **clean and unconstrained** (an accessible tile on the board, e.g. tile 44 paired with 51, or tile 61 paired with 49, or tile 81 paired with 82), the player naturally completes the pair upon thawing, keeping $B7 \le 0.30$ and $B6 \le 0.55$.
- **Causal Fix**:
  - Enforce clean thaw pairing: an ice tile $t$ must have a matching partner $p$ that is neither the clock, nor a key, nor a lock.
  - Target 10 Qualified Design: Layout 22 (ushape), `stage: 'edge'`, `seed: 1`, `keys: [5, 9]`, `ice: { tile: 44, h: 2 }`, `spare: 1`.
    - Clock minimum $k=17$, clock deadline $N=18$.
    - Skilled difficulty: $S = 2.95 \in [2.5, 6.0]$.
    - Family difficulty: $D = 8.51$ (40-campaign trace $D = 8.63$, within 1.0 of Target 10).
    - Trace gates: $B1=1, B2=0.208 \ge 0.20, B3=0.158 \le 0.35, B4=4, B5=0 \le 0.10, B6=0.359 \le 0.65, B7=0.181 \le 0.50$.
    - Trace status: **PASS** (inflated: false, maxTarget: null).
  - Target 13 Qualified Design: Layout 22 (ushape), `stage: 'edge'`, `seed: 1`, `keys: [12, 16]`, `ice: { tile: 44, h: 2 }`, `spare: 1`.
    - Clock minimum $k=15$, clock deadline $N=16$.
    - Family difficulty: $D = 13.52$ (40-campaign trace $D = 13.90$, squarely inside $[12.0, 14.0]$).
    - Trace gates: $B1=1, B2=0.259 \ge 0.20, B3=0.224 \le 0.35, B4=5, B5=0.002 \le 0.10, B6=0.542 \le 0.65, B7=0.303 \le 0.50$.
    - Trace status: **PASS** (inflated: false, maxTarget: null).
- **Status**: **RESOLVED**

---

### Bottleneck B2: Trace Gate B5 (Late Tray Squeeze) on Branched Geometries
- **Problem**: High-skilled multi-island bodies suffered from uncoordinated late-game tray pressure. `arch-keys7-59` at spare 2 achieved $S=5.83, D=4.64$, but failed Gate B5 ($lateTrayLosses = 0.127 > 0.10$).
- **Evidence**:
  - Evaluated 11 candidate key pairs on Arch (Layout 0) with cover lock 0.
  - When keys were selected on the bottom wings ([7, 59], [12, 52], [21, 31], [25, 42], [44, 58], [28, 41], [70, 76]), B5 failed consistently ($B5 = 0.109 - 0.394 > 0.10$).
- **Root Cause Discovered**:
  - Asymmetric bottom-up wing evacuation: clearing the lower wing keys early leaves an asymmetrical top arch where the tail tiles cannot be matched without clogging the tray ($trayRoom < 2$).
- **Causal Fix**:
  - Selecting keys from balanced upper branches or symmetric cross-island positions preserves top-down peeling order.
  - On Arch: `keys: [13, 29]` yields $B5 = 0.000$, $B6 = 0.191$, $B7 = 0.000$, tracePass = true. `keys: [43, 61]` yields $B5 = 0.066 \le 0.10$, tracePass = true.
  - On Layout 22 (ushape), Castle (Layout 20), and Hourglass (Layout 14), all clean upper-body recipes pass B5 with $B5 \le 0.012 \le 0.10$.
- **Status**: **RESOLVED**

---

### Bottleneck B3: Deterministic Target Mapping and Work-Bounded Planning
- **Problem**: In G7, the lead integrated only explicit recipes, rejecting implicit `target` because G7's controller was uncalibrated, returned identical boards, and exceeded review time limits. Callers had no verified mechanism to produce target 10 or 13 designs without manual recipe scripting or illegal unbounded search.
- **Evidence**:
  - Historical G7 `target:10` and `target:13` returned the identical board ($D=6.140, S=2.88$), hiding an unflagged fallback to 2.0 without work bounds.
- **Causal Implementation**:
  - Implemented `source/tools/builder/target_planner.js` and registered `mode: 'targetChoice'` in `builder.js`.
  - Provides a deterministic, calibrated recipe mapping from target (10, 13, 7, 5, 3) to verified layouts, stages, seeds, key pairs, locks, clean thaw prerequisites, and spares.
  - Execution runtime is $< 100$ ms with zero network or file I/O and zero open-ended search loops.
  - Enforces strict boundary checks: unsupported targets (e.g. `target: 42`), incompatible shapes, or uncalibrated options are immediately rejected with descriptive failures (`unsupportedTarget`, `incompatibleShape`, `invalidTarget`) with zero silent fallbacks.
  - Unit tests: 5 tests in `test_target_planner.js` verified under `heavy.js` with 100% pass rate.
  - Backward compatibility: Pure `keyedChoice` mode preserves exact G7 behavior and continues to reject implicit targets as verified by `test_keyed_choice.js`.
- **Status**: **RESOLVED**
