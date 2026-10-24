# Narrow-first hypothesis trial: interrupted for diagnostics

Started2026-10-24T12:25:24.715Z, runtimeeeaa906, session2256.
The verified benchmark PID12264 was deliberately stopped during level99 so a
bounded public-state trace could investigate excessive decision counts.
It exited1 after Stop-Process. No complete18-case score is claimed.

Same planning as HUMAN_REFERENCE_HYPOTHESIS_CHALLENGE_2026-10-24.md.
Loaded source: `671a5beb04e4765dac7863ca8a5a2acf80fef1158be31a8da63f518c07925655`.
Input: `02d7ec5d8e26fe7684c5b4473c631fe46e5933ea46083078a8044eadd4725a69`.

| Level | Dennis tries | Bot tries | Status | Slowest ms | Sampled decisions | Changed roots | Verified hypothetical clears |
|---:|---:|---|---|---:|---:|---:|---:|
| 81 | 1 | >1 | tray loss | 1509.6 | 122 | 107 | 679 |
| 92 | 5 | 3 | clear | 1504.6 | 95 | 0 | 1705 |
| 93 | 1 | >1 | tray loss | 1503 | 13 | 0 | 7 |
| 99 | 2 | unresolved | interrupted during computation | — | — | — | — |

The other14 requested cases were not reached. Every completed campaign's accepted
actions independently replayed through original Hard.play. The interrupted case
is unresolved, never a counted physical loss or a free restart. The full155-level
goal remains unmet. No pass is merged with another policy/run.
