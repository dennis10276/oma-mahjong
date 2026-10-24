# Public-state repeat diagnostic: level99

Same narrow-rollout planning profile, one actual start,64 accepted-tap cap.
Only public physical states and actual picture/orientation/role/safety-memory
signatures were compared. Physical-tap count is excluded from state equivalence;
new information, moves, removals, tray order, peek, relief and arrivals are retained.

| Version | Status at cap | Accepted taps | Moves | Tiles left | Identical public choices repeated | Slowest ms |
|---|---|---:|---:|---:|---:|---:|
| Before visit guard | unresolvedBudget | 64 | 40 | 32 | 9 | 1506.7 |
| With visit guard | unresolvedBudget | 64 | 43 | 29 | 0 | 1508.2 |

Before the fix, taps55–62 repeatedly alternated tiles29 and6, with tray[25,31]
and moves40. The entire physical AND actual remembered-knowledge state matched
earlier choices at53/54. All examples were hypothesis choices overriding primary
root49. Thus these repeats brought no information or physical progress.

The guard records only accepted actual choices. It prevents a sampled alternative
from repeating the same state/knowledge/action within an attempt, preserves the
real primary fallback and constructive winning/clock-exit witnesses, and resets
visit bookkeeping on a real retry. New observed information allows reconsideration.
The guarded trace filtered6 repeated roots on3 decisions. It reached3 more removals
in the same64-tap window without repeating an identical public choice.

Both complete64-tap traces independently replayed through original Hard.play.
Both caps remain UNRESOLVED; neither is a measured successful try, a physical loss,
an impossibility claim or a new full-score result. The interrupted18-case trial
is documented separately. Full development and unseen20 gates remain unmet.
