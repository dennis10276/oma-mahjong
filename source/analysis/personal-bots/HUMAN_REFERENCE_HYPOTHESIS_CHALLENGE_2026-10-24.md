# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true}`
Source: `ea57c84eb4c5edbbfbe6a54623ace90d100e9c9a9a09391271a8bd979c2f3f9a`; unchanged: true.
Input: `02d7ec5d8e26fe7684c5b4473c631fe46e5933ea46083078a8044eadd4725a69`.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 81 | 1 | >1 | no | versionTable | 736.4 | 1507.5 |
| 92 | 5 | 3 | yes | versionTable | 905.2 | 1505.4 |
| 93 | 1 | >1 | no | versionTable | 637.2 | 1505.6 |
| 99 | 2 | >1 | no | versionTable | 986.1 | 1507 |
| 102 | 2 | >1 | no | recordedOpening | 1076.8 | 1508.5 |
| 107 | 1 | >1 | no | recordedOpening | 986.3 | 1504.5 |
| 111 | 3 | 2 | yes | recordedOpening | 431.3 | 1505.4 |
| 112 | 1 | >1 | no | recordedOpening | 289.6 | 1502.7 |
| 121 | 4 | 2 | yes | recordedOpening | 556 | 1506.3 |
| 123 | 1 | 1 | yes | recordedOpening | 755.7 | 1504.7 |
| 124 | 3 | 2 | yes | recordedOpening | 720.7 | 1508.4 |
| 125 | 1 | >1 | no | recordedOpening | 1013.6 | 1506.4 |
| 134 | 1 | 1 | yes | recordedOpening | 265.4 | 1506.6 |
| 137 | 2 | >1 | no | recordedOpening | 636.9 | 1502.6 |
| 141 | 1 | 1 | yes | recordedOpening | 429.9 | 1503.2 |
| 143 | 1 | 1 | yes | recordedOpening | 507.9 | 1507.3 |
| 147 | 1 | 1 | yes | recordedOpening | 824 | 1507.4 |
| 150 | 3 | 2 | yes | recordedOpening | 914.5 | 1507.5 |

Passed 10/18; mean 695.2ms; slowest 1508.5ms; dominance stops 0.
Causal availability: 466 successful public proofs in 787 queries (includes hypothetical positions, not learned observations).
Blocked taps: 0 retained actual rejected-tap facts; no unseen ice/lock identity is assigned.
Hypotheses: 707 audited decisions, 1 changed roots, 419/758 complete worlds preferred after a constructed clear, 1963 hypothetical routes independently replayed in production. These are conditional heuristic samples, never actual known-win proofs or exact loss fractions.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
