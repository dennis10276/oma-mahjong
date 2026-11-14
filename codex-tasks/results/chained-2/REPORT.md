# TASK 17 — more chained traps

Technical candidate bank complete. Human review is mixed; revisions and placement review remain. No game levels were changed.

Branch `wip/codex-chained-2`, based on local `wip/cc-builder-loop` at `56c0218f`, in its own worktree. Main, Firebase, level tables, bots, ribbon and jokers were not changed. Claude’s builder/bank files were read and reused without edits. Heavy searches run through `loop/heavy.js` with disposable workers and per-job and total walls.

Review bank: 60/60 primary boards across 29 layouts; 6 have 96 tiles for ending-in-zero slots; 6 new kinds are delivered; 2/2 separate clearer lookalikeCoverThaw variants. Additional experimental records remain in local reserves.

## Dennis’s latest lab findings

Dennis’s notes do not approve this bank as a run of levels 332 and up. The sixty-board technical delivery remains available for review; human readiness is mixed and revisions are needed.

The strongest positive anchors are the exact lookalikeCoverThaw board at lab 334 (four stars, suggested 290–310) and roofThawKey at lab 336 (four stars, 300+). lookalikeCover at 335 is an easy introduction; waitThawKey at 339 belongs around 275 as-is or needs more chaining for later use. lookalikeWay at 337 has an AHA but is held for continuation/clue review.

The outsideIn pilot at 332 did not produce an AHA, and the clearLockRoof pilot at 333 was not hard enough to spot. These two examples do not establish successful new AHA ideas. The selected outsideIn board uses a different layout; it remains untested. The other new patterns in /new.html have no recorded user verdict yet. Only lab 332 explicitly comments on the finish: it was fine. That does not validate every tail.

The original rank order predates these notes and is not an approved placement order. Exact-board findings below supersede that earlier judgment. Unrated stars are shown as “—”, not zero-star reviews. Recorded wins/attempts are telemetry, separate from Dennis’s written verdict.

| Original lab | Exact board | Stars / verdict choice | Recorded results | Dennis’s note | Finding / next action |
|---:|---|---|---|---|---|
| 332 | outsideIn-L1-s21-p1.json | — / — | 0 completed, 0 wins | No AHA. Finish fine but no hard chain. | Strengthen the trap before later-level use. The finish was explicitly fine. |
| 333 | clearLockRoof-L16-s21-p1.json | — / — | 2 completed, 1 wins | A bit better nut nog hard enough to spot like the other chains. | Needs a less obvious, stronger chain before later-level use. |
| 334 | lookalikeCoverThaw-L12-s12-p2.json | 4 / — | 5 completed, 1 wins | This is an AHA yes!. 290-310 level. | Positive AHA anchor for approximately 290–310; not approval for 332+. The two clearer variants are different boards and remain untested. |
| 335 | lookalikeCover-L17-s12-p2.json | 4 / easy | 2 completed, 1 wins | Its an AHA but early introducing chains. Its an easy one. | Use as an early chain introduction or strengthen it before later placement. |
| 336 | roofThawKey-L23-s12-p2.json | 4 / right | 4 completed, 0 wins | Yes AHA moment :). 300+ level. | Positive AHA anchor for 300+. Four completed attempts and no win are recorded; do not describe this as a four-try solve. |
| 337 | lookalikeWay-L13-s12-p2.json | — / hard | 6 completed, 0 wins | Got an AHA but got stuck with it. Is that intended? I dont see it otherwise. | Hold for route and clue review. An engine win exists, but the intended continuation was not clear to Dennis. Six completed attempts and no win are recorded. |
| 338 | waitLookalikeWay-L7-s11-p1.json | 2 / easy | 1 completed, 1 wins | Easy to see the trap. too easy.. not even an AHA | This exact board is too obvious for the intended later AHA role. Its delivered sibling has a different seed and spare and is not reviewed by this note. |
| 339 | waitThawKey-L4-s11-p1.json | 3 / easy | 3 completed, 1 wins | Just about an AHA could be place around 275 or more chained to place later. | Approximately 275 as-is; add more meaningful chaining for later use. |

These findings apply to the exact files named. They do not transfer to other hosts, seeds, spare settings, or clearer-key-roof variants. Notes and IDs are preserved verbatim in lab-findings.json. The eight original boards remain at http://127.0.0.1:8265/; additional candidates are separate at /new.html.

## New hosts for the nine placed shapes

Six additional layouts are counted per shape, relative to that shape’s two previous hosts. Most also exclude all five previous layouts (0, 14, 18, 31, 36). The nested shape may use 14 and 18, which were previously hosts of other shapes; its previous hosts were 31 and 36. The eight-board lab uses only globally unseen layouts. Three layers are preferred in selection; deeper exceptions are disclosed in the board table.

| Shape | Previous hosts | Delivered additional layouts | Quota |
|---|---|---|---:|
| waitThawWay | 14, 31 | 3, 7, 9, 11, 21, 23 | 6/6 |
| waitNested | 31, 36 | 3, 9, 16, 18, 23, 33 | 6/6 |
| waitThawKey | 14, 18 | 4, 5, 16, 21, 39, 43 | 6/6 |
| lookalikeThaw | 18, 31 | 5, 6, 16, 27, 30, 46 | 6/6 |
| lookalikeCover | 18, 31 | 3, 5, 12, 13, 17, 37 | 6/6 |
| lookalikeWay | 14, 18 | 3, 5, 12, 13, 37, 47 | 6/6 |
| roofThawKey | 0, 18 | 4, 6, 11, 15, 23, 35 | 6/6 |
| waitLookalikeRoof | 14, 18 | 3, 6, 24, 30, 35, 39 | 6/6 |
| waitLookalikeWay | 14, 31 | 7, 11, 20, 41, 44, 46 | 6/6 |

The full 48-layout search matrix is in `source/analysis/builder/bank/chained-v2/host-search.json`. Per layout it records every completed search, raw successes and rejection reasons. `noChain` means the recipe placement search failed; `noClockPartnerHolders` means the exposed-clock link lacked two guarded twin holders; `fixedTwinsClose`/`noRepeatedKeyPair` reject unreadable fixed picture groups; `noProvenBait`, `clockNotBait`, `wrongRepeatedPairNotBait` and `newIdeaNotBait` reject harmless or unproven offers; `idle:*` rejects a special whose ablation has no effect. A hard wall is inconclusive. None of these bounded failures proves a layout impossible. Finishing can additionally fail separation, exact replay/minimum, face-down protection, the pressure target or the independent verifier.

| Shape | Most frequent observed barriers | Other legacy hosts intentionally unsearched |
|---|---|---|
| waitThawWay | too few late-route holders (2676); clockTwinNotGate (2598); no visible connected placement (2118) | 0, 18, 36 |
| waitNested | nested:noDirectGeometry (66536); no visible connected placement (62387); nested:noInnerKeyGeometry (43539) | none |
| waitThawKey | no visible connected placement (5286); too few late-route holders (2233); clockTwinNotGate (1013) | 0, 31, 36 |
| lookalikeThaw | no visible connected placement (5285); no separated ordinary lookalike pair (4399); two disjoint losing choices not proved (266) | 0, 14, 36 |
| lookalikeCover | no visible connected placement (13397); no separated ordinary lookalike pair (4851); two disjoint losing choices not proved (717) | 0, 14, 36 |
| lookalikeWay | no visible connected placement (30292); no separated ordinary lookalike pair (9290); two disjoint losing choices not proved (2123) | 0, 31, 36 |
| roofThawKey | no visible connected placement (5643); no exact losing bait (1273); two disjoint losing choices not proved (702) | 14, 31, 36 |
| waitLookalikeRoof | no visible connected placement (4758); too few late-route holders (1692); no separated ordinary lookalike pair (1189) | 0, 31, 36 |
| waitLookalikeWay | no separated ordinary lookalike pair (2544); too few late-route holders (2203); no visible connected placement (1757) | 0, 18, 36 |

Barrier counts span bounded searches and constructor revisions. Layouts named as unsearched are not called blocked. The earlier constructor unnecessarily required route matches below the gated clock itself; `flexClockHolders` can instead use tiles below late prerequisites. The final exact prices still decide whether taking the exposed clock loses. Extra lookalikes may consume an entire ordinary two-copy picture group; using all 36 pictures was not a game rule. Twin repair can move unmarked extra copies while keeping every authored bait/key tile fixed, and can keep improving through intermediate states before reaching the final separation threshold.

## New wrong ideas

| Kind | Wrong idea | Delivered host |
|---|---|---|
| pairedFalseMelt | The wrong idea is that a ready matching pair which advances a frozen gate must be safe before the key route. | 1 |
| sharedThawDetour | The wrong idea is that advancing two frozen fronts with one tile must beat preparing the key route. | local prototype; not counted |
| roofBeforeSide | The wrong idea is to strip the ordinary roof over the clock before preparing its access and keys. | 4 |
| twinChase | The wrong idea is to dig immediately towards a visible twin instead of saving that matching relief for the chain. | 7 |
| clearLockRoof | The wrong idea is that pairing away the roof of a locked thaw exit is useful before the key route is ready. | 16 |
| outsideIn | The wrong idea is to work inward from a free side of the clock stack instead of opening the remote prerequisite first. | 23 |
| splitPreparation | The wrong idea is to prepare both fronts at once because either preparation is safe on its own; together they spend the clock margin. | 39 |

Each delivered new link names an initially legal offer and its geometric evidence in `card.trap.newLink`. The exact engine must prove it loses at the shipped deadline, and removing each ice or lock must change the minimum or defuse a bait. All use existing game rules on a chain of three or four links. For splitPreparation, the verifier also proves that each preparation alone wins within the spare budget while the combined offer loses. Novelty is a design judgment; human AHA is not proved by engine solvability. Failed prototypes are not counted as delivered kinds.

## Wrong-idea ledger and sequence audit

`card.wrongIdea` is a sorted, unique list of the actual proven bait kinds. The read-only checker checks all shared kinds independently: distance <=6 for a wrong idea, <=20 for wrong idea plus full chain signature, and <=12 for the same layout. Duplicate levels and missing annotations fail explicitly.

```powershell
node source/tools/builder/check_sequence.js source/analysis/builder/bank/placed-250-B source/analysis/builder/bank/placed-303 --out codex-tasks/results/chained-2/sequence-history.json
```

Historical audit: 82 levels, wrongIdea6=262, wrongIdeaShape20=46, layout12=29; 15 boards lack reliable saved trap metadata. The detailed output is in sequence-history.json/.txt. Historical boards were not edited. The old metadata is traced to its original saved card and marked derived. Unknown older traps are not invented.

Within 250–302 alone: {"wrongIdea6":91,"wrongIdeaShape20":13,"layout12":1,"duplicateLevel":0}. Within 303–331 alone: {"wrongIdea6":159,"wrongIdeaShape20":27,"layout12":24,"duplicateLevel":0}. The combined result additionally includes violations across their boundary.

This is a review order, not sixty consecutive placed levels. Reusing the common early-key/lonely-melt kinds in adjacent candidate slots would violate the ledger. The lead must interleave other wrong ideas and obey the checker when assigning actual levels 332 and up; 96-tile candidates belong only at levels ending in 0. No level table was changed.

## Easier to read and far end

The key-roof readability dial measures the true covered key and its icy roof from the initial rendered geometry. Clearer variants require at least 65% of the key and 90% of the roof exposed; both old extreme boards expose 58.35% of their covered key. The original two designs are preserved in `far-end/` for the last levels. Their old pressure is archival, not a claim that they meet the v2 tail target.

- lookalikeCoverThaw-L5-s12-p3.json: {"rows":[{"key":61,"roof":82,"keyShown":0.6806,"roofShown":1}],"keyShown":0.6806,"roofShown":1}
- lookalikeCoverThaw-L3-s21-p3.json: {"rows":[{"key":68,"roof":78,"keyShown":0.6806,"roofShown":1}],"keyShown":0.6806,"roofShown":1}

## Review order

Human anchors: waitThawWay and waitNested one try, lookalikeThaw two, roofThawKey four, lookalikeCoverThaw eleven. The latter is kept out of the primary bank. The remaining shape and new-idea weights are explicit design judgments in chained_v2_handoff.js. Within that ordering, more links, deeper layers, longer clock route, less spare and fewer winning openings raise the score. This is not a player-rating model or a bot prediction.

| Order | Board | Shape | Layout | Layers | Tiles | k + spare | Starts | Pressure parks | Down |
|---:|---|---|---:|---:|---:|---|---:|---:|---:|
| 1 | waitNested-L33-s15-p3.json | waitNested | 33 | 5 | 72 | 9 + 3 | 5 | 2.5 | 25.0% |
| 2 | waitNested-L18-s35-p2.json | waitNested | 18 | 3 | 76 | 9 + 2 | 6 | 3 | 25.0% |
| 3 | waitNested-L16-s12-p2.json | waitNested | 16 | 5 | 74 | 5 + 2 | 5 | 2.4 | 25.7% |
| 4 | waitThawWay-L7-s12-p2.json | waitThawWay | 7 | 4 | 80 | 11 + 2 | 4 | 1.6 | 25.0% |
| 5 | waitNested-L3-s12-p2.json | waitNested | 3 | 4 | 80 | 13 + 2 | 7 | 1.9 | 25.0% |
| 6 | waitThawWay-L21-s12-p2.json | waitThawWay | 21 | 7 | 96 | 7 + 2 | 6 | 2.6 | 25.0% |
| 7 | waitThawWay-L23-s12-p2.json | waitThawWay | 23 | 3 | 76 | 17 + 2 | 5 | 2 | 25.0% |
| 8 | waitThawWay-L11-s11-p1.json | waitThawWay | 11 | 5 | 76 | 11 + 1 | 4 | 1.6 | 25.0% |
| 9 | waitNested-L23-s36-p1.json | waitNested | 23 | 3 | 76 | 11 + 1 | 2 | 2.7 | 25.0% |
| 10 | waitThawWay-L9-s12-p2.json | waitThawWay | 9 | 6 | 76 | 17 + 2 | 5 | 2 | 25.0% |
| 11 | waitThawWay-L3-s11-p1.json | waitThawWay | 3 | 4 | 80 | 15 + 1 | 3 | 2 | 25.0% |
| 12 | waitNested-L9-s15-p1.json | waitNested | 9 | 6 | 76 | 15 + 1 | 3 | 2.2 | 25.0% |
| 13 | waitThawKey-L39-s12-p2.json | waitThawKey | 39 | 5 | 80 | 5 + 2 | 9 | 2.4 | 25.0% |
| 14 | waitThawKey-L16-s12-p2.json | waitThawKey | 16 | 5 | 74 | 9 + 2 | 6 | 1.6 | 25.7% |
| 15 | waitThawKey-L4-s11-p1.json | waitThawKey | 4 | 4 | 84 | 9 + 1 | 3 | 1.9 | 25.0% |
| 16 | waitThawKey-L5-s11-p1.json | waitThawKey | 5 | 4 | 88 | 11 + 1 | 4 | 2.2 | 25.0% |
| 17 | waitThawKey-L43-s11-p1.json | waitThawKey | 43 | 5 | 84 | 11 + 1 | 3 | 1.8 | 25.0% |
| 18 | waitThawKey-L21-s12-p2.json | waitThawKey | 21 | 7 | 96 | 15 + 2 | 3 | 1.9 | 25.0% |
| 19 | lookalikeThaw-L5-s12-p2.json | lookalikeThaw | 5 | 4 | 88 | 11 + 2 | 7 | 1.8 | 25.0% |
| 20 | lookalikeThaw-L6-s13-p2.json | lookalikeThaw | 6 | 5 | 84 | 11 + 2 | 6 | 2.9 | 25.0% |
| 21 | lookalikeThaw-L30-s12-p2.json | lookalikeThaw | 30 | 5 | 80 | 12 + 2 | 6 | 2.1 | 25.0% |
| 22 | lookalikeThaw-L16-s12-p2.json | lookalikeThaw | 16 | 5 | 74 | 12 + 2 | 5 | 2.4 | 25.7% |
| 23 | lookalikeThaw-L46-s11-p1.json | lookalikeThaw | 46 | 5 | 74 | 8 + 1 | 3 | 1.9 | 25.7% |
| 24 | lookalikeThaw-L27-s13-p2.json | lookalikeThaw | 27 | 7 | 96 | 13 + 2 | 4 | 3 | 25.0% |
| 25 | outsideIn-L23-s21-p1.json | outsideIn | 23 | 3 | 76 | 9 + 1 | 3 | 2.5 | 25.0% |
| 26 | lookalikeCover-L17-s12-p2.json | lookalikeCover | 17 | 3 | 76 | 10 + 2 | 14 | 2 | 25.0% |
| 27 | lookalikeCover-L12-s12-p2.json | lookalikeCover | 12 | 3 | 88 | 10 + 2 | 7 | 2.5 | 25.0% |
| 28 | lookalikeCover-L5-s12-p2.json | lookalikeCover | 5 | 4 | 88 | 10 + 2 | 12 | 2.1 | 25.0% |
| 29 | lookalikeCover-L13-s12-p2.json | lookalikeCover | 13 | 3 | 96 | 12 + 2 | 9 | 1.5 | 25.0% |
| 30 | lookalikeCover-L3-s12-p2.json | lookalikeCover | 3 | 4 | 80 | 9 + 2 | 4 | 2.4 | 25.0% |
| 31 | lookalikeCover-L37-s12-p2.json | lookalikeCover | 37 | 4 | 84 | 11 + 2 | 6 | 1.5 | 25.0% |
| 32 | lookalikeWay-L37-s12-p2.json | lookalikeWay | 37 | 4 | 84 | 10 + 2 | 7 | 1.8 | 25.0% |
| 33 | lookalikeWay-L13-s12-p2.json | lookalikeWay | 13 | 3 | 96 | 13 + 2 | 11 | 2.1 | 25.0% |
| 34 | roofBeforeSide-L4-s22-p1.json | roofBeforeSide | 4 | 4 | 84 | 11 + 1 | 3 | 1.6 | 25.0% |
| 35 | lookalikeWay-L12-s11-p1.json | lookalikeWay | 12 | 3 | 88 | 13 + 1 | 4 | 1.9 | 25.0% |
| 36 | pairedFalseMelt-L1-s23-p1.json | pairedFalseMelt | 1 | 3 | 76 | 10 + 1 | 2 | 2.1 | 25.0% |
| 37 | lookalikeWay-L47-s19-p1.json | lookalikeWay | 47 | 5 | 96 | 13 + 1 | 5 | 2.2 | 25.0% |
| 38 | lookalikeWay-L3-s11-p1.json | lookalikeWay | 3 | 4 | 80 | 17 + 1 | 7 | 2.4 | 25.0% |
| 39 | lookalikeWay-L5-s11-p1.json | lookalikeWay | 5 | 4 | 88 | 16 + 1 | 4 | 2.8 | 25.0% |
| 40 | clearLockRoof-L16-s21-p1.json | clearLockRoof | 16 | 5 | 74 | 9 + 1 | 3 | 2 | 25.7% |
| 41 | roofThawKey-L23-s12-p2.json | roofThawKey | 23 | 3 | 76 | 10 + 2 | 6 | 2.3 | 25.0% |
| 42 | roofThawKey-L35-s12-p2.json | roofThawKey | 35 | 5 | 88 | 10 + 2 | 6 | 2.7 | 25.0% |
| 43 | roofThawKey-L6-s12-p2.json | roofThawKey | 6 | 5 | 84 | 10 + 2 | 4 | 2.6 | 25.0% |
| 44 | roofThawKey-L15-s12-p2.json | roofThawKey | 15 | 6 | 80 | 12 + 2 | 5 | 2.7 | 25.0% |
| 45 | twinChase-L7-s22-p1.json | twinChase | 7 | 4 | 80 | 14 + 1 | 3 | 2.1 | 25.0% |
| 46 | roofThawKey-L4-s12-p2.json | roofThawKey | 4 | 4 | 84 | 16 + 2 | 4 | 2.2 | 25.0% |
| 47 | roofThawKey-L11-s11-p1.json | roofThawKey | 11 | 5 | 76 | 16 + 1 | 3 | 2.2 | 25.0% |
| 48 | waitLookalikeRoof-L3-s12-p2.json | waitLookalikeRoof | 3 | 4 | 80 | 9 + 2 | 7 | 3 | 25.0% |
| 49 | waitLookalikeRoof-L39-s12-p2.json | waitLookalikeRoof | 39 | 5 | 80 | 9 + 2 | 5 | 2.5 | 25.0% |
| 50 | waitLookalikeRoof-L35-s12-p2.json | waitLookalikeRoof | 35 | 5 | 88 | 9 + 2 | 3 | 2.5 | 25.0% |
| 51 | waitLookalikeRoof-L6-s12-p2.json | waitLookalikeRoof | 6 | 5 | 84 | 9 + 2 | 3 | 1.7 | 25.0% |
| 52 | waitLookalikeRoof-L30-s12-p2.json | waitLookalikeRoof | 30 | 5 | 80 | 11 + 2 | 4 | 2.8 | 25.0% |
| 53 | splitPreparation-L39-s25-p1.json | splitPreparation | 39 | 5 | 80 | 7 + 1 | 4 | 2.4 | 25.0% |
| 54 | waitLookalikeRoof-L24-s11-p1.json | waitLookalikeRoof | 24 | 4 | 76 | 9 + 1 | 3 | 2 | 25.0% |
| 55 | waitLookalikeWay-L7-s12-p2.json | waitLookalikeWay | 7 | 4 | 80 | 7 + 2 | 4 | 2.3 | 25.0% |
| 56 | waitLookalikeWay-L20-s12-p2.json | waitLookalikeWay | 20 | 6 | 84 | 7 + 2 | 8 | 2 | 25.0% |
| 57 | waitLookalikeWay-L41-s12-p2.json | waitLookalikeWay | 41 | 4 | 76 | 9 + 2 | 3 | 1.9 | 25.0% |
| 58 | waitLookalikeWay-L46-s12-p2.json | waitLookalikeWay | 46 | 5 | 74 | 13 + 2 | 3 | 2.9 | 25.7% |
| 59 | waitLookalikeWay-L11-s11-p1.json | waitLookalikeWay | 11 | 5 | 76 | 9 + 1 | 4 | 2.9 | 25.0% |
| 60 | waitLookalikeWay-L44-s13-p2.json | waitLookalikeWay | 44 | 7 | 84 | 13 + 2 | 5 | 2 | 25.0% |

## Validation and lab

Each accepted board has a complete strict single-tap replay, an exact minimum with spare, no visibly close twins or close four-copy group, face-down share 23–28% outside the mechanism and shortest route, and 1.5–3 pressure parks with at most 10% of expert decisions at three waiting. Pressure uses bank/feel.js expert, 16 games, seed 9; atomic free pairs do not count as waiting. The older forcedPressure and greedy-loss/one-waiter targets are diagnostics only.

Fresh final independent audit of the current manifest: {"ok":true,"completed":62}. Real-game preview: {"ok":true,"boards":8}.

Lab: http://127.0.0.1:8265/new.html . Eight distinct hosts outside the previous five; real game, local fake/offline data, findings saved on this PC. `lab-selection.json` maps the eight previews to exact files. The lab level labels are review labels, not placement.

Reproduce the lightweight tests with `node --test source/tools/builder/test_chained_v2.js source/tools/builder/test_chained_mixes.js`. Regeneration and verification must reserve cores through loop/heavy.js. Raw candidates and finishing traces remain local; the delivered JSON cards and aggregate host evidence are the handoff.

## Verdict recovery

The original played set is restored at http://127.0.0.1:8265/ . Its eight notes, stars and verdict choices were still present in the PC findings file. Replacing the displayed board set hid most of their IDs; switching between localhost and 127.0.0.1 also changes browser storage. The replacement boards now live at /new.html. Ratings are never copied onto a different design. The original manifest and complete original board set are pinned, and rebuilds preserve them. `chained_v2_server.js` restores saved ratings before lab.js initializes, on either hostname. Fresh browser checks verified all eight original notes and rating fields on both origins; see verdict-recovery-check.json.
