# Public frontier obstacle-relief correction

The production engine permanently lifts obstacles when no legal tile remains,
at least one geometrically free tile exists and the tray is not full.
The complete-known planner modeled this; the human controller's public-frontier
callback did not. A four-tile all-visible board therefore incorrectly received
`knownDead:true`, despite a four-tap production win. This was a false certificate,
not a newly demonstrated impossible level.

| Check | Result |
|---|---|
| Regression before correction | FAIL: `knownDeadEnd`, expected `win` |
| Renamed one/two-hit ice controls | 24/24 constructive four-tap wins, independently replayed |
| Unknown role / picture guards | No guessed relief or newly supplied identity |
| Full tray / arbitrary restricted callback | No inferred relief |
| Complete offline reference suite | 54/54 tests passed in 4s |

The controller now proves that its entire possible frontier is empty before
introducing relief. An uncertain tile prevents that proof. Actual previously
rejected taps can be excluded only on their unchanged alive board. The callback
returns its relief state, which the known planner retains. The frontier cache
distinguishes full and nonfull trays. No hidden role, face, deck or seed is read.

The old raw-short-probe full run was deliberately stopped after emitting level69,
solely because of this reproduced physics/certificate bug, not a polling timeout.
Its source fingerprint was `5df95cb01cd2179c69fa98495b1b500f69572ff1a8e83fd0f899247f9ac182af`.
Failures already observed included46,50,52,69. It has no complete-catalog score
and no completed report; do not extrapolate the earlier33/42 to a full result.
Only the owned benchmark PID39728 was stopped; its wrapper session35017 ended.

The prior completed130/140 campaign score retains its independently verified
physical routes, but its no-win/death explanations predate this correction.
No post-fix campaign gain is claimed here. The strict all-level Dennis gate and
the untouched20-level gate remain unmet. Levels157+ remain unopened.
