# Builder continuation with B3, 2026-11-10

The first pilot produces **zero experimental hits in four requests / 16 proposal
trials**. Twelve trials reach numerical ratings; B3 scores all of them at
S1.00-1.15, below the normal 2.5 minimum. Three trials fail selected-spare/static
checks and one fails the bounded construction proof. No trial reaches trace
qualification, no level is accepted, and no difficulty policy is changed.

| Body / family request | Trials | New evaluations | Result |
| --- | ---: | ---: | --- |
| U / 10 | 4 | 3 | No measured hit |
| U / 13 | 4 | 4 | No measured hit |
| Castle / 10 | 4 | 4 | No measured hit |
| Castle / 13 | 4 | 4 | No measured hit |

"New evaluations" includes static checks that do not proceed to bot ratings.
All 16 proposals are distinct. Total measured request costs are 82.219 seconds
wall and 86.484 seconds process CPU, including failed trials. Cost per usable
level is undefined because no usable level was produced. Cache hits contribute
to these observed costs; this is not an uncached timing benchmark.

The exact G9 U board (keys [12,16], ice 44 strength 2, clock 16, hash
`e038d9ff3e4a48228ead2c9d0e732a8f0677fffa476543976a3294e7efa4a176`)
still gives family D13.515, but now B3 S1.05. It previously gave old skilled
S9.22 and Dennis cleared it first try. The stronger bot changes the diagnosis
from "too hard for skilled" to "not enough challenge for skilled" without
changing the physical board or the family rating.

The castle wing-ice recipe shows why a monotone clock assumption is unsafe:
family D16.59 at spare 2 rises to D18.415 at spare 3, while B3 stays S1.10.
The cap-20 result at spare 1 is a capped measure, not an exact difficulty above
the measurement ceiling. All these bodies retain the zero-face-down G9 control.

The working continuation now has an explicit B3 source-fingerprinted yardstick,
target-sensitive measured proposal selection, persistent miss knowledge,
bounded distinct trials and complete qualification checks. It cannot yet
construct reliably at the requested bands. Its present finite component supply
is inadequate under the stronger solver; clock tuning alone did not repair it.

G10 owns the broader builder problem. Deliberate face-down placement is one
possible component experiment, alongside other matching/dependency mechanisms.
It is not a predetermined fix. No face-down experiment was run before the user
requested the broad Gemini handoff.

`results.json` retains requests, every attempt and costs. `knowledge.json`
retains constructed boards, proofs, ratings, misses and exact ruler/code context.
`metadata.json` records the context and raw evidence hashes. A repeat command is:

```powershell
node source/tools/builder/loop/heavy.js --label builder-next-repeat -- node source/analysis/builder-next/b3-pilot/run.js
```

The repeat writes to ignored `source/build/builder-next-b3-pilot-repeat/`, leaving
this evidence intact. The small controller check
`node source/tools/builder-next/test_planning.js` passes; it protects the old
false-qualification/cycling defects, not general puzzle-building competence.
