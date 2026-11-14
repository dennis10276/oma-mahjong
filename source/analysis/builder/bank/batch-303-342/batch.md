# Batch for levels 303-342 (chain traps, bot-free)

Pool: 6544 jobs, 134 finished boards (after leaving out 0 boards and 0 boards of hosts used in earlier placed levels). Levels filled: 13 of 13 (the batch stops at 315: the boards after the first hole are in spares/after-hole-*.json). Score ramp target 7 -> 8.5 (difficulty.js), a breather 1.25 below the line every 5th level (levels 306, 311).

| level | layout | tiles | chain (shape index) | links | score | winning first moves | tailGreedyWin | clock spare | face-down | tail waiting 0/1/2/3 | needle |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 303 | 30 diamond | 80 | 12: clock<ice; thaw<lock; keyA<way:ice | 3 | 7.03 | 3/14 | 0.1138 | 1 | 0.275 | 0.333/0.449/0.159/0.058 (run 7) |  |
| 304 | 3 ushape | 80 | 31: clock<lock; keyA<way:ice; keyB<cover:ice | 3 | 7.38 | 6/14 | 0.0825 | 1 | 0.275 | 0.269/0.463/0.224/0.045 (run 3) |  |
| 305 | 9 heart | 76 | 11: clock<ice; thaw<lock; keyA<cover:ice | 3 | 7.02 | 3/10 | 0.1125 | 1 | 0.276 | 0.344/0.469/0.156/0.031 (run 3) |  |
| 306 | 41 hourglass | 76 | 12: clock<ice; thaw<lock; keyA<way:ice | 3 | 6.58 | 2/8 | 0.145 | 1 | 0.276 | 0.328/0.478/0.164/0.03 (run 3) | needle |
| 307 | 36 hourglass | 76 | 35: clock<ice; thaw<lock; keyB<cover:ice | 3 | 6.9 | 4/12 | 0.0975 | 1 | 0.25 | 0.281/0.484/0.219/0.016 (run 3) |  |
| 308 | 16 moon | 74 | 11: clock<ice; thaw<lock; keyA<cover:ice | 3 | 6.46 | 2/16 | 0.16 | 1 | 0.27 | 0.369/0.492/0.123/0.015 (run 2) | needle |
| 309 | 44 hourglass | 84 | 12: clock<ice; thaw<lock; keyA<way:ice | 3 | 7.15 | 4/9 | 0.1125 | 1 | 0.274 | 0.324/0.5/0.176/0 (run 1) |  |
| 310 | 13 house | 96 | 8: clock<lock; keyA<cover:ice; keyB<cover:ice | 3 | 6.74 | 3/17 | 0.1425 | 1 | 0.229 | 0.299/0.471/0.195/0.034 (run 4) |  |
| 311 | 4 twins | 84 | 14: clock<ice; thaw<lock; keyA<cover:ice; keyB<cover:ice | 4 | 6.57 | 6/12 | 0.2313 | 1 | 0.274 | 0.286/0.486/0.214/0.014 (run 3) |  |
| 312 | 12 arch | 88 | 33: clock<cover:lock; keyA<cover:ice; keyB<cover:ice | 3 | 7.44 | 3/13 | 0.0925 | 1 | 0.273 | 0.333/0.487/0.167/0.013 (run 3) |  |
| 313 | 0 arch | 80 | 8: clock<lock; keyA<cover:ice; keyB<cover:ice | 3 | 7.31 | 4/14 | 0.0925 | 1 | 0.275 | 0.246/0.492/0.246/0.015 (run 2) |  |
| 314 | 6 pyramid · tall | 84 | 13: clock<cover:ice; coverThaw<lock; keyA<cover:ice | 3 | 7.26 | 2/8 | 0.0912 | 1 | 0.274 | 0.014/0.082/0.479/0.425 (run 39) | needle |
| 315 | 14 hourglass | 80 | 31: clock<lock; keyA<way:ice; keyB<cover:ice | 3 | 7.2 | 4/12 | 0.1375 | 1 | 0.275 | 0.308/0.492/0.185/0.015 (run 2) |  |

## Spares

| spare | layout | tiles | chain | links | score | winning first moves | tailGreedyWin | clock spare |
|---|---|---|---|---|---|---|---|---|
| 1 | 41 | 76 | clock<ice; thaw<lock; keyA<way:ice | 3 | 6.82 | 2/8 | 0.12 | 1 |
| 2 | 4 | 84 | clock<ice; thaw<lock; keyA<cover:ice; keyB<cover:ice | 4 | 7.55 | 6/12 | 0.115 | 1 |
| 3 | 43 | 84 | clock<ice; thaw<lock; keyA<way:ice; keyB<cover:ice | 4 | 6.29 | 5/11 | 0.2125 | 2 |
| 4 | 18 | 76 | clock<cover:ice; coverThaw<lock; keyA<cover:ice | 3 | 7.27 | 2/12 | 0.1275 | 1 |
| 5 | 36 | 76 | clock<lock; keyA<way:ice; keyB<cover:ice | 3 | 6.34 | 3/11 | 0.2412 | 1 |
| 6 | 14 | 80 | clock<ice; thaw<lock; keyA<cover:ice | 3 | 6.45 | 2/12 | 0.1663 | 1 |
| 7 | 12 | 88 | clock<lock; keyA<cover:ice; keyB<cover:ice | 3 | 6.85 | 3/14 | 0.155 | 1 |
| 8 | 6 | 84 | clock<cover:ice; coverThaw<lock; keyB<cover:ice | 3 | 6.63 | 4/8 | 0.225 | 1 |

## Summary

- 303-305: 3 levels, score 7.02 to 7.38, mean 7.14, links 3
- 306-308: 3 levels, score 6.46 to 6.9, mean 6.65, links 3
- 309-311: 3 levels, score 6.57 to 7.15, mean 6.82, links 3/4
- 312-315: 4 levels, score 7.2 to 7.44, mean 7.30, links 3
- shapes used (index: levels): 8: 2, 11: 2, 12: 3, 13: 1, 14: 1, 31: 2, 33: 1, 35: 1
- layouts used (id: levels): 0: 1, 3: 1, 4: 1, 6: 1, 9: 1, 12: 1, 13: 1, 14: 1, 16: 1, 30: 1, 36: 1, 41: 1, 44: 1
- needle boards (fewer than 3 winning first moves), allowed from level 303 and at least 2 levels apart: 306, 308, 314
- largest score dip between neighbouring levels: 0.44

## Holes (a hole is a level for which no board in the pool fits next to the others without breaking a hard rule; nothing was relaxed) - the first one, level 316, is where the batch stops

- level 316: 120 boards fit the level's tile count / link / needle rules (20 layouts, 14 shapes); blocked by: layoutWithin12Levels 120, shapeThirdUse 18, shapeWithin2Levels 43, layoutAndShapeTwice 61, ledgerFewerThan3FieldsDiffer 65, boardUsedElsewhere 25, scoreDipOver05 33; fit without any conflict: 0
- level 318: 120 boards fit the level's tile count / link / needle rules (20 layouts, 14 shapes); blocked by: layoutWithin12Levels 118, shapeThirdUse 18, shapeWithin2Levels 35, layoutAndShapeTwice 61, ledgerFewerThan3FieldsDiffer 65, boardUsedElsewhere 25, scoreDipOver05 4; fit without any conflict: 0
- level 319: 120 boards fit the level's tile count / link / needle rules (20 layouts, 14 shapes); blocked by: layoutWithin12Levels 113, shapeThirdUse 18, shapeWithin2Levels 41, layoutAndShapeTwice 61, ledgerFewerThan3FieldsDiffer 65, boardUsedElsewhere 25, scoreDipOver05 2; fit without any conflict: 0
- level 323: 120 boards fit the level's tile count / link / needle rules (20 layouts, 14 shapes); blocked by: layoutWithin12Levels 111, shapeThirdUse 18, shapeWithin2Levels 33, layoutAndShapeTwice 61, ledgerFewerThan3FieldsDiffer 65, boardUsedElsewhere 25, scoreDipOver05 10; fit without any conflict: 0
- level 324: 120 boards fit the level's tile count / link / needle rules (20 layouts, 14 shapes); blocked by: layoutWithin12Levels 111, shapeThirdUse 18, shapeWithin2Levels 36, layoutAndShapeTwice 61, ledgerFewerThan3FieldsDiffer 65, boardUsedElsewhere 25; fit without any conflict: 0
- level 329: 120 boards fit the level's tile count / link / needle rules (20 layouts, 14 shapes); blocked by: layoutWithin12Levels 111, shapeThirdUse 18, shapeWithin2Levels 19, layoutAndShapeTwice 61, ledgerFewerThan3FieldsDiffer 65, boardUsedElsewhere 25, scoreDipOver05 39; fit without any conflict: 0
- level 331: 120 boards fit the level's tile count / link / needle rules (20 layouts, 14 shapes); blocked by: layoutWithin12Levels 108, shapeThirdUse 18, shapeWithin2Levels 10, layoutAndShapeTwice 61, ledgerFewerThan3FieldsDiffer 65, boardUsedElsewhere 25; fit without any conflict: 0
- level 332: 120 boards fit the level's tile count / link / needle rules (20 layouts, 14 shapes); blocked by: layoutWithin12Levels 108, shapeThirdUse 18, shapeWithin2Levels 19, layoutAndShapeTwice 61, ledgerFewerThan3FieldsDiffer 65, boardUsedElsewhere 25, scoreDipOver05 20; fit without any conflict: 0
- level 335: 120 boards fit the level's tile count / link / needle rules (20 layouts, 14 shapes); blocked by: layoutWithin12Levels 106, shapeThirdUse 18, shapeWithin2Levels 18, layoutAndShapeTwice 61, ledgerFewerThan3FieldsDiffer 65, boardUsedElsewhere 25, scoreDipOver05 76; fit without any conflict: 0
- level 336: 120 boards fit the level's tile count / link / needle rules (20 layouts, 14 shapes); blocked by: layoutWithin12Levels 106, shapeThirdUse 18, shapeWithin2Levels 18, layoutAndShapeTwice 61, ledgerFewerThan3FieldsDiffer 65, boardUsedElsewhere 25; fit without any conflict: 0
- level 337: 120 boards fit the level's tile count / link / needle rules (20 layouts, 14 shapes); blocked by: layoutWithin12Levels 106, shapeThirdUse 18, shapeWithin2Levels 22, layoutAndShapeTwice 61, ledgerFewerThan3FieldsDiffer 65, boardUsedElsewhere 25, scoreDipOver05 34; fit without any conflict: 0

## Waiting for the display fix (frozen key / frozen lock shapes, card.trap.needsUi)

- 16 clock<lock; keyA<frozen; keyB<cover:ice
- 17 clock<lock; keyA<frozen; keyB<frozen
- 18 clock<ice; thaw<lock; keyA<frozen
- 19 clock<lock; clock<cover:ice; keyA<frozen
- 20 clock<ice; thaw<lockIce
- 21 clock<ice; thaw<lockIce; keyA<cover:ice
- 22 clock<lockIce; keyA<cover:ice
- 23 clock<cover:ice; coverThaw<lockIce
- 26 clock<lock; clock<cover:lockIce; keyA<cover:ice
- 27 clock<lock; clock<cover:ice; coverThaw<ice; keyA<frozen
- 28 clock<lockIce; clock<cover:ice
- 29 clock<lock; keyA<frozen; keyB<way:ice

## Pool failures (reason: count)

- nobuild: 4916
- twins: 1338
- notRetuned: 441
- retuneFailed:tail: 4
- retuneFailed:rebuildDiffers: 2
