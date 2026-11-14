# Task 18 — Six constructor link kinds

## Human review supersedes the initial ranking

**Revision required; the bank is not approved as a 320+ run.** Dennis liked the traps at original lab 351, 353 and 355. The first and third need easier finishes. The simple examples need more meaningful chaining. Both key-delay examples exposed unreadable specials. See [the exact verdicts](VERDICTS.md) and [the four revised examples](REVISIONS.md). The original boards and results are preserved. The counts below describe the earlier technical delivery, not human placement approval.


Branch: `wip/codex-new-ideas`; base: `c582db46` from the newest local `wip/cc-builder-loop`. Updated task, including the forty-board combination target, is the scope.

Current independent acceptance: **92 boards**. Main 320+ catalogue: **40/40** two-idea chains, with at most four boards per primary idea pair. 28 layouts. Only `checked/` boards are accepted; raw and unfinished examples are research evidence.

**Unmet requests are explicit:** three-layer sample gaps: doubleMelt 0/4; freeMelt 0/4; clockCount 3/4. Reserve upgrades accepted: 8/15. Failed candidates were not counted or silently substituted for these requests. The forty-board main catalogue and the remaining research gaps are separate results.

No level table was changed. Nothing was merged into main, released, pushed, or written to Firebase. The numbers in the lab are local labels.

## Constructor and proofs

`chained_six_specs.js` supplies declarative recipes; `chained_six_ideas.js` supplies six link kinds, each with `place`, `pictures`, and `prove`. `chained_shapes.js` composes a dependency graph with ordered link lists. `trap_mixes.registerChain(name, {base, links})` uses the same stages for further combinations. Incompatible physical constraints fail placement; combinations are never relabelled successes.

Geometry, fixed bait pictures, and tray obligations are authored before minimum-clock search. Three-of-a-kind inserts a reserved free copy immediately after the third copy in the planned dig, then assigns the fourth copy to a buried tail tile. This differs from moving pictures on an already finished host.

For Task 18, `card.wrongIdea` records the authored link kinds. Generic earlyKey/lonelyMelt classifications of those moves remain visible as exact-priced baits, and do not double-count the featured ideas. Thus the forty-board pair cap is enforced on the actual wrongIdea ledger, not only a display label.

Every accepted new bait is a proven loss at the actual shipping deadline. Its exact price is also recorded through min(19, shortest+3). Dial 2 is required; all greedy ties are considered. A two-idea chain may have one immediate greedy lure and another separately proven losing decision. The older two-disjoint-baits requirement remains for older stories; a standalone new hard chain needs its authored bait, and combinations must prove every constituent idea.

Fixed the premature dial-2 gate: build previously called the obviousness check with no priced baits, making dial 2 fail universally. The preliminary gate now checks route obviousness; the final gate checks the priced preferred bait. The independent verifier still checks dial 2.

The verifier imports declarative specs and board predicates, and uses separate engine calls for prices, earlier-deadline unsatisfiability, and special effects. It imports no trap constructor. It checks each composed link, visibility at move 0, bait loss, and the wrong-idea ledger. A clock-count card also carries a strict winning witness for the longer top approach, avoiding the parked side tile until after the clock.

Fixed a missing picture edge in chain verification: a post-clock lock may guard the twin of an actual picture waiting in the tray at the clock. Only that measured relay connects the two acts; arbitrary matching pictures do not create graph edges. The lock must independently pass its post-clock fork/pressure effect check. A mutation test removes the relay and confirms the disconnected lock is rejected.

Composition means combining constraints, not guaranteeing physically contradictory pairs. For example, clockRoof requires a key on the pre-clock roof, whereas keysLater requires both keys to stay off the pre-clock route. With the game’s one shared key pair those exact definitions cannot coexist; placement rejects them. No second key system or new mechanic was added.

Finishing uses `bank/feel_retune.js` through `tuneFeel` with pressure parks 1.5–3 (the established finish aims inside that band), face-down share .23–.28, visible twins apart, no close four-copy pictures, strict complete replay, and a fresh independent verification. The stored feel cards use seed 9, 16 playouts. All heavy searches ran through `loop/heavy.js` with worker termination deadlines; unknown searches were rejected.

## Per idea

### One pair, two melts (`doubleMelt`)

Use the separated pair beside both ice fronts; preparing the two fronts with lonely neighbours strands two pictures.

Accepted hosts (all chains): none. Three-layer single-idea sample: none (0/4). Raw constructors yielded 0 candidates.

No accepted host. Real two-front constructions reach picture assignment and then fail `obvious:freeRoutePair`: the requested correct move is itself a ready free pair on the clock route. Pair-first greedy also prefers that correct pair over two lonely singles. To make this buildable, explicitly allow this idea’s shared correct pair in obviousness and test its wrong singles at the later frontier, or change the lure to a competing wrong ready pair. The current task requires the existing dial, so the constructor rejects it rather than weakening that gate.

Bait prices: no accepted price. 

### The dig melts it for you (`freeMelt`)

Follow the dig to thaw the frozen key or thaw tile for free; preparing it with outside neighbours spends the tray room needed by that dig.

Accepted hosts (all chains): none. Three-layer single-idea sample: none (0/4). Raw constructors yielded 1 candidates.

No accepted key/thaw host unless listed below. Frozen ordinary route tiles were explored but excluded: they are a broader idea than the requested key/thaw tile. Tight valid key/thaw placements frequently have covered combined badges, a survivable outside preparation, or ice that is redundant because the mandatory dig already removes its neighbours. A buildable change is a crossing two-route host: the frozen key/thaw tile blocks a genuinely cheaper early exit, while the intended dig removes its visible neighbours incidentally. That requires new crossing geometry, rather than making an arbitrary route tile icy.

Bait prices: no accepted price. 

### Count the clock (`clockCount`)

The ready pair advances an alternative approach, but its extra tap misses the clock; use the shorter single-tile approach.

Accepted hosts (all chains): 0, 1, 5, 6, 8, 9, 11, 12, 18, 21, 27, 30, 33, 37. Three-layer single-idea sample: L1, L18, L12 (3/4). Raw constructors yielded 89 candidates.

The initial nearby-roof candidates failed the stronger alternative-route witness and were held. The accepted recipe authors the parked side tile and proves an actual longer top approach.

Bait prices: +2 clock moves. 

### The melter’s twin is under the ice (`selfLocked`)

Leave the free melting neighbour until the other side has opened the ice that holds its twin.

Accepted hosts (all chains): 6, 11, 17, 19, 23, 25, 27, 31, 35, 36, 42, 47. Three-layer single-idea sample: L23, L31, L25, L19 (4/4). Raw constructors yielded 22 candidates.

Rejected hosts where the shortest winning route used the lonely neighbour before the ice, the visible under-ice twin was too close, or the new bait was survivable.

Bait prices: lost through price horizon; +2 clock moves. 

### Three of a kind (`savePair`)

Save one of the two free copies for the visible third copy in the dig; pairing both free copies leaves that third picture waiting through a full tray.

Accepted hosts (all chains): 0, 3, 5, 6, 7, 8, 9, 11, 12, 14, 16, 17, 18, 19, 21, 23, 24, 25, 27, 28, 30, 31, 33, 35, 36, 42, 43, 46. Three-layer single-idea sample: L17, L12, L18, L31 (4/4). Raw constructors yielded 111 candidates.

Rejected third copies outside the final shortest dig, schedules that could not reserve the free copy within three waiting tiles, and inseparable four-copy pictures.

Bait prices: +2 clock moves; +3 clock moves; lost through price horizon. 

### Keys are not for now (`keysLater`)

Save the clock before taking the ready keys; their lock guards the second act, and the two key taps miss the deadline.

Accepted hosts (all chains): 3, 5, 12, 18, 24, 28, 31, 36, 47. Three-layer single-idea sample: L31, L28, L12, L18 (4/4). Raw constructors yielded 34 candidates.

Many placements leave the tail lock idle and are rejected. Three-layer hosts are particularly restricted by the post-clock effect and picture spacing. A clock-relief experiment removed planner overflow but usually made the lock idle, so it remains an opt-in research dial.

Bait prices: +2 clock moves. Every accepted lock has a post-clock fork/pressure effect, independently reproduced.

## Main two-idea catalogue for 320+

Target met: 40/40. Extra qualified siblings stay in checked/ and are not counted beyond the pair quota.

| # | Board | Primary ideas | Layout / layers | Tiles | Clock min + spare | Pressure parks | Down |
|---:|---|---|---|---:|---|---:|---:|
| 1 | keysLater_savePair-L18-s97-p1 | keysLater+savePair | 18 / 3 | 76 | 5 + 1 | 2.2 | 25% |
| 2 | selfLocked_savePair-L31-s93-p1 | savePair+selfLocked | 31 / 3 | 76 | 9 + 1 | 1.8 | 25% |
| 3 | waitInnerIce_keysLater-L3-s277-p1 | keysLater+waitForTwin | 3 / 4 | 80 | 7 + 1 | 2.4 | 25% |
| 4 | keysLater_selfLocked-L36-s97-p1 | keysLater+selfLocked | 36 / 4 | 76 | 7 + 1 | 2.4 | 25% |
| 5 | roofThawKey_clockCount-L1-s139-p1 | clockCount+clockRoof | 1 / 3 | 76 | 9 + 1 | 1.9 | 25% |
| 6 | clockCountThaw_savePair-L8-s211-p1 | clockCount+savePair | 8 / 5 | 84 | 9 + 1 | 2.8 | 25% |
| 7 | roofThawKey_savePair-L23-s85-p1 | clockRoof+savePair | 23 / 3 | 76 | 10 + 1 | 3 | 25% |
| 8 | waitThawKey_savePair-L35-s97-p1 | savePair+waitForTwin | 35 / 5 | 88 | 9 + 1 | 1.5 | 25% |
| 9 | roofThawKey_selfLocked-L6-s97-p1 | clockRoof+selfLocked | 6 / 5 | 84 | 11 + 1 | 1.8 | 25% |
| 10 | waitThawWay_clockCount-L21-s113-p1 | clockCount+waitForTwin | 21 / 7 | 96 | 11 + 1 | 2.2 | 25% |
| 11 | selfLocked_savePair-L17-s93-p1 | savePair+selfLocked | 17 / 3 | 76 | 9 + 1 | 2.6 | 25% |
| 12 | lookalikeThaw_savePair-L19-s85-p1 | lookalikeChoice+savePair | 19 / 3 | 76 | 12 + 1 | 2 | 25% |
| 13 | waitInnerIce_keysLater-L47-s277-p1 | keysLater+waitForTwin | 47 / 5 | 96 | 7 + 1 | 1.6 | 25% |
| 14 | lookalikeThaw_clockCount-L11-s113-p1 | clockCount+lookalikeChoice | 11 / 5 | 76 | 10 + 1 | 2.9 | 25% |
| 15 | keysLater_savePair-L5-s127-p1 | keysLater+savePair | 5 / 4 | 88 | 8 + 1 | 2.9 | 25% |
| 16 | clockCount_savePair-L0-s197-p1 | clockCount+savePair | 0 / 5 | 80 | 9 + 1 | 1.6 | 25% |
| 17 | roofThawKey_savePair-L14-s85-p1 | clockRoof+savePair | 14 / 3 | 80 | 11 + 1 | 1.7 | 25% |
| 18 | waitThawWay_savePair-L7-s251-p1 | savePair+waitForTwin | 7 / 4 | 80 | 9 + 1 | 2.9 | 25% |
| 19 | selfLocked_savePair-L25-s93-p1 | savePair+selfLocked | 25 / 3 | 84 | 9 + 1 | 2.5 | 25% |
| 20 | lookalikeThaw_savePair-L27-s97-p1 | lookalikeChoice+savePair | 27 / 7 | 96 | 10 + 1 | 1.5 | 25% |
| 21 | waitThawWay_clockCount-L33-s113-p1 | clockCount+waitForTwin | 33 / 5 | 72 | 13 + 1 | 1.8 | 25% |
| 22 | keysLater_savePair-L24-s97-p1 | keysLater+savePair | 24 / 4 | 76 | 9 + 1 | 1.6 | 25% |
| 23 | clockCountThaw_savePair-L9-s211-p1 | clockCount+savePair | 9 / 6 | 76 | 11 + 1 | 1.8 | 25% |
| 24 | lookalikeThaw_clockCount-L30-s113-p1 | clockCount+lookalikeChoice | 30 / 5 | 80 | 14 + 1 | 2.2 | 25% |
| 25 | roofThawKey_savePair-L43-s97-p1 | clockRoof+savePair | 43 / 5 | 84 | 10 + 1 | 2.6 | 25% |
| 26 | keysLater_clockCount-L18-s197-p1 | clockCount+keysLater | 18 / 3 | 76 | 12 + 1 | 1.6 | 25% |
| 27 | lookalikeThaw_savePair-L46-s97-p1 | lookalikeChoice+savePair | 46 / 5 | 74 | 10 + 1 | 2.1 | 26% |
| 28 | waitNested_savePair-L16-s227-p1 | savePair+waitForTwin | 16 / 5 | 74 | 13 + 1 | 2 | 26% |
| 29 | selfLocked_savePair-L42-s127-p1 | savePair+selfLocked | 42 / 5 | 76 | 9 + 1 | 2.6 | 25% |
| 30 | waitNested_selfLocked-L31-s173-p1 | selfLocked+waitForTwin | 31 / 3 | 76 | 15 + 1 | 1.7 | 25% |
| 31 | roofThawKey_selfLocked-L35-s97-p1 | clockRoof+selfLocked | 35 / 5 | 88 | 12 + 1 | 1.7 | 25% |
| 32 | waitCoverKey_selfLocked-L47-s173-p1 | selfLocked+waitForTwin | 47 / 5 | 96 | 13 + 1 | 1.8 | 25% |
| 33 | lookalikeThaw_clockCount-L1-s113-p1 | clockCount+lookalikeChoice | 1 / 3 | 76 | 11 + 1 | 2.1 | 25% |
| 34 | keysLater_savePair-L3-s97-p1 | keysLater+savePair | 3 / 4 | 80 | 8 + 1 | 2.3 | 25% |
| 35 | waitInnerIce_keysLater-L24-s277-p1 | keysLater+waitForTwin | 24 / 4 | 76 | 11 + 1 | 2.2 | 25% |
| 36 | waitLockCover_selfLocked-L6-s173-p1 | selfLocked+waitForTwin | 6 / 5 | 84 | 13 + 1 | 3 | 25% |
| 37 | waitThawWay_clockCount-L0-s113-p1 | clockCount+waitForTwin | 0 / 5 | 80 | 15 + 1 | 1.8 | 25% |
| 38 | clockCount_savePair-L5-s197-p1 | clockCount+savePair | 5 / 4 | 88 | 11 + 1 | 1.9 | 25% |
| 39 | roofThawKey_savePair-L19-s85-p1 | clockRoof+savePair | 19 / 3 | 76 | 12 + 1 | 1.7 | 25% |
| 40 | lookalikeThaw_savePair-L23-s85-p1 | lookalikeChoice+savePair | 23 / 3 | 76 | 10 + 1 | 2.2 | 25% |

Pair use: keysLater+savePair: 4; savePair+selfLocked: 4; keysLater+waitForTwin: 3; keysLater+selfLocked: 1; clockCount+clockRoof: 1; clockCount+savePair: 4; clockRoof+savePair: 4; savePair+waitForTwin: 3; clockRoof+selfLocked: 2; clockCount+waitForTwin: 3; lookalikeChoice+savePair: 4; clockCount+lookalikeChoice: 3; clockCount+keysLater: 1; selfLocked+waitForTwin: 3.

Ordering favours fewer links/shorter digs and spreads layouts; it is a judgement, not a bot difficulty rating. The earlier six-level wrong-idea spacing rule cannot hold for an uninterrupted catalogue of two-idea boards: seven consecutive boards require fourteen distinct idea appearances, while six new plus three named old kinds supply nine. The pair cap is enforced; final interleaving with other levels belongs to the lead.

## Single-idea three-layer samples

| Idea | Boards | Hosts |
|---|---|---|
| doubleMelt | none | 0/4 |
| freeMelt | none | 0/4 |
| clockCount | clockCountThaw-L1-s139-p1, clockCountThaw-L18-s139-p1, clockCount-L12-s139-p1 | 3/4 |
| selfLocked | selfLocked-L23-s89-p1, selfLocked-L31-s89-p1, selfLocked-L25-s85-p1, selfLocked-L19-s85-p1 | 4/4 |
| savePair | savePair-L17-s83-p1, savePair-L12-s83-p1, savePair-L18-s83-p1, savePair-L31-s81-p1 | 4/4 |
| keysLater | keysLater-L31-s89-p1, keysLater-L28-s89-p1, keysLater-L12-s157-p1, keysLater-L18-s89-p1 | 4/4 |

## Fifteen reserve hosts

Each is rebuilt on its original layout and base graph with an extra new link. These are not clock-only retunes. A candidate is not an upgrade until finishing and independent acceptance pass.

| Reserve | Accepted rebuild | Status |
|---|---|---|
| waitNested-L31-s2-p2 | waitNested_savePair-L31-s97-p1, waitNested_selfLocked-L31-s173-p1 | accepted |
| waitThawKey-L18-s4-p1 | waitThawKey_savePair-L18-s107-p1 | accepted |
| waitThawWay-L14-s2-p1 | — | raw only; finish not accepted |
| waitThawWay-L31-s3-p1 | — | raw only; finish not accepted |
| waitNested-L16-s12-p2 | waitNested_savePair-L16-s227-p1 | accepted |
| waitNested-L18-s35-p2 | waitNested_savePair-L18-s107-p1, waitNested_savePair-L18-s227-p1 | accepted |
| waitNested-L3-s12-p2 | waitNested_savePair-L3-s107-p1, waitNested_savePair-L3-s227-p1 | accepted |
| waitNested-L33-s15-p3 | waitNested_savePair-L33-s227-p1 | accepted |
| waitNested-L9-s15-p1 | — | no proved rebuild |
| waitThawKey-L21-s12-p2 | waitThawKey_savePair-L21-s227-p1 | accepted |
| waitThawKey-L43-s11-p1 | — | raw only; finish not accepted |
| waitThawKey-L5-s11-p1 | — | no proved rebuild |
| waitThawWay-L23-s12-p2 | — | raw only; finish not accepted |
| waitThawWay-L7-s12-p2 | waitThawWay_savePair-L7-s251-p1 | accepted |
| waitThawWay-L9-s12-p2 | — | raw only; finish not accepted |

## Lab and review

[Open the lab](http://127.0.0.1:8266/). It uses the unchanged current `bank/lab_server.js`, including the named Lab player, `/replays` collection of `omamj.replayq*`, and “Show the way to the clock”. Findings and recordings are saved beside `source/build/new-ideas-lab/` on this PC. `lab-selection.json` identifies the easiest/hardest chosen board per yielding idea.

Strongest expected AHA: **Three of a kind**, because the familiar safe free pair becomes wrong for a visible third-copy reason; **The melter’s twin is under the ice**, because the same ice visibly explains why the tempting neighbour must wait. These are design judgements awaiting Dennis’s play, not measured ratings.

Dennis’s 337 calibration is 13 clock moves out of 15, with three waiting more than once. These boards use the requested spare 1. Candidates with a longer minimum should be treated as farther-on/end-of-catalogue material, not silently assumed to match that calibration. 96-tile boards belong in every-tenth-level slots. No placement has been made.

## Validation

Focused suite: 34 passing checks, two opt-in historical delivery checks skipped, including exhaustive agreement on 9,408 four-copy states. Command: `node --test --test-timeout=120000 source/tools/builder/test_chained_six_ideas.js source/tools/builder/test_chained_mixes.js source/tools/builder/test_chained_v2.js source/tools/builder/test_trap_mixes.js source/tools/builder/test_four_copy_matches.js` (through heavy.js). The older base-story sweep was stopped after 437 seconds; it is not reported as passing. Its initial recipe-identity assertion was updated to include composed link signatures and passed on rerun.

## Failures and reproducibility

Largest rejected-attempt counters (diagnostic logs span development revisions; acceptance uses the current proof):

- noChain: 218629
- place18:selfLocked:geometry: 106645
- place18:clockCount:geometry: 65993
- noClockPartnerHolders: 40734
- noRoofKeyCell: 34494
- place18:freeMelt:geometry: 27746
- trayOverflow: 20783
- savePairSchedule: 12731
- place18:keysLater:geometry: 11677
- place18:savePair:geometry: 9019
- clockTwinNotGate: 8527
- nested:unusedGate: 5577
- noRepeatedKeyPair: 4579
- obvious:freeRoutePair: 4432
- place18:doubleMelt:geometry: 3819
- nested:noIcyNeighbour: 3522
- fixedTwinsClose: 2755
- idea18:thirdNotInDig: 2464

Source: `source/tools/builder/chained_six_*.js`, `chained_clock_count.js`, and the changes to `trap_mixes.js`, `chained_shapes.js`, `chained_v2_finish.js`, `verify_chained_v2.js`. Logs: `source/analysis/builder/bank/new-ideas/runs/`. `selection.json` is the machine-readable handoff. `checked/` contains accepted complete artifacts, including solutions and proof cards.

Reproduce final proof refresh (through the shared heavy wrapper): `node source/tools/builder/chained_six_run.js --mode refresh --names <families> --workers 4 --minutes 10 --ms 60000`. Rebuild the handoff and lab: `node source/tools/builder/chained_six_handoff.js --lab`.
