# Levels 158+: the plan from here (2026-10-24, Claude, for Dennis and Codex)

Status: the variety remake is PAUSED. Nothing about it is live. Branch `wip/level-variety`.

## What the lab taught us (rounds 1-5, `source/analysis/variety-plan.md`)

1. The test players misjudge these boards both ways. They guess where Dennis reasons ("levels that are
   passed by deducing which routes won't work are not hard"), so a board can be "0%" for them and two
   tries for him, or "16%" and six tries.
2. Most of my clocks were loose: my "quickest way to the clock" (a beam search) was often far longer than
   the real shortest (61 vs 15, 44 vs 21). Fixed (`tools/lab/exact.js`), but that is one factor only.
3. One trick per level is not enough: "easy once you get the clock, then it's just collecting". The fun
   levels keep the pressure on all the way.
4. Shapes: the random outlines on 54 px without towers look alike ("the shapes of the pile feel very
   similar"). 86 tiles fill most of the screen; variety in outline alone is limited.
5. Building and judging were the same loop: I made boards, tuned them until my own judge liked them, and
   the judge was wrong, so the tuning pushed towards its blind spots.

## Why level 132 works (and my lab levels often didn't)

132 was made by the game's own designer (`www/hard.js` make) from a normal pile: 82 tiles, 36 different
pictures with almost all of them twice only (5 four-of-a-kind), so nearly every tile's partner is one
specific tile somewhere else; 33 face down; 12 ice, 7 locks; the clock short and early (6 moves, the true
shortest 5). The pressure is in the deal itself, on every move, and the specials add to it. My lab levels
put the pressure in one special combination and left the rest of the board easy.

## What I think about waiting for Codex's bot

Yes, wait with building levels 158+, but not with everything. A stronger bot helps only if it plays like
a person, not just well. A perfect solver wins every level; a level is hard for a person when the right
line is hard to see, hidden information has to be gambled on, or a trap looks safe. So what we need from
the bot is a skill dial: how far ahead it looks, what it remembers of turned-over tiles, whether it
reasons "this can't work". And whatever bot we use must first prove itself on levels people have
already played.

## The plan

### A. Now, without waiting (does not depend on how levels are judged)

1. Ground truth from real play. Levels 92-157 have been played by the family (replays and results in
   Firebase; `dataset.js` on `wip/honest-observer`). Per level: tries to win per player, how a try ended
   (tray full, clock, gave up), time, and the lab results. This is what any judge must reproduce.
2. Check the judges we have against it: the frozen test players, the move-based personal bots, the
   room-for-error measure (`tools/lab/room.js`), the exact clock slack. One table: how well each ranks the
   levels the way the family's tries do. That tells us how far off we are, in numbers.
3. A shape catalogue for Dennis to look at: ~40 pile shapes without towers at 54 px, drawn as pictures,
   including ones with gaps, islands, ridges and different heights (not only outlines). He picks the ones
   that look different and nice; difficulty plays no part here.
4. Game improvements already made on the branch, to be released separately when Dennis wants: the clock
   badge points at its tile (outline only briefly, at the start and when you tap it while covered), a tap
   on a lock lights up both keys (also covered ones), and still to do: "no moves left" ends a try when
   everything you can reach is locked or frozen.
5. Keep the lab: the idea list with ratings and the recorded taps stay as material.

### B. When Codex's bot is there

6. Agree on one interface: `play(board, skill) -> { won, moves, end reason, decisions }`, with skill =
   lookahead, memory of face-down tiles, deduction on/off. Run it at a few skill levels.
7. Validate it on the ground truth (A1): it must rank levels 92-157 like the family's tries do (and the
   lab levels like Dennis's tries), clearly better than the current test players. If it does not, it is
   not used to judge new levels; we improve it first.

### C. Then build levels 158+ (one generator, judged honestly)

8. Start from the designer that made 132 (pressure in the deal, all game long), on the shapes Dennis chose
   (A3), with one of his favourite special combinations per level on top (chain of ice, partners behind
   locks, chain reaction, blind dig, locked clock; ratings in the lab), and the clock from the true
   shortest way plus a small spare.
9. Many candidates per level; the validated bot picks the ones in the target band (lab "hard"), and the
   rules for variety (spots, pairs, specials in new places) keep neighbours different. No tuning loop
   that chases one number.
10. Dennis plays a sample (3 per session, spread over the range) in the lab; his tries feed back into the
    bot's calibration, not straight into the levels.
11. Release from the first level nobody has reached, with the "no moves left" check in the game and new
    dashboard predictions.

## Open questions for Dennis

- What exactly is Codex's bot (branch, interface), and when is it ready?
- Should the game improvements (A4) go out on their own before the new levels?
