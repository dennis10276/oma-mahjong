# 60 px for 250-300: what Claude found after the handoff (2026-11-15)

Dennis, after seeing the compact draft of 250: "The shape shouldnt be weird suddenly I saw 250 (that doesnt need changing) with
weirdly placed tiles", "Level 250 can stay the same cause its a tenth level", "without changing the levels too much especially the
traps cant be changed. every 10th level may be bigger and therefore smaller tile size".

1. **The tens (250, 260, 270, 280, 290, 300) stay exactly as released.** Their drafts in `range-250-300.json` are not used.
2. **The freely repacked drafts are not adopted** (46 in `range-250-300.json`): they keep the trap by proof, but the pile no longer
   looks like a designed shape, which is what Dennis objected to.
3. **Why a released pile cannot simply get bigger tiles:** 39 of the 45 other levels are 7 tiles wide; on the 392 px reference that is
   54.5 px (after 1.69's 2 px side room). 60 px needs a pile 6 wide (the levels before 250 are 6 wide). So about one tile in seven of
   every layer has to go somewhere else, whatever the method.
4. **A tidy way was tried** (`tools/builder/bank/narrow.js`): take out one whole column (and one row for nine-row piles) that holds no
   tile of the trap, slide the rest together, and put the removed tiles back as straight stacks on the middle. The trap is taken as
   the specials, their thawing neighbours, what lies on them, and the route to the clock. Result before any engine proof:
   10 of 45 can be narrowed this way (253, 256, 257, 258, 274, 279, 281, 282, 288, 295), with 6 to 17 tiles moved to the middle;
   6 are already narrow enough; for 29 the trap itself runs through every column or its upper tiles lose their support.
5. **Exchange repair of the five held drafts** (`bank/slot_search.js`, tiles trade places inside Codex's compact shape): 296 reaches
   "same special-tile relations and order" but then fails the shortest-clock-route and badge checks; not pursued further because of 2.

So for most of 251-299 "same board, trap untouched, tidy shape, 60 px" cannot all hold. The choice is Dennis's:
keep the released boards at 54.5 px and build 301+ on 6-wide layouts, or rebuild 251-299 as new boards with the same kind of trap
on 6-wide designed layouts.
