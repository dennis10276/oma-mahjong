# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"rememberBlockedTaps":true}`
Source: `21ca235aff2184e5e911b1fff17d0493a21ea343e93e4a5d2dac7f7a5845dc67`; unchanged: true.
Input: `85df19d5b4f0f0a0d3d557cb0262e013675739a0a563dee72f69adc66e64b19e`.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 81 | 1 | >1 | no | versionTable | 36.1 | 199.3 |
| 93 | 1 | >1 | no | versionTable | 62 | 474.2 |
| 99 | 2 | >1 | no | versionTable | 23.6 | 152.3 |
| 102 | 2 | >1 | no | recordedOpening | 24.8 | 158.2 |
| 107 | 1 | >1 | no | recordedOpening | 15.3 | 74.1 |
| 112 | 1 | >1 | no | recordedOpening | 37.6 | 156.1 |
| 125 | 1 | >1 | no | recordedOpening | 19 | 142.4 |
| 137 | 2 | >1 | no | recordedOpening | 59.9 | 477.6 |
| 10011 | 2 | >1 | no | levelLab | 38.3 | 229.9 |
| 10012 | 6 | 5 | yes | levelLab | 132 | 1502.8 |
| 10015 | 11 | 2 | yes | levelLab | 178.9 | 1277.1 |
| 10032 | 5 | >4 | no | levelLab | 197.3 | 1504.8 |
| 10033 | 5 | >4 | no | levelLab | 400.5 | 1503.8 |
| 10041 | 7 | >6 | no | levelLab | 106.5 | 604.9 |
| 10042 | 4 | 2 | yes | levelLab | 79.7 | 586.3 |
| 10044 | 1 | 1 | yes | levelLab | 55.9 | 437.2 |
| 10045 | 6 | 1 | yes | levelLab | 143.3 | 1309 |
| 10046 | 1 | 1 | yes | levelLab | 82.9 | 556.3 |
| 10047 | 1 | 1 | yes | levelLab | 90.1 | 458.4 |
| 10048 | 2 | 1 | yes | levelLab | 71.8 | 296.3 |
| 10049 | 2 | >1 | no | levelLab | 106.9 | 486.2 |
| 10052 | 3 | >2 | no | levelLab | 257 | 1339.8 |
| 10053 | 2 | 1 | yes | levelLab | 56.7 | 435.5 |

Passed 9/23; mean 110.9ms; slowest 1504.8ms; dominance stops 0.
Causal availability: 264540 successful public proofs in 607038 queries (includes hypothetical positions, not learned observations).
Blocked taps: 0 retained actual rejected-tap facts; no unseen ice/lock identity is assigned.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
