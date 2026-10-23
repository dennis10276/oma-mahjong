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

Current status: implementation and validation in progress. The complete
development set and the unseen20-level gate are still open.

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

The goal remains unmet. The best completed full20-case screen passed16/20,
with a1508.5ms slowest observation-plus-planning decision. See
`HUMAN_REFERENCE_RECOVERY_2026-10-23.md`, policy source at `6ed93dc`, fingerprint
`4a7d9926b6e7faec9f01dc90534baf0c43030392bdb9bebb1c826096dec55617`.
134/139/141/143/145 clear on try1;136/147/149/150 remain failures. These are
development boards, not the complete140-level gate or the unseen20-level gate.

Validated general changes distinguish actual unknown boundary taps from passive
reveals, refuse to borrow safety from an unrelated free match, preserve complete
known face-up pairs before beam pruning, and compare observed side/thaw routes
for both clocks and tray recovery. Dependency costs remain ordering heuristics,
never lower bounds, route witnesses, safety certificates or impossibility proofs.

The current `aa9795c` pressure-aware candidate passes9/11 focused cases, including
all original134/141/143/147 focus levels plus136 and149 on try1.137 fails its
allowed single try;150 fails both allowed tries. Slowest1507.5ms. See
`HUMAN_REFERENCE_PRESSURE_PARITY_FOCUS_2026-10-23.md`, source fingerprint
`bab967f44115c22b945e6b16db7d7b9ab8dea442e198066e894a0a540efd5be7`.
A complete20-case comparison is required before promotion. No profile is chosen
by level, human outcome or hidden information.37/37 offline checks pass,
including192 baseline/research concealed-world controls.

`progressiveReopens` keeps a remembered closed tile eligible when its actual
known non-losing peek/removal prefix opens a new possible public action or
mechanical-certainty gain. It does not assume the newly exposed picture/role.
`riskFirstRecovery` estimates unresolved carrier pressure along observed mate
frontiers before applying the ordinary known-mate preference. Required known
pairs cancel before outside matches are spent. Unknown pictures and Jokers stay
unresolved; projected overflow is a ranking risk, not a physical prediction,
route witness, safety guarantee or death proof. Endpoint parity is not a proof
that intermediate tray pressure fits. Actual known transitions still use the
physical model, and every campaign action independently replays in production.

Retry memory now also retains later-seen keys/locks and reconstructs starting
ice hits from visible remaining ice plus public neighbor removals under the
declared exclusive-role contract. Late none remains ambiguous: it may be thawed
ice or an opened lock, so it must not become starting safety. No hidden role is
read or inferred merely because its picture was recognized from a border.

The read-only catalog refresh still accounts for140 first clears, levels17-156,
without opening future/unseen boards. An older full-catalog baseline passed
111/140 with `unchanged:false` because source changed during execution; that is
coverage/older-policy evidence, not validation of the current source. The next
20 not-developed-on progression levels remain reserved for a later freeze.

Negative experiments remain in their short reports. The consumed-pair scoring
screen passed15/20, regressing133. Balanced recovery plus constructive digging
passed16/20, fixing136 but regressing137 and changing132 from one try to two.
These results are not hidden by reporting only successful settings; initial
focused improvements are not presented as complete-set wins. Earlier comparisons
remain in per-run tables and Git rather than growing this checkpoint indefinitely.

A public-only136 probe finds the same seven-tap clock opening as Dennis, removes
the clock at move6, and later reaches an empty tray. Subsequent commitments cause
the loss. A dead position reached after mistakes does not prove that the initial
board is impossible or excuse failure as hidden luck. Investigate general route
and commitment selection before making any such claim.

Public-analysis caching is scoped to one search/observation snapshot. Bounded
proofs stay unresolved. Only frozen alive arrays may cache binary signatures;
mutable arrays never do. Accepted campaign actions independently replay through
unmodified production. The1500ms search deadline is shared by alternative roots
and death proofs; timing also includes the actual observation/projection work.
