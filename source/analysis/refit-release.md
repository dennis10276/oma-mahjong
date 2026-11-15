# Compact refit release candidate

Prepared from live `a99b338e` for Dennis's question about releasing the refitted levels. This branch is **not published**.

The table changes exactly the 38 direct refits listed in `refit-251-299.json`. Live 262 and 277 remain unchanged because the proposed swap boards do not preserve their clock chains. All every-tenth boards, the five ordinary boards that already fit and all other levels remain unchanged.

The complete construction, independent trap proofs, structural difficulty comparisons and review labs are on `wip/codex-finish-ten`, under `source/analysis/builder/finish-ten/REPORT.md`. The release table was built from the actual live table, without bringing over unrelated future builder levels.

Per-board save revisions invalidate an unfinished old layout only when its board changed, including repetitions. Player progress and completed stars stay. The exact release candidate has won all 38 through the actual game on a 392×730 phone, with at least 58.566 CSS px tile pitch.

Run `node source/tests/run.js` for the complete offline suite before publishing. Release authorization and the main merge are separate from preparing this branch.

Validation: the complete offline suite passed 172/172 tests in 394 seconds on this candidate. All 38 refits also passed actual-game wins at 392 x 730 with tile pitch at least 58.566 CSS px. No release command has been run.
