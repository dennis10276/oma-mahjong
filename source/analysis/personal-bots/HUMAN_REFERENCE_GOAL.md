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
The old exact-grid Hard cover shortcut is replaced by game-geometry occlusion:
the renderer's1.24 height ratio,14% up-left layer lift and drawing order are
projected without screenshots. Higher drawn tiles are subtracted as a union,
not checked individually. Opaque-body/side bounds are conservative for tile
widths of at least20px (side allowance=max(.085,3/20)). An inner face region,
inset.15 tile-widths, defines the readable obstacle-overlay region. Dennis
clarified on2026-10-23 that he recognizes a face-up picture even from its exposed
beige/green border. Picture/orientation visibility therefore also tests two
inscribed body strips, including the minimum solid side depth. Rounded corners
and soft shadows alone do not count. This is an explicit semantic recognition
contract, not a pixel-recognition or per-picture artwork guarantee. A border
does not disclose an obstacle overlay that is still covered.
Renderer/CSS anchors and covered-union/separated-layer controls guard it.
Side-blocking prevents taking, not seeing.
Exposed back orientation is public; a picture and current obstacle overlay are
read only when exposed and face-up, including a physically opened peek.
Covered or closed pictures/roles stay unknown. The active clock badge alone is
public even through a cover; its picture gets no exemption. `observeBoard` calls
trusted picture/role readers only after that gate. Search receives data, not
readers, and must stop at an unobserved picture, orientation or mechanical role.

The game-state bridge currently assumes the declared >=20px viewport domain.
Integration at a smaller rendered tile size must remain unsupported until its
geometry bound is supplied; old unrecorded viewport identity is not claimed.
Entirely occluded pictures and closed pictures remain unknown, even with the
border-recognition contract. Concealed-world controls use projection-aligned
covers so they remain genuinely occluded rather than merely grid-stacked.

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

## Development checkpoint

Using the declared exclusive-role forecast throughout play passed15/20 recent
cases, slowest1506ms. It adds133 and137 on try1 but regresses141 from a clear
to an18-tile tray loss; it is not a dominating replacement for the14/20 clock-only
forecast. Neither result permits selecting different profiles by level or human
outcome. A combined general single-carry strategy is the next comparison.

A public-only replay probe of136 removes the clock at move6 and later reaches
an empty tray. The subsequent singleton commitments lead to a certified dead
position only after earlier choices. This is evidence to investigate general
commitment/route selection, not evidence that the starting board is impossible
or that hidden luck excuses failure.147,149 and150 remain unresolved failures.

The source-unchanged clock-route screen passed14/20 recent levels, slowest
1508.4ms, adding139 without losing the other13 passes. Raising nonclock discovery
to three carried tiles also passed14/20 but changed139 from one try to two, so
it is not automatically promoted. Production controls cover all37 pictures at
three carried tiles: first discovery either matches or peeks, never adds a fourth
unmatched tile. That local safety property does not prove a stronger whole-game
strategy.31/31 offline tests pass, including192 baseline/research concealed-world
controls. No full-catalog or unseen20 success is claimed.

Border recognition passed13/20 recent cases, adding145 on try1; slowest1511ms.
The optional `alternativeGoalRoutes` compares both side directions using only
public dependencies rather than choosing a geometric length tie arbitrarily.
It includes every blocker on a branching side and only the needed observed thaw
neighbors. A focused check adds139 on try1 versus Dennis3 while retaining
134/141/143;147 still fails.30/30 core checks pass. Broader testing is required
before selecting a new default; dependency costs remain heuristics, never
feasibility, lower-bound, safety or impossibility certificates.

The completed older full-catalog baseline passed111/140, not the goal. Its
source changed on disk during execution, so its report explicitly records
`unchanged:false`; it is coverage/older-policy evidence, not a current gate pass.
The source-unchanged20-case geometry/known-pair candidate passed12/20, with a
1505.1ms slowest observation-plus-planning decision. These results predate the
newly authorized border-recognition contract. Both full failures and substitute
board provenance remain in the short reports.

The optional `patientSingleCarry` phase prefers guaranteed ready pairs with one
carried tile outside the clock phase, rather than digging prematurely. It uses
only observed pictures and public mechanical certainty. Its initial focused
comparison remained3/4, including a failure on147, so it is experimental rather
than a demonstrated improvement or promoted default.29/29 offline human-reference
tests pass after the border-contract change; the full goal remains active.

The source-bound focused run in `HUMAN_REFERENCE_FOCUS_2026-10-22.md` clears
134,141,143 on try1 and fails147 within its allowed single try. Slowest planning
decision is1499.8ms. These four rows are not a complete-catalog pass. An earlier
20-case conservative-role experiment passed14/20; the next full-catalog run must
retain all failures, including132,136,145,147,149,150 rather than reporting only
the improved focus cases. No unseen20-level freeze or completion is claimed.

Public-analysis caching is scoped to one search/observation snapshot. It reuses
metrics and bounded/unbounded proof analyses without turning bounds into loss
certificates. Frozen alive arrays may cache their binary signatures; mutable
arrays never do. Tests check identical paths/conclusions with caching enabled,
including one-node proof limits, and96 concealed worlds with identical public
observations. The stopped full-catalog batch is recorded separately as interrupted,
not promoted to a completed benchmark.
