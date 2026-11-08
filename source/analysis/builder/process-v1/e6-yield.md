# E6: end-to-end supply from 500 builds

**The supply stop rule fires: zero library candidates from 500 builds.** No finished level was accepted or assigned. CPU cost per finished level cannot be estimated from zero output. Do not spend another batch on measurement speed; the next experiment should change how visible choices are built.

The original two single-process runs used 14.4 CPU-minutes and 14.6 wall-minutes (1.727 CPU-seconds per attempted build). They covered indices 0-499 once, with no skipped duplicates, errors or unresolved candidates. Source: library/pipeline-runs.jsonl, runs 2026-11-07T21-03-00-633Z, 2026-11-07T21-03-58-364Z. The E5 proposal was applied only through the research wrapper; production defaults and ruler pins stay unchanged.

| Stage | Entered | Passed | Failed | CPU seconds |
|---|---:|---:|---:|---:|
| build | 500 | 455 | 45 | 161.638 |
| dedupe | 455 | 455 | 0 | 0.048 |
| static | 455 | 168 | 287 | 206.877 |
| screen | 168 | 32 | 136 | 200.561 |
| planner | 32 | 5 | 27 | 158.282 |
| curve | 5 | 5 | 0 | 80.47 |
| traces | 5 | 0 | 5 | 54.531 |
| C1 | 0 | 0 | 0 | 0 |
| C2 | 0 | 0 | 0 | 0 |
| library | 0 | 0 | 0 | 0 |

45 builds returned no board. Of 455 boards, 168 passed static gates. Readability A2 accounts for 273 static failures; A3 for 9, A4 for 3 and A1 for 2. These are ordered first-failure counts, not unconditional quality estimates. A5 and A7 were report-only. The screen passed 32/168, and the planner passed 5/32 at S >= 2.2 (floor 2.5 minus margin 0.3). All five had a shippable curve spare, then lost every eligible spare to trace gates.

| Finalist | Index | Seed | Trace rejection |
|---|---:|---:|---|
| keysFarSide-hourglass-14 | 0 | 1 | s1 A4 fails at this spare; s2 traces fail: B5; s3 traces fail: B5 |
| iceLockClock-twins-32 | 258 | 7 | s1 traces fail: B6; s2 traces fail: B2,B6; s3 traces fail: B2,B6 |
| deepClock-vase-11 | 276 | 7 | s1 traces fail: B1,B2,B6; s2 traces fail: B1,B2,B6; s3 traces fail: B1,B2,B6 |
| deepClock-letterH-10 | 279 | 7 | s1 traces fail: B3; s3 traces fail: B2 |
| roomInTrayFrozen-pyramid-15 | 430 | 11 | s1 A4 fails at this spare; s2 traces fail: B2; s3 traces fail: B2,B6 |

Trace gate failures overlap; counts below are spare tests and distinct boards, respectively. Boolean verdicts, not rounded metric values, decide failure (one B6 value displays 0.650 but is slightly above 0.65 before rounding).

| Gate | Failed spare tests | Affected boards |
|---|---:|---:|
| B1 | 3 | 1 |
| B2 | 8 | 4 |
| B3 | 1 | 1 |
| B4 | 0 | 0 |
| B5 | 2 | 1 |
| B6 | 7 | 3 |

Sources: process-v1/e6-gates.jsonl (12 spare tests), library/rejects.jsonl. The pinned family and planner fingerprints are stored in e6-yield.json. Regenerate with `node source/tools/builder/loop/research/e6_analyze.js`; it validates run coverage, accounting and log coverage before writing.

The supply kill is decisive under this experimental gate set; the dial kill is **inconclusive**. Only five curves ran rather than the intended 30, and the original run used spares 0-3, not 0-4. Individual curve rows were not logged. Supplemental 0-4 curves in e6-curves.jsonl reconstruct these same puzzles by content hash. 5 curves are recovered, costing 14.03 additional CPU-seconds (11.31 wall-seconds), with cached ratings reused where available. Their cost and date are separate from the original batch. Do not present these as 30 curves or as evidence that the dial works across the full 6-16 band.

G5 should build visible, fair choices on readable layouts. The original batch used a mock 5.4-8.5 screen and an old S >= 2.2 screening margin; preserve it as historical evidence, not a production policy. Current work starts at 250 with family targets 10-13 and normal skilled 2.5-6, plus Dennis's explicit minimum-2 fallback if really needed. Report comparable baseline and new-builder runs under the same current policy, then fallback supply separately. Keep all rejects and unknowns; do not change the bots, soften gates, or select a favorable seed batch to manufacture yield. Five unlabeled trace failures leave open whether some thresholds reject puzzles Dennis would like; no routine playtesting is required and no unsupported automatic relaxation is justified.

No C1/C2, slot assignment, fresh ACCEPT campaign or special-ablation acceptance was reached. The 60 CPU-minute-per-finished-level rule is unmeasured. No game board, main branch or Firebase record changed.
