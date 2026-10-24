# Retry clock-exit replacement experiment

The completed retry-learning diagnostic cleared0/12 lab/salt cases, despite
learning four unrecovered-risk facts per case. The existing clock wrapper protects
a safe-clock-exit report even when its root matches an actual earlier failed risk.
The retained-planner reset also protects these reports. Reaching the clock safely
does not establish a complete winning route.

The opt-in `retryClockExitReplacement` permits reconsidering such a root only when
actual same-level memory assigns it a penalty. The replacement must have a lower
penalty and a known, physically validated safe clock-exit prefix. Known wins and
exhaustive known-dead reports remain protected. Unknowns, exhausted nodes and
expired deadlines cannot justify replacement. Defaults remain unchanged.

The reference tests pass99/99 before importing the independently tested compiled
visibility gate. They include the actual production-replayed alternate exit,
replacement of a protected safe exit, unknown-picture refusal, protected wins and
shared node/deadline bounds. Lab captures now count decisions matching a learned
risk, choices of a penalized root and choices carrying a safe-clock-exit report.
These counts will distinguish an inactive restriction from a live cause of failure.
After importing the exact compiled gate and its exhaustive parity test, the complete
offline reference suite passes100/100 in31s while the twelve primary workers run.

This is an isolated candidate, with no campaign improvement or adoption claimed.
First run the instrumented lab control with replacement disabled. If learned risks
never match later decisions, investigate their scope before crediting this variant.
All twelve primary workers must retain their original frozen source until terminal.
