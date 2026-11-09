# Four-copy proof correction and coupled construction

The builder could incorrectly prove a winnable matching puzzle lost. A free
tray match is not interchangeable with every other matching tile when a picture
has four copies. Which copy leaves the board can determine the outcome. This
blocked exactly the kind of deliberate matching construction being investigated.

The offline engine now branches over ambiguous matches, including a matching
clock. Its single-branch shortcut requires the sole remaining face-up copy.
The offline strict clock solver now uses a complete, budgeted finishing search
instead of treating the game's heuristic `Layouts.solve` failure as a proof.
An unfinished earlier proof prevents a later route being called the minimum.
Game code, bots, ruler pins and difficulty requirements are unchanged.

## Evidence for the correction

`counterexample.json` records a twelve-tile puzzle and a complete strict winning
replay. After removals `[11,7,1]`, taking matching tile 0 loses and matching tile
3 wins. The previous engine claimed the state lost. The same error occurs with
tile 0 as the clock. The historical engine and reproduction script are preserved.

The regression compares the corrected engine with exhaustive physical search
on 9,408 small states, including face-down variants and strict rules. The new
strict finisher is also compared with exhaustive search. Clock minima and full
witnesses are checked separately.

Both `frozen-audit.json` and the final-code `final-frozen-audit.json` recheck the
136 completed designs from the dependency and row-context experiments: zero
changed recorded minima or choice outcomes, zero unknowns, zero invalid strict
witnesses. These audits preserve the previous raw results rather than rewriting
them. They do not re-rate bots or establish qualification.

The historical G5 minimum-2 fallback receipt was separately checked at its old
clock setting: game and strict minimum 17, clock 19, calibrated static and all
required 80-campaign trace checks still pass. Its repeated-known-error ceiling
remains target 10. This is an audit of the existing S=2.33 receipt, not another
acceptance or a new fallback. No fresh ACCEPT blocks were reserved or consumed.

Pipeline v5 binds rejection identity to the proof engine and its helpers, even
in the baseline construction mode. Acceptance checkpoints bind these sources
too. Regression tests change only `finish.js` and verify that both old rejects
and old acceptance checkpoints cannot silently carry over.

## Construction results

`coupledRowChoice` turns a row's premature single into a safe uncovering move
followed by a genuine choice between matching copies. A fixed 27-recipe schedule
across nine catalogue layouts built 18 puzzles on six layouts; nine recipes
had no suitable coupling and failed explicitly. Every built puzzle has a full
strict witness and a proven winning/losing matching-copy choice. Skilled scores
are only 1.00–1.02. The fork remains avoidable enough to be too easy.

`reserveNote` instead makes spare matching copies necessary for a later passage.
It constructs 72-tile musical-note geometry, a minimum-nine-move clock, visible
spine and reserve pictures, and tiles at least 52 px on the standard viewport.
These are experimental construction controls, not calibrated presets or approved
level shapes. The fixed comparisons, all at spare 2, are:

| Construction | Skilled tries | Result |
| --- | ---: | --- |
| One reserve passage | 1.30 | Too easy |
| Two passages, first fit prototype | 18.50 | Invalid fairness evidence: one reserve picture hidden |
| Two passages, reserve pictures visible | 16.50 | Too hard |
| Close one waiting picture before the second passage | 1.13 | Too easy |
| Same relief behind one known pair | 1.13 | Too easy |
| Same relief behind two known pairs | 1.05 | Too easy |

The first two-passage prototype failed tile size and is retained in
`reserve-note-pilot`. The later hidden-picture prototype is marked in
`reserve-note-fit/LIMITATION.json`; its high score is not an improvement claim.
Family ratings were skipped when skilled scores missed the unchanged 2.5–6
band. No new board reached qualification or acceptance.

`final-controls.json` also checks the final-source one-passage, two-passage and
two-pair-relief controls against calibrated static gates. All fail required A6:
a wrong matching copy reveals the loss only after more than six further
removals. The initial pair fork also lacks an obvious goal-directed alternative
under the current check. Other required static gates pass without unresolved
proofs. This is an additional construction failure, not a reason to relax A6.

The reserve proof uses actual geometry and globally counted pictures. Two
unique pictures must wait across a four-copy passage. If both outside copies
are spent, a forced spacer introduces a fourth unmatched picture. All critical
pictures must be face-up, both spacer tiles must lie in the ordered dependency,
and extra matching escapes disable the certificate. Exhaustive checks cover
346 reachable core states and 96 certified losses, including reversed tile
indices. `reserveCuts:false` disables every certificate family for reference
checks. Relief variants retain a strict witness and the nine-move minimum.

## Validation and remaining bottleneck

All **250** builder, loop and research tests pass. `evidence-audit.json` checks
all 26 newly stored design witnesses, all 18 coupled choices, complete schedules,
and historical snapshot hashes wherever recorded. Missing historical hash keys
remain explicit. Timings include cache hits and are not clean CPU benchmarks;
CPU per finished level remains unmeasured because this continuation finished
zero qualified levels. Runs were serialized through `heavy.js`, without agents.

The next construction problem is prompt feedback from a wrong matching copy
and a gradual response to a plan: visible matching
dependencies currently produce either a readily avoided choice or an abrupt
tray-pressure cliff. More copies of the same motif and more relief depth did
not fill the gap. The next comparison should hold geometry and the main choice
fixed while changing how many *necessary* earlier choices commit tray space;
do not expand a random seed sweep or weaken the skilled floor to hide the gap.

This continues the builder objective for levels 250 onward. Family targets stay
10 at 250, 12 at 274, 13 at 275, then approximately +3 per 25 levels. No easier/
peak alternation, new fallback use, game-level writes, Firebase changes, main
changes or publication are included.
