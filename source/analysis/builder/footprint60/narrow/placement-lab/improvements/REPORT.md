# Workshop revisions from Dennis's edits — 2026-11-15

The lab is a way for Dennis to show where the builder misses the shape of a level
and how simply it can be edited. His saves are examples and feedback, not finished
boards the next agent should assume are mandatory solutions. Nothing here changes
the accepted Task 19 drafts, released tables, tenth levels or difficulty measurements.

## Human feedback and current evidence

The exact nine notes and saved positions are frozen in `input-notes.json`. Real
current saves remain outside the worktree in `codex-tasks/results/narrow-251-299/placements`.

| Level | Feedback / revision | Evidence and remaining work |
| --- | --- | --- |
| 251 | Choose harmless tiles instead of frozen tiles; fill the middle. New workspace parks ordinary tiles 4, 11, 33, 40, 49, 59, keeping specials on the board. | Partial foundation: 59.13 px, eight rows. A full compact finish has not been proved. |
| 252 | Dennis questioned the rejection. Keep his exact layout. | Full strict finish, minimum clock cost 8, special prerequisites/effects and authored bait prices hold. Side neighbours changed. Workshop behaviour pass; default strict geometry certificate still rejects that difference. |
| 253 | Shorten the top/bottom and bring protruding arms inward. Search now includes both-arm movements and central low filling. | New seven-row, 63.35 px partial foundation, 12 ordinary tiles at the side. Tested complete candidates missed the clock deadline; this is not a finished remake. |
| 254 | No towers. Keep his exact layout. | Workshop checks and full strict finish pass. |
| 255 | No towers; explain why the proposal failed. | His saved layout changes cover/thaw relations. The new checker names the actual connections. No good compact revision proved; proposal starts from released geometry. |
| 256 | His shape is the intended direction; no towers. | Low-fill workspace with seven ordinary tiles at the side, 58.57 px. Complete candidates did not pass. The checker now reports clock deadlines instead of throwing a tail-search error. |
| 257 | Keep it as symmetrical as possible, without towers. Keep his exact layout. | Workshop checks and full strict finish pass. Symmetry now affects candidate ranking. |
| 258 | Is nine rows really too small? | Released nine-row layout is about 52.65 px on 392×730. New eight-row partial foundation is 59.13 px, with 18 ordinary tiles at the side. The previous saved geometry changed trap connections; tested complete alternatives also changed twin visibility or clock behaviour. |
| 259 | Apply the notes and make released layouts editable. | Released editing is implemented for all 40 boards. No compact revision proved here; released geometry is the proposed starting point. |

These are bounded search outcomes, not claims that another tidy construction is
impossible. In particular, 253 is still open; the generated foundation is not a
claim to have completed Dennis's top/bottom/arms design suggestion.

## Whole lab

- Workshop passes: **252, 254, 257, 268, 282, 284, 299**.
- Partial workspaces: **251, 253, 256, 258, 261, 263, 267, 269, 272, 273, 274, 278,
  283, 286, 287, 293, 295, 297**.
- Released geometry retained: **255, 259, 262, 265, 266, 271, 277, 279, 281, 288,
  289, 291, 292, 296, 298**.

Each `level-N.json` records positions, status, candidate method, exact source hash,
search failures and, for a pass, the checked complete design and certificate.
The builder attaches these as proposal overlays without changing the original
`baseHash`, original problem IDs or any human save. New/reset workspaces use the
revisions; existing saved work only changes when Dennis chooses a proposal or reset.

## Interpretation for the next lead

Practical shape principles inferred from the notes: choose ordinary filler for
relocation, keep the mechanical cluster together, use empty central space before
adding height, and consider the whole outline and symmetry. These are implementation
lessons, not new difficulty findings or replacements for Claude's authored chains.
Use the exact notes and boards to judge the next edit; do not infer a difficulty
change from whether Dennis liked a silhouette.

The workshop records side-access changes and rechecks behaviour. Its pass is
deliberately distinct from Task 19's unchanged default geometry certificate. Do not
copy a workshop pass into accepted `narrow/level-N.json` or a release automatically.

Validation: 13 focused tests; browser QA of all 40 workspaces, direct released-board
dragging, independent saved drafts across reload, preserved notes, live proof and
an actual game win; separate bridge/drag regression. QA uses isolated data. The
real user's nine saved files were hash-checked unchanged during this update.
