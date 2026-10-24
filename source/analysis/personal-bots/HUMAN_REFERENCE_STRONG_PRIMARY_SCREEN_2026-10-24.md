# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"informationSampling":true,"informationPlayoutNodes":1,"informationPrimaryMs":200,"informationSchedule":"sequential"}`
Source: `9f272f14f4f18efb837e120ef6ea877642e1fe6bffa237fa5212c177fe671d5a`; unchanged: true.
Input: `5710b9e2772fa2cd5207574a8669159817f3d18d173fb7c7ff4ca4bb0d69a51a`.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 81 | 1 | >1 | no | versionTable | 1258.5 | 1304 |
| 92 | 5 | 2 | yes | versionTable | 1279.1 | 1319.8 |
| 93 | 1 | >1 | no | versionTable | 1276.1 | 1306.3 |
| 99 | 2 | >1 | no | versionTable | 1215.4 | 1300.1 |
| 102 | 2 | >1 | no | recordedOpening | 1279 | 1302.5 |
| 107 | 1 | >1 | no | recordedOpening | 1271.8 | 1301.2 |
| 111 | 3 | 1 | yes | recordedOpening | 1282.5 | 1301.5 |
| 112 | 1 | >1 | no | recordedOpening | 1285.3 | 1302.1 |
| 121 | 4 | >3 | no | recordedOpening | 1065.4 | 1299.4 |
| 123 | 1 | >1 | no | recordedOpening | 1276.6 | 1303.8 |
| 124 | 3 | >2 | no | recordedOpening | 1199.5 | 1303.3 |
| 125 | 1 | >1 | no | recordedOpening | 1266.5 | 1299.1 |
| 134 | 1 | >1 | no | recordedOpening | 1195.7 | 1295.6 |
| 137 | 2 | >1 | no | recordedOpening | 1258.2 | 1298.3 |
| 141 | 1 | 1 | yes | recordedOpening | 1222.4 | 1301.4 |
| 143 | 1 | 1 | yes | recordedOpening | 1274 | 1301.4 |
| 147 | 1 | >1 | no | recordedOpening | 1266.2 | 1300.1 |
| 150 | 3 | >2 | no | recordedOpening | 1260.5 | 1302.4 |
| 10011 | 2 | >1 | no | levelLab | 1230.6 | 1301.9 |
| 10032 | 5 | >4 | no | levelLab | 1186.7 | 1303.6 |
| 10033 | 5 | >4 | no | levelLab | 1206.6 | 1303.2 |
| 10041 | 7 | >6 | no | levelLab | 1210.3 | 1305.2 |
| 10049 | 2 | >1 | no | levelLab | 1257.6 | 1301.5 |
| 10052 | 3 | >2 | no | levelLab | 1238.2 | 1302.7 |

Passed 4/24; mean 1252.3ms; slowest 1319.8ms; dominance stops 0.
Causal availability: 7304 successful public proofs in 79154 queries (includes hypothetical positions, not learned observations).
Blocked taps: 0 retained actual rejected-tap facts; no unseen ice/lock identity is assigned.
Hypotheses: 1462 audited decisions, 268 changed roots, 1027/5297 complete worlds preferred after a constructed clear, 6522 hypothetical routes independently replayed in production. These are conditional heuristic samples, never actual known-win proofs or exact loss fractions.
Hypothesis limits: 4270 unresolved complete worlds, 184 unfinished batches, 0 all-loss worlds excluded only by the preference. Verified narrow/wider rollout clears: 0/0; unresolved rollouts: 3276; conditional certified rollout losses: 7599.
Sampling influence: 268/1462 contested decisions (18.3%); 0 primary choices excluded by actual safety proofs are counted separately. Information-aware play-outs: 32262, clears 1267, physical policy losses 20947, unresolved 10048, repeated-public-choice stops 0.
Filled-position exact search: 4096 nodes per candidate at most, within the shared deadline; 17932 calls, 3217983 expanded nodes, 7599 completely exhausted hypothetical losses. Capped searches stay unresolved; these are not actual loss proofs.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
