# Puzzle bank census summary

Candidates: 11534 (census files in source\build\bank)

## Funnel

| stage | entered | failed | passed | failure reasons |
|---|---|---|---|---|
| construct | 11534 | 3693 | 7841 | noProvenVisibleChoice: 3098; wallClock: 595 |
| dedupe | 7841 | 0 | 7841 | - |
| static | 7841 | 1671 | 6170 | A1: 735; spareNotShippable: 663; unresolved:A6: 116; A3: 111; unresolved:A4: 34; unresolved:A1: 7; unresolved:A4+A6: 4; unresolved:A1+A6: 1 |
| dScreen | 6170 | 5026 | 1144 | D<7: 2860; D<4.5: 2166 |
| stability | 1144 | 158 | 986 | cliff: 158 |
| full | 986 | 0 | 986 | - |
| band | 986 | 83 | 903 | S>6: 83 |
| trace | 903 | 798 | 105 | B2+B3: 154; B3: 106; B1+B2+B3: 70; B2+B6: 67; B2+B3+B4: 65; B3+B4: 64; B2: 63; B1+B2+B6: 58; B1+B2: 27; B1+B2+B3+B4: 26; B1+B2+B5+B6: 16; B5: 15; B2+B5+B6: 12; B6: 12; B1+B2+B3+B5+B6: 8; B1+B2+B5: 5; B2?+B3?+B4?: 4; B1+B2+B4+B6: 4; B3+B5: 3; B2+B5: 3; B2+B4: 3; B1+B2+B3+B5: 2; B4: 2; B1+B2+B4: 1; B1+B2+B3+B4+B5+B6: 1; B1+B2+B3+B6: 1; B5+B6: 1; B2+B3+B5: 1; B2+B3+B5+B6: 1; B1+B2+B4+B5+B6: 1; B2+B3+B4+B5: 1; B2+B4+B5+B6: 1 |

Banked: 105

## CPU

| stage | cpu-sec total | runs | cpu-sec per run |
|---|---|---|---|
| construct | 16509.85 | 11534 | 1.43 |
| dedupe | 0.05 | 7841 | 0 |
| static | 3767.03 | 7841 | 0.48 |
| dScreen | 11735.51 | 6170 | 1.9 |
| stability | 10550.87 | 1144 | 9.22 |
| full | 39844.37 | 986 | 40.41 |
| trace | 17005.88 | 903 | 18.83 |
| total | 99413.57 | 11534 | 8.62 |

Banked puzzles per cpu-hour: 3.8

## Knob tables, candidates that reached the D screen (n = 6170; D = D40, cap 40, 40 campaigns)

### spare

| spare | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 1 | 1638 | 0% | 1.4 | 2.3 | 3.68 |
| 2 | 2326 | 0% | 1.23 | 1.95 | 3.55 |
| 3 | 2206 | 0% | 1.15 | 2.08 | 3.65 |

### maxDown

| maxDown | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 912 | 0% | 1.18 | 1.83 | 3.33 |
| 1-10 | 1272 | 0% | 1.25 | 2.28 | 3.78 |
| 11-20 | 1616 | 0% | 1.25 | 2.15 | 3.78 |
| 21-30 | 1548 | 0% | 1.2 | 1.98 | 3.46 |
| 31+ | 822 | 0% | 1.35 | 2.33 | 3.9 |

### hiddenOnWay

| hiddenOnWay | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 3135 | 0% | 1.25 | 2.13 | 3.68 |
| 1 | 3035 | 0% | 1.23 | 2.05 | 3.58 |

### traps

| traps | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 | 1572 | 0% | 1.25 | 2.13 | 3.65 |
| 1 | 1484 | 0% | 1.3 | 2.23 | 3.91 |
| 2 | 1560 | 0% | 1.2 | 1.98 | 3.5 |
| 3 | 1554 | 0% | 1.2 | 2.03 | 3.52 |

### depth

| depth | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 2 | 955 | 0% | 1.2 | 1.9 | 3.4 |
| 3 | 870 | 0% | 1.23 | 2.05 | 3.48 |
| 4 | 853 | 0% | 1.3 | 2.38 | 3.68 |
| 5 | 845 | 0% | 1.3 | 2.28 | 3.88 |
| 6 | 657 | 0% | 1.2 | 2.05 | 3.98 |
| default | 1990 | 0% | 1.23 | 2.01 | 3.5 |

### layout

| layout | n | S pass rate | D q1 | D median | D q3 |
|---|---|---|---|---|---|
| 0 arch (80) | 148 | 0% | 1.33 | 2.29 | 4.03 |
| 1 steps (76) | 66 | 0% | 1.13 | 1.59 | 2.63 |
| 2 vase (76) | 112 | 0% | 1.27 | 2.65 | 7.22 |
| 3 ushape (80) | 137 | 0% | 1.23 | 1.8 | 3.25 |
| 4 twins (84) | 108 | 0% | 1.23 | 1.92 | 2.73 |
| 5 moon (88) | 91 | 0% | 1.29 | 2.25 | 3.38 |
| 6 pyramid · tall (84) | 98 | 0% | 1.46 | 2.3 | 3.67 |
| 7 frame (80) | 158 | 0% | 1.16 | 1.73 | 2.56 |
| 8 cross (84) | 113 | 0% | 1.2 | 1.75 | 2.9 |
| 9 heart (76) | 134 | 0% | 1.42 | 3.04 | 5.73 |
| 10 letterH (80) | 181 | 0% | 1.27 | 2.15 | 3.65 |
| 11 vase (76) | 184 | 0% | 1.15 | 1.69 | 3.1 |
| 12 arch (88) | 100 | 0% | 1.17 | 2.05 | 3.65 |
| 13 house (96) | 149 | 0% | 1.2 | 2.48 | 3.45 |
| 14 hourglass (80) | 139 | 0% | 1.44 | 2.4 | 3.49 |
| 15 pyramid · tall (80) | 90 | 0% | 1.5 | 2.39 | 3.73 |
| 16 moon (74) | 151 | 0% | 1.5 | 2.95 | 4.94 |
| 17 bowtie (76) | 110 | 0% | 1.21 | 2.34 | 3.25 |
| 18 frame (76) | 154 | 0% | 1.16 | 2.33 | 3.2 |
| 19 hourglass · ridges (76) | 114 | 0% | 1.15 | 1.54 | 2.33 |
| 20 castle · two islands (84) | 101 | 0% | 1.23 | 2.6 | 6.03 |
| 21 star (96) | 130 | 0% | 1.27 | 2.93 | 7.6 |
| 22 ushape (76) | 144 | 0% | 1.1 | 1.7 | 5.47 |
| 23 hourglass (76) | 129 | 0% | 1.18 | 1.9 | 2.55 |
| 24 twins (76) | 155 | 0% | 1.35 | 2.33 | 3.54 |
| 25 frame (84) | 107 | 0% | 1.14 | 1.55 | 2.94 |
| 26 letterH (76) | 140 | 0% | 1.13 | 1.89 | 3.51 |
| 27 steps (96) | 120 | 0% | 1.69 | 3.47 | 11.86 |
| 28 arch (72) | 93 | 0% | 1.15 | 1.53 | 2.38 |
| 29 hourglass (96) | 162 | 0% | 1.35 | 2.51 | 3.88 |
| 30 diamond (80) | 121 | 0% | 1.65 | 3.13 | 4.15 |
| 31 oval · two islands (76) | 89 | 0% | 1.18 | 1.8 | 2.93 |
| 32 twins (80) | 159 | 0% | 1.14 | 1.58 | 2.29 |
| 33 ushape (72) | 147 | 0% | 1.4 | 2.78 | 3.98 |
| 34 bowtie (84) | 96 | 0% | 1.12 | 1.83 | 4.75 |
| 35 hourglass (88) | 114 | 0% | 1.31 | 2.47 | 3.71 |
| 36 hourglass (76) | 142 | 0% | 1.43 | 2.29 | 3.28 |
| 37 frame (84) | 118 | 0% | 1.22 | 2.2 | 3.82 |
| 38 frame (88) | 110 | 0% | 1.16 | 1.52 | 2.82 |
| 39 frame (80) | 128 | 0% | 1.37 | 2.41 | 4.59 |
| 40 vase (72) | 137 | 0% | 1.23 | 2.08 | 4.53 |
| 41 hourglass (76) | 138 | 0% | 1.06 | 1.25 | 1.8 |
| 42 hourglass · ridges (76) | 145 | 0% | 1.53 | 2.78 | 4.33 |
| 43 hourglass (84) | 106 | 0% | 1.21 | 1.92 | 3.69 |
| 44 hourglass (84) | 108 | 0% | 1.27 | 1.72 | 3.56 |
| 45 frame (74) | 185 | 0% | 1.2 | 2.08 | 5.33 |
| 46 hourglass (74) | 161 | 0% | 1.27 | 2.03 | 3.3 |
| 47 pyramid (96) | 148 | 0% | 1.4 | 2.98 | 4.46 |

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
| 83d42f1d02f330a0 | 22 ushape | 76 | 10.61 | 13.84 | 1.1 | below |
| 419674a0f6e89e90 | 42 hourglass · ridges | 76 | 4.02 | 4.02 | 1.04 | below |
| afceed3c5c4129d2 | 34 bowtie | 84 | 7.8 | 7.86 | 1.02 | below |
| 02d6a5d55237ecd9 | 33 ushape | 72 | 11.48 | 12.84 | 1.14 | below |
| 340616f4292e5786 | 35 hourglass | 88 | 6.24 | 6.3 | 1.23 | below |
| 01de001920225661 | 20 castle · two islands | 84 | 13.24 | 17.38 | 1.16 | below |
| 97e3936af627fc62 | 39 frame | 80 | 15.65 | 21.08 | 4.95 | normal |
| 082447a4e4877e7a | 10 letterH | 80 | 5.99 | 6.05 | 1.15 | below |
| 32cdf17a9ae86caa | 22 ushape | 76 | 5.01 | 5.1 | 1.06 | below |
| 15cbc8ea29e2519e | 46 hourglass | 74 | 4.88 | 4.88 | 1.41 | below |
| 6aa8b515867c6d04 | 39 frame | 80 | 4.27 | 4.27 | 1.56 | below |
| 6c5be1cf651b3099 | 2 vase | 76 | 9.44 | 9.76 | 1.19 | below |
| 557060dfe01b1484 | 22 ushape | 76 | 19.89 | 39.77 | 1.02 | below |
| d4848b6cdf86cb59 | 28 arch | 72 | 16.06 | 28.95 | 1.01 | below |
| d85761756eca764b | 34 bowtie | 84 | 4.79 | 4.79 | 1.23 | below |
| 660e8b2b8c45e96b | 22 ushape | 76 | 20 | 40 | 2.44 | normal |
| 01827263e7299e12 | 16 moon | 74 | 4.96 | 4.96 | 1.79 | normal |
| 4176ac01018c90f5 | 37 frame | 84 | 5.18 | 5.19 | 1.16 | below |
| 02257721565efcb5 | 30 diamond | 80 | 5.89 | 5.92 | 1.89 | normal |
| 4931abaa332584e7 | 22 ushape | 76 | 19.29 | 36.97 | 3.7 | normal |
| 81235d41006d0206 | 24 twins | 76 | 6.97 | 6.98 | 1.35 | below |
| cd69012192ede759 | 17 bowtie | 76 | 4.26 | 4.26 | 1.1 | below |
| a319ecd9c4792d95 | 36 hourglass | 76 | 9.76 | 10.94 | 3.45 | normal |
| 1337ab5d6c7d5be4 | 16 moon | 74 | 4.35 | 4.64 | 1.08 | below |
| acb37fbbc789513a | 23 hourglass | 76 | 17.66 | 31.46 | 1.01 | below |
| 11227bc96704155f | 42 hourglass · ridges | 76 | 4.33 | 4.33 | 1.75 | normal |
| c2d1c14b08cf65da | 8 cross | 84 | 5.61 | 5.61 | 1.21 | below |
| 62088c711df51060 | 29 hourglass | 96 | 6.23 | 6.28 | 2.88 | normal |
| 08bf7b3401215b5e | 21 star | 96 | 5.36 | 5.36 | 2.08 | normal |
| d5c04d3e2ddf4879 | 47 pyramid | 96 | 11.45 | 15.43 | 2.21 | normal |
| fbd72997bdb2ae07 | 13 house | 96 | 6.41 | 6.47 | 1.38 | below |
| d3683afc75c2a0a9 | 21 star | 96 | 5.73 | 5.76 | 1.27 | below |
| fdb8bb473db53e24 | 47 pyramid | 96 | 8.09 | 8.3 | 2.36 | normal |
| 3fcf030da4e5764e | 27 steps | 96 | 5.1 | 5.1 | 1.1 | below |
