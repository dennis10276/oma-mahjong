# Trap design (workflow trap-design, 2026-11-12)

## Merged build specification

# Merged trap build spec (read-only; nothing built, nothing rated)

All paths are under `C:/Users/den_k/Idea/OmasMahjong/cc-builder-loop/source/tools/`.

## Verdict
Both designs make the same core fix, and the code confirms the cause: `findTemptingPairs` (`builder-next/construct.js:126-131`) keeps the bait away from ice and dig (`nearDig`). A has the sharper proofs; B has the better pictures and rightly puts repeated pictures in the second act.

Code facts that change both designs:
- **Thaw only gets easier.** Ice-neighbours are same-layer tiles within 2 plus tiles directly above or below (`www/layouts.js:349`). Removing a tile can never spoil a thaw.
- **A5 counts only pair or match baits costing 1-2 moves.** `temptingMoves` skips way tiles and almost all singles, so a single-tile bait needs its own `D.priceMove` proof.
- **Gate A2 prunes any special that does not change k.** Ice the dig thaws for free, and every post-clock special, counts as idle.
- **`planDig` cannot thaw a frozen side-blocker.** `needSet` follows only cover, lock to keys, and ice to neighbours.
- **k is at most 19**, so at least 75% of tiles always remain after the clock.

Dropped as wishful:
- **A-T4 Guard Duel** and A-T2's "thaw before the dig removes tiles": impossible, because thaw is monotone.
- **A-T3's bait** (N2's pair): N2 is on the winning route and costs nothing.
- **B-T3's proof** ("dig the cover without B"): B is in the cover, so every line takes it. Re-specified as trap 1.
- **B-T7 Two-front keys:** no recipe makes key order cost 2.
- **A-T7 / B-T6 blind forks:** deferred; face-down tiles on the mechanism are what Dennis called luck (261).
- **A-T6 / B-T2 stand-alone:** room-in-tray stories were under 1% hard in bank run 1 (`builder/bank/specs.js`). Folded into trap 3.
- **A-T5 Clock Bait, B-T8:** later; B-T8 moves into the second act.
- **Second act:** "at least 35% tiles left" is vacuous, and `canReachWithin` is clock-only, so it cannot run on the tail.

## Trap types to build first
Each story hand-builds `roles` plus `roles.bait` (authored bait tiles) and carries its own proof. Spare 1 by default. Every role tile is face-up and `c.roleShown0`.

**1. Key on the clock** (from 262; B-T3 fixed)
- **Picture:** locked clock. Key B lies free on top of the clock stack. Key A is far, under 1-3 tiles.
- **Bait:** tap B. It then waits in the tray through A's whole dig.
- **Recipe:** lock on the clock; B is a free tile in `above[clock]`; A by distance. The dig orphans (`planDigPictures`) are taken before A is free.
- **Proofs:** `priceMove(start, single B)` is lose or cost at least 2, exact; the stored route takes the keys consecutively; lock not idle.
- **Dial:** A's cover 1-3, orphans 1-2, spare 1-2.
- **Layout:** any. A rough geometry count finds candidate clocks on all 48.
- **Risks:** the bait is not lethal if the tray never fills during A's dig (low yield); A4 single order.

**2. The short thaw** (from 254; A-T3 plus B-T1)
- **Picture:** clock frozen h2, uncovered. Neighbours are lock N1, a cheap plain N2, and a decoy N3 under cover tile X. Keys far and visible.
- **Bait:** pair X plus its free twin Y ("melt it without the keys").
- **Recipe:** `placeRoles` with iceLockClock, then require an unlocked N3 whose go-round costs spare+1 to spare+4 more than the keys (existing `digCost` comparison). `bait=[[X,Y]]`.
- **Proofs:** `priceMove(bait)` is at least spare+1 or lose; the first key-cover tile is obvious (`obvious.js`); lock and ice not idle.
- **Dial:** go-round margin, key cover, a second lock.
- **Layout:** clock with at least 3 thaw-neighbours, one covered.
- **Risks:** a unique unremarkable order (layouts 7 and 20 history); the lock trimmed as idle.

**3. The wrong melt** (A-T1 simplified)
- **Picture:** clock frozen h2, no keys. Several free neighbours can melt it.
- **Bait:** a free neighbour L whose twin is visible but covered deep.
- **Right idea:** melt with neighbours whose twins come free in the dig.
- **Recipe:** `bait=[[L,twin]]`; L is a free thaw-neighbour outside the dig; the twin stays covered through the dig.
- **Proofs:** `priceMove(single L)` is lose, exact; `fairFork`; `canReachWithin(cap-1)` is no.
- **Dial:** wrong neighbours 1-3, orphans.
- **Layout:** a flat row with at least 4 thaw-neighbours.
- **Risks:** reads as a tray squeeze; bots find it easy (overruling is allowed).

**4. Guarded key** (B-T4 / A-T2 salvaged; build last)
- **Picture:** locked clock. Key A is visible under one frozen cover tile g (h2). g melts through dig tile S plus one more tile.
- **Bait:** the free pair beside g.
- **Recipe:** `ice[g]=2`; g is A's only cover; S is a neighbour of g on the dig; the bait pair is a neighbour of g off the dig.
- **Proofs:** A shows with g present; the ice raises k by at least 1; the bait is priced 1-2 (A5).
- **Layout:** a key spot beside the clock stack.
- **Risks:** the frozen-key blind spot; idle ice; one overlay per tile.

## Second-act rule
After the clock, the tail must pass all of these on `bank/texture.js` plus one proof:
- At least one proven tail fork: at a stored-route state 15-60% into the tail, a visible pair or match where `D.priceMove` returns lose, exact, and `fairFork` passes. `clockNeed` already handles `clockTaken`.
- At least one four-copy picture whose two pairs overlap in time, with that fork among its copies where possible.
- Face-down share at most 0.30, gamble steps 0, obvious pairs below the board's pre-`smarten` value.
- The fork tiles are visible before the clock is taken.

Produce it with `bank/smarten.js` (bot-free, trap tiles protected). A post-clock lock or ice is phase 2, because the idle gate rejects it until the tail-fork proof stands in for "matters".

## Variety rule
- **Ledger:** every bank puzzle Dennis rated (both findings files) plus live levels. Each entry has layout id, trap type, clock cell (3x3 plus layer band), key cell and ice cell.
- **Reject** a candidate when any of these hold:
  - its layout is in the last 12 entries (shuffle bag over the 48 layouts);
  - its trap type is in the last 2;
  - the same layout and trap type ever appeared together;
  - fewer than 3 of the 5 fields differ from any entry;
  - it shares more than 75% of a layout.
- **Lab boards go into A9:** `gateA9` already accepts `o.previous`; `VC.build` just never passes it.
- **Retire** `deepClock` and `lockBeside` as stand-alone stories.

## Acceptance checklist (no bots)
1. A1 honest clock.
2. No idle lock, ice or key.
3. Keys, locks and ice visible at move 0; no frozen or face-down key.
4. Bait proven: lose, or cost at least spare+1, exact. `unknown` fails.
5. Bait is structural: its tiles are a role tile, a thaw-neighbour, a key or clock cover, or a twin of one.
6. The right first move is obvious (A4).
7. The decisive fork is at 15-60% of the way.
8. No face-down tile in the mechanism; A7.
9. Second-act rule.
10. Ledger passes.

## Implementation plan
1. **New `builder/trap_stories.js`.** Registers four stories in `B.STORIES`, each with `place(c, brief, rng)` returning roles and `bait`, and `prove(design, roles)`. `builder/keyed_choice.js` is the precedent for hand-placed keys.
2. **Three guarded hooks in `builder-next/construct.js`** (unchanged when absent):
   - line 433: `story.place ? story.place(...) : B.placeRoles(...)`;
   - line 210: use `roles.bait` instead of `findTemptingPairs`;
   - line 514: `story.prove` instead of `choiceProofs`.
3. **`builder/loop/gate_profile.js`:** add profile `traps-v1`, where A5 may be met by the story proof (traps 1 and 3 have single-tile baits). I did not read how profiles are structured; check first.
4. **New `builder/bank/ledger.js`.** Holds signatures and the reject rule. Pass `previous` into `SG.staticGates` from `construct.js:507`.
5. **`builder/bank/specs.js`:** draw the trap type first, then a fitting unused layout from the bag.
6. **New `builder/bank/second_act.js`.** Runs `smarten`, then the tail-fork search and the texture thresholds.
7. **New `builder/test_trap_stories.js`.** Per trap, build on 3 layouts and assert its proofs, the structural bait check, and an unchanged result for an old story. Add a ledger test that rejects a copy of 275.

Build order: trap 1, trap 2, trap 3, then ledger and second act, then trap 4.

## Unverified
- Yields for all four traps; only rough geometry was counted.
- Whether a free pair needs a free tray slot.
- That moves count tiles (inferred from k=12 against pair index 6 on 262).

## Reader briefs

### earlier-claude

**Earlier Claude/Codex builder work on traps: brief**

**Scope.** I read the README, stories.js, builder-notes, why-hard-claude, tasks 05 and 07, pieces-v1/v2 RESULT, KEY-MEMORY, KEY-VISIBILITY, and the choice-motifs, dependency-choices and tail-plans REPORTs. I did not open the gate, descriptors or codex-review reports, nor TASK-10/11, clock-plan-v1 or builder-v2 beyond what the other reports quote.

**1. Designs that exist**

*Builder v2 stories (`stories.js`, 2026-11-06).* A story is a role spec: clock depth, locks, keys, ice. The pictures (tray pressure, traps) are placed afterwards along the planned way.
- keysFarSide: clock locked, keys buried on the far side (cover 2-4).
- keysOnIsland: keys on the other island.
- clockInSight: clock on top and locked, keys deep (cover 3-6).
- iceLockClock: clock frozen (ice 2), the clock's thaw-neighbours are locked, so keys come first.
- lockBeside: a locked tile sits on the clock's cover; keys deep.
- frozenGuards: keys frozen in, so guards, then keys, then the lock on the clock.
- chainReaction: keys open a lock, the lock thaws ice, the ice frees the clock.
- roomInTrayLocked and roomInTrayFrozen: the twins of the tiles on the clock are locked or frozen, so they wait in the tray.
- deepClock: clock buried 4-7 deep.

*Forced tray pressure.* Two necessary dig tiles ("orphans") get covered twins that cannot leave before the clock. The clock then makes the third waiting tile in every order. It is proven by `canReachWithin(cap-1) = no`. This holds on 88 of 88 harness boards.

*Decision trap.* A free, visible face-up pair off the dig, away from dig tiles and thaw neighbours. Its later tile is moved next to the earlier one. The engine proves it tempting and lost after the first tile (`E.kindOf` = pair, `E.winnable` = lose). It is only placed with spare 1. 82 of 88 boards got one.

*Luck moment.* A face-down tile whose turn-over opens a pair while 2+ tiles wait.

*Task 07 piece catalogue (16 pieces).* Clock, clockWay, keys, clockLock, clockIce, lockBeside, keyGuard, iceChain, frozenPartner, lockedPartners, blindTwins, blindWay, luckDig, relief, temptingPair (a visible off-route pair, with a delay), wrongClock (a free clock with a buried partner).

*Later constructions (cc-builder-loop, 2026-11-09).*
- Row-choice motif: a held picture, a tempting side tile, and a roof whose match cannot yet leave its row. The winning route reserves a tray slot before removing the roof. It was extracted from the "U-board decision before tile 55".
- Clover dependency choice: four exposed upper tiles per lobe whose lower partners depend on two other uppers, so the first lower partner needs 3 tray places. A loose bait picture's partner lies below the dependency, so parking it early makes the dependency impossible.
- tailPairWidth: pairs interleaved as ABAB or ABCABC after the clock.
- `knobs.clockTile`: moves the clock while keeping the puzzle. A clock-prelude control kept skilled near 3 while family changed a lot.

**2. Dennis's reactions (quotes from the files)**
- Lab 2026-11-05: "Very fun clock seems good here" (225, 5 stars). 217 "Very fun. Clock can be tighter, maybe do a -1 on clock". 200 "Shape is not the most fun."
- "The locks put you in the right direction otherwise you dont know where to go before the clock." "I like easy looking shapes with hard problems." "Digging without seeing exactly where is not very engaging." "frustrating cause the hard part is tray pressure at the very end to get the keys. Replace." "too loose ... adds nothing". "I dont see how I can take the clock faster then this route." "Get rid of the blob levels."
- "More smartness in how traps are placed would be nice."
- "We are spending a lot of time making levels in a unique and difficult way when we dont have the ground work done." He also asked for a box of small trap pieces of known difficulty, with no per-level playtests.
- Test puzzle 254 (2026-11-12): "a nice trap idea, the rest is quite easy". This is the basis for the rule to steer harder after the trap.
- Earlier: he noticed "a lot of the same pairs" on an 88-tile test puzzle. He rated 91, 132 and 135 as hard but fun, and 150 as a mid-board squeeze.

Task 05 turned the notes into a placement score: decisive tiles at ~15-60% of the solution, clock and locks visible, keys never face-down, at most 1 face-down tile on the way, a temptation at the decision point, spare 1. No Dennis rating of builder-made levels against that score is recorded in what I read.

**3. Why traps felt bolted-on or unintended**
- **Hidden keys.** With 0 keys visible at the start, the family median was 19.8 tries and 88% of boards hit 18+. With 1 key visible it was 13. With 2 visible it was 4-6 (other table: 6.3). When the keys showed, difficulty fell. A key that is hidden in 0 of 88 boards looks like difficulty but is the bot not knowing where to dig.
  - The family bot also forgets key identity on retry. Only 3.7% of retries head straight for a previously seen key's cover. Key memory lowers hidden-key boards by about 6 tries. Treat 20-try boards as partly a bot artifact.
- **Frozen keys.** A frozen key shows the ice, not the key. Claude's recommendation was to drop them and use a visible guard tile (ice in front of the key) instead. Frozen keys took one board from 20 to 3.4 once memory was fixed.
- **Unique forced order with an unremarkable right move.** On keysFarSide on layout 20 (both keys visible), only 1 of 16 legal first moves wins. The right move is not the key. iceLockClock on layout 7 is also brutal. Hard for the wrong reason.
- **Late squeeze.** Dennis dislikes tray pressure that only appears at the end.
- **Blind digging.** Luck moments and face-down tiles on the dig are what Dennis rejects.
- **Cliffs and rebuild noise.** Changing any knob builds a new puzzle. One brief on seeds 1/2/3 gave 19.3 / 6.9 / 19.1. The way ladder is a cliff in 5 of 6 pairs. 36% of 746 edits moved the rating by 3 or more tries.
- **Isolated traps stay easy.** Locally hard motifs (row-choice, clover, tailPairWidth) transfer to skilled 1.0-1.2. An isolated trap, or a count of proven traps, does not make a level. Difficulty needs interaction with the rest of the board.
- **Model-composed levels failed.** The piece-composition model missed (family MAE 7.64 tries; 0 of 12 new compositions qualified). The pressure-frame grid also gave skilled 1.0-1.2. Pieces are not additive.
- **Frame choices.** Way length barely matters once keys show. Spare is the fine control. Traps only exist at spare 1.
- **Stacked roles.** Ice plus lock stacked on one tile is a known construction bug: only one overlay shows.

**4. Worth carrying over**
- Make every role visible from the start. If a hidden key is wanted, use one key visible (a clear target, part of the way unclear), not zero. Add a visible guard instead of frozen keys.
- Build a temptation that is a visible free pair, off the dig, that the engine proves lost after the first tile. Prove it with the engine.
- Connect the trap to the story. The best examples were keys → lock → thaw → clock chains, and tray-holding twins (orphans) that force the clock to be the 3rd waiting tile.
- Put the decisive moment early to middle, never last.
- Keep it fair. The right move should be discoverable (spare 1, the clock-first grab clearly wrong), not a unique order with an unremarkable first move.
- Vary layout and trap type together, because Dennis noticed three boards on the same layout with the same kind of trap. Each of the ten stories on its own layout reads as a recognisable "recipe" he already knows from the lab's `ideas.js`.
- Steer harder after a good trap instead of discarding the board.

**Key paths**
- C:/Users/den_k/Idea/OmasMahjong/level-builder/source/tools/builder/stories.js
- C:/Users/den_k/Idea/OmasMahjong/level-builder/source/analysis/builder/why-hard-claude.md
- C:/Users/den_k/Idea/OmasMahjong/level-builder/source/analysis/builder/builder-notes.md
- C:/Users/den_k/Idea/OmasMahjong/codex-tasks/TASK-05-dennis-round2-smart-traps.md
- C:/Users/den_k/Idea/OmasMahjong/codex-tasks/results/why-hard-v1/KEY-MEMORY.md
- C:/Users/den_k/Idea/OmasMahjong/cc-builder-loop/source/analysis/builder/choice-motifs-v1/REPORT.md
- C:/Users/den_k/Idea/OmasMahjong/cc-builder-loop/source/analysis/builder/dependency-choices-v1/REPORT.md

### current-code

## How the current constructor builds a trap (read-only brief)

### Pipeline (builder-next/construct.js VC.build, 72-96 tiles)
1. `B.placeRoles(c, story, brief, rng)` (builder.js:115) picks clock/locks/keys/ice from the story SPEC using geometry only.
2. VC then forces the clock to the top-z candidate when stage='top'.
3. `B.planDig` makes P, the minimal tile sequence the clock needs.
4. `B.chooseHolders` picks covered partner "holders" (stories with coverPartners).
5. `placePicturesVC` assigns pictures:
   - `planDigPictures` sets the dig pairing and tray occupancy.
   - `findTemptingPairs` picks the trap pairs.
6. `placeDownVC` chooses the face-down tiles.
7. `E.clockShortest` (300k nodes) gives k, and the clock gets n = k+spare.
8. `SG.staticGates` (A1-A9) runs, then the `choiceProofs` requirement.

### The trap concretely (all stories share it)
- **There is no story-specific trap.** The story only decides where the roles sit. The trap is added afterwards by `findTemptingPairs`.
- `findTemptingPairs`: it picks 1-2 pairs (targets.traps, minimum 1). These are normal pairs of tiles that are:
  - not in P, not special, not a holder, and not adjacent (left/right) to a dig tile or to an ice neighbour;
  - not free at the start, but freed by dig step 1-5 (maxMidStep = min(5, P/2)).
  - Taking one costs tray/moves. The fallback is a pair that is free at the start.
- The tempting pair is chosen purely by free-timing in the dig. It is NOT chosen relative to the key, ice or lock positions. The code deliberately excludes the areas near the ice and the dig (`nearDig`), so traps sit AWAY from the ice, key and clock structure.
- `choiceProofs` requires an authored trap pair to appear in a report fork as one of two things:
  - a detour costing 1-2 spare clock moves, with a winning alternative at that fork; or
  - a fair, proven lose-fork.
  - It does not require the trap to relate to the story.

### Stories (stories.js, placeRoles)
All role choices are made by filtering on `above[i].size` (cover depth), distance and peak. There is no search over combinations of roles.
- **keysFarSide**
  - Clock locked, depth 0-2.
  - Keys: depth 2-4 cover, sorted by distance from the clock (farthest first, from the top 6 of the candidates).
  - Keys must be within dist 6 or 9 of each other (they are placed as a pair). `openable` means the side dig is at most 6.
  - Independent: the clock position is chosen first; keys are merely "far". The lock sits on the clock, so it is trivially connected.
- **keysOnIsland**
  - Same as keysFarSide, but keys must be on a different peak (needs 2 or more peaks) and have depth 1-3 cover.
- **clockInSight**
  - Clock at depth 0 and locked; keys at depth 3-6 (deepest cover first).
- **iceLockClock**
  - Clock frozen (h=2), depth 0-1. The thaw neighbours (`thawNbs`) are locked, with the cheapest ones left free so the thaw needs the keys.
  - Keys: depth 1-3, far from the clock.
  - `trimThawLocks` and the dear-lock removal then drop locks that do not matter, because an idle lock costs a full search to prove.
  - This is the only story where lock, ice and clock are truly connected: the locked tiles are the clock's own ice neighbours. The keys are still just "far".
  - Dennis's board 254 (arch, 88 tiles, 18 face-down): a nice trap idea, 0 stars, rest too easy.
- **lockBeside**
  - Clock at depth 2-4; the topmost cover tile is locked (coverLock 1). Keys: deep, with depth 2-4 cover. Lock and clock are connected through the cover; the keys are independent.
  - Dennis's boards 261/262/263: 2/4/1 stars, shapes diamond/twins/hourglass. Three on the same trap type felt like replays.
- **roomInTrayLocked / roomInTrayFrozen**
  - Clock depth 3-5, no lock on the clock. The twins of the cover tiles are locked (keys deep) or frozen.
  - Holders come from `chooseHolders`, which locks or freezes the partners of the dig orphans. The trap is tray pressure while the keys or ice are dealt with.
  - Holders that go unused are un-locked and un-iced afterwards (`holdersNeeded`).
- **deepClock**
  - Clock depth 4-7 under buried cover. No locks, ice or keys at all (specials = 0).
  - The only "trap" is tray pressure from the `coverPartners:'buried'` holders (the twins of the tiles on the clock are buried), plus the generic tempting pair.
  - Rated boards: 271 hourglass 3 stars, "played this before"; 272 diamond 2 stars, "played before"; 273 moon 4 stars (smartMade, 22 face-down), "I liked this"; 276 pyramid tall 2 stars. Board 275 (keysFarSide, diamond, smartMade) got 0 stars: "I played this before. Dont reuse levels!". 2026264 (deepClock, twins) got 3 stars.
  - So deepClock has no ice/key/lock interplay. That is exactly what Dennis says is missing.
- **frozenGuards (banned)**
  - Clock locked; keys frozen (keyIce 2); guards must go first.
  - Their keys must not thaw each other, which the code enforces via `okPair`.
- **chainReaction (banned)**
  - Key, then lock, then thaw, then clock. Has `chain: true` in the spec, but I did not verify the code actually uses it.

### Proven vs assumed
- **Proven by the engine:**
  - The clock is honest (A1: won at n=k, lost at k-1).
  - Each lock/ice is not idle (`trimThawLocks`, `storyKept`, `prune`).
  - A4: the winning actions are obvious (see the gates below).
  - A5/A6: the priced or lose-fork trap.
  - `E.clockShortest` gives k.
- **Only assumed (geometry heuristics):**
  - "Far" and "deep" for keys.
  - That the trap is related to the story.
  - Which move tempts: it is simply any pair that frees up early.
  - That the player will see the structure (readability is only `PS.readable` plus keys in sight by move 3).
- **Independently placed (not connected):**
  - The keys vs the clock (only the distance sorted).
  - The tempting pairs vs the roles (explicitly excluded from the area around them).
  - The face-down tiles vs the traps (`placeDownVC` avoids the special tiles, traps, and the clock twin).
  - The shape or layout vs the story: the layout is just chosen by `brief.layout` or seed, so identical layouts recur across levels.

### Hooks for hand-placed roles
- There is NO explicit "put role X at tile T" API in the builder as such.
  - `placeRoles` returns `{clock, locks:Set, keys:[a,b], ice:{tile:h}, holderSpecials}`. This is a plain object.
  - Everything downstream (`planDig`, `chooseHolders`, `placePicturesVC`, `placeDownVC`, `designOf`, `rulesOf`) takes that roles object as an argument.
  - A new story can therefore build its own roles object (e.g. `ice[keyTile]=1` with `keys` on the clock path) and call the later steps.
  - Exported from builder.js: `placeRoles, planDig, needSet, placePictures, chooseHolders, coveredDuringDig, necessary, canReachWithin, trayOnWay, LAYOUTS, STORIES`.
  - Exported from construct.js: `build, placePicturesVC, placeDownVC, findTemptingPairCandidates, choiceProofs, witnessTail`.
  - `keep` options in `B.build` exist, but VC rejects `opts.keep`.
- `c = B.context(tiles)` gives `above, nb, inb, free0, peak, dist, centre`.
- `SPEC.keyIce` exists (ice on keys), so a key under ice is already expressible. It is used only in the banned frozenGuards and chainReaction.

### Proof helpers
- `E.clockShortest(g, {nodes})` gives the shortest clock route k. `exactRoute` (lab/exact.js) gives the strict route.
- `E.winnable`, `E.classify` (winning actions at a state), `E.longest` (loss depth).
- detour.js:
  - `clockNeed(C, s)` gives the smallest clock.n still winnable from a state.
  - Tempting-move enumeration covers pair, match and (opt-in) single moves, plus peek pairs.
  - The cost of a move is the increase in `clockNeed`. This is the "costs k spare moves" test.
  - The result is win, lose or unknown, up to k+3 and at most 19.
  - `D.work(nodes)` is a node-budget tracker; unknown is never read as a loss.
- publicfork.js:
  - `fairFork` checks that a lose-fork is readable under K re-deals of the unseen face-down pictures, that the loss shows within 6 removals, and that it is offered at 60% of tiles left or more.
  - `permuteHidden` and `redeals` are the re-deal helpers.
- obvious.js: `obviousMoves/isObvious/visibleRoles/keysInSight`. Obvious means the clock, a blocker within 3, a visible key or lock, or a tray match.
- static_gates.js A1-A9:
  - A1: honest build.
  - A2: readable plus keys in sight (by move 3).
  - A3: release-legal clock (strict k = k, spare 1-3, k+s at most 19).
  - A4: no hidden single order.
  - A5: a priced temptation costing 1-2 spare moves at 15-60% of the way to the clock.
  - A6: fair lose-forks.
  - A7: luck bounded.
  - A8: if k is at most 6, spare must be at least 2.
  - A9: original (against live levels 70-199; no same layout, puzzle, or over 75% shared layout) and shaped, and tiles over 88 means 'lv%10==0 only'.
- Important gap: A9 only compares against levels 70-199. It does not know the lab boards Dennis has already played, which explains the replays.

### Key findings for the redesign
1. The trap is generic and decoupled from the story.
2. Only iceLockClock couples more than one role.
3. deepClock, the story behind four of the five lab-3 boards, has no specials at all.
4. `nearDig` explicitly keeps traps away from the ice and keys.
5. The role objects can be hand-built, since the downstream steps only consume the roles object.

### liked-boards

**Method.** I wrote a light node script (/tmp/x/a.js, read-only) over the board files, the live levels (Hard.get) and lab 225 (codex-tasks/results/200-225-v14/levels.jsonl, level==225). Conventions: "cov" = tiles lying on it, "mv" = pair index in the stored solution, "free0" = free at start. A clock "n/k" is the allowed moves versus the proven route length. Ice "thaw" times use my guess of which tiles count as neighbours (same z, within 2 in x and y). Everything after "unverified" is my inference.

**Liked boards**

- **L262 eadb34f1 (lockBeside, twins layout 24, 76 tiles, 15 face-down).**
  - Clock: #58 (4,8,z2), covered by 2 tiles, n=13, k=12, spare 1. It is taken at move 6.
  - Lock: #69 (5,8,z3) lies directly on the clock; it is one of the two coverers and goes at move 5. The other coverer goes at move 1.
  - Keys: #21 (10,8) and #31 (10,12), both z0 at the far right edge. They are face-up and each has one tile on it. They are taken at moves 4 and 5.
  - Nothing is iced.
  - Opening: 73 71 70 65 59 52 48, then keys 21 and 31, lock 69, then 60, then clock 58.
  - What the player must SEE: the clock is buried under the lock, whose keys lie across the board. Spare is only 1, so every move before the keys must be spent on the key route.
  - Why it fits "trap can be harder": the keys are visible, in a corner and free at once, so the route is nearly forced. The fun was the puzzle at the end.

- **L273 daf285e5 (deepClock, moon layout 16, 22 face-down).**
  - Clock: #37 (3,10,z1), four coverers (moves 1, 2, 3, 3), n=11, k=8, spare 3. It is taken at move 4.
  - No specials besides the clock.
  - Opening: 73 71 67 65 60 56 48 37(C).
  - What the player must SEE: one stack has to be dug out in a specific order. Only 3 of the first 8 moves are free choices.
  - The trap is stack depth plus 22 face-down tiles. There is no connection to other specials, so I do not know what Dennis liked beyond "I liked this". That is a guess.

- **L254 c6b10b7f (iceLockClock, arch layout 12, 88 tiles, 18 face-down).**
  - Clock: #81 (10,8,z2). It is uncovered but iced (h2), n=14, k=11, spare 3. It is taken at move 6.
  - Its ice thaws when 2 neighbours are gone. Its neighbours at the same level are #86 (the LOCK, moves 1 to 5) and one other tile.
  - Lock: #86 (8,8,z2) sits beside the clock. Its keys #13 (0,4) and #7 (1,2) are far upper-left at z0, face-up, with 1 tile on each. They are taken at move 3.
  - Opening: 79 84 64 60, keys 7 and 13, 82, 85(d), 87, lock 86, clock 81.
  - What the player must SEE: the clock looks free, but the ice needs the lock gone, and the lock needs keys on the far side. That is a true three-link chain: keys, then lock, then ice, then clock.
  - Rest too easy: 88 tiles with only 3 specials, and a free-looking clock.

- **Lab 225 (very fun).**
  - Ice only: #2 h2 at z0, #58 h2 at z2, #60 h2 at z3. No lock, no keys.
  - Clock: #0 (4,0,z0), one coverer (move 11). n=24 is huge slack, taken at move 12.
  - Three h2 ices (each needs two neighbours gone) in a 6-layer board.
  - Opening: 70 69 12 18 57 40 68 56. 22 face-down tiles.
  - Unverified: the fun is probably that the ice dependencies interleave in time (thaws near moves 4, 12 and 23).

**Neutral and meh boards**

- **L264 1a1d1b5b (3 stars, "clock boring").** deepClock, twins layout 24. Clock #43 (7,12,z1) has 3 coverers and n=9, k=6, spare 3. It is taken at move 3, within the first 6 moves. 38 of 76 tiles are face-down. A short clock reached at once, with nothing else tied to it, is a plausible cause of "boring".
- **L261 2073ccd9 (liked the trap, board after too luck-based).**
  - lockBeside, diamond layout 30, 80 tiles, 40 face-down. Clock #40 (10,10,z1) has 1 coverer, n=15, k=14.
  - Lock #79 is at the very top (z4), and the keys #8 and #21 are free at moves 5 to 6. Clock is taken at move 7.
  - After move 7 there is no second act, and 40 face-down tiles probably explain "luck based". That second part is a guess.
- **L263 f2cb553e (1 star).**
  - lockBeside, hourglass layout 14. The lock #78 (8,12,z2) lies directly on the clock #35 (8,12,z0), which has 3 coverers.
  - n=16, k=15. Keys #7 and #13 sit in the top-left corner and both go at moves 3 to 4.
  - Same recipe as L262, except the 4 tiles bunched in the corner make the pairs obvious. The lock is already free (cov 0, mv 4).
- **L276 901dcc65 (2 stars).** deepClock, tall pyramid layout 15, 0 face-down. Clock #14 has 1 coverer, n=8, k=5, spare 3, taken at move 3. It is trivially short and shallow.
- **L271 5623afed.** deepClock, hourglass layout 23. Clock #28 (6,12,z0) has 3 coverers, n=10, k=8, taken at move 4. Only 8 face-down.
- **L272 02257721.** deepClock, diamond layout 30. Clock #18 (8,8,z0) has 4 coverers, n=12, k=9, taken at move 5. 8 face-down.
- **L275 3bf50015.**
  - keysFarSide, diamond layout 30, with only 1 face-down tile.
  - The clock #48 (8,10,z1) is itself the locked tile, with 4 coverers, n=16, k=14. Keys #3 and #14 are free at move 6, far left.
  - This is the only board where the lock sits on the clock tile itself.

**Live hard-but-fun levels**

- **91:** 80 tiles, 32 face-down. Clock #49 n=7, 2 coverers, taken at move 3. 3 locks on the top row z3, with keys #79 (z3, free0) and #7 (free0). 5 ices (h1 or h2), with early thaws at move 2 and move 3. Opening: key 79 first, then 73, 65(d), then clock 49, then key 7.
- **132:** 82 tiles. Clock #65 n=6, taken at move 3. 7 locks at various depths, 2 keys at moves 4 and 4. 12 ices, h1 mostly. Opening: 79, then ice #81 (a top-level tile, thaws at move 1), 76, 66(d), then clock at move 3, then keys 3 and 77, then lock 80.
- **135:** 88 tiles. Clock #27 n=8, taken at move 3. 7 locks, keys at moves 12 and 13 (so after the clock, a second act). 12 ices.
- **150:** 96 tiles. Clock #34 n=7, 1 coverer, taken at move 3. 4 locks, keys #86 and #91 both free at move 1. 7 ices.
- **Common live pattern:** n=6 to 8, clock at move 3, many specials in other places.

**What the liked traps share that the meh ones lack**
1. **Connection.** 254 links keys to lock to ice to clock. 262 puts the lock on the clock with the keys far away. The meh deepClock boards (264, 271, 272, 276) have a single mechanic, a covered clock, with no other special tied to it.
2. **A visible but wrong or forced route (guess).** In 262 and 254 the keys are clearly visible, but spare is 1 or 3 and the other route burns moves.
3. **Layered difficulty.** 273 and 225 are deep (4 coverers, 6 layers) with many face-down tiles. 276 (0 face-down, 1 coverer, k=5) is the opposite.
4. Slack n-k is small in the liked trap boards (262 spare 1, 254 spare 3) and large in 276 (spare 3 with k=5). The pattern is not strict: 273 has spare 3.

**Repeats (felt like repeats)**
- **deepClock story in 5 of the 10 boards** (264, 271, 272, 273, 276). Clock sits at z0 or z1, covered by 1 to 4 tiles, taken between move 3 and move 5, spare 2 to 3.
- **lockBeside story in 261, 262, 263.** Lock directly on or beside the clock, keys in a far corner at moves 3 to 6.
- **Diamond layout 30 in 261, 272, 275.** Clock at y 8 to 10, x 8 to 10 in all three. Different stories but similar position, so the board looks identical.
- **Twins layout 24 in 262 and 264.** Hourglass in 263 and 271.
- **Almost every board** takes the clock between moves 3 and 8, early.
- **Missing from all rated lab boards:** a second act after the clock, and ice together with key (only 254 combines them; none has ice under a key).

## Design A (mechanism-first)

**TRAP SYSTEM FOR THE LEVEL BUILDER (mechanism-first)**

Assumptions: keys are one matching pair, and one key pair opens every lock. This is taken from the briefs and not re-verified in code. The units are the engine's own. A move's cost is the rise in `clockNeed` (detour.js) after it. A "bait" is a visible move that costs at least 2 spare clock moves or loses (fair lose-fork). A "right line" is the stored solution.

**Core change.** Today `findTemptingPairs` deliberately avoids the roles (`nearDig`). Invert that. The bait must be made of role tiles or role twins: ice thaw-neighbours, lock-neighbours, key covers, the twin of a dig orphan. Every trap below is one mechanism, placed by one function from a hand-built `roles` object. `placeRoles` returns a plain object, so a new story can build it directly and call `planDig`, `chooseHolders`, `placePicturesVC` and `placeDownVC`. No other trap is added on top.

**1. TRAP TYPES**

**T1 Thaw Price.**
- Picture: the clock is iced (h=2) and sits free-looking. Four same-level thaw-neighbours are visible: L1 and L2 on the left, R1 and R2 on the right. L1 and L2 are free right now and look like the obvious thaw.
- Right idea: thaw via the right side.
- Recipe: the twins of L1 and L2 are covered orphans held in the tray (`chooseHolders`, frozen/locked holders). Taking L1 or L2 parks a tile that cannot leave before the clock, so with the other two orphans the tray overflows. R1 and R2 have free or parkable twins but sit under one cover tile. Spare is 1.
- Prove: bait (L1 or L2 first) has `clockNeed` of at least k+2 or loses. The first R move leaves `clockNeed` at k. The thaw count is met at ≥2 on either side. `canReachWithin(cap-1)` is no.
- Dial: the number of R covers (0 to 2), the number of orphans (2 or 3), h (1 or 2).
- Needs: a flat top surface, at least 4 tiles in a row beside the clock, depth 2 or more.

**T2 Key Rail.**
- Picture: the clock is locked. Key A lies under the clock's own cover, so it comes out in the dig. Key B sits behind a visible ice guard g.
- Bait: finishing the dig, which looks like progress and takes A in the tray.
- Right idea: thaw g before the dig removes tiles. The thaw-neighbours of g are the twins of dig tiles, so the dig order decides whether they are still around.
- Recipe: A is in P (the dig). g is `ice[g]=1` (h=1) on B's cover. One thaw-neighbour of g is the partner of a dig tile. Keys are face-up.
- Prove: the dig-first line loses or costs 2 or more. The g-first line wins. Both keys are visible at move 0. The lock is not idle (`trimThawLocks`).
- Dial: h of g (1 or 2), the number of dig tiles that depend on g's neighbours (1 to 3), spare.
- Needs: two regions at distance 5 or more and a clock cover of at least 2.

**T3 Lock Handoff (the 254 chain, made harder).**
- Picture: the clock is iced (h=2) and free-looking. Its thaw-neighbours are a lock N1 and a normal tile N2. The keys are far away and visible.
- Bait: N2's free twin pair, which gives only 1 of the 2 thaws, and the clock grab elsewhere.
- Right idea: keys, then lock, then thaw.
- Recipe: this is `iceLockClock` plus a coupling. One of the key covers contains the twin of N2. That way the first act is not just "walk to the corner".
- Prove: key route is forced but not unique among unremarkable moves. The first right move is a key-cover tile, which is a blocker within 3, so it is obvious (obvious.js). Bait costs 2 or more.
- Dial: the number of thaw-neighbours that are locked (1 or 2), key cover depth (1 to 3), spare.

**T4 Guard Duel.**
- Picture: two key-cover tiles, g1 and g2, are both iced (h=1). A free pair P sits between them.
- Right idea: thawing one guard uses P, but only one choice leaves the other guard thawable later.
- Recipe: g1 and g2 share one thaw-neighbour set of size 3. Taking P and one neighbour thaws g1; the other path thaws g2.
- Prove: one thaw order wins and the other loses by tray. Both guards are visible at move 0.
- Dial: the shared neighbour count, spare.
- Needs: two key covers close together.

**T5 Clock Bait.**
- Picture: the clock is free at the start. Its twin is behind a lock.
- Bait: grabbing the clock early. It then waits in the tray as an unpaired tile.
- Right idea: dig the keys first and take the clock last, with the tray free.
- Recipe: the clock partner is locked. The keys are under a cover of 2 or 3. Spare is 1.
- Prove: the early grab leaves `clockNeed` above n. The keys-first line wins.
- Dial: key cover depth and the number of orphans. This is the easiest type.

**T6 Tray Hostage.**
- Picture: two locked tiles each hold a dig orphan's twin, and the keys are visible.
- Right idea: the order in which the orphans leave decides tray room.
- Recipe: `roomInTrayLocked` with two locks. The keys sit under one cover tile that is the twin of a second orphan.
- Prove: of the two orders, one wins and one loses. `canReachWithin(cap-1)` is no.
- Dial: orphans (2 or 3) and the cover of the keys.

**T7 Blind Fork.**
- Picture: one face-down tile T lies next to a key cover. Turning it costs one move.
- Right idea: the correct action is the same whatever picture is under T.
- Recipe: place T with `placeDownVC` on the trap area, not away from it. This is the one allowed blind tile per trap.
- Prove: under K re-deals (`permuteHidden`, `fairFork`) the winning action is invariant. The loss shows within 6 removals. Luck is bounded (A7).
- Dial: the number of re-deals the fork must survive, the move budget of the turn.
- It is a modifier on T1 to T6, not a standalone trap.

**2. SECOND-ACT RULE**

After the clock, the board needs at least 35% of the tiles left. It must contain one more proven fork that uses a different role class than the first act. If act one is key and lock, act two is ice or tray, and the reverse. Act two must pass these checks:
- It has at least 3 states on the stored route where the winning actions are at most 1/3 of the legal moves (`E.classify`).
- It has a tray squeeze proven by `canReachWithin(cap-1)` on the tail, at no more than the same depth as act one.
- At most 15% of its tiles are face-down, and every act-two fork passes `fairFork`.
- It is visible before the clock is taken, so the player can plan ahead.
- The squeeze is not the last 3 moves (Dennis: no late squeeze). The decisive move lies at 15 to 60% of the tail.

This is not a free cruise like 254 (88 tiles, 3 specials) because the tail has its own proven fork. It is not luck like 261 (40 face-down) because of the 15% cap and the re-deal check.

**3. VARIETY RULE**

Each built level gets a signature of five fields: layout id, trap type, clock cell (3x3 grid plus z-band), key cell, ice cell. Keep a persistent ledger that includes the lab boards Dennis has already rated. A9 only compares against levels 70-199, which is why replays slipped through. Reject a candidate if any of these hold:
- Its layout was used in the last 12 ledger entries. Draw layouts from a shuffle bag so each is used once per cycle.
- Its trap type appears in the last 3 entries. Cycle types round-robin.
- Its signature differs from any ledger entry in fewer than 3 of the 5 fields.
- It is a `deepClock` or `lockBeside` build with no other role tied to the clock. Retire those as stand-alone stories.

Mirror the layout in x as a free variation, and never place the same type twice in a row on a mirrored layout.

**4. JUDGING A TRAP WITHOUT BOTS**

A built trap passes only if all of these are engine-proven:
1. The clock is honest: won at n=k, lost at k-1 (A1).
2. Every lock, ice and key is non-idle (`trimThawLocks`, `storyKept`).
3. The bait is real: `clockNeed` after the bait is at least k+2, or `E.winnable` says lose.
4. The right line costs nothing: `clockNeed` stays at k, and the stored solution plays it.
5. The bait is built from role tiles (twin of a dig orphan, thaw-neighbour, key cover). Check this structurally.
6. Keys and ice are visible at move 0; keys are never face-down (A2, `keysInSight`).
7. The right first move is discoverable: a blocker within 3, a visible key or lock, or a tray match (obvious.js).
8. The decisive fork sits at 15 to 60% of the way to the clock, spare 1 (A5).
9. At most 1 blind tile on the route, with re-deal invariance (A7, `fairFork`).
10. The signature passes the variety rule.
11. Node-budget `unknown` is never read as a pass.

Bots only add information: the rating, and the "hidden key" artifact, where about 20 tries partly measures the bot not knowing where to dig.

**5. FIRST THREE TO BUILD**

**T3 Lock Handoff.** It is the only trap Dennis called a nice idea (254), and `iceLockClock` is the only story that already couples roles. Smallest change: add the key-cover coupling and the second act.
- Fails if: it becomes a unique forced order with an unremarkable first move (layout 20 / `iceLockClock` on layout 7 history). Fix by requiring checklist item 7.
- Fails if: the keys are frozen or hidden. Do not allow `keyIce` here.
- Fails if: the lock turns idle when `trimThawLocks` removes it.

**T1 Thaw Price.** The bait is a plain free pair that looks right, and the proof is cheap (one `clockNeed` comparison per candidate pair). It reuses `chooseHolders` and `roomInTrayFrozen`, which already exist.
- Fails if: it is a late squeeze, so the orphans must be placed early in the route.
- Fails if: the frozen holders go unused and get un-iced (`holdersNeeded`), so the trap quietly disappears. Re-run the idle check after cleanup.
- Fails if: the thaw-neighbour count is wrong (my guess of "same z, within 2" is unverified), so confirm with the engine's own neighbour function.

**T2 Key Rail.** It gives a different picture (dig versus guard) from T1 and T3, and it uses a visible guard instead of the frozen keys that failed before.
- Fails if: the ice guard acts like a frozen key and hides the key. The key B must be face-up and visible behind the guard.
- Fails if: blind digging returns. Keep B's cover at 3 or less and visible.
- Fails if: the two regions sit too close and the dig order does not matter, so check checklist item 3 for every candidate.

T4, T5 and T6 come next once these three are proven. T7 is added as a modifier only after the base traps pass.

## Design B (player-first)

TRAP SYSTEM FOR THE BUILDER (player-first). Read-only; built from the three briefs and LEVEL-DESIGN-FACTS.md (lines 34-65, 81-106). Nothing was run.

CORE DIAGNOSIS
- Today the trap is generic: findTemptingPairs picks a pair by free-timing and nearDig deliberately keeps it AWAY from ice, keys and clock. Only iceLockClock couples roles, and even there the keys are just "far". deepClock (5 of the 10 lab boards) has no specials at all. A9 does not know the lab boards, which explains the replays.
- Fix: a trap is a small mechanism that owns its role tiles and its tempting move. The constructor gets a TRAP RECIPE that builds the roles object by hand (placeRoles returns a plain object, so downstream planDig, chooseHolders, placePicturesVC, placeDownVC and designOf can consume it). The tempting pair and the face-down tiles are then placed relative to the mechanism, not away from it.

1. TRAP TYPES (each: picture / recipe / proof / dial / layout need)

T1 KEY-IN-THE-ICE-WAY ("the ice you must not wait for")
- Picture: the clock is iced (h2) and looks free. Its two ice neighbours are the lock L and a plain tile. The keys are visible, one of them on the clock's own dig route. Tempting: take the visible free pair beside the ice, which looks like it thaws it, but a neighbour must leave via the lock, so it only burns tray and moves. Right idea: keys first, lock, thaw, clock.
- Recipe: clock C ice h2. Neighbour N1 = lock tile (keys A, B). N2 = plain tile covered by one tile T. Key A is free at the start. Key B lies under a tile whose partner is a decoy-twin of the tempting pair. Tempting pair X1/X2 is adjacent to N2, so removing it looks like progress.
- Prove: clockNeed after the tempting pair is at least spare+1 (lose) or +2; right line wins on the stored solution; both keys' identity is visible before the first choice (keysInSight). Lock not idle (trimThawLocks). Ice not idle (thaw is on the route).
- Dial: h1 vs h2; key B cover 1-3; tempting pair cost +1 vs +2 vs lose; spare 1-3.
- Layout: a flat-topped region next to a two-level stack (clock at z>=1 with two same-z side tiles).

T2 CLOCK-AS-THE-THIRD-NEIGHBOUR (tray squeeze, tied to ice)
- Picture: the clock sits behind a tile whose twin is frozen. Two tray slots are already used by unavoidable dig tiles. Tempting: take the frozen tile's visible pair now. Right: leave a slot, thaw first.
- Recipe: the frozen tile is a holder (chooseHolders, coverPartners:'frozen'). Its ice neighbours are on the OTHER side of the board from the clock. The unavoidable orphans' twins sit under the ice.
- Prove: canReachWithin(cap-1)=no for the clock (forced tray pressure) and canReachWithin(cap)=yes only via the thaw line. The tempting line loses after the first tile (E.winnable). The holders are all used (holdersNeeded).
- Dial: number of orphans (1-2), ice h, thaw distance.
- Layout: wide board with two separated regions.

T3 KEY ON THE ROUTE ("the key is the way")
- Picture: lock on the clock; key A is visible and free, key B sits ON the clock's own route (a cover tile of the clock is B's partner-holder). Tempting: take A and its twin-free pair path first, or clear the clock cover directly. Right: B is both a key and a cover tile, so one match does two jobs.
- Recipe: B chosen from the clock's cover set (above[C]). A far (distance sorted, as today). Lock on C.
- Prove: removing B early is on every winning line; the greedy "dig the cover without B" costs >=2 spare. A4 satisfied (not a unique unremarkable order: B is a visible cover tile).
- Dial: cover size 1-4, A distance, spare.
- Layout: any with a stack over the clock; avoids the "keys in a corner" recipe of lockBeside.

T4 ICE-GUARDS-THE-KEY ("visible guard", replaces frozen keys)
- Picture: key A is visible, ice sits on a GUARD tile directly beside it, not on the key. The guard's ice neighbours include a tile that is also needed by the clock route. Tempting: clear the guard's neighbour as a side trip.
- Recipe: ice on the tile that blocks a key (side-block), not on the key itself (keyIce is blind-spot territory). Thaw neighbours include one tile on the clock route, so the thaw is a shared cost.
- Prove: key visible at move 0; thaw takes exactly h neighbours; skipping the shared neighbour costs >=1 spare; no idle ice.
- Dial: h, how shared the neighbour is.

T5 LOCK-GATES-THE-THAW (chain, done honestly)
- Picture: ice h1 on the clock; its only neighbour is a lock; keys far. Needs three visible steps. Tempting: a pair that frees a different neighbour that is not an ice-neighbour.
- Recipe: chainReaction as spec'd but with keys visible and not frozen (the banned variant is the frozen version).
- Prove: A1 plus clockNeed after the tempting pair at least spare+2; chain depth is real (the lock is removed, the ice thaws, then the clock).
- Dial: add a second lock or ice h2.

T6 WRONG-CLOCK-TWIN (peek-pair bait; face-down is fine)
- Picture: a face-down tile whose turn-over reveals a free pair that wastes a slot. Right: leave it face-down until the key move gives a free twin for free.
- Recipe: face-down F on the clock's thaw side; F's twin is covered by a key or lock tile.
- Prove: fairFork (re-deals, loss shows within 6 removals, offered at 60% tiles or more). Luck bounded (A7).

T7 TWO-FRONT KEYS (island split)
- Picture: key A on island 1, key B on island 2, clock between. Tempting: dig toward the nearer key. Right: the far key is the one worth reserving a slot for.
- Recipe: keysOnIsland with the clock's cover split between the islands.
- Prove: clockNeed differs by at least 2 between the two key orders.
- Layout: 2+ peaks (twins, hourglass).

T8 SECOND-CLOCK-OF-THE-SAME-PICTURE (repeated pictures matter, FACTS line 47)
- Recipe: four copies of one picture, two of them in the trap, two in the second act; pairing wrong early costs later.
- Prove: the engine finds a loss for the mispaired line after the trap, within the second act.

2. SECOND-ACT RULE
After the clock/trap the board must keep at least 30-40% of tiles and contain: (a) a second dependency, an unspent lock or ice with its keys / neighbours still in play (keys at moves 12-13 as in live level 135); (b) at least one repeated picture (four copies) so wrong pairing costs; (c) spare of the clock does not carry over, so require that the post-trap tray cap is still binding, via canReachWithin(cap-1)=no at the 50% point; (d) no luck: any face-down tiles after the trap need the fairFork redeal test. This fixes 254 (3 specials, free-looking cruise) and 261 (40 face-down).

3. VARIETY RULE (codeable)
Keep a played-registry (all lab boards and live levels, not just 70-199) with, per board: layout id, trap type, clock x/y bin (3x3 grid), key positions bins, taken-at-move bin. Reject if any of: same layout and same trap type in the last 6 levels; same layout within 3; same trap type within 2; clock bin and key bins equal to any registry entry on the same layout; more than 75% shared tile layout. Rotate: pick the trap type first, then the layout from the layouts that fit its needs but weren't used with it. Also reject two consecutive boards with the clock taken in the same move bin. Add the lab board keys to A9.

4. JUDGING WITHOUT BOTS (checklist)
1. A1: clock honest (won at k, lost at k-1).
2. No idle special: trimThawLocks / storyKept / prune; every lock, ice, key matters.
3. keysInSight and roles visible by move 3 (A2); no key face-down; no frozen key.
4. Temptation proven: after the tempting move, clockNeed at least spare+1 (lose) or +2 (costly), by detour.js.
5. Right line exists and is obvious (A4): a visible key, lock or blocker, not a unique unremarkable first move.
6. Decisive fork at 15-60% of the way (A5/A6), never last.
7. Fair lose-fork under redeals (publicfork.js).
8. Connection: the tempting pair or its twin lies within the thaw/key/cover set of the mechanism (a new check: nearDig must be reversed for traps).
9. Second act present per rule 2.
10. Variety registry passes.
Bots are extra information only; overrule for cool levels.

5. FIRST THREE TO BUILD
- T3 Key on the route: smallest change (key chosen from above[C]), visible, no new engine pieces. Fail modes: unique forced order if the cover is size 1 (check A4); late squeeze if the keys end up last.
- T1 Key-in-the-ice-way: takes the strength of 254 (the only liked three-link chain) and makes the tempting pair connected. Fail modes: idle ice if N2 thaws anyway; hidden key B (keep it visible, one key free at the start); two roles stacked on a tile (known construction bug).
- T2 Tray squeeze with frozen holder: preserves the proven forced-pressure machinery (88 of 88). Fail modes: late squeeze (decisive moment must be at 15-60%); unused holders (holdersNeeded); blind digging if face-down tiles cover the orphans.
T4 is the next step once T1 is stable (replaces frozen keys). Avoid hidden-key traps and frozen keys until proven by engine.
