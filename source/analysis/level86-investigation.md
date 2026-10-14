# Level 86 investigation — 1.49

## Findings

Level 86 is a difficulty reversal after 85 in the current clock-focused model. It offers more freedom at the start, and the calibration accepts a broad range around each target without checking adjacent-level reversals. The investigation also reproduced an information leak in the bot: its hypothetical move scoring uses identities that would only become visible after committing the move. This weakens the claim that its measured win rate represents human planning difficulty.

No production files, levels, clocks, player settings or releases were changed during this investigation.

## The player received the intended board

The actual Android start events identify the focused model and the expected designs. Level 85 and 86 were both played on 1.49 with 88 tiles; their logged expected chances are 0.5583333333 and 0.635, matching the shipped table. Neither start has an easier-deal marker. Both finished without Hint or Shuffle. Level 86 took 180 seconds, versus 248 for 85. Both were won on the first attempt. These logs support the observed faster play, but they do not record individual tile choices and cannot establish which choices felt like guesses.

## Difficulty goes in the wrong direction

| Level | Approved focused target | Release measurement (600 games) | Fresh measurement |
| --- | ---: | ---: | ---: |
| 80 | 65% | 61.5% | 59.9% (1,600 games) |
| 81 | 64% | 60.7% | 63.2% (1,600 games) |
| 82 | 63% | 63.0% | 61.3% (1,600 games) |
| 83 | 62% | 69.0% | 68.0% (1,600 games) |
| 84 | 61% | 63.0% | 58.5% (1,600 games) |
| 85 | 60% | 55.8% | 58.0% (8,000 games) |
| 86 | 59% | 63.5% | 62.2% (8,000 games) |

Higher win chance means easier. The larger fresh sample confirms the 85→86 reversal: approximately 4.1 percentage points, with an approximate 95% sampling interval of 2.6–5.6 points for this difference. A single player's results are not estimated by this interval. The model does not rank 86 as easier than every one of 80–85: 83 is easier in its measurements, and 81 is similar.

The validator allows ±8 percentage points per level before 90 and ±3 points for the whole 80–89 band. Level 85 landed below its target while 86 landed above its target. Both pass. There is no test that a later neighbor is not materially easier. The band average can look correct while individual levels oscillate. See `tools/sim/validate_focused.js` and `tests/t_curve.js`.

## Board structure and uncertainty

| Property | Level 85 | Level 86 |
| --- | ---: | ---: |
| Tiles | 88 | 88 |
| Layers | 6 | 5 |
| Initially playable tiles (ice/locks respected) | 5 | 11 |
| Face-down tiles | 35 | 35 |
| Tiles completely covered by a tile at the same position | 22 | 27 |
| Initially visible, face-up tile identities | 32 | 37 |
| Clock budget | 11 | 8 |
| Preserved solution moves to the clock | 8 | 5 |
| Spare moves on that route | 3 | 3 |

86 has a more open starting board: over twice as many playable tiles and fewer layers. That offers more ways to keep matching without managing the same narrow order as 85. This is a structural explanation, not a proof that every position in 86 is easier.

There are not more face-down tiles in 86. Covered and face-down counts overlap, so they must not be added to claim that 86 hides more information overall. It actually starts with more face-up identities visible than 85.

However, among available single-tile choices in 40 sampled bot games after the clock is removed, while more than 20 tiles remain, 32.7% of choices in 86 have no currently visible or freely peekable matching tile (4,754 of 14,547), versus 17.3% in 85 (1,991 of 11,480). Those choices offer less information about where their partner is. This is a diagnostic of the sampled bot positions, not a count of the human player's guesses. None of those sampled 85/86 decision states required choosing blindly among all available tiles: at least one option had a known partner.

The combination of more freedom and more options with unknown partners can produce the reported feeling: less constrained ordering, with less useful information for distinguishing some choices. Calibration currently scores win rate, not the quality or legibility of those choices.

## Reproduced bot information leak

`Hard.play` simulates each candidate take, follows newly available tray matches and scores the resulting position. `score` then counts the actual pictures of newly takeable tiles and looks for newly exposed partners. These pictures may have been covered or face-down before the hypothetical take. The bot uses this future information while choosing whether to take the covering tile. A human cannot compare those unseen outcomes before committing.

A counterfactual test on level 86 at move 14 held all currently visible or freely peekable identities, geometry, tray, obstacles, clock and the random seed fixed. Swapping two still-unseen identities (indices 15 and 38, faces 31 and 34) changed the bot's choice from tile 34 to tile 9. The same probe with hypothetical scoring restricted to currently available identities chose tile 9 in both cases. This confirms that unseen information affects the production bot's choice, rather than the result being random variation. Similar counterexamples were found for every investigated level 80–86, so this is a systemic measurement issue, not an 86-only bug.

A second reproduction uses the shipped `Hard.play` directly, with no in-memory replay changes. With seed 4390333195 and the same hidden swap, both games take exactly the same first 14 tiles. On move 15, one chooses index 83 and the other chooses index 86. Both swapped tiles are still hidden, and all visible or freely peekable identities are identical. The clock was already removed on move 6. This isolates the problem to the remaining board, independently of the clock and the instrumentation. Run `node build/repro86_hidden.js`.

The existing hidden-information test swaps deeply buried tiles and checks only the first two decisions. It misses tiles that a candidate move would uncover, and therefore does not establish the stronger claim that the bot never uses unseen information.

The diagnostic replay was checked against the original bot for the first 40 games per investigated level: outcomes, move counts and removal order match exactly before the knowledge restriction. The restricted scorer is a counterfactual control, not a newly calibrated human model; no replacement win-rate targets are claimed for it.

## Recommended correction

1. Correct hypothetical scoring so it cannot use a newly revealed identity before committing the revealing move. Add a counterfactual regression test that swaps unseen pictures immediately under candidate moves, including after the clock is gone. Recalibrate and remeasure before trusting the difficulty percentages again.
2. Check local difficulty consistency as well as broad target bands. Use enough fresh games to distinguish a material easier neighbor from sampling noise; the present ±8-point allowance is too broad for a curve that moves by 1 point per level here.
3. Tune the visible board relationships and tray ordering, and evaluate how often choices depend on partners whose identity cannot yet be known. Keep the approved clock challenge, and do not add face-down tiles as a substitute for more useful planning.

## Reproduction artifacts

- `build/diagnose86.js`: diagnostic replay, hidden-identity counterfactual probes, structural and fresh win-rate measurements. It reads production source and creates in-memory diagnostic variants only.
- `build/repro86_hidden.js` and `analysis/level86-hidden-repro.json`: the direct counterexample using the unmodified shipped bot.
- `analysis/level86-diagnostics-85-86-8000.json`: fresh 8,000-game comparison and counterexample witnesses.
- `analysis/level86-diagnostics-80-81-82-83-84-1600.json`: fresh 1,600-game comparison for the preceding levels.
- `analysis/validation-1.48.json`: release measurements, still used by 1.49.
- `build/level-85-start.png`, `build/level-86-start.png`: screenshots inspected during the investigation.
- Private player telemetry is retained separately in `analysis/level86-player-events.json`; it was not published.
