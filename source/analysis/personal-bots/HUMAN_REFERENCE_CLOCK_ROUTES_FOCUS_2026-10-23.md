# Alternative public clock routes: focused development check

Source `8d9018201f0120b7007df030a56a7dc99f4489331be670bb89ce818016508d2a`;
unchanged during execution. The border-recognition candidate's planning options
plus `alternativeGoalRoutes:true`; no per-level policy, hidden pictures or seeds.

| Level | Dennis tries | Bot tries | Pass | Slowest ms |
|---:|---:|---:|:---:|---:|
| 134 | 1 | 1 | yes | 1061.3 |
| 139 | 3 | 1 | yes | 1496.5 |
| 141 | 1 | 1 | yes | 611.9 |
| 143 | 1 | 1 | yes | 495.5 |
| 147 | 1 | >1 | no | 1347.9 |

4/5 strict passes. Every accepted tap independently replayed in production.
139 previously failed both allowed tries at the clock. Comparing alternate
sides using observed locks, keys and thaw requirements avoids a needless locked
side. These dependency sets are ordering heuristics, not feasibility/death
proofs. The unchanged production witness still checks selected known routes.
147 remains a tray loss with44 tiles left. Full catalog/unseen20 gates not met.
