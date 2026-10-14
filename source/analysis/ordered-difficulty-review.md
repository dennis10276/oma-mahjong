# Unpublished local difficulty rebuild

The source project is updated locally. Nothing has been released, pushed, installed on the phone or reset. The distributed app remains 1.49.

The observer no longer uses pictures revealed only by a hypothetical move. The focused persona remains unchanged. Levels 1–79 retain their exact existing table rows. Levels 80–269 form a strictly decreasing sequence of measured focused-player win chances, also when considering only games that reach the clock. Every level stays within 1.5 percentage points of its target. No neighboring full-win drop exceeds four points. Selection also favors useful visible partner information.

The boards were selected and reordered as complete boards. Each clock travels with its board: its tile, counter, solution through the clock, and faces along that route are preserved. Face arrangements elsewhere supply the challenge. Existing face-down tiles are reduced from up to 40% to at most 20%; none are added. Gold pairs, keys and a complete legal solution are protected.

| Level | Focused win chance | Target | Reaches clock |
| --- | ---: | ---: | ---: |
| 80 | 65.71% | 65.00% | 100.00% |
| 81 | 65.41% | 64.00% | 100.00% |
| 82 | 62.35% | 63.00% | 99.94% |
| 83 | 61.83% | 62.00% | 99.84% |
| 84 | 61.52% | 61.00% | 99.95% |
| 85 | 60.42% | 60.00% | 100.00% |
| 86 | 57.69% | 59.00% | 99.78% |
| 87 | 57.64% | 58.00% | 99.99% |
| 88 | 57.12% | 57.00% | 100.00% |
| 89 | 56.98% | 56.00% | 99.79% |
| 90 | 54.80% | 55.00% | 99.68% |
| 100 | 45.92% | 45.00% | 100.00% |
| 120 | 35.62% | 35.00% | 99.67% |
| 150 | 30.43% | 30.00% | 100.00% |
| 200 | 24.72% | 24.96% | 99.98% |
| 269 | 17.35% | 18.00% | 99.96% |

Each candidate was measured over 8,192 focused games on seeds separate from candidate generation. The final order is selected from these fresh estimates; they are not a second holdout evaluation of the selected order. Sensible-player measurements use 1,024 games.

Across the selected sequence, mean clock reach is 99.94%; the lowest is 99.24%. Mean expiration rate is 0.04%; the highest is 0.48%. Difficulty after the clock decreases in all 189 neighboring comparisons.

| Level | Old unknown-partner options | New unknown-partner options | New face-down tiles |
| --- | ---: | ---: | ---: |
| 80 | 40.61% | 23.05% | 17/88 |
| 85 | 28.44% | 17.43% | 15/76 |
| 86 | 34.08% | 13.43% | 17/88 |

Unknown-partner options are available single-tile choices whose matching tile is neither visible nor freely peekable in the sampled positions. This diagnoses useful information; it does not count a human player’s guesses. Old and new rows are different boards, and their sampled positions differ.

The approved targets through 150 remain. The former 30% plateau now gradually falls to 18% at 269. Beyond 269, the app mirrors and renames the hardest validated board instead of cycling to an easier board. That prevents an easier reset, but does not claim further increases beyond the authored catalog.

A fixed test player and finite samples cannot guarantee that every human attempt feels harder, or distinguish every tiny neighboring difference statistically. Small adjacent rate differences remain uncertain. Real play feedback is still needed before treating these rates as personal predictions.

Offline verification: 94/94 tests passed on the final selection (offline; 263 seconds). The observer fixtures fail under the 1.49 observer and pass with the fix. The release gate checks model freshness, exact board hashes, every neighboring step, protected clocks, solution proofs, information limits and earlier-level preservation, even when release tests are skipped.

Rebuild workflow: [ORDERED_LEVELS.md](../tools/sim/ORDERED_LEVELS.md). Raw measurements: [validation-ordered.json](validation-ordered.json).
