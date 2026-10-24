# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"informationSampling":true,"informationPlayoutNodes":1,"informationPrimaryMs":200,"informationSchedule":"sequential"}`
Source: `9f272f14f4f18efb837e120ef6ea877642e1fe6bffa237fa5212c177fe671d5a`; unchanged: true.
Input: `3c9d2c4d74ec9506e781be938ac3a59a25023096826ab0dd2fb69fa9d376334d`.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 99 | 2 | 1 | yes | versionTable | 1181 | 1303.1 |
| 111 | 3 | 2 | yes | recordedOpening | 1238.5 | 1301.6 |
| 112 | 1 | 1 | yes | recordedOpening | 1254.7 | 1303.8 |

Passed 3/3; mean 1231.8ms; slowest 1303.8ms; dominance stops 0.
Causal availability: 0 successful public proofs in 0 queries (includes hypothetical positions, not learned observations).
Blocked taps: 0 retained actual rejected-tap facts; no unseen ice/lock identity is assigned.
Hypotheses: 372 audited decisions, 83 changed roots, 779/1455 complete worlds preferred after a constructed clear, 5229 hypothetical routes independently replayed in production. These are conditional heuristic samples, never actual known-win proofs or exact loss fractions.
Hypothesis limits: 676 unresolved complete worlds, 69 unfinished batches, 0 all-loss worlds excluded only by the preference. Verified narrow/wider rollout clears: 0/0; unresolved rollouts: 528; conditional certified rollout losses: 1641.
Sampling influence: 83/372 contested decisions (22.3%); 0 primary choices excluded by actual safety proofs are counted separately. Information-aware play-outs: 9018, clears 939, physical policy losses 6032, unresolved 2047, repeated-public-choice stops 0.
Filled-position exact search: 4096 nodes per candidate at most, within the shared deadline; 7360 calls, 1054181 expanded nodes, 1641 completely exhausted hypothetical losses. Capped searches stay unresolved; these are not actual loss proofs.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
