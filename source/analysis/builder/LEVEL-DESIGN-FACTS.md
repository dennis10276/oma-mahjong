# Level design: facts and Dennis's decisions

Read this before making or judging levels. These are settled. Do not ask Dennis again unless something here
contradicts new evidence; then say which line and why. Each line has the date Dennis decided it. Kept by the lead;
add new decisions with a date.

## Who plays
- **The family plays the same levels** (since 1.55). The players whose results count are Dennis
  (Dennisisdebeste, the skilled player), Gerda, Mrs. Doubtfire and PUK.
- **Grandma (OmaHanny) has her own, easier track.**
  - Her track keeps levels 1–118 exactly as they were.
  - From 119 her face-down share and deal target climb to the family's by level 143 (2026-10-24).
  - Long term she should reach family level, maybe about 100 levels on.
  - She is not part of the family curve below.
- **The game should be addictive and brain-training but not too hard, with rewarding colours and sounds**
  (the app's origin).
- **Hard but fun, by Dennis:** levels 91, 132 and 135. He finds 132 and 150 harder than the first new 200+
  levels (2026-11-04).

## How difficulty is measured
- **Measure:** tries until the first win. More tries means harder; a win on try 1 means too easy (2026-10-28).
- **The family bot decides difficulty** (2026-11-06): "catching the genuinely harder level matters more than being
  right on average."
  - Its rating pools two full runs (seeds 4711 and 18427), with a fresh seed as a check.
  - It is fitted to the family's yardstick: weighted tries until first win, Dennis ×2, Gerda ×1, Mrs. Doubtfire ×2
    (2026-11-02). Levels are tuned mainly to how the normal players struggle, but not fully, or they get too hard.
- **The skilled bot stands for Dennis and is the builder's competence benchmark.** It should not be worse than his demonstrated play (2026-11-09, B1 clarification, superseding the older allowance for 2 tries where Dennis needed 1). Improve its general ability to solve boards he finds easy, rather than discarding boards because of bot weaknesses. The existing new-level selection band remains **2.5–6 tries** (2026-11-04); changing bot capability requires explicitly versioned ratings, not artificially retaining mistakes to preserve that band.
- **His real results are evidence:** Dennis's own wins in the lab (for example 200 in 5 tries, 225 in 4, rated
  "right") count as the skilled rating where they exist.
- **New human comparison** (2026-11-09): Dennis won the exact G9 board with keys [12,16], ice 44 strength 2 and clock 16 in one recorded completed try, marked easy/three stars, while the skilled bot scored 9.22. The logger also records two starts and no completed losses. Frozen board, raw taps and legal-prefix/completion checks are in `source/analysis/skilled-bot-b1/evidence/`. B1 is a broader skilled-bot improvement task, including other human-played boards and face-down puzzles. G9's zero face-down setting was an experimental control, not a new level-design rule.
- **No routine playtesting:** Dennis does not want to playtest new levels as a rule (2026-11-05). He wants the
  builder to know how hard a level will be.
- **The bots are tools, not truth.** A change to how they play must be a new bot version that matches real players
  at least as well (Dennis's lab wins, and the family's plays on live levels 85–174). Known blind spot: frozen keys,
  and hidden keys may be one too (2026-11-07). Codex may fix blind spots (2026-11-07).

## The curve
- **Decisions of 2026-11-12 (they supersede the lines below where they differ):**
  - **The curve follows the normal players:** Gerda, Mrs. Doubtfire, D4v3 and Loulou. Not Dennis, and not the old
    weighted sum (Dennis ×2, Gerda ×1, Mrs. Doubtfire ×2).
  - **Start: 6 tries on the family bot's scale at 250, then +1 try every 15 levels** (7 at 265, 8 at 280, 10 at
    310). Final decision of 2026-11-12, after seeing that the bot rates the hardest live levels (132, 150) at
    about 7 while normal players need 20+ tries there. It supersedes "about 10 at 250" from earlier that day.
  - **Favour 72–80 tiles on non-big levels** (2026-11-12). The game has 36 pictures, so every pair above 72 tiles
    repeats a picture; Dennis noticed "a lot of the same pairs" on the 88-tile test puzzle. 96 tiles stay on every
    tenth level.
  - **Repeated pictures must matter** (2026-11-12): steering may open all four copies together after the trap so
    that pairing the wrong two costs, move repeats around, add face-down tiles after the trap, and add a second
    obstacle if it works.
  - **Focus on the traps** (2026-11-12, after lab 3): "you have to focus on making the traps more thought about with
    ice, keys and clock positions. There is the fun. You kinda have to see it." Traps must be better connected and
    thought out. All-face-up levels are okay but must be harder if they are there; face-down is fine.
  - **The bots may be overruled for cool levels** (2026-11-12): "Drop the bots if you think you made some cool levels
    the bot didn't like", once the traps are better connected and thought out.
  - **Never reuse levels** (2026-11-12, "very important"): three different boards on the same layout with the same
    kind of trap felt like levels he had already played. A level must not feel like an earlier one: vary layout and
    trap together.
  - **Use the earlier Claude builder findings** (2026-11-12): look at the previous Claude attempts at the level
    builder and take those findings as well.
  - **Twins must not sit together** (2026-11-13, lab 4, levels 281 and 282): "Pairs are too much together. Too
    obvious." Two tiles of the same picture must not lie next to or on each other as a rule.
  - **Ice, locks and the clock combined are the most fun** (2026-11-13): "make levels that combine freeze clock and
    locks, those are most fun." Clarified the same day: "The clock doesn't necessarily have to be frozen. The locks
    or keys can too, or the way to the clock or lock. Make it smarter and more versatile." So traps are composed
    freely from ice, locks, keys and covers on the clock, a lock, a key or a tile on the way, not from a few fixed
    recipes. (This allows frozen keys and frozen locks again, as long as the player can see what they are.)
  - **The clock's timer must be fully visible** (2026-11-13): on 281 the counter badge of the clock was cut off.
    The clock tile itself may be covered more; that was not the problem. Cause: a UI bug - the game draws the badge
    16% of a tile above the clock tile, so a clock in the top row pushed it out of the board area. Dennis: "Fix the
    UI bug instead" of keeping traps away from the top. Fixed in `www/js/board.js` (clockBadge keeps the badge
    inside the board; test in `tests/t_hard.js`) on wip/cc-builder-loop; it reaches the game with the next release
    Dennis approves. No placement rule for the clock follows from this.
  - **Chain traps are what we want** (2026-11-13, lab 5): 291 got 5 stars - "Very good. these thought out things
    is what we want. AHA moment when you get it." 292 and 293 got 4 stars ("Awesome puzzle/trap", "Amazing puzzle
    again"). The three liked boards have chains of three or four linked specials; the two-link chains (294, 295,
    296) were "too easy to see the right route".
  - **The part after the trap must be harder** (2026-11-13, said on 292, 293 and 294): "a bit too easy after".
  - **Smarter traps or more tray pressure** when a trap is easy; and "I like to see this way of stacking more. You
    see things better" (296, the cross layout).
  - **UI wishes** (2026-11-13): show both markers on a frozen key or frozen lock (approved); tapping a frozen tile
    should also light up the tiles that thaw it when those are not free yet.
  - **The bot ratings are dropped** (2026-11-13, after Codex's Task 12: the family bot rates nearly every chain trap
    at its cap of 40 and the skilled bot at about 1, the same for Dennis's 5-star and 2-star boards). "These levels
    are much better but the bots rate them weird. Drop the bot ratings." This supersedes the bot-scale curve, the
    skilled band and the bot checks for new levels.
  - **The lead decides the difficulty** (2026-11-13): "You decide how difficult they are based on some minor input I
    already gave and your own brain." Input so far: two-link chains are too easy to see; three- and four-link
    chains are right (291: 3 tries, 5 stars); the part after the trap must be harder; more tray pressure makes a
    trap harder; many face-down tiles feel like luck.
  - **What to build** (2026-11-13): "fun and challenging in all kinds of varieties with variety ways of clock lock
    ice combinations like the levels I liked and much more new ones."
  - **Placement** (2026-11-13): "Place them on the 250+ levels after they are fully done." Releasing stays a
    separate step that needs Dennis's explicit OK.
  - **Go beyond 289 and mix** (2026-11-13, later): "Place these levels at 250+ and mix them with the already done
    levels", and make "much more levels also beyond 289. More variety and mixes in traps is great. as long as its
    solvable". So: solvable is the one hard requirement; variety and mixed traps come before strict uniformity.
    Clarified: "keep the levels I like from the older process and interleave them with the new ones." The liked
    older boards are the ones Dennis rated 4 or 5 stars in the lab that are not already live below 250 (the ten in
    `process-v1/e5-boards.json`, plus bank boards 262 and 273); they are kept as they are and placed by how many
    tries he needed.
    217 gets its clock tightened by one move when placed (Dennis: yes, 2026-11-13), provided it stays winnable.
  - **New game mechanics are allowed, jokers are not** (2026-11-13): "We can add new game mechanics but no
    jokers." New mechanics are proposed and prototyped first; Dennis chooses which go into the game.
  - **The part after the trap must not feel like just clicking** (2026-11-14, lab 6, level 250: 4 stars, 5 tries, "FUN trap.
    Really that AHA moment. After the trap tray pressure may increase. Its too easy after. Maybe more face down as
    well after the trap"; later: "Not too much, but it shouldnt feel like just clicking"). The builder raises tray
    pressure after the clock and puts somewhat more face-down tiles in the part after the trap; the trap itself
    stays fully visible. Not overdone (same day): "Dont overdo on tray pressure. 1 in tray is
    enough after a hard trap."
  - **Chained traps stay the model; other trap ideas go inside a chain** (2026-11-14, lab 7, twelve new trap kinds by
    Codex, all rated "too easy", 1-3 stars): "These traps feel less of a AHA moment then the chained ones. These are
    more straightforward"; "all of these ideas seem fine just make them chained and less obvious"; "Fine to have more
    then 1 trap but it should be meaningfull. This was just 2 easy traps." A trap is too obvious when the tiles of
    the right route are already waiting in the tray. He likes three layers ("easier to see") and boards read from
    above rather than from the side.
  - **Two traps on one board** (2026-11-14, correction): "Preferably depend on eachother but they can also be 1 hard and
    1 medium trap." Two easy, unrelated traps are what he does not want.
  - **No ribbon mechanic** (2026-11-14): "In essence its the same as lock and key cause you can only take lock after key."
  - **Tapping a frozen or locked tile that cannot be taken shows what it needs** (the tiles that thaw it, or the keys),
    not the tiles lying on it (2026-11-14). Done on the work branch.
  - **More tray pressure after the trap: at least two waiting, and it must be felt** (2026-11-14, lab 8, levels 302 and
    303 after the first retune): "Not overdone. I didnt feel the tray pressure after the trap. Still I would like more
    tray pressure after make it at least 2 instead of the 1 now." This replaces "1 in tray is enough". Lead's reading: he
    did not feel it because the measure counted waiting tiles along the stored route, which a player need not follow;
    the board itself has to force it (the part after the trap cannot be cleared while holding fewer than two).
  - **Keep level 271 at clock 19** (2026-11-14, lab 8, and Dennis's correction to the Task 16 handoff): "19 works so your measurement of 20 is wrong."
    The lab note says "This is the tightest it can be but its pretty obvious. Keep it like this" and asks for more
    chains and choices in future digging boards. This is the liked older 217, not a template for future digging.
    Codex checked its saved strict win and both engine modes: the proven minimum is 19. Do not loosen it to 20.
  - **Skilled minimum 1.75** (maximum stays 6). Dennis does not want to play levels in advance: the bot should know.
  - **Repeated-blunder check (B7) is a trigger to steer, not a rejection** (later on 2026-11-12, after Dennis
    played test puzzle 254): a puzzle where more than 0.3 of the bot's lost tries repeat a known mistake is
    improved by steering before it is placed.
  - **Steering:** a puzzle with a good trap idea but an easy remainder should be steered to be a bit harder after
    the trap (Dennis on 254: "a nice trap idea, the rest is quite easy").

- **Old levels:** levels up to 199 are live and played; 175–199 stay as they are (2026-11-04).
- **New levels now start at 250 instead of 200** (2026-11-08; supersedes the 2026-11-04 start):
  - the same opening curve shifts by 50 levels: family about 10 tries at 250, rising evenly to 12 at 274, then 13 at 275 (a small step up);
  - skilled 2.5–6 tries throughout.
- **After 275:** increase at about the same rate as 250–275 (2026-11-08), interpreted as about +3 family tries per 25 levels: about 16 at 300 and 19 at 325. No plateau has been approved. The bot's 20-try measurement cap is a limitation to resolve, not a reason to flatten the curve.
- **No alternating easier levels and peaks** (2026-11-08). Follow the steadily rising curve without position-based dips or boosts. Big-board slots do not get a peak exception.
- **Skilled target is 2.5–6 per level; the minimum may go down to 2 if really needed** (2026-11-08, latest clarification). Keep 2.5 as the normal minimum. Record individual levels that use the 2–2.5 fallback; none below 2 or above 6. No averaging across levels and no hidden screening margin.
- **Tolerance** (2026-11-06):
  - ±1 try per level, also on an independent seed;
  - every 5 consecutive levels average within ±0.5 of the curve.
- **Big boards (96 tiles)** only at every 10th level (250, 260, 270, …). A big board may be a little easier than its
  neighbours (2026-10-31).

## What a level must be
- **Puzzle:** levels are built around deliberate traps the family will struggle with, relying less on board
  randomness, so everything is thought through and feels fun (2026-11-02).
- **Every special matters:** ice, locks and the clock must each actually change the level; old levels often had
  specials that added nothing (2026-10-31).
- **Readable intent:**
  - the clock, locks and keys are in sight at the start, so the player sees the problem;
  - no blind digging as the main difficulty;
  - no luck-only losses.
- **Pacing:** no long free cruising followed by the main puzzle with high tray pressure at the very end. Pressure
  at the end is fine, just not as the only puzzle (2026-11-06).
- **Fair clock:** the clock matters but leaves a fair way. Keep the current skill level, with tray pressure as it
  is; the alarm clock stays as it is (2026-10-15).
- **Shapes:**
  - recognisable, original layouts, with no blobs and no blocks (2026-11-04, 2026-11-05);
  - at least 72 tiles for 200+;
  - tiles at least 52 px (2026-10-28).
- **Dennis's notes on the first 200+ boards** (round 2, 2026-11-05):
  - 200's shape was not fun;
  - 217 was too easy (make the clock tighter);
  - 225 was very fun.
- **Every level gets a design card:** its story, and why it is hard.

## Game rules that matter for design
- The tray shows 4 slots; at most 3 unmatched tiles may wait, and a 4th unmatched tile loses.
- A tile is free when nothing lies on it and its left or right side is empty.
- Ice h: thaws when h of its ice-neighbours are gone. A lock opens when both keys (a normal pair) are gone. The
  clock tile must be taken within n moves.
- Face-down tiles can be turned over for free when free.
- **Peek pair:** a turned-over free face-down tile and its free twin go together without a tray slot, even with
  3 waiting (2026-11-06; the game's own rule, `www/js/board.js` peekPair).
- Hint and shuffle: once per level. After 5 lost tries, a player can watch Dennis's winning replay (planned
  2026-11-06).

## How work is done
- **The level builder is the way levels are made from now on.** The main objective is a robust builder for all
  levels ahead, not one batch (2026-11-07). 200–225 (20 of 26 qualified) is a historical test case; new work starts at 250 (2026-11-08). This continuation does not replace levels below 250.
- **Builder continuation** (2026-11-10): resume broad builder improvement using the reviewed B3 `faa0295c` skilled candidate in explicit, source-versioned experiments. Task G10 covers construction, planning, repair, quality, variety and cost. The family ruler and difficulty policies stay unchanged; known bot exceptions remain visible when reviewing disputed rejections.
- **Experimental rebuild** (2026-11-09): rebuild the construction and difficulty-planning layer in a separate folder, reusing verified physics, pinned bots and useful checks. Treat this phase as an experiment: prioritize a working prototype and small real bot runs, with lightweight validation rather than extensive test infrastructure. The aim remains target-driven construction with a bounded build-rate-repair loop; existing difficulty, quality and release decisions stay unchanged.
- **Approval:** nothing goes into the game's levels without Dennis's OK, and nothing is released without his
  explicit OK.
- **Rules for agents:**
  - main is exactly what is live;
  - agents never write to Firebase plays/, scores/ or replays/; reading player data for analysis is fine;
  - the Firebase secret and the APK keystore never go into code;
  - CPU: up to 12 cores and at most 80% CPU load on Dennis's PC (2026-11-13; it supersedes "one CPU-heavy job at a
    time"). Heavy jobs reserve their cores through `source/tools/builder/loop/heavy.js --cores N`; several jobs may
    run side by side as long as the total fits.
- **Who does what:** the lead (now a Claude Code workflow on Dennis's PC, 2026-11-07) oversees Codex
  (`codex-tasks/`) and Gemini (`gemini-tasks/`), reviews and merges their work, and makes the final level changes.
  Codex may fix anything it finds (2026-11-07).
  - Codex continues the builder work from Claude's results on `wip/cc-builder-loop` (2026-11-08); G5 for Gemini focuses on better puzzle construction. No review agents; CPU-heavy runs remain serialized.
