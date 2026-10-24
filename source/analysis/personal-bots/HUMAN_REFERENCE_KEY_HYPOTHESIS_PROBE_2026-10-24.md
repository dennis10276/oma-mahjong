# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true}`
Source: `65c5af718e0f6f97b056f1d58f12c4428a6e2543abdd73d67e5b6d0013284e7d`; unchanged: true.
Input: `b0c8844b5ae7ae59ffcb4bd43f1723d4f33e37f424bbe7df53cd5e5d3eb4b8ff`.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 107 | 1 | 1 | yes | recordedOpening | 1123 | 1507.1 |
| 124 | 3 | >2 | no | recordedOpening | 786.4 | 1506.9 |
| 137 | 2 | >1 | no | recordedOpening | 635.3 | 1502.4 |

Passed 1/3; mean 906.2ms; slowest 1507.1ms; dominance stops 0.
Causal availability: 0 successful public proofs in 0 queries (includes hypothetical positions, not learned observations).
Blocked taps: 0 retained actual rejected-tap facts; no unseen ice/lock identity is assigned.
Hypotheses: 159 audited decisions, 25 changed roots, 512/923 complete worlds preferred after a constructed clear, 2822 hypothetical routes independently replayed in production. These are conditional heuristic samples, never actual known-win proofs or exact loss fractions.
Hypothesis limits: 213 unresolved complete worlds, 158 unfinished batches, 198 all-loss worlds excluded only by the preference. Verified narrow/wider rollout clears: 2609/213; unresolved rollouts: 1566; conditional certified rollout losses: 1839.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
