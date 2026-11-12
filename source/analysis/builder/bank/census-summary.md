# Puzzle bank census summary

Candidates: 8708 (census files in source\build\bank)

## Funnel

| stage | entered | failed | passed | failure reasons |
|---|---|---|---|---|
| construct | 8708 | 2659 | 6049 | noProvenVisibleChoice: 2243; wallClock: 416 |
| dedupe | 6049 | 0 | 6049 | - |
| static | 6049 | 1431 | 4618 | A1: 735; spareNotShippable: 501; A3: 88; unresolved:A6: 78; unresolved:A4: 20; unresolved:A4+A6: 4; unresolved:A1: 4; unresolved:A1+A6: 1 |
| dScreen | 4618 | 3829 | 789 | D<7: 2860; D<4.5: 969 |
| stability | 789 | 114 | 675 | cliff: 114 |
| full | 675 | 0 | 675 | - |
| band | 675 | 57 | 618 | S>6: 57 |
| trace | 618 | 547 | 71 | B2+B3: 99; B3: 72; B1+B2+B3: 55; B2+B3+B4: 47; B1+B2+B6: 47; B3+B4: 46; B2+B6: 44; B2: 33; B1+B2+B3+B4: 18; B1+B2: 15; B1+B2+B5+B6: 13; B6: 9; B5: 9; B2+B5+B6: 8; B1+B2+B3+B5+B6: 7; B1+B2+B4+B6: 4; B1+B2+B5: 3; B3+B5: 2; B2+B5: 2; B4: 2; B2+B4: 2; B1+B2+B4: 1; B2?+B3?+B4?: 1; B1+B2+B3+B4+B5+B6: 1; B1+B2+B3+B5: 1; B1+B2+B3+B6: 1; B5+B6: 1; B2+B3+B5: 1; B2+B3+B5+B6: 1; B1+B2+B4+B5+B6: 1; B2+B3+B4+B5: 1 |

Banked: 71

## CPU

| stage | cpu-sec total | runs | cpu-sec per run |
|---|---|---|---|
| construct | 11651.32 | 8708 | 1.34 |
| dedupe | 0.02 | 6049 | 0 |
| static | 2853.48 | 6049 | 0.47 |
| dScreen | 8327.32 | 4618 | 1.8 |
| stability | 7149.62 | 789 | 9.06 |
| full | 26748.55 | 675 | 39.63 |
| trace | 11620.07 | 618 | 18.8 |
| total | 68350.37 | 8708 | 7.85 |

Banked puzzles per cpu-hour: 3.74

## Knob tables, candidates that reached the D screen (n = 4618; D = D40, cap 40, 40 campaigns)

### spare

| spare | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 1 | 1240 | 0% | 1.33 | 2.23 | 3.59 |
| 2 | 1730 | 0% | 1.18 | 1.8 | 3.4 |
| 3 | 1648 | 0% | 1.13 | 1.88 | 3.4 |

### maxDown

| maxDown | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 673 | 0% | 1.15 | 1.73 | 3.15 |
| 1-10 | 940 | 0% | 1.2 | 2.14 | 3.5 |
| 11-20 | 1211 | 0% | 1.2 | 1.9 | 3.58 |
| 21-30 | 1187 | 0% | 1.15 | 1.83 | 3.28 |
| 31+ | 607 | 0% | 1.27 | 2.2 | 3.72 |

### hiddenOnWay

| hiddenOnWay | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 2324 | 0% | 1.18 | 1.99 | 3.59 |
| 1 | 2294 | 0% | 1.18 | 1.88 | 3.3 |

### traps

| traps | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 1211 | 0% | 1.23 | 2 | 3.54 |
| 1 | 1098 | 0% | 1.23 | 2.13 | 3.73 |
| 2 | 1163 | 0% | 1.15 | 1.85 | 3.25 |
| 3 | 1146 | 0% | 1.15 | 1.85 | 3.3 |

### depth

| depth | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 2 | 685 | 0% | 1.18 | 1.8 | 3.28 |
| 3 | 663 | 0% | 1.18 | 1.95 | 3.38 |
| 4 | 633 | 0% | 1.2 | 2.17 | 3.5 |
| 5 | 628 | 0% | 1.22 | 2.13 | 3.68 |
| 6 | 508 | 0% | 1.15 | 1.8 | 3.85 |
| default | 1501 | 0% | 1.18 | 1.88 | 3.38 |

### layout

| layout | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 arch (80) | 106 | 0% | 1.23 | 1.86 | 3.45 |
| 1 steps (76) | 43 | 0% | 1.12 | 1.48 | 2.07 |
| 2 vase (76) | 75 | 0% | 1.21 | 2.25 | 7.03 |
| 3 ushape (80) | 106 | 0% | 1.19 | 1.7 | 3.04 |
| 4 twins (84) | 96 | 0% | 1.23 | 1.92 | 2.73 |
| 5 moon (88) | 86 | 0% | 1.25 | 2.23 | 3.41 |
| 6 pyramid · tall (84) | 88 | 0% | 1.38 | 2.28 | 3.64 |
| 7 frame (80) | 99 | 0% | 1.12 | 1.5 | 2.53 |
| 8 cross (84) | 102 | 0% | 1.2 | 1.73 | 2.86 |
| 9 heart (76) | 101 | 0% | 1.38 | 2.68 | 4.1 |
| 10 letterH (80) | 124 | 0% | 1.2 | 1.96 | 3.56 |
| 11 vase (76) | 131 | 0% | 1.15 | 1.68 | 2.88 |
| 12 arch (88) | 92 | 0% | 1.15 | 1.79 | 3.35 |
| 13 house (96) | 101 | 0% | 1.13 | 2.42 | 3.4 |
| 14 hourglass (80) | 101 | 0% | 1.4 | 2.33 | 3.3 |
| 15 pyramid · tall (80) | 60 | 0% | 1.37 | 2.17 | 3.35 |
| 16 moon (74) | 109 | 0% | 1.35 | 2.35 | 3.73 |
| 17 bowtie (76) | 83 | 0% | 1.36 | 2.4 | 3.37 |
| 18 frame (76) | 112 | 0% | 1.13 | 1.81 | 3.14 |
| 19 hourglass · ridges (76) | 81 | 0% | 1.1 | 1.25 | 1.98 |
| 20 castle · two islands (84) | 93 | 0% | 1.23 | 2.6 | 6.03 |
| 21 star (96) | 78 | 0% | 1.25 | 2.63 | 5.27 |
| 22 ushape (76) | 113 | 0% | 1.1 | 1.55 | 4.35 |
| 23 hourglass (76) | 88 | 0% | 1.1 | 1.61 | 2.51 |
| 24 twins (76) | 123 | 0% | 1.25 | 2.23 | 3.54 |
| 25 frame (84) | 94 | 0% | 1.13 | 1.54 | 2.9 |
| 26 letterH (76) | 109 | 0% | 1.1 | 1.83 | 3.38 |
| 27 steps (96) | 79 | 0% | 1.44 | 2.83 | 8.2 |
| 28 arch (72) | 65 | 0% | 1.1 | 1.53 | 2.48 |
| 29 hourglass (96) | 89 | 0% | 1.25 | 2.15 | 3.45 |
| 30 diamond (80) | 81 | 0% | 1.4 | 2.85 | 4.3 |
| 31 oval · two islands (76) | 62 | 0% | 1.11 | 1.62 | 2.92 |
| 32 twins (80) | 109 | 0% | 1.13 | 1.48 | 2.03 |
| 33 ushape (72) | 107 | 0% | 1.54 | 2.93 | 4.05 |
| 34 bowtie (84) | 87 | 0% | 1.12 | 1.75 | 3.79 |
| 35 hourglass (88) | 106 | 0% | 1.24 | 2.38 | 3.55 |
| 36 hourglass (76) | 93 | 0% | 1.18 | 2.28 | 3.28 |
| 37 frame (84) | 109 | 0% | 1.18 | 2.2 | 3.63 |
| 38 frame (88) | 95 | 0% | 1.17 | 1.5 | 2.76 |
| 39 frame (80) | 92 | 0% | 1.22 | 2.14 | 4 |
| 40 vase (72) | 111 | 0% | 1.19 | 1.9 | 4.57 |
| 41 hourglass (76) | 98 | 0% | 1.05 | 1.2 | 1.69 |
| 42 hourglass · ridges (76) | 100 | 0% | 1.43 | 2.41 | 4.23 |
| 43 hourglass (84) | 95 | 0% | 1.18 | 1.9 | 3.63 |
| 44 hourglass (84) | 99 | 0% | 1.25 | 1.7 | 4.04 |
| 45 frame (74) | 133 | 0% | 1.15 | 1.83 | 4.53 |
| 46 hourglass (74) | 116 | 0% | 1.19 | 1.82 | 3.25 |
| 47 pyramid (96) | 98 | 0% | 1.28 | 2.75 | 4.11 |

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
| ce1b50d1dfb09f95 | 36 hourglass | 76 | 6.74 | 6.74 | 1.08 | below |
| 4f6bcf4c671a1351 | 30 diamond | 80 | 9.49 | 9.75 | 1.34 | below |
| 91e303e0fabc10c7 | 29 hourglass | 96 | 20 | 39.92 | 1.01 | below |
| eea3612b65b08d5d | 16 moon | 74 | 5.71 | 5.71 | 1.13 | below |
| ac7eb10440a19af6 | 0 arch | 80 | 4.97 | 5.07 | 1.2 | below |
| 627e4c7676053f16 | 22 ushape | 76 | 10.88 | 20.49 | 1.04 | below |
| 2c63e69952b30bc8 | 46 hourglass | 74 | 19.4 | 38.03 | 1.08 | below |
| 6c53f410ad1c1cc2 | 9 heart | 76 | 14.56 | 20.09 | 1.06 | below |
| 7e6369dbebda25d0 | 10 letterH | 80 | 4.83 | 4.83 | 1 | below |
| a631c3ae37b235a5 | 4 twins | 84 | 5.85 | 6.4 | 4.7 | normal |
| ccf7c41ace79a452 | 36 hourglass | 76 | 4.12 | 4.12 | 1.06 | below |
| 5dea678fe647b016 | 32 twins | 80 | 5.43 | 5.43 | 1.31 | below |
| 16f918114c547d76 | 0 arch | 80 | 10.5 | 11.56 | 4.95 | normal |
| 91bac48109389405 | 43 hourglass | 84 | 16.31 | 27.79 | 2.35 | fallback |
| adca4df498afb826 | 7 frame | 80 | 5.58 | 5.59 | 1.06 | below |
| 5623afed9aa2e032 | 23 hourglass | 76 | 5.82 | 5.86 | 1.86 | normal |
| a2c1f19979423787 | 43 hourglass | 84 | 3.88 | 3.88 | 1.04 | below |
| 2073ccd93f55cd93 | 30 diamond | 80 | 8.71 | 9.06 | 3.29 | normal |
| 163d13c32257befc | 41 hourglass | 76 | 11.28 | 13.23 | 1.05 | below |
| 48077fa94d213ba8 | 43 hourglass | 84 | 18.89 | 36.26 | 1.01 | below |
| 4c06fba7cf985f4a | 42 hourglass · ridges | 76 | 15.49 | 22.79 | 1.26 | below |
| dd6837ba385f7a5d | 39 frame | 80 | 4.28 | 4.28 | 1.16 | below |
| 47b8684cda679d6d | 16 moon | 74 | 5.96 | 5.96 | 2.09 | normal |
| e1f6096ef5de8492 | 36 hourglass | 76 | 19.83 | 39.26 | 1.08 | below |
| fb3d054abf74ff78 | 17 bowtie | 76 | 15.49 | 17.48 | 5.08 | normal |
| 1a1d1b5bc1d3e303 | 24 twins | 76 | 6.76 | 6.76 | 2.42 | normal |
| 1de7beba3bfe7db5 | 14 hourglass | 80 | 20 | 40 | 1.1 | below |
| fb1376fa4de0c4c9 | 14 hourglass | 80 | 17.95 | 31.84 | 1.01 | below |
| 3126a9ca5085d538 | 22 ushape | 76 | 20 | 39.89 | 1.05 | below |
| 65961fe9b9208fac | 11 vase | 76 | 4.25 | 4.33 | 1.24 | below |
| 9eb3e8529baef7f1 | 31 oval · two islands | 76 | 4.14 | 4.14 | 1.76 | normal |
| 675702b265cb6fff | 20 castle · two islands | 84 | 6.9 | 6.96 | 1.68 | below |
| 793603ff82b720ad | 18 frame | 76 | 16.59 | 27.58 | 1.15 | below |
| f7989b88cf48d764 | 14 hourglass | 80 | 17.87 | 30.99 | 2.21 | normal |
| 2b11a1116266150e | 27 steps | 96 | 9.99 | 10.67 | 3.19 | normal |
| 331644540f9500c0 | 46 hourglass | 74 | 4.91 | 4.91 | 1.21 | below |
| 823a1b018c28dab7 | 25 frame | 84 | 5.51 | 5.62 | 1.18 | below |
| 99191c2e58f0df00 | 33 ushape | 72 | 5.26 | 5.33 | 1.91 | normal |
| 060d1a5d80eee5f2 | 40 vase | 72 | 5.71 | 5.89 | 2.17 | normal |
| 23cb3eee625c315d | 35 hourglass | 88 | 19.43 | 37.78 | 1.02 | below |
| 214b0966a6cfd091 | 28 arch | 72 | 4.11 | 4.38 | 1.78 | normal |
| 1f1d8c05fb7a0b44 | 18 frame | 76 | 15.38 | 27.78 | 1.09 | below |
| e70f2226be74e5f4 | 27 steps | 96 | 11.79 | 13.51 | 4.9 | normal |
| a2ca720698c16712 | 45 frame | 74 | 4.65 | 4.67 | 1.08 | below |
| 30d19393992f749d | 14 hourglass | 80 | 20 | 40 | 1 | below |
| 536a0dd73605b529 | 22 ushape | 76 | 18.47 | 34.58 | 1.04 | below |
| 1861b89e329a017c | 22 ushape | 76 | 20 | 40 | 1.05 | below |
| f2cb553e8c69b993 | 14 hourglass | 80 | 5.68 | 5.84 | 5.1 | normal |
| b90cfc56b4ae89f9 | 16 moon | 74 | 19.62 | 37.71 | 3.18 | normal |
| e1068ad4fd8e2d7c | 22 ushape | 76 | 18.54 | 35.65 | 1.09 | below |
| 0c8146c06e9cfce7 | 34 bowtie | 84 | 5.38 | 5.63 | 1.11 | below |
| 361f3aa1e53f3c82 | 29 hourglass | 96 | 4.31 | 4.31 | 2.2 | normal |
| 5449c336394d5c7e | 47 pyramid | 96 | 4.87 | 4.87 | 1.1 | below |
| c781b8b3719bbe02 | 27 steps | 96 | 5.91 | 5.94 | 1.24 | below |
| a145054402c273e9 | 39 frame | 80 | 8 | 8.48 | 1.4 | below |
| ce716f44faeb82b5 | 40 vase | 72 | 4.41 | 4.41 | 1.1 | below |
| ccc0a289ed1360dd | 35 hourglass | 88 | 19.18 | 36.56 | 2.06 | normal |
| 1638b2148ace611f | 6 pyramid · tall | 84 | 5.79 | 5.81 | 1.26 | below |
| 7fea9a3e91312fa7 | 22 ushape | 76 | 20 | 40 | 4.21 | normal |
| 9c0dafd3eab1a295 | 29 hourglass | 96 | 11.97 | 19.16 | 1.27 | below |
| c6b10b7f8137d023 | 12 arch | 88 | 9.67 | 10.34 | 3.8 | normal |
| 1e81043cdec30df1 | 0 arch | 80 | 20 | 39.96 | 1.06 | below |
| eadb34f1069985e2 | 24 twins | 76 | 7.36 | 7.64 | 2.41 | fallback |
| 1bbbb8e34f380ba4 | 26 letterH | 76 | 6.29 | 6.57 | 2.23 | normal |
| c7918fd1b3b63e6f | 40 vase | 72 | 4.47 | 4.47 | 1.01 | below |
| 6884cc73cb9c009d | 8 cross | 84 | 4.66 | 4.66 | 1.09 | below |
| ab9a9d8268f047eb | 34 bowtie | 84 | 16.51 | 28.07 | 1 | below |
| 08114da14cbe0892 | 26 letterH | 76 | 7 | 7 | 1.36 | below |
| 30026c6896502575 | 40 vase | 72 | 13.93 | 22.69 | 1.6 | below |
