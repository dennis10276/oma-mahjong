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

## The plan (after Dennis's answers, 2026-10-24)

- Building levels 158+ waits for Codex's human-like bot (one that plays better than Dennis), being built
  in the `personal-bots` folder on Dennis's computer (not on GitHub). Codex also has the ground truth from
  real play. When it is done: adopt it, check it against real results (levels 92-157, the lab levels) and
  improve it. The personal bots (move-based, dashboard) are not worth building on for this.
- The old steps 7 and up (start from the designer, many candidates, pick by the bot) were rejected as
  lazy. The way levels are built gets a new design once the bot is there.
- Parked on its own branch `wip/clock-key-hints` (from main, not released): the clock badge pointing at
  its tile, the brief outline, keys lighting up on a lock tap. Still to do there: "no moves left".
- Shape catalogue for Dennis to judge by look (`tools/lab/shapes.js` -> `shapes-data.js`, page template
  `tools/lab/shapes-template.html`; published as a private claude.ai page, his picks in its database,
  collection `picks`): the game's shapes, the added ones, random outlines, today's lab shapes, and flat,
  tall, two-hill and ridge variations; 42 in all. Several shapes do not fit 86 tiles at 54 px without
  towers at all (shown with 72 tiles, or left out: tree, ring, wave, arrow, plus, xshape, tshape, chevron,
  kite and most random outlines).
