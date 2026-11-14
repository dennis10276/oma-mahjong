# Batch for levels 303-342 (chain traps, bot-free)

Pool: 6876 jobs, 92 finished boards (after leaving out 0 boards and 0 boards of hosts used in earlier placed levels). Levels filled: 13 of 13 (the batch stops at 315: the boards after the first hole are in spares/after-hole-*.json). Score ramp target 7 -> 8.5 (difficulty.js), a breather 1.25 below the line every 5th level (levels 306, 311).

| level | layout | tiles | chain (shape index) | links | score | winning first moves | tailGreedyWin | clock spare | face-down | tail waiting 0/1/2/3 | needle |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 303 | 19 hourglass · ridges | 76 | 20: clock<ice; thaw<lockIce | 3 | 7.28 | 5/11 | 0.0712 | 1 | 0.276 | 0.3/0.483/0.2/0.017 (run 3) |  |
| 304 | 30 diamond | 80 | 12: clock<ice; thaw<lock; keyA<way:ice | 3 | 7.1 | 3/14 | 0.1062 | 1 | 0.275 | 0.333/0.493/0.159/0.014 (run 2) |  |
| 305 | 3 ushape | 80 | 31: clock<lock; keyA<way:ice; keyB<cover:ice | 3 | 7.18 | 6/14 | 0.1025 | 1 | 0.275 | 0.149/0.403/0.343/0.104 (run 5) |  |
| 306 | 16 moon | 74 | 35: clock<ice; thaw<lock; keyB<cover:ice | 3 | 7.01 | 2/15 | 0.1163 | 1 | 0.27 | 0.355/0.5/0.145/0 (run 1) | needle |
| 307 | 36 hourglass | 76 | 36: clock<cover:ice; coverThaw<lock; keyB<cover:ice | 3 | 6.97 | 3/10 | 0.0988 | 1 | 0.224 | 0.098/0.328/0.393/0.18 (run 11) |  |
| 308 | 41 hourglass | 76 | 12: clock<ice; thaw<lock; keyA<way:ice | 3 | 7.2 | 2/8 | 0.0675 | 1 | 0.276 | 0.313/0.478/0.179/0.03 (run 3) | needle |
| 309 | 23 hourglass | 76 | 9: clock<lock; clock<cover:ice; keyA<cover:ice | 3 | 7.09 | 4/15 | 0.1313 | 1 | 0.276 | 0.273/0.424/0.227/0.076 (run 11) |  |
| 310 | 13 house | 96 | 8: clock<lock; keyA<cover:ice; keyB<cover:ice | 3 | 7.18 | 3/17 | 0.0975 | 1 | 0.229 | 0.115/0.379/0.379/0.126 (run 7) |  |
| 311 | 18 frame | 76 | 12: clock<ice; thaw<lock; keyA<way:ice | 3 | 7.24 | 3/13 | 0.1487 | 1 | 0.276 | 0.262/0.492/0.231/0.015 (run 2) |  |
| 312 | 15 pyramid · tall | 80 | 11: clock<ice; thaw<lock; keyA<cover:ice | 3 | 7.22 | 2/10 | 0.085 | 1 | 0.275 | 0.314/0.5/0.186/0 (run 1) | needle |
| 313 | 31 oval · two islands | 76 | 24: clock<lock; keyA<way:ice; keyB<way:ice | 3 | 7.17 | 7/15 | 0.14 | 1 | 0.25 | 0.197/0.459/0.295/0.049 (run 4) |  |
| 314 | 11 vase | 76 | 9: clock<lock; clock<cover:ice; keyA<cover:ice | 3 | 7.26 | 3/7 | 0.0688 | 1 | 0.276 | 0.215/0.431/0.277/0.077 (run 5) |  |
| 315 | 14 hourglass | 80 | 35: clock<ice; thaw<lock; keyB<cover:ice | 3 | 7.28 | 2/11 | 0.0712 | 1 | 0.275 | 0.229/0.429/0.271/0.071 (run 5) | needle |

## Spares

| spare | layout | tiles | chain | links | score | winning first moves | tailGreedyWin | clock spare |
|---|---|---|---|---|---|---|---|---|
| 1 | 41 | 76 | clock<ice; thaw<lock; keyA<way:ice | 3 | 7.2 | 2/8 | 0.0675 | 1 |
| 2 | 19 | 76 | clock<ice; thaw<lockIce | 3 | 6.69 | 5/11 | 0.1412 | 1 |
| 3 | 43 | 84 | clock<ice; thaw<lock; keyA<way:ice; keyB<cover:ice | 4 | 6.64 | 5/11 | 0.1688 | 2 |
| 4 | 18 | 76 | clock<cover:ice; coverThaw<lock; keyA<cover:ice | 3 | 7.42 | 2/12 | 0.1125 | 1 |
| 5 | 36 | 76 | clock<ice; thaw<lock; keyA<cover:ice; keyB<cover:ice | 4 | 5.99 | 5/11 | 0.2612 | 2 |
| 6 | 14 | 80 | clock<lock; clock<cover:ice; keyA<way:ice | 3 | 6.49 | 4/12 | 0.1613 | 1 |
| 7 | 12 | 88 | clock<lock; keyA<cover:ice; keyB<cover:ice | 3 | 6.62 | 5/14 | 0.1787 | 1 |
| 8 | 6 | 84 | clock<ice; thaw<lock; keyA<cover:ice | 3 | 6.46 | 2/8 | 0.1688 | 1 |

## Summary

- 303-305: 3 levels, score 7.1 to 7.28, mean 7.19, links 3
- 306-308: 3 levels, score 6.97 to 7.2, mean 7.06, links 3
- 309-311: 3 levels, score 7.09 to 7.24, mean 7.17, links 3
- 312-315: 4 levels, score 7.17 to 7.28, mean 7.23, links 3
- shapes used (index: levels): 8: 1, 9: 2, 11: 1, 12: 3, 20: 1, 24: 1, 31: 1, 35: 2, 36: 1
- layouts used (id: levels): 3: 1, 11: 1, 13: 1, 14: 1, 15: 1, 16: 1, 18: 1, 19: 1, 23: 1, 30: 1, 31: 1, 36: 1, 41: 1
- needle boards (fewer than 3 winning first moves), allowed from level 303 and at least 2 levels apart: 306, 308, 312, 315
- largest score dip between neighbouring levels: 0.18

## Holes (a hole is a level for which no board in the pool fits next to the others without breaking a hard rule; nothing was relaxed) - the first one, level 316, is where the batch stops

- level 316: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 79, shapeThirdUse 14, shapeWithin2Levels 23, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22; fit without any conflict: 0
- level 318: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 78, shapeThirdUse 14, shapeWithin2Levels 14, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22, scoreDipOver05 21; fit without any conflict: 0
- level 319: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 78, shapeThirdUse 14, shapeWithin2Levels 20, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22, scoreDipOver05 19; fit without any conflict: 0
- level 322: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 76, shapeThirdUse 14, shapeWithin2Levels 21, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22, scoreDipOver05 2; fit without any conflict: 0
- level 323: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 76, shapeThirdUse 14, shapeWithin2Levels 15, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22, scoreDipOver05 26; fit without any conflict: 0
- level 325: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 76, shapeThirdUse 14, shapeWithin2Levels 14, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22, scoreDipOver05 6; fit without any conflict: 0
- level 329: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 76, shapeThirdUse 14, shapeWithin2Levels 17, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22, scoreDipOver05 60; fit without any conflict: 0
- level 331: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 72, shapeThirdUse 14, shapeWithin2Levels 6, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22; fit without any conflict: 0
- level 332: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 72, shapeThirdUse 14, shapeWithin2Levels 12, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22; fit without any conflict: 0
- level 333: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 72, shapeThirdUse 14, shapeWithin2Levels 6, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22; fit without any conflict: 0
- level 335: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 72, shapeThirdUse 14, shapeWithin2Levels 14, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22, scoreDipOver05 37; fit without any conflict: 0
- level 336: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 72, shapeThirdUse 14, shapeWithin2Levels 14, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22; fit without any conflict: 0
- level 338: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 72, shapeThirdUse 14, shapeWithin2Levels 8, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22, scoreDipOver05 38; fit without any conflict: 0
- level 339: 79 boards fit the level's tile count / link / needle rules (16 layouts, 15 shapes); blocked by: layoutWithin12Levels 69, shapeThirdUse 14, shapeWithin2Levels 10, layoutAndShapeTwice 47, ledgerFewerThan3FieldsDiffer 48, boardUsedElsewhere 22, scoreDipOver05 21; fit without any conflict: 0

## Waiting for the display fix (frozen key / frozen lock shapes, card.trap.needsUi)


## Pool failures (reason: count)

- nobuild: 5145
- twins: 1405
- notRetuned: 553
- retuneFailed:forced: 8
