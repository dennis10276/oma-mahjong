# detbot retry and replanning review

Reviewed origin/wip/det-bot at2513920b7803d4032017a9841a3749db16adf1c2:
source/tools/sim/detbot/det_bot.js, solver2.js and rollout.js.

Useful idea: retain actual same-board observations across tries, fill unknowns in
separate hypothetical worlds, and combine continuation search with a policy that
only learns hypothetical pictures when they would become visible. A sampled win
can guide an action but cannot become a known winning route or actual memory.
The current reference already separates hypotheses from observed picture memory.
Tests assert hypothetical ranking never changes picture/orientation/role memory.

The prototype needs these corrections before its scores or solver claims can be
adopted into the production reference:

- rollout.js marks every currently takeable tile known, including closed pictures,
  before selecting actions. A physical peek may automatically match a tray/open
  tile and consume clock moves; later repeated peeks also require actual taps.
  Hypothetical simulation must use production transitions and the ONE observer.
- solver2.js batches a pair as one transition and permits a clock-containing pair
  through its intermediate-clock check. If the clock is second and the first tap
  expires it, the real game has already lost. Candidate routes must be checked
  tap by tap. The new complete public-memory witness uses advance() for every tap.
- det_bot.js checks its decision deadline before each world, then loops across all
  root actions with separate solves and rollouts. All roots need one shared
  deadline with checks inside each solve and rollout to meet the2s action limit.
- Hypothetical role guesses must reproduce earlier public frames, rejected taps,
  actual matches and current free-tile takeability. A possible missing key or
  unseen plain tile is a hypothesis, not permission to assume a public fact.
- The solver does not implement production Joker wildcard/finale behavior. Its
  ordinary-picture search cannot certify arbitrary production boards.

Dennis's updated rule explicitly permits current takeability of every free tile.
The prototype's use of that legal list is therefore allowed, but it must enter
through the ONE observer and cannot reveal future hypothetical availability.

Current experiment01 tested complete constructive retry routes through trusted
memory. It repaired no board: all4722 opportunities still had unknown alive
pictures. This is evidence for improving information access and retry strategy;
it does not refute the broader sampled-world approach or prove any board impossible.
Raw observed-memory audits retain the saved actual tap sequences. On lab10041,
salt1 learned76/86 pictures by try3 and learned nothing more through try12;
salts2 and3 cleared on tries4 and3. No guessed picture was promoted to fill the gap.
