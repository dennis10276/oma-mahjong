# Lab41 public retry trace

One salt1 diagnostic reproduced four actual tray losses. All176 accepted taps
independently replayed through original production; captured source was unchanged.
This is a developed-board diagnostic, not a seeded adoption screen or timing test.
The JSON contains actual public decision states and conditional sampler reports.
The summary reconstructs where each picture still in the terminal tray entered it,
removing an origin whenever that picture leaves the public tray.

| Actual try | Taps | Surviving second-slot placements (tile at tap) | Learned third-slot risk |
|---:|---:|---|---:|
|1|43|85 at2; 67 at35|46|
|2|35|85 at2; 67 at29|81|
|3|51|67 at29; 34 at40|45|
|4|47|67 at29; 46 at38|45|

Tile67 introduced picture12, with no remembered partner, on every attempt and
remained in the tray until each loss. This motivates investigating earlier carrier
decisions, but does not prove taking that tile was a losing action.

A stronger information-use issue appears in the same trace: no attempt ever chose
clock52, either successfully or unsuccessfully. At the tile67 decisions and the next
three decisions, the public geometry says clock52 is structurally free, its picture13
and face-up orientation are remembered, and the route audit ends at an unknown
obstacle role in a hypothetical successor. This does not establish the current
mechanical frontier. The planner repeatedly chose routes ending at that information
frontier instead of testing the clock directly. Some such routes increased tray load.
The public clock badge reports location52 and move limit61; no concealed role or
future picture was used to derive this finding.

Next candidate: an early probe of an available uncertain clock, using the public
frontier and actual rejection feedback. Default tray limit1 leaves room after a
possible unmatched take; a free closed peek or known tray match is also eligible.
Preserve known winning routes. Rejection means ice-or-lock only, not which one;
existing blocked-tap memory must prevent unchanged repeated probes. The candidate
needs production controls and a complete48-case seeded screen before adoption.
The subsequent direct candidate trace recorded zero probes across four attempts;
the original geometric-access diagnosis was too strong. Capture current public
role, availability and rejected-tap blocking before choosing a further route change.
The current-frontier diagnostic now confirms a publicly known lock at clock52;
the actor was correct not to probe it. Key discovery is the relevant next route.
