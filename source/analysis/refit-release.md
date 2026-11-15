# Compact refits and approved milestone swaps

This candidate starts from live `a99b338e` and changes exactly **42 slots**. It is not published.

| Destination | Source board |
|---|---|
| 260 | Original 262, moved intact (84 tiles) |
| 262 | Compact original 260 (82 tiles) |
| 277 | Compact original 280 (88 tiles) |
| 280 | Original 277, moved intact (76 tiles) |

These pairwise swaps were explicitly confirmed by Dennis. Level 270 stays unchanged. The other 38 direct refits stay in their original slots. All 45 ordinary levels in 251-299 now fit the near-60-pixel target; five already fitted and remain unchanged. The tenth-level exceptions keep their original boards and can use smaller tiles.

The compact 260/280 variants retain their source clock costs, special dependencies/effects, authored losing choices and full authored proofs. Independent source pressure checks remain close. Difficulty moves with the boards: this does not claim that new 277 matches old 277 in difficulty; the old hard board now provides the 280 milestone.

`refit-251-299.json` lists the exact 42 slots, source hashes, destination hashes and per-board save revisions. Every other packed row, the table length and existing metadata remain unchanged. No unrelated future builder levels were imported.

Changed slots and repetitions of those boards use save revision 10. Unchanged designed boards retain 9. An unfinished old layout on a changed board restarts; player progress, completed stars and historical recordings stay.

All 42 candidate boards have won through the actual game at 392 x 730. Ordinary refits measure at least 58.566 CSS px; the two intact milestone boards measure 54.068 CSS px. The complete offline suite passed 172/172 tests in 389 seconds on this final candidate.

Construction, fresh source proofs, pressure measurements and current labs are on `wip/codex-finish-ten`, under `source/analysis/builder/finish-ten/swap-260-280/REPORT.md`. Current comparison: http://127.0.0.1:8278/ . Current compact replacement editor: http://127.0.0.1:8279/ . Earlier 38-board candidate notes are historical.
