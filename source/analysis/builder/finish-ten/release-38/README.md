## Earlier 38-board candidate (superseded)

The approved swaps now produce a 42-slot candidate. See `../swap-260-280/REPORT.md` for the current plan. This file retains the earlier stage.

Dennis asked whether the refitted levels can be released. A separate candidate is prepared on `wip/codex-refit-release` in `../codex-refit-release`, directly from live `a99b338e`. It contains **38 direct refits**, with live 262 and 277 retained. The five ordinary boards that already fit, every tenth level, all levels outside the selected 38, the table length and existing metadata are unchanged. No main merge, release version bump, deployment or Firebase write has occurred.

`manifest.json` lists the exact 38 and packed board hashes. `scope-check.json` independently compares the candidate against the actual live git table, including all untouched rows and metadata. Use this release artifact, rather than copying the wider builder branch's whole level table: that branch also has unrelated future boards that are not part of this release.

The release branch adds per-board save revisions (`boardVersions`) to `Hard.designVersion`. Changed boards and repetitions of those boards use revision 10. Unchanged designed boards retain 9, and earlier generations remain unchanged. An unfinished old layout on a changed level restarts; progress, completed stars and historical recordings are retained. The existing designed-level test now expects the appropriate per-board revision, and two focused tests cover scope, decoding, repetitions and saved-game behavior.

The candidate's actual game—not only the older lab renderer—has won all 38 at 392×730. Every tile pitch measured at least **58.566 CSS px**; details are in `browser.json` and `phone-291.png`. All 38 survive the game's pack/unpack and strict solution checks.

The full offline release suite passed **172/172 tests in 394 seconds** on the isolated release candidate. `checks.json` and `full-tests.log` record the result. The 38-board candidate is ready for publication review. No deployment is authorized by the task file; this is a concrete reviewable release candidate.
