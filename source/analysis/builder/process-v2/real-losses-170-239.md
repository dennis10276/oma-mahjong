# What real players lose to on live levels 170-239 (2026-11-11)

Data: Firebase `replays/<pid>` (GET only) for Dennis, Gerda, Mrs. Doubtfire, saved in `source/build/real-v2/replays/full-<pid>.json` (git-ignored; PUK not pulled, no data in range); `plays/` end events from `plays-export.json`; level table `real-170-239.json`. Script `source/tools/builder/loop/research/real_v2_losses.js` (light, seconds), numbers in `real-losses-170-239.json`.

**Retention.** `replay-retention.json` keeps 30 days, whole attempts (a daily prune deletes expired attempts, no partial thinning). The oldest record is 2026-10-13, older than the 1.54 board era, so every try on levels 170-239 is still there: replays exist for 44/44 lost tries (Dennis), 267/267 (Gerda), 44/45 (Mrs. D; the 45th is an interrupted recording) and match the ledger's lost counts (44/267/46). Counted here: end events with app >= 1.54, tile count = table, replay board identical to the table (477 tries: 114 Dennis, 306 Gerda, 57 Mrs. D). Gerda lost 267 tries, far above the 20-try cap of the earlier table (level 209: 54 lost tries, 188: 36, 196: 31). Older tries will disappear from Firebase after 30 days.

**Loss codes.** `stuck` + `ck` = alarm clock ran out; `stuck` without `ck` = tray overflow (4 waiting tiles without a partner); `restart` = the player gave up. The clock counts taps (n = 6-16 on these levels, mostly 6-10), not matches, so a clock loss is decided in the first few moves. No hint or shuffle was used in any recorded try in this range (flags `h`, `sh` and replay `shuffle` events: 0 in all 477 tries).

## 1. Loss mix and timing per player
| | Dennis | Gerda | Mrs. D |
|---|---|---|---|
| lost tries (replay) | 44 | 267 | 45 (44) |
| tray overflow | 14 (32%) | 182 (68%) | 40 (89%) |
| clock ran out | 16 (36%) | 62 (23%) | 5 (11%) |
| gave up (restart) | 14 (32%) | 23 (9%) | 0 |
| share of board cleared at loss, tray (median) | 0.10 (10 of 14 in first third, none late) | 0.27 (111 early / 57 middle / 14 late) | 0.48 (13 / 19 / 8) |
| median moves at tray loss | 3 | 7 | 12 |
| clock losses: median cleared / moves | 0.09 / 2 | 0.09 / 2 | 0.09 / 2 |
| restarts: median cleared | 0.43 (6/7/1 early/mid/late) | 0.06 | - |

Clock losses are always in the first ~9% of the board (all 83 of them are "early"): the player did not reach the alarm tile in n taps. They are concentrated on a few levels: Gerda 209 (19 of her 54 lost tries), 196 (11), 188 (7), 205 (6); Dennis 196 (4 of his 8 lost tries), 177 (2). Level 196 costs everybody clock tries (15 in total).

Tray situation at the loss (replayed state, only where the engine state is exact):
- The waiting tiles' twins are buried: 77% (Dennis, n=14), 78% (Gerda, n=182), 84% (Mrs. D, n=39) of twins were not free; 59 / 63 / 80% lay under other tiles, 42 / 48 / 41% were face-down, 15 / 11 / 6% frozen or locked (shares of twins; one tray has up to 4 tiles, so twins per loss ~ 4). Mean tiles directly above a twin: 1.2 / 1.2 / 1.5.
- Avoidable? At the last moment the tray grew from 2 to 3 waiting tiles: Gerda had a free match for a waiting tile available in 44 of 182 (24%), a free pair but no match in 78 (43%), neither in 60 (33%); the tile she took then was face-down in 59 (32%). Right before the fatal tap she had a free tile matching a waiting tile (and took another) in 60 of 182 (33%). Dennis (n=14): 4 / 7 / 3, fatal tile face-down 1; Mrs. D (n=39): 5 / 19 / 15, face-down 19 (but she plays much longer: median 94 taps).
- So about a quarter to a third of Gerda's tray losses had a free safe move that was not taken; two thirds were the tray filling up with no free match (typically after turning over a face-down tile or taking a single when a pair existed). "Face-down tile turned over as the move that filled the tray" is the most common single feature for Gerda (32% at the 3rd slot, 33% at the fatal one).

**Repeated tries: same spot or scattered?** Mostly scattered. Consecutive lost tries on a level: Gerda 235 pairs, same cause in 61% (clock-after-clock 20, tray-after-tray 119), but the fatal tile is identical in only 5 of 119 tray pairs, the set of waiting tile faces in 2 of 119, and the first 12 taps are identical in 2 of 235 (median shared opening: 1 tap). Dennis (21 pairs): same cause 8; fatal tile same in 0 of 4 tray pairs, opening identical in 1. Mrs. D (33 pairs): same cause 27 (tray); fatal tile same in 1 of 25. Cleared share differs between consecutive losses by 0.06-0.14 (median). Nobody repeats a line; they re-roll. Clock losses repeat on the same levels because the board decides them, but within a level players do not fix the opening quickly. No sign of "learning the spot"; the losses read as slips/gambles on face-down tiles plus per-level clock pressure, not as one hard passage the player keeps hitting.

## 2. Hard vs easy levels, structurally
Features come from `Hard.get()` (the table the players got). n is levels. Hard sets: Dennis 3+ tries (n = 9 of 70: 176, 177, 182, 185, 196, 205, 217, 220, 230); Gerda 10+ tries (n = 10 of 40 levels 170-209: 171, 176, 187, 188, 190, 196, 197, 200, 205, 209). AUC = chance that a hard level has the higher value than an easy one (0.5 = no separation), 90% bootstrap band.

| feature | Gerda 10+ (10 vs 30) median hard / easy, AUC | Dennis 3+ (9 vs 61) median hard / easy, AUC |
|---|---|---|
| tiles | 88 / 86, 0.73 (0.58-0.88) | 88 / 86, 0.70 (0.54-0.82) |
| face-down share (%) | 16.6 / 16.8, 0.47 | 16.0 / 16.5, 0.49 |
| clock n | 7 / 8, 0.31 (0.16-0.47) | 7 / 8, 0.43 |
| clock n / tiles | 0.080 / 0.091, 0.28 (0.12-0.47) | 0.080 / 0.091, 0.39 |
| clock slack (stored solution) | 2 / 2, 0.39 | 1 / 2, 0.44 |
| ice tiles, locks | 12 / 12, 0.42; 7 / 7, 0.46 | 11 / 12, 0.42; 6 / 7, 0.38 |
| layers (max), share on layer 3+ | 5 / 4, 0.60; 0.26 / 0.24, 0.56 | 4 / 4, 0.53; 0.21 / 0.23, 0.50 |
| free tiles at start | 14 / 11, 0.71 (0.56-0.84) | 13 / 12, 0.50 |
| faces with 2+ free copies at start (share) | 0.111 / 0.056, 0.81 (0.71-0.91) | 0.083 / 0.083, 0.52 |
| tiles whose every copy is buried at start | 0.68 / 0.75, 0.33 | 0.71 / 0.71, 0.51 |
| bot D20 | 4.7 / 2.4, 0.78 (0.65-0.90) | 2.8 / 2.9, 0.52 |

What they have in common:
- **Gerda's hard levels**: slightly bigger (88-96 tiles; the 74-76 tile levels are never hard), a SHORTER clock in absolute and relative terms (6-8 taps; 1 hard level has 12) and, surprisingly, more faces with two free copies at the start (11% vs 6%): more visible pairs, more singles to be tempted into. Face-down share, ice, locks and layers do not separate (AUC 0.4-0.6). Of her 206 lost tries on the 10 hard levels, 138 are tray, 51 clock, 17 restart; on the 30 others 44 / 11 / 6 (the clock share is 25% vs 18%).
- **Dennis' 3+ try levels** share almost nothing structural: 88 vs 86 tiles (0.70) is the only feature outside chance and he never clearly loses to board size (n = 9). His extra tries are mostly (a) restarts: 14 of his 44 lost tries (182: 2 of 2 losses, 217: 2 of 3, 220: 2 of 2), i.e. he abandons a start he does not like; (b) the clock on 196 (4) and 177 (2); (c) early tray overflow after 3-4 moves (14; opening probe losses, median 3 moves), 3 of them on 230. He loses almost no try late (1 restart past two thirds, 0 tray) so his difficulty is the opening lottery of a level, not endurance.
- The skilled player's 3+ levels are NOT the bot's high-D levels (D20 AUC 0.52, same as chance).

## 3. Cheap bot-free measures vs the bot D
Spearman rho (90% bootstrap band), n = levels. 18 candidate measures were tried, so a result at the edge of chance is expected for one or two of them: treat the single "significant" ones as leads, not findings.

| measure | Gerda tries (n=40) | Y (n=70) | Dennis tries (n=70) |
|---|---|---|---|
| bot D20 (reference) | 0.31 (0.06, 0.52) | 0.12 (-0.09, 0.31) | 0.12 (-0.07, 0.32) |
| tiles | 0.38 (0.13, 0.58) | 0.34 (0.16, 0.51) | 0.16 (-0.04, 0.36) |
| faces with 2+ free copies at start | 0.39 (0.11, 0.61) | 0.13 (-0.09, 0.33) | -0.09 (-0.30, 0.11) |
| clock n / tiles | -0.30 (-0.54, 0.00) | -0.23 (-0.42, -0.02) | -0.14 (-0.33, 0.05) |
| clock n | -0.25 (-0.50, 0.02) | -0.15 (-0.36, 0.05) | -0.09 (-0.29, 0.13) |
| clock slack - dig (taps to spare after clearing what covers the alarm) | -0.02 (-0.29, 0.22) | -0.16 (-0.35, 0.03) | -0.21 (-0.41, -0.01) |
| face-down share | -0.14 (-0.37, 0.12) | 0.01 (-0.16, 0.20) | -0.07 (-0.25, 0.13) |
| free tiles at start | 0.14 (-0.14, 0.39) | -0.05 (-0.26, 0.15) | -0.05 (-0.26, 0.15) |
| buried-twin share | -0.11 (-0.36, 0.15) | 0.08 (-0.12, 0.29) | 0.05 (-0.14, 0.25) |
| ice, locks, max layer | |rho| <= 0.10 | |rho| <= 0.04 | |rho| <= 0.12 |
| skilled bot S | 0.15 (-0.10, 0.43) | 0.11 (-0.09, 0.33) | 0.15 (-0.04, 0.34) |

Gerda's raw lost-try counts (uncapped, 0-54 per level) give the same ranks (the cap 20 hardly matters for rank). Within Gerda's own losses, the two causes separate differently: clock losses fall with clock n/tiles (rho -0.34 (-0.56, -0.08)) and clock slack (-0.29 (-0.54, -0.02)), i.e. the tighter the alarm the more clock losses; tray losses rise with faces having 2+ free copies (0.41 (0.18, 0.61)) and tiles (0.36 (0.10, 0.59)).

Honest reading: several cheap measures (tile count, free pairs at start, clock tightness) match the bot D20 for Gerda (0.3-0.4 vs 0.31) but are not clearly better: the bands overlap fully, n = 40, and ~18 measures were tried. For Dennis (n = 70) and the pooled Y no cheap measure, and not the bot, predicts anything (all |rho| <= 0.2, bands include 0, apart from clock slack - dig -0.21 for Dennis with a band that just excludes 0; sign says: less spare time, more tries). None would justify replacing D; a combination of tiles + clock tightness + start pairs for the normal player is a candidate to test on new levels (fresh, pre-registered) instead of fitting more here.

## What real difficulty is made of
- **Skilled player (Dennis)**: little. 70/70 won, 61 on the 1st or 2nd try, 44 lost tries in total, nearly all in the first tenth of the board: clock not reached in n taps (16), early tray overflow after 3-4 moves (14), gave up on a start (14). Structural cause for the 9 levels with 3+ tries is not visible in the table; level 196 (6 taps, dig 3, clock) and 177/230 stand out through the alarm clock and the opening. It is opening luck plus the alarm, not a long hard board, and the bots do not capture it (D20 and S rank-uncorrelated).
- **Normal player (Gerda, Mrs. D)**: mostly tray overflow in the first third (Gerda, 68%) or middle (Mrs. D, 89%), with about 80% of the waiting tiles' twins buried and 40-50% of those face-down, a third of the fatal moves turning over a face-down tile, a quarter with a free match overlooked, plus the alarm on a few tight-clock levels (196, 209, 188, 205). Larger boards and a tight clock raise it; layers, ice, locks and face-down share do not separate.

## Not available / caveats
- Mrs. D only through level 182 (13 levels, 45 lost tries), Gerda through 209 (209 unfinished: 54 lost tries so far), Dennis all, PUK not pulled. No normal-player data at 210+.
- Replays hold taps and engine state but not what the player SAW: a face-down tile's face is in the state whether or not it was turned. "Twin face-down" therefore means unseen at the loss only if never peeked; seen-ness and the peek (`p`) history were not used. Mrs. D one lost try is an interrupted recording; 3 more recordings are incomplete (win/other).
- Hint use is not logged in this range (0). The "free match / free pair" checks use free tiles with ice and locks (state `ob`), no look-ahead beyond one move.
- Hard-level sets are tiny (n = 9, 10); AUC bands are bootstrap, not corrected for 18 measures. The cap 20 in the earlier table affects only the tries column.
- Clock-slack "dig" is an estimate (tiles on top and the cheaper side); "slack" uses the stored solution's position of the clock tile.
