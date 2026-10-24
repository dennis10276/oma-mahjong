# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"informationSampling":true,"informationPlayoutNodes":1}`
Source: `1203bb21eb021571832de2847f066546896b17960a044747faf396ff37007cf0`; unchanged: true.
Input: `3c9d2c4d74ec9506e781be938ac3a59a25023096826ab0dd2fb69fa9d376334d`.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 99 | 2 | >1 | no | versionTable | 1240.6 | 1301.7 |
| 111 | 3 | >2 | no | recordedOpening | 1280.3 | 1303.5 |
| 112 | 1 | >1 | no | recordedOpening | 1273.1 | 1301.4 |

Passed 0/3; mean 1272.7ms; slowest 1303.5ms; dominance stops 0.
Causal availability: 0 successful public proofs in 0 queries (includes hypothetical positions, not learned observations).
Blocked taps: 0 retained actual rejected-tap facts; no unseen ice/lock identity is assigned.
Hypotheses: 323 audited decisions, 96 changed roots, 239/1195 complete worlds preferred after a constructed clear, 1759 hypothetical routes independently replayed in production. These are conditional heuristic samples, never actual known-win proofs or exact loss fractions.
Hypothesis limits: 956 unresolved complete worlds, 130 unfinished batches, 0 all-loss worlds excluded only by the preference. Verified narrow/wider rollout clears: 0/0; unresolved rollouts: 871; conditional certified rollout losses: 4194.
Sampling influence: 96/323 contested decisions (29.7%); 0 primary choices excluded by actual safety proofs are counted separately. Information-aware play-outs: 9435, clears 46, physical policy losses 7836, unresolved 1553, repeated-public-choice stops 0.
Filled-position exact search: 4096 nodes per candidate at most, within the shared deadline; 7049 calls, 1572215 expanded nodes, 4194 completely exhausted hypothetical losses. Capped searches stay unresolved; these are not actual loss proofs.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
