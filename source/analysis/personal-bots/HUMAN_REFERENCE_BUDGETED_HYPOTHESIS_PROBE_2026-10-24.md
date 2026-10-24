# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"hypothesisActionMs":100}`
Source: `9392e925c432fb85353c7aa0ded5a3c1bef1886c2fba6ed659a223c79a45ea5c`; unchanged: true.
Input: `b0c8844b5ae7ae59ffcb4bd43f1723d4f33e37f424bbe7df53cd5e5d3eb4b8ff`.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 107 | 1 | >1 | no | recordedOpening | 850.7 | 1503.7 |
| 124 | 3 | >2 | no | recordedOpening | 1010.3 | 1506.9 |
| 137 | 2 | >1 | no | recordedOpening | 635.3 | 1501.9 |

Passed 0/3; mean 913.1ms; slowest 1506.9ms; dominance stops 0.
Causal availability: 0 successful public proofs in 0 queries (includes hypothetical positions, not learned observations).
Blocked taps: 0 retained actual rejected-tap facts; no unseen ice/lock identity is assigned.
Hypotheses: 127 audited decisions, 26 changed roots, 117/890 complete worlds preferred after a constructed clear, 531 hypothetical routes independently replayed in production. These are conditional heuristic samples, never actual known-win proofs or exact loss fractions.
Hypothesis limits: 643 unresolved complete worlds, 125 unfinished batches, 130 all-loss worlds excluded only by the preference. Verified narrow/wider rollout clears: 517/14; unresolved rollouts: 4130; conditional certified rollout losses: 726.
Candidate budgets: maximum 100ms per root within the shared deadline; 1015 world preparations, 8318 candidate evaluations, 3060 local deadline stops retained as unresolved.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
