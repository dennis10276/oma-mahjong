# Current live levels 80–150: solvability and uncertainty

**Measured the actual live app, version 1.49, levels 80–150 inclusive (71 levels). No unpublished level data was measured here.**

Downloaded the live browser assets and the app update bundle at 2026-10-12T21:57:21.033Z. Their level tables match byte-for-byte. The live legality rules also match the audit oracle. Version and level table were checked again after measurement. The deployed level-table SHA-256 is `79db375bc2ece069a0bc1224ebc4d9fd7722e4c979ddf6ce4e31ebdde579d305`.

## What the audit establishes

- **71/71 levels have a verified complete winning route**, respecting the tray, ice, locks and clock. This proves they are beatable.
- **290,816 fresh games**: 4,096 per level, using the clock-focused player. There were 60,653 wins. These are bot results, not human first-try win chances.
- **2,657 winning games**, across **5/71 levels**, contained no deliberate selection of a single tile with an unseen matching partner. These levels were: 81, 90, 103, 109, 141.
- Across 6,032,667 scored decisions, 484,245 (8.03%) selected a tile with no known partner.
- The bot did not win in this sample on 11 levels: 86, 89, 92, 100, 108, 117, 127, 129, 132, 134, 149. Their verified winning routes still pass.

**A universal no-guess guarantee is not proved. These results also do not prove that guessing is unavoidable.** An unmatched tile can be a safe information-gathering move; choosing between known pairs can still involve hidden-future uncertainty. A failed or bounded search cannot establish that every possible player strategy needs a guess.

## Measurement model and limits

The measurement uses the corrected observation-only audit player with the same focused profile as live 1.49. The older simulation code shipped with 1.49 could let newly uncovered hidden faces affect a candidate score; it is unsuitable for a guessing audit. Correcting the observer does not alter the live boards or game.

The audit player knows takeable face-down faces through idealised free peeks, and treats face-up tiles without an exact-position covering tile as readable. It does not simulate blocked-tap x-ray, all deductions from tile counts, or every human strategy. Consequently its win rates must not be read as your win chances or the probability of requiring a guess. Its failure on a level you already beat is evidence of that model limitation.

The same seed set is used for every board, and is independent of previous level selection. Candidate choices use the corrected frozen knowledge state, not future revealed faces.

## Bounded searches for routes using known partners

A separate search allows free peeks and their automatic matches, but deliberately parks only identified tiles with a known matching partner elsewhere. It can use hindsight to choose route order. This restricted condition is not equivalent to deduction-only play. Fixed-order free inspection also excludes other possible strategies.

| Visibility model | Conditional route certificates | Hit 30,000-node limit | No route under restricted policy |
|---|---:|---:|---:|
| Only fully uncovered face-up faces known | 0 | 8 | 63 |
| All face-up identities granted known, including covered tiles | 5 | 44 | 22 |

The second model grants extra information. Its certificates, if any, are conditional witnesses. Neither row certifies a universal no-guess strategy, and neither failure column proves guessing is necessary.

## Every live level

All rows use 4,096 games. “No unseen-partner wins” is a count of winning games, not a proof that their move order is logically deducible. “Clock losses” counts games ending specifically on the countdown.

| Level | Bot wins | Bot win rate | No unseen-partner wins | Clock losses | Winning route |
|---|---:|---:|---:|---:|---|
| 80 | 1145 | 27.95% | 0 | 0 | Verified |
| 81 | 2342 | 57.18% | 2338 | 0 | Verified |
| 82 | 752 | 18.36% | 0 | 0 | Verified |
| 83 | 338 | 8.25% | 0 | 10 | Verified |
| 84 | 1350 | 32.96% | 0 | 0 | Verified |
| 85 | 1 | 0.02% | 0 | 8 | Verified |
| 86 | 0 | 0.00% | 0 | 0 | Verified |
| 87 | 2091 | 51.05% | 0 | 0 | Verified |
| 88 | 6 | 0.15% | 0 | 157 | Verified |
| 89 | 0 | 0.00% | 0 | 0 | Verified |
| 90 | 2641 | 64.48% | 19 | 0 | Verified |
| 91 | 1930 | 47.12% | 0 | 1672 | Verified |
| 92 | 0 | 0.00% | 0 | 0 | Verified |
| 93 | 18 | 0.44% | 0 | 431 | Verified |
| 94 | 1294 | 31.59% | 0 | 0 | Verified |
| 95 | 48 | 1.17% | 0 | 0 | Verified |
| 96 | 388 | 9.47% | 0 | 2899 | Verified |
| 97 | 1745 | 42.60% | 0 | 0 | Verified |
| 98 | 1660 | 40.53% | 0 | 355 | Verified |
| 99 | 2130 | 52.00% | 0 | 0 | Verified |
| 100 | 0 | 0.00% | 0 | 1 | Verified |
| 101 | 1944 | 47.46% | 0 | 0 | Verified |
| 102 | 5 | 0.12% | 0 | 1046 | Verified |
| 103 | 3886 | 94.87% | 4 | 6 | Verified |
| 104 | 1970 | 48.10% | 0 | 404 | Verified |
| 105 | 2547 | 62.18% | 0 | 415 | Verified |
| 106 | 31 | 0.76% | 0 | 235 | Verified |
| 107 | 1144 | 27.93% | 0 | 2091 | Verified |
| 108 | 0 | 0.00% | 0 | 0 | Verified |
| 109 | 454 | 11.08% | 120 | 0 | Verified |
| 110 | 1667 | 40.70% | 0 | 1040 | Verified |
| 111 | 1414 | 34.52% | 0 | 2 | Verified |
| 112 | 2275 | 55.54% | 0 | 0 | Verified |
| 113 | 878 | 21.44% | 0 | 0 | Verified |
| 114 | 48 | 1.17% | 0 | 0 | Verified |
| 115 | 1070 | 26.12% | 0 | 0 | Verified |
| 116 | 1107 | 27.03% | 0 | 1262 | Verified |
| 117 | 0 | 0.00% | 0 | 1 | Verified |
| 118 | 1297 | 31.67% | 0 | 2750 | Verified |
| 119 | 1517 | 37.04% | 0 | 1458 | Verified |
| 120 | 947 | 23.12% | 0 | 11 | Verified |
| 121 | 605 | 14.77% | 0 | 365 | Verified |
| 122 | 2 | 0.05% | 0 | 29 | Verified |
| 123 | 24 | 0.59% | 0 | 658 | Verified |
| 124 | 2 | 0.05% | 0 | 280 | Verified |
| 125 | 729 | 17.80% | 0 | 0 | Verified |
| 126 | 2 | 0.05% | 0 | 190 | Verified |
| 127 | 0 | 0.00% | 0 | 2183 | Verified |
| 128 | 114 | 2.78% | 0 | 571 | Verified |
| 129 | 0 | 0.00% | 0 | 0 | Verified |
| 130 | 680 | 16.60% | 0 | 833 | Verified |
| 131 | 1420 | 34.67% | 0 | 0 | Verified |
| 132 | 0 | 0.00% | 0 | 272 | Verified |
| 133 | 430 | 10.50% | 0 | 1567 | Verified |
| 134 | 0 | 0.00% | 0 | 105 | Verified |
| 135 | 12 | 0.29% | 0 | 1341 | Verified |
| 136 | 697 | 17.02% | 0 | 2151 | Verified |
| 137 | 1255 | 30.64% | 0 | 0 | Verified |
| 138 | 320 | 7.81% | 0 | 334 | Verified |
| 139 | 1541 | 37.62% | 0 | 92 | Verified |
| 140 | 1639 | 40.01% | 0 | 0 | Verified |
| 141 | 182 | 4.44% | 176 | 1806 | Verified |
| 142 | 2 | 0.05% | 0 | 782 | Verified |
| 143 | 773 | 18.87% | 0 | 0 | Verified |
| 144 | 1303 | 31.81% | 0 | 0 | Verified |
| 145 | 1513 | 36.94% | 0 | 0 | Verified |
| 146 | 110 | 2.69% | 0 | 2314 | Verified |
| 147 | 530 | 12.94% | 0 | 689 | Verified |
| 148 | 1812 | 44.24% | 0 | 1350 | Verified |
| 149 | 0 | 0.00% | 0 | 8 | Verified |
| 150 | 876 | 21.39% | 0 | 0 | Verified |

## Files and reproduction

- `source-manifest.json`: fetched URLs, timestamps and SHA-256 hashes.
- `snapshot/`: captured live browser assets and app update bundle.
- `measurements.json`: complete per-level metrics, winning witnesses and seeds for sample wins.
- `measurements.csv`: per-level results for a spreadsheet.
- `route-audit.json`: bounded search outcomes and any conditional certificates.
- `checks.json`: source, accounting, witness and example-replay checks.

Run from the project root:

```powershell
node tools/sim/measure_live_information.js 4096
node tools/sim/audit_live_information_routes.js
node tools/sim/report_live_information.js
```

All 7 consistency checks passed. The game, live levels, unpublished levels and player progress were left unchanged. Nothing was published.
