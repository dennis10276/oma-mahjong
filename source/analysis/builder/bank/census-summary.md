# Puzzle bank census summary

Candidates: 6517 (census files in source\build\bank)

## Funnel

| stage | entered | failed | passed | failure reasons |
|---|---|---|---|---|
| construct | 6517 | 1992 | 4525 | noProvenVisibleChoice: 1678; wallClock: 314 |
| dedupe | 4525 | 0 | 4525 | - |
| static | 4525 | 1095 | 3430 | A1: 572; spareNotShippable: 378; A3: 70; unresolved:A6: 52; unresolved:A4: 15; unresolved:A4+A6: 4; unresolved:A1: 4 |
| dScreen | 3430 | 3036 | 394 | D<7: 3036 |
| stability | 394 | 69 | 325 | cliff: 69 |
| full | 325 | 0 | 325 | - |
| band | 325 | 34 | 291 | S>6: 34 |
| trace | 291 | 264 | 27 | B2+B3: 59; B1+B2+B3: 36; B2+B3+B4: 27; B3: 25; B3+B4: 25; B1+B2+B6: 16; B2+B6: 15; B1+B2+B3+B4: 13; B2: 11; B1+B2: 6; B1+B2+B3+B5+B6: 5; B2+B5+B6: 4; B6: 3; B1+B2+B4+B6: 2; B1+B2+B5+B6: 2; B2+B4: 2; B1+B2+B5: 2; B1+B2+B4: 1; B2?+B3?+B4?: 1; B1+B2+B3+B6: 1; B5+B6: 1; B2+B5: 1; B3+B5: 1; B4: 1; B2+B3+B5: 1; B2+B3+B5+B6: 1; B1+B2+B4+B5+B6: 1; B5: 1 |

Banked: 27

## CPU

| stage | cpu-sec total | runs | cpu-sec per run |
|---|---|---|---|
| construct | 8543.41 | 6517 | 1.31 |
| dedupe | 0.03 | 4525 | 0 |
| static | 2155.43 | 4525 | 0.48 |
| dScreen | 6458.05 | 3430 | 1.88 |
| stability | 4324.23 | 394 | 10.98 |
| full | 14801.05 | 325 | 45.54 |
| trace | 6775.1 | 291 | 23.28 |
| total | 43057.29 | 6517 | 6.61 |

Banked puzzles per cpu-hour: 2.26

## Knob tables, candidates that reached the D screen (n = 3430; D = D40, cap 40, 40 campaigns)

### spare

| spare | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 1 | 920 | 0% | 1.3 | 2.15 | 3.5 |
| 2 | 1298 | 0% | 1.15 | 1.79 | 3.32 |
| 3 | 1212 | 0% | 1.1 | 1.7 | 3.25 |

### maxDown

| maxDown | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 500 | 0% | 1.15 | 1.67 | 3.09 |
| 1-10 | 705 | 0% | 1.18 | 2.08 | 3.43 |
| 11-20 | 913 | 0% | 1.18 | 1.83 | 3.5 |
| 21-30 | 885 | 0% | 1.13 | 1.8 | 3.23 |
| 31+ | 427 | 0% | 1.23 | 2.05 | 3.64 |

### hiddenOnWay

| hiddenOnWay | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 1721 | 0% | 1.18 | 1.9 | 3.5 |
| 1 | 1709 | 0% | 1.15 | 1.83 | 3.23 |

### traps

| traps | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 915 | 0% | 1.2 | 1.93 | 3.51 |
| 1 | 811 | 0% | 1.23 | 2.03 | 3.57 |
| 2 | 880 | 0% | 1.13 | 1.74 | 3.2 |
| 3 | 824 | 0% | 1.15 | 1.75 | 3.25 |

### depth

| depth | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 2 | 492 | 0% | 1.18 | 1.75 | 3.26 |
| 3 | 510 | 0% | 1.18 | 1.98 | 3.43 |
| 4 | 483 | 0% | 1.2 | 2.08 | 3.37 |
| 5 | 472 | 0% | 1.17 | 1.95 | 3.63 |
| 6 | 377 | 0% | 1.15 | 1.65 | 3.48 |
| default | 1096 | 0% | 1.18 | 1.8 | 3.25 |

### layout

| layout | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 arch (80) | 84 | 0% | 1.18 | 1.83 | 3.49 |
| 1 steps (76) | 36 | 0% | 1.13 | 1.49 | 2.08 |
| 2 vase (76) | 46 | 0% | 1.13 | 1.92 | 5.52 |
| 3 ushape (80) | 83 | 0% | 1.18 | 1.58 | 2.74 |
| 4 twins (84) | 76 | 0% | 1.23 | 1.87 | 2.7 |
| 5 moon (88) | 65 | 0% | 1.18 | 2.1 | 3.53 |
| 6 pyramid · tall (84) | 65 | 0% | 1.3 | 2.15 | 3.63 |
| 7 frame (80) | 73 | 0% | 1.1 | 1.4 | 2.2 |
| 8 cross (84) | 77 | 0% | 1.2 | 1.68 | 2.48 |
| 9 heart (76) | 76 | 0% | 1.38 | 2.89 | 4.13 |
| 10 letterH (80) | 91 | 0% | 1.2 | 1.9 | 3.47 |
| 11 vase (76) | 99 | 0% | 1.13 | 1.55 | 2.72 |
| 12 arch (88) | 69 | 0% | 1.15 | 1.78 | 3.25 |
| 13 house (96) | 75 | 0% | 1.1 | 2.17 | 3.22 |
| 14 hourglass (80) | 71 | 0% | 1.4 | 2.15 | 3.58 |
| 15 pyramid · tall (80) | 45 | 0% | 1.4 | 2.15 | 3.35 |
| 16 moon (74) | 81 | 0% | 1.23 | 2.35 | 3.93 |
| 17 bowtie (76) | 60 | 0% | 1.44 | 2.54 | 3.35 |
| 18 frame (76) | 81 | 0% | 1.1 | 1.58 | 2.93 |
| 19 hourglass · ridges (76) | 66 | 0% | 1.11 | 1.25 | 1.85 |
| 20 castle · two islands (84) | 71 | 0% | 1.23 | 2.88 | 7.65 |
| 21 star (96) | 51 | 0% | 1.25 | 2.68 | 5.59 |
| 22 ushape (76) | 89 | 0% | 1.08 | 1.55 | 3.78 |
| 23 hourglass (76) | 65 | 0% | 1.1 | 1.53 | 2.4 |
| 24 twins (76) | 92 | 0% | 1.25 | 2.29 | 3.58 |
| 25 frame (84) | 69 | 0% | 1.13 | 1.38 | 2.42 |
| 26 letterH (76) | 79 | 0% | 1.1 | 1.7 | 2.69 |
| 27 steps (96) | 56 | 0% | 1.46 | 2.83 | 7.57 |
| 28 arch (72) | 51 | 0% | 1.12 | 1.53 | 2.55 |
| 29 hourglass (96) | 70 | 0% | 1.25 | 2.07 | 3.45 |
| 30 diamond (80) | 66 | 0% | 1.41 | 2.55 | 4.43 |
| 31 oval · two islands (76) | 44 | 0% | 1.17 | 1.62 | 2.59 |
| 32 twins (80) | 84 | 0% | 1.13 | 1.4 | 2.06 |
| 33 ushape (72) | 74 | 0% | 1.68 | 2.83 | 3.91 |
| 34 bowtie (84) | 62 | 0% | 1.16 | 1.86 | 3.8 |
| 35 hourglass (88) | 71 | 0% | 1.19 | 2.17 | 3.69 |
| 36 hourglass (76) | 72 | 0% | 1.18 | 2.14 | 3.21 |
| 37 frame (84) | 86 | 0% | 1.15 | 2.1 | 2.97 |
| 38 frame (88) | 66 | 0% | 1.15 | 1.4 | 2.29 |
| 39 frame (80) | 67 | 0% | 1.21 | 2.17 | 4.33 |
| 40 vase (72) | 75 | 0% | 1.19 | 1.9 | 4.43 |
| 41 hourglass (76) | 74 | 0% | 1.05 | 1.21 | 1.71 |
| 42 hourglass · ridges (76) | 75 | 0% | 1.43 | 2.42 | 4.27 |
| 43 hourglass (84) | 70 | 0% | 1.14 | 1.79 | 3.24 |
| 44 hourglass (84) | 76 | 0% | 1.19 | 1.67 | 4.69 |
| 45 frame (74) | 107 | 0% | 1.14 | 1.65 | 3.69 |
| 46 hourglass (74) | 81 | 0% | 1.15 | 1.75 | 3.23 |
| 47 pyramid (96) | 68 | 0% | 1.25 | 2.79 | 4.28 |

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
| 4c06fba7cf985f4a | 42 hourglass · ridges | 76 | 15.49 | 22.79 | 1.26 | below |
| fb1376fa4de0c4c9 | 14 hourglass | 80 | 17.95 | 31.84 | 1.01 | below |
| 3126a9ca5085d538 | 22 ushape | 76 | 20 | 39.89 | 1.05 | below |
| 2b11a1116266150e | 27 steps | 96 | 9.99 | 10.67 | 3.19 | normal |
| 23cb3eee625c315d | 35 hourglass | 88 | 19.43 | 37.78 | 1.02 | below |
| e70f2226be74e5f4 | 27 steps | 96 | 11.79 | 13.51 | 4.9 | normal |
| 536a0dd73605b529 | 22 ushape | 76 | 18.47 | 34.58 | 1.04 | below |
| 1861b89e329a017c | 22 ushape | 76 | 20 | 40 | 1.05 | below |
| f2cb553e8c69b993 | 14 hourglass | 80 | 5.68 | 5.84 | 5.1 | normal |
| b90cfc56b4ae89f9 | 16 moon | 74 | 19.62 | 37.71 | 3.18 | normal |
| e1068ad4fd8e2d7c | 22 ushape | 76 | 18.54 | 35.65 | 1.09 | below |
| 9c0dafd3eab1a295 | 29 hourglass | 96 | 11.97 | 19.16 | 1.27 | below |
| c6b10b7f8137d023 | 12 arch | 88 | 9.67 | 10.34 | 3.8 | normal |
| 1e81043cdec30df1 | 0 arch | 80 | 20 | 39.96 | 1.06 | below |
| eadb34f1069985e2 | 24 twins | 76 | 7.36 | 7.64 | 2.41 | fallback |
