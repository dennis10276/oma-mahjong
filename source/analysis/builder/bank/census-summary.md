# Puzzle bank census summary

Candidates: 3739 (census files in source\build\bank)

## Funnel

| stage | entered | failed | passed | failure reasons |
|---|---|---|---|---|
| construct | 3739 | 919 | 2820 | noProvenVisibleChoice: 802; wallClock: 117 |
| dedupe | 2820 | 0 | 2820 | - |
| static | 2820 | 864 | 1956 | A1: 572; spareNotShippable: 233; A3: 33; unresolved:A6: 19; unresolved:A4: 6; unresolved:A4+A6: 1 |
| dScreen | 1956 | 1795 | 161 | D<7: 1795 |
| stability | 161 | 29 | 132 | cliff: 29 |
| full | 132 | 0 | 132 | - |
| band | 132 | 17 | 115 | S>6: 17 |
| trace | 115 | 103 | 12 | B2+B3: 18; B1+B2+B3: 16; B3: 11; B2+B3+B4: 10; B1+B2+B6: 10; B3+B4: 9; B1+B2+B3+B4: 5; B2: 5; B2+B6: 5; B1+B2+B4+B6: 2; B1+B2+B5+B6: 2; B1+B2+B3+B5+B6: 2; B1+B2: 2; B1+B2+B4: 1; B2+B5+B6: 1; B2?+B3?+B4?: 1; B1+B2+B3+B6: 1; B5+B6: 1; B2+B5: 1 |

Banked: 12

## CPU

| stage | cpu-sec total | runs | cpu-sec per run |
|---|---|---|---|
| construct | 3759.9 | 3739 | 1.01 |
| dedupe | 0.02 | 2820 | 0 |
| static | 1218.14 | 2820 | 0.43 |
| dScreen | 3307.17 | 1956 | 1.69 |
| stability | 1764.71 | 161 | 10.96 |
| full | 6187.92 | 132 | 46.88 |
| trace | 2636.03 | 115 | 22.92 |
| total | 18873.9 | 3739 | 5.05 |

Banked puzzles per cpu-hour: 2.29

## Knob tables, candidates that reached the D screen (n = 1956; D = D40, cap 40, 40 campaigns)

### spare

| spare | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 1 | 535 | 0% | 1.2 | 1.7 | 2.98 |
| 2 | 730 | 0% | 1.1 | 1.35 | 2.37 |
| 3 | 691 | 0% | 1.05 | 1.23 | 2.42 |

### maxDown

| maxDown | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 299 | 0% | 1.1 | 1.27 | 2.2 |
| 1-10 | 379 | 0% | 1.12 | 1.4 | 2.65 |
| 11-20 | 524 | 0% | 1.1 | 1.4 | 2.53 |
| 21-30 | 501 | 0% | 1.08 | 1.27 | 2.53 |
| 31+ | 253 | 0% | 1.13 | 1.63 | 3.08 |

### hiddenOnWay

| hiddenOnWay | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 1000 | 0% | 1.1 | 1.4 | 2.79 |
| 1 | 956 | 0% | 1.1 | 1.35 | 2.38 |

### traps

| traps | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 508 | 0% | 1.13 | 1.45 | 2.66 |
| 1 | 462 | 0% | 1.13 | 1.49 | 2.75 |
| 2 | 509 | 0% | 1.08 | 1.33 | 2.35 |
| 3 | 477 | 0% | 1.08 | 1.33 | 2.5 |

### depth

| depth | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 2 | 275 | 0% | 1.1 | 1.33 | 2.38 |
| 3 | 305 | 0% | 1.1 | 1.55 | 2.73 |
| 4 | 272 | 0% | 1.13 | 1.45 | 3.08 |
| 5 | 277 | 0% | 1.1 | 1.43 | 2.68 |
| 6 | 230 | 0% | 1.08 | 1.25 | 2.22 |
| default | 597 | 0% | 1.1 | 1.4 | 2.48 |

### layout

| layout | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 arch (80) | 52 | 0% | 1.13 | 1.68 | 3.47 |
| 1 steps (76) | 24 | 0% | 1.12 | 1.44 | 1.89 |
| 2 vase (76) | 25 | 0% | 1.05 | 1.23 | 2.25 |
| 3 ushape (80) | 50 | 0% | 1.11 | 1.25 | 1.79 |
| 4 twins (84) | 43 | 0% | 1.14 | 1.48 | 2.4 |
| 5 moon (88) | 37 | 0% | 1.13 | 1.45 | 2.45 |
| 6 pyramid · tall (84) | 32 | 0% | 1.15 | 1.75 | 2.84 |
| 7 frame (80) | 40 | 0% | 1.08 | 1.3 | 2.03 |
| 8 cross (84) | 48 | 0% | 1.15 | 1.63 | 2.53 |
| 9 heart (76) | 35 | 0% | 1.2 | 2.68 | 4.06 |
| 10 letterH (80) | 48 | 0% | 1.19 | 1.59 | 3.58 |
| 11 vase (76) | 58 | 0% | 1.09 | 1.19 | 1.68 |
| 12 arch (88) | 41 | 0% | 1.08 | 1.2 | 2.15 |
| 13 house (96) | 41 | 0% | 1.05 | 1.13 | 2.55 |
| 14 hourglass (80) | 30 | 0% | 1.16 | 1.4 | 2.11 |
| 15 pyramid · tall (80) | 27 | 0% | 1.23 | 1.88 | 2.54 |
| 16 moon (74) | 48 | 0% | 1.15 | 1.48 | 3.23 |
| 17 bowtie (76) | 32 | 0% | 1.29 | 2.17 | 3.01 |
| 18 frame (76) | 46 | 0% | 1.05 | 1.14 | 1.72 |
| 19 hourglass · ridges (76) | 36 | 0% | 1.08 | 1.14 | 1.25 |
| 20 castle · two islands (84) | 37 | 0% | 1.13 | 1.53 | 3.28 |
| 21 star (96) | 29 | 0% | 1.25 | 2.23 | 4.97 |
| 22 ushape (76) | 52 | 0% | 1.05 | 1.23 | 3.45 |
| 23 hourglass (76) | 36 | 0% | 1.08 | 1.13 | 1.64 |
| 24 twins (76) | 49 | 0% | 1.15 | 1.53 | 2.7 |
| 25 frame (84) | 42 | 0% | 1.06 | 1.21 | 1.78 |
| 26 letterH (76) | 46 | 0% | 1.08 | 1.25 | 2.19 |
| 27 steps (96) | 28 | 0% | 1.25 | 1.52 | 2.15 |
| 28 arch (72) | 28 | 0% | 1.04 | 1.23 | 2.05 |
| 29 hourglass (96) | 38 | 0% | 1.15 | 1.69 | 2.43 |
| 30 diamond (80) | 39 | 0% | 1.32 | 1.98 | 4.8 |
| 31 oval · two islands (76) | 25 | 0% | 1.05 | 1.25 | 1.5 |
| 32 twins (80) | 48 | 0% | 1.08 | 1.23 | 1.98 |
| 33 ushape (72) | 46 | 0% | 1.27 | 2.69 | 3.66 |
| 34 bowtie (84) | 41 | 0% | 1.08 | 1.6 | 2.5 |
| 35 hourglass (88) | 40 | 0% | 1.1 | 1.61 | 3.03 |
| 36 hourglass (76) | 44 | 0% | 1.1 | 1.72 | 2.52 |
| 37 frame (84) | 48 | 0% | 1.1 | 1.38 | 2.28 |
| 38 frame (88) | 47 | 0% | 1.1 | 1.3 | 1.84 |
| 39 frame (80) | 38 | 0% | 1.08 | 1.59 | 2.65 |
| 40 vase (72) | 40 | 0% | 1.12 | 1.4 | 3 |
| 41 hourglass (76) | 42 | 0% | 1.05 | 1.12 | 1.7 |
| 42 hourglass · ridges (76) | 39 | 0% | 1.19 | 1.85 | 3.37 |
| 43 hourglass (84) | 46 | 0% | 1.1 | 1.64 | 3.21 |
| 44 hourglass (84) | 45 | 0% | 1.13 | 1.58 | 3.08 |
| 45 frame (74) | 64 | 0% | 1.08 | 1.33 | 3.26 |
| 46 hourglass (74) | 51 | 0% | 1.13 | 1.65 | 2.38 |
| 47 pyramid (96) | 35 | 0% | 1.07 | 1.27 | 3.07 |

## Knob tables, all candidates with an S screen (n = 0; S = B3 20 campaigns)

### spare

| spare | n | S pass rate (1.8-7) | S q1 | S median | S q3 |
|---|---|---|---|---|---|

### maxDown

| maxDown | n | S pass rate (1.8-7) | S q1 | S median | S q3 |
|---|---|---|---|---|---|

### hiddenOnWay

| hiddenOnWay | n | S pass rate (1.8-7) | S q1 | S median | S q3 |
|---|---|---|---|---|---|

### traps

| traps | n | S pass rate (1.8-7) | S q1 | S median | S q3 |
|---|---|---|---|---|---|

### depth

| depth | n | S pass rate (1.8-7) | S q1 | S median | S q3 |
|---|---|---|---|---|---|

### layout

| layout | n | S pass rate (1.8-7) | S q1 | S median | S q3 |
|---|---|---|---|---|---|

## Banked puzzles

| key | layout | tiles | D20 | D40 | S | band |
|---|---|---|---|---|---|---|
| 12da9f9f49d8e6a5 | 46 hourglass | 74 | 17.91 | 31.19 | 1.05 | below |
| b1ee7d2ffc06c9d9 | 8 cross | 84 | 19.11 | 38.04 | 1 | below |
| 4f6bcf4c671a1351 | 30 diamond | 80 | 9.49 | 9.75 | 1.34 | below |
| 91e303e0fabc10c7 | 29 hourglass | 96 | 20 | 39.92 | 1.01 | below |
| 627e4c7676053f16 | 22 ushape | 76 | 10.88 | 20.49 | 1.04 | below |
| 2c63e69952b30bc8 | 46 hourglass | 74 | 19.4 | 38.03 | 1.08 | below |
| 6c53f410ad1c1cc2 | 9 heart | 76 | 14.56 | 20.09 | 1.06 | below |
| a631c3ae37b235a5 | 4 twins | 84 | 5.85 | 6.4 | 4.7 | normal |
| 16f918114c547d76 | 0 arch | 80 | 10.5 | 11.56 | 4.95 | normal |
| 91bac48109389405 | 43 hourglass | 84 | 16.31 | 27.79 | 2.35 | fallback |
| 2073ccd93f55cd93 | 30 diamond | 80 | 8.71 | 9.06 | 3.29 | normal |
| 163d13c32257befc | 41 hourglass | 76 | 11.28 | 13.23 | 1.05 | below |
