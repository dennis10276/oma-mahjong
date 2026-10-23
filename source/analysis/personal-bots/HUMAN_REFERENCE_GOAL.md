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

The goal remains unmet. The completed frozen full-catalog screen passes126/140,
slowest1516.1ms. Every recorded first clear17-156 is included. See
`HUMAN_REFERENCE_CATALOG_CURRENT_2026-10-23.md`, source `040a5e8`, fingerprint
`59599bbbfb2e2d66c78f735956c1eb8e87bf66d0db19e2ad1176756563f625a5`;
unchanged throughout execution. All original134/141/143/147 focus levels pass
on try1. Failures:50,81,84,92,93,99,102,107,112,121,124,125,137,150. Recorded
openings pass49/57; original-version tables19/24; explicitly non-identical current
fixed substitutes24/24; current classic/aspect1.5 substitutes34/35. This is still
development evidence, not the unseen20-level gate. The metadata-only refresh
still finds140 clears, newest156; no future board was opened.

Validated general changes distinguish actual unknown boundary taps from passive
reveals, refuse to borrow safety from an unrelated free match, preserve complete
known face-up pairs before beam pruning, and compare observed side/thaw routes
for both clocks and tray recovery. Dependency costs remain ordering heuristics,
never lower bounds, route witnesses, safety certificates or impossibility proofs.

Current `4d9f249` adds a rule-supported takeability proof for an unobserved role:
the origin frame must be known, both actually observed keys removed, and two
actually observed starting ice-neighbors removed. Under the declared maximum2
ice hits and0-or-2-key contract, every supported blocker is then discharged.
The role/picture remains unknown; only legal availability is proved. Exhaustive
public-world controls and original-engine closed-tile replays validate it.
39/39 offline tests pass. On the14 prior failures it clears92 on try3 versus5,
and150 on try2 versus3; the other12 still fail. The unchanged-source recent
regression passes25/26 recorded levels131-156, slowest1502.5ms; only137 fails.
Increasing the inspection tray limit from1 to3 still passes the same2/14 prior
failures, so that combination is not promoted. No128/140 mixed-source score or
complete-set improvement is claimed without a new full-catalog run.
No profile is selected by level, human outcome or hidden information.

The earlier ice-budget-fixed source `b2f8845` also clears all six recorded
levels151-156 on try1 (strictly beating every2+ target), with1552.5ms slowest.
That broadens development coverage, but is not the future unseen20 gate and
is not silently merged with another source's results into a frozen score.

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

Negative experiments remain in their short reports. The latest patient-pair
combination passes8/12 and regresses146/149 without fixing137/150. A public-role
replay confirms137's apparent free pair is iced, not a guaranteed usable pair.
The consumed-pair scoring screen passed15/20, regressing133. Balanced recovery
plus constructive digging passed16/20, fixing136 but regressing137 and changing132 from one try to two.
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
