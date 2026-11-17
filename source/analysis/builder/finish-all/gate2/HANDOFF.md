# Task 24 handoff

Scope ends at 349. The 49 planned source boards and their placement order are unchanged. The reviewed refits use only their own tile identities and pictures; ordinary finish pairs may be removed. No layout catalogue was used.

`level-301.json` through `level-349.json` are the reviewed puzzles. Each has a current independent audit, special-picture prerequisite check, finish-pressure record, and actual game win. `checkpoint-recipes.json` reconstructs their puzzle data directly from the frozen source. Failed search dumps are diagnostics, not alternate accepted levels.

The candidate is based on released 1.70 (`97dc6221`). Every packed row and save revision through 300 is preserved. It adds 301–349 with revision 12. Extending the table changes the repeat cycle to 150–349, a 200-board span; all repeats use revision 12. There are no authored rows for 350 or above. A later table extension needs a fresh revision above 12 and another repeat-cycle check.

Review: http://127.0.0.1:8290/ . Historical/earlier/live comparisons cover 251–299; planned-source/candidate comparisons cover 301–349. Puzzle IDs remain stable, and earlier feedback is preserved.

The clock minimum, spare, special effects and prerequisites, authored wrong moves, complete strict win and authored proof all pass. Finish-pressure figures are structural samples, not human win-rate predictions. The before/after measurements remain visible in REPORT.md and the audits.

See `candidate-validation.json` and `COMMITS.md` for final integration and suite evidence. No Gate 2 release is authorized.
