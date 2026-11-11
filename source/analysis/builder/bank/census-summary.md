# Puzzle bank census summary

Candidates: 189 (census files in source\build\bank)

## Funnel

| stage | entered | failed | passed | failure reasons |
|---|---|---|---|---|
| construct | 189 | 44 | 145 | noProvenVisibleChoice: 41; wallClock: 3 |
| dedupe | 145 | 0 | 145 | - |
| static | 145 | 38 | 107 | A1: 26; spareNotShippable: 10; A3: 2 |
| dScreen | 107 | 97 | 10 | D<7: 97 |
| stability | 10 | 3 | 7 | cliff: 3 |
| full | 7 | 0 | 7 | - |
| band | 7 | 1 | 6 | S>6: 1 |
| trace | 6 | 4 | 2 | B1+B2+B3+B4: 1; B1+B2+B3: 1; B3+B4: 1; B1+B2: 1 |

Banked: 2

## CPU

| stage | cpu-sec total | runs | cpu-sec per run |
|---|---|---|---|
| construct | 168.31 | 189 | 0.89 |
| dedupe | 0 | 145 | 0 |
| static | 57.72 | 145 | 0.4 |
| dScreen | 201.36 | 107 | 1.88 |
| stability | 80.38 | 10 | 8.04 |
| full | 394.67 | 7 | 56.38 |
| trace | 108.52 | 6 | 18.09 |
| total | 1010.95 | 189 | 5.35 |

Banked puzzles per cpu-hour: 7.12

## Knob tables, candidates that reached the D screen (n = 107; D = D40, cap 40, 40 campaigns)

### spare

| spare | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 1 | 31 | 0% | 1.15 | 1.68 | 3.32 |
| 2 | 39 | 0% | 1.13 | 1.23 | 2.15 |
| 3 | 37 | 0% | 1.02 | 1.13 | 1.7 |

### maxDown

| maxDown | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 16 | 0% | 1.04 | 1.12 | 1.29 |
| 1-10 | 9 | 0% | 1.35 | 1.48 | 2.33 |
| 11-20 | 35 | 0% | 1.07 | 1.2 | 2.17 |
| 21-30 | 28 | 0% | 1.07 | 1.15 | 1.83 |
| 31+ | 19 | 0% | 1.24 | 2.3 | 3.49 |

### hiddenOnWay

| hiddenOnWay | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 57 | 0% | 1.08 | 1.25 | 2.48 |
| 1 | 50 | 0% | 1.11 | 1.2 | 1.83 |

### traps

| traps | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 35 | 0% | 1.1 | 1.2 | 2.68 |
| 1 | 23 | 0% | 1.09 | 1.15 | 1.77 |
| 2 | 28 | 0% | 1.07 | 1.31 | 2.36 |
| 3 | 21 | 0% | 1.08 | 1.68 | 2.3 |

### depth

| depth | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 2 | 17 | 0% | 1.2 | 1.35 | 2.3 |
| 3 | 17 | 0% | 1.15 | 1.23 | 3.23 |
| 4 | 17 | 0% | 1.08 | 1.45 | 1.95 |
| 5 | 18 | 0% | 1.07 | 1.72 | 2.76 |
| 6 | 14 | 0% | 1.08 | 1.13 | 1.24 |
| default | 24 | 0% | 1.1 | 1.15 | 1.54 |

### layout

| layout | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 arch (80) | 3 | 0% | 1.83 | 2.53 | 4.06 |
| 1 steps (76) | 1 | 0% | 1.15 | 1.15 | 1.15 |
| 2 vase (76) | 2 | 0% | 1.13 | 1.13 | 1.13 |
| 3 ushape (80) | 4 | 0% | 1.16 | 1.92 | 2.82 |
| 4 twins (84) | 5 | 0% | 1.35 | 1.95 | 2.83 |
| 6 pyramid · tall (84) | 3 | 0% | 1.52 | 1.95 | 2.97 |
| 7 frame (80) | 1 | 0% | 1 | 1 | 1 |
| 8 cross (84) | 1 | 0% | 1.18 | 1.18 | 1.18 |
| 9 heart (76) | 1 | 0% | 1.08 | 1.08 | 1.08 |
| 10 letterH (80) | 1 | 0% | 1.93 | 1.93 | 1.93 |
| 11 vase (76) | 4 | 0% | 1.11 | 1.21 | 1.27 |
| 12 arch (88) | 3 | 0% | 2.13 | 3.25 | 16.98 |
| 13 house (96) | 1 | 0% | 1.23 | 1.23 | 1.23 |
| 14 hourglass (80) | 1 | 0% | 3.23 | 3.23 | 3.23 |
| 15 pyramid · tall (80) | 1 | 0% | 1.2 | 1.2 | 1.2 |
| 16 moon (74) | 2 | 0% | 1.02 | 1.04 | 1.06 |
| 18 frame (76) | 4 | 0% | 1.02 | 1.09 | 1.48 |
| 20 castle · two islands (84) | 1 | 0% | 9.38 | 9.38 | 9.38 |
| 22 ushape (76) | 2 | 0% | 1.21 | 1.42 | 1.62 |
| 23 hourglass (76) | 2 | 0% | 1.1 | 1.12 | 1.13 |
| 24 twins (76) | 2 | 0% | 1.04 | 1.08 | 1.11 |
| 25 frame (84) | 5 | 0% | 1.02 | 1.05 | 1.08 |
| 26 letterH (76) | 2 | 0% | 1.91 | 2.11 | 2.32 |
| 27 steps (96) | 4 | 0% | 1.04 | 1.08 | 1.16 |
| 28 arch (72) | 3 | 0% | 1.22 | 1.35 | 1.42 |
| 29 hourglass (96) | 4 | 0% | 1.13 | 1.18 | 1.51 |
| 30 diamond (80) | 4 | 0% | 2.71 | 6.05 | 15.21 |
| 31 oval · two islands (76) | 1 | 0% | 1.35 | 1.35 | 1.35 |
| 32 twins (80) | 2 | 0% | 1.46 | 1.74 | 2.02 |
| 33 ushape (72) | 2 | 0% | 1.22 | 1.39 | 1.56 |
| 34 bowtie (84) | 2 | 0% | 1.6 | 1.85 | 2.1 |
| 35 hourglass (88) | 4 | 0% | 1.07 | 1.12 | 1.29 |
| 36 hourglass (76) | 1 | 0% | 1.8 | 1.8 | 1.8 |
| 37 frame (84) | 1 | 0% | 1.68 | 1.68 | 1.68 |
| 38 frame (88) | 2 | 0% | 1.1 | 1.2 | 1.3 |
| 40 vase (72) | 3 | 0% | 1.07 | 1.13 | 1.15 |
| 41 hourglass (76) | 2 | 0% | 1.21 | 1.29 | 1.37 |
| 42 hourglass · ridges (76) | 3 | 0% | 1.1 | 1.15 | 13.94 |
| 43 hourglass (84) | 5 | 0% | 1.83 | 3.73 | 5.03 |
| 44 hourglass (84) | 1 | 0% | 1.25 | 1.25 | 1.25 |
| 45 frame (74) | 6 | 0% | 1.61 | 2.82 | 12.38 |
| 46 hourglass (74) | 3 | 0% | 1.92 | 2.63 | 3.29 |
| 47 pyramid (96) | 2 | 0% | 1.01 | 1.02 | 1.04 |

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
| 4f6bcf4c671a1351 | 30 diamond | 80 | 9.49 | 9.75 | 1.34 | below |
| a631c3ae37b235a5 | 4 twins | 84 | 5.85 | 6.4 | 4.7 | normal |
