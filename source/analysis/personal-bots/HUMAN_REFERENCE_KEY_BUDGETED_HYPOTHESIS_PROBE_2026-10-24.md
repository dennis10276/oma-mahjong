# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"hypothesisActionMs":100}`
Source: `65c5af718e0f6f97b056f1d58f12c4428a6e2543abdd73d67e5b6d0013284e7d`; unchanged: true.
Input: `b0c8844b5ae7ae59ffcb4bd43f1723d4f33e37f424bbe7df53cd5e5d3eb4b8ff`.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 107 | 1 | >1 | no | recordedOpening | 860.5 | 1504.7 |
| 124 | 3 | 2 | yes | recordedOpening | 632.1 | 1505.4 |
| 137 | 2 | >1 | no | recordedOpening | 636.1 | 1505.2 |

Passed 1/3; mean 692.6ms; slowest 1505.4ms; dominance stops 0.
Causal availability: 0 successful public proofs in 0 queries (includes hypothetical positions, not learned observations).
Blocked taps: 0 retained actual rejected-tap facts; no unseen ice/lock identity is assigned.
Hypotheses: 95 audited decisions, 11 changed roots, 127/828 complete worlds preferred after a constructed clear, 735 hypothetical routes independently replayed in production. These are conditional heuristic samples, never actual known-win proofs or exact loss fractions.
Hypothesis limits: 522 unresolved complete worlds, 92 unfinished batches, 179 all-loss worlds excluded only by the preference. Verified narrow/wider rollout clears: 724/11; unresolved rollouts: 2822; conditional certified rollout losses: 883.
Candidate budgets: maximum 100ms per root within the shared deadline; 920 world preparations, 7561 candidate evaluations, 2342 local deadline stops retained as unresolved.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
