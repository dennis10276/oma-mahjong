# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true}`
Source: `a239b8a91eb8cefb4596f6fd02b66c5a1f801b6039a09b27ea9693558cedbe3e`; unchanged: true.
Input: `02d7ec5d8e26fe7684c5b4473c631fe46e5933ea46083078a8044eadd4725a69`.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 81 | 1 | >1 | no | versionTable | 821.8 | 1507.3 |
| 92 | 5 | 3 | yes | versionTable | 905.6 | 1504.2 |
| 93 | 1 | >1 | no | versionTable | 638 | 1502.6 |
| 99 | 2 | >1 | no | versionTable | 1049.4 | 1509.4 |
| 102 | 2 | >1 | no | recordedOpening | 1076.7 | 1508.4 |
| 107 | 1 | 1 | yes | recordedOpening | 1123.2 | 1505.5 |
| 111 | 3 | 2 | yes | recordedOpening | 525.1 | 1505.4 |
| 112 | 1 | >1 | no | recordedOpening | 451.8 | 1503.4 |
| 121 | 4 | 1 | yes | recordedOpening | 768.9 | 1507 |
| 123 | 1 | 1 | yes | recordedOpening | 788 | 1506.1 |
| 124 | 3 | 2 | yes | recordedOpening | 732.2 | 1507.9 |
| 125 | 1 | >1 | no | recordedOpening | 1013.9 | 1505.2 |
| 134 | 1 | 1 | yes | recordedOpening | 265.8 | 1505.6 |
| 137 | 2 | >1 | no | recordedOpening | 637 | 1502.7 |
| 141 | 1 | 1 | yes | recordedOpening | 320.5 | 1503.8 |
| 143 | 1 | 1 | yes | recordedOpening | 508.2 | 1507.2 |
| 147 | 1 | 1 | yes | recordedOpening | 860.9 | 1504.2 |
| 150 | 3 | 2 | yes | recordedOpening | 915.8 | 1509.3 |

Passed 11/18; mean 745.6ms; slowest 1509.4ms; dominance stops 0.
Causal availability: 0 successful public proofs in 4 queries (includes hypothetical positions, not learned observations).
Blocked taps: 0 retained actual rejected-tap facts; no unseen ice/lock identity is assigned.
Hypotheses: 794 audited decisions, 67 changed roots, 1817/2423 complete worlds preferred after a constructed clear, 11739 hypothetical routes independently replayed in production. These are conditional heuristic samples, never actual known-win proofs or exact loss fractions.
Hypothesis limits: 455 unresolved complete worlds, 794 unfinished batches, 151 all-loss worlds excluded only by the preference. Verified narrow/wider rollout clears: 10945/794; unresolved rollouts: 4984; conditional certified rollout losses: 2317.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
