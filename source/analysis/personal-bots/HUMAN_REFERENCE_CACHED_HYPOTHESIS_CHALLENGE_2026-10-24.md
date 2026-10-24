# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true}`
Source: `33ddd6f6db0af708ea6475e561b3616d71e49187a9443a886c1226f3a49a1c04`; unchanged: true.
Input: `02d7ec5d8e26fe7684c5b4473c631fe46e5933ea46083078a8044eadd4725a69`.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 81 | 1 | >1 | no | versionTable | 821.9 | 1506.4 |
| 92 | 5 | 3 | yes | versionTable | 907.2 | 1506.1 |
| 93 | 1 | >1 | no | versionTable | 638.6 | 1502.7 |
| 99 | 2 | >1 | no | versionTable | 1049.7 | 1506.4 |
| 102 | 2 | >1 | no | recordedOpening | 1077.4 | 1509.3 |
| 107 | 1 | 1 | yes | recordedOpening | 1123.4 | 1505.6 |
| 111 | 3 | 2 | yes | recordedOpening | 525.9 | 1503.5 |
| 112 | 1 | >1 | no | recordedOpening | 452.6 | 1503.5 |
| 121 | 4 | 1 | yes | recordedOpening | 526.2 | 1506.4 |
| 123 | 1 | 1 | yes | recordedOpening | 789.4 | 1504 |
| 124 | 3 | >2 | no | recordedOpening | 770.2 | 1506.4 |
| 125 | 1 | >1 | no | recordedOpening | 1014.4 | 1504.3 |
| 134 | 1 | 1 | yes | recordedOpening | 266 | 1507.6 |
| 137 | 2 | >1 | no | recordedOpening | 637.2 | 1506.7 |
| 141 | 1 | 1 | yes | recordedOpening | 320.1 | 1502.8 |
| 143 | 1 | 1 | yes | recordedOpening | 508.5 | 1507.4 |
| 147 | 1 | 1 | yes | recordedOpening | 850.9 | 1508.4 |
| 150 | 3 | 2 | yes | recordedOpening | 916.5 | 1510.2 |

Passed 10/18; mean 734.3ms; slowest 1510.2ms; dominance stops 0.
Causal availability: 0 successful public proofs in 4 queries (includes hypothetical positions, not learned observations).
Blocked taps: 0 retained actual rejected-tap facts; no unseen ice/lock identity is assigned.
Hypotheses: 768 audited decisions, 65 changed roots, 1841/2713 complete worlds preferred after a constructed clear, 12239 hypothetical routes independently replayed in production. These are conditional heuristic samples, never actual known-win proofs or exact loss fractions.
Hypothesis limits: 598 unresolved complete worlds, 766 unfinished batches, 274 all-loss worlds excluded only by the preference. Verified narrow/wider rollout clears: 11283/956; unresolved rollouts: 6113; conditional certified rollout losses: 3310.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
