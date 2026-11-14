# TASK 17 candidate bank

`selection.json` gives the sixty primary boards in review order, six additional
hosts per original shape, and two clearer-key-roof variants. The `far-end/`
directory preserves the two original extreme designs separately. Nothing here
changes the level table.

Each delivered card contains `card.wrongIdea`, its clock minimum and spare,
separately proven baits, every special's ablation, twin and visibility facts,
and the prescribed expert's pressure parks. `audit-final.json` records the fresh
independent verification of all sixty primary boards plus the two clearer ones.

The primary bank includes six 96-tile boards for levels ending in zero. Review
rank is a difficulty judgment, not a consecutive placement schedule: common
wrong ideas still need spacing. Use `check_sequence.js` on the proposed numbered
level files before placement.

The original eight played boards and their verdicts are restored at
http://127.0.0.1:8265/ . `lab-selection-original.json` pins their IDs and designs.
The final eight-board selection is kept separately at
http://127.0.0.1:8265/new.html ; `lab-selection.json` identifies those boards.
Findings stay local and load on both localhost and 127.0.0.1 before the lab starts.

Start the server with:
`node source/tools/builder/chained_v2_server.js source/build/chained-v2-lab 8265`.
Rebuilding the lab preserves the original played set and its IDs.

Report: `codex-tasks/results/chained-2/REPORT.md` at the repository root.
Raw candidates, surplus examples and development logs stay local; the checked-in
manifest is the handoff. Heavy jobs must use `source/tools/builder/loop/heavy.js`.
