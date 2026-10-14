# Rebuilding the progression from level 80

The clock-focused persona is unchanged. Observer model 2 freezes visible knowledge before evaluating a hypothetical move, so newly revealed pictures cannot steer that choice beforehand.

Use these commands in sequence from the project directory:

```
node tools/sim/build_ordered.js 8 2
node tools/sim/validate_ordered.js 8
node tools/sim/select_ordered.js
```

The first command creates candidates using the immutable 1.49 board catalog. It preserves the complete solution, clock tile and countdown, all faces along the solution through the clock, gold pairs and keys. Face swaps elsewhere must preserve that solution. Existing face-down tiles are reduced to at most 20%; none are added. Candidate layouts must retain phone tiles of at least 54 pixels.

The second command measures candidates on 8,192 games from a different seed set than candidate selection. Its seeds belong to the measurement, independently of the level number. Sensible-player rates use another 1,024 games. Measurements are cached against the source model and policy, and candidate identity.

The third command chooses a complete ordered sequence. Both full win chance and win chance conditional on reaching the clock must strictly decrease at every step. Every rate must remain within 1.5 percentage points of its target; no full-win step may drop more than four points. The selection score prefers boards with unknown-partner options at or below 22%, alongside closeness to the target. It rejects candidates with clock reach below 99%, clock expiration above 0.5%, blind choices above 12%, unknown-partner options above 28%, or a sensible-player win rate exceeding the focused player's by more than five points. Each assigned board must also fit the existing clock-margin regime at its new level number. The preserved clock travels with its whole board when levels are reordered.

This writes `analysis/levels-ordered.js` and `analysis/validation-ordered.json` for review. Only `node tools/sim/select_ordered.js --install` installs the table into the LOCAL `www` folder. No command above releases, deploys, resets a player or changes the distributed APK.

Run `node tools/sim/check_ordered.js` and the full offline tests after installing. The release script calls the ordered-difficulty gate even with `--no-tests`. Old independent per-level builders are not a replacement for this sequence: they do not enforce neighboring difficulty.

The authored catalog ends at 269. Overflow retains the hardest validated board, mirrored and with renamed pictures, instead of cycling back to easier boards. It does not claim an unbounded increase beyond the measured catalog. Extend the catalog with measured boards before promising further increases. A strict ordering of sample estimates also cannot promise that every individual human playthrough feels harder; targets measure the fixed focused persona, and small adjacent differences remain statistically uncertain.
