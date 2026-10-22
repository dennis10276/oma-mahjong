# Human-information reference: Dennis gate

This replaces the open-ended perfect-reference/perception project. Work is on
`wip/personal-bots` in `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review`.

1. One documented game-state visibility function gates picture and role reads.
   Retry memory contains only previously seen information on the same level.
   The visible clock badge is public even when its tile is covered, confirmed
   by Dennis on2026-10-22. No hidden deck, level seed or future-branch reveals.
2. Include every recorded Dennis clear, including131-155 and later clears.
   Count actual starts/restarts. Require bot tries <= Dennis tries on every
   level, and strictly fewer wherever Dennis needed2+. Initial focus:
   134,141,143,147. A finite failure is not impossibility or permission to peek.
3. Make general planning changes only. After development passes, freeze the
   bot and compare the next20 progression levels without fitting on them.
4. Report the slowest decision; target under approximately2 seconds on a PC.
5. Small commits, short per-run result tables, no large new analysis logs.

The screenshot/pixel/pose/dictionary track is stopped. Existing source and
evidence are retained for archival purposes only; it is not part of this bot.
Use `node source/tests/run.js human_reference` for the non-pixel core checks.
Historical symbolic campaigns declaring complete obstacle rules are not proof
that this new visibility-gated goal has passed.

Current status: implementation and validation in progress. The prior four
individual regressions and the unseen20-level gate are still open.

## Single visibility rule

`human_board_visibility.js:tileVisibility` is the only exposure decision.
An alive tile is exposed unless an alive, higher tile occupies the exact same
x/y position (the production Hard cover convention). Partial overlap leaves a
recognizable edge, as Dennis confirmed. Side-blocking prevents taking, not seeing.
Exposed back orientation is public; a picture and current obstacle overlay are
read only when exposed and face-up, including a physically opened peek.
Covered or closed pictures/roles stay unknown. The active clock badge alone is
public even through a cover; its picture gets no exemption. `observeBoard` calls
trusted picture/role readers only after that gate. Search receives data, not
readers, and must stop at an unobserved picture, orientation or mechanical role.

## Recorded-clear coverage

Dennis confirmed on2026-10-22 that old recordings do not exist and that his
attempt counts still set the target. The catalog therefore keeps every recorded
first clear, not just the recent recording subset. It prefers an exact opening
recording, then that app version's fixed level table, then the current fixed
definition, then a current classic board at declared aspect1.5. The last two
sources are explicitly not asserted identical to the historical board. This
distinction must remain in results; counts alone cannot reconstruct a missing
historical deal. A replay win never replaces the first-clear target.

The human-information campaign independently replays accepted actions through
unmodified production. A 1500 ms shared search deadline includes alternative-root
searches and death proofs. Expiration stays unresolved/bounded, never a loss.
The candidate inspects unknown free closed tiles before nonclock commitments;
inspection ordering is still being compared over the complete development set.

The optional exclusive-role contract derives from `Layouts.obstacles`: the
generator reserves keys/locks before choosing ice from unused positions. The
trusted environment rejects overlap, more than two ice hits, or a key count
other than zero/two before enabling that declaration. Under it, previously
observed ice can be forecast to thaw and an observed lock can open after both
actually observed keys leave. No unobserved role is read or assumed absent.
`exclusiveRoles: 'clock'` uses that extra forecast only while the clock remains;
it is an experimental general strategy, not a per-level rule or proven optimum.

Screening stops once the allowed number of tries is exhausted (one for a
one-try Dennis clear; Dennis minus one otherwise). This affects only evaluation
censoring, not policy decisions. A `>N` result means no clear within N actual
tries, not an invented successful try. Source hashes and board provenance are
reported; only one short table is written when a report path is explicitly given.
