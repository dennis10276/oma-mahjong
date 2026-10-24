# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"informationSampling":true,"informationPlayoutNodes":1,"informationPrimaryMs":200,"informationSchedule":"sequential","informationPicturePrior":"diverse","informationActionPaths":true,"informationPrimitivePeeks":true,"informationExactUnknownLimit":8,"captureDecisionDiagnostics":true}`
Source: `76d2b33aaed5b9d2b9eabb0fa40e089b7864cfee59b7f5149f97f20f1cd21379`; unchanged: true.
Input: `55119a1c07fdbc9518656e4c629a6deb0874a46aac66b5172b31d193cc512355`.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 93 | 1 | >1 | no | versionTable | 1256.4 | 1301.7 |
| 99 | 2 | 1 | yes | versionTable | 1084.9 | 1298.1 |
| 111 | 3 | 2 | yes | recordedOpening | 1190.5 | 1302.2 |
| 112 | 1 | >1 | no | recordedOpening | 1257.1 | 1300 |
| 137 | 2 | >1 | no | recordedOpening | 1254.5 | 1297.3 |

Passed 2/5; mean 1186ms; slowest 1302.2ms; dominance stops 0.
Causal availability: 0 successful public proofs in 0 queries (includes hypothetical positions, not learned observations).
Blocked taps: 0 retained actual rejected-tap facts; no unseen ice/lock identity is assigned.
Hypotheses: 360 audited decisions, 47 changed roots, 165/853 complete worlds preferred after a constructed clear, 2348 hypothetical routes independently replayed in production. These are conditional heuristic samples, never actual known-win proofs or exact loss fractions.
Hypothesis limits: 688 unresolved complete worlds, 52 unfinished batches, 0 all-loss worlds excluded only by the preference. Verified narrow/wider rollout clears: 0/0; unresolved rollouts: 192; conditional certified rollout losses: 154.
Sampling influence: 47/360 contested decisions (13.1%); 0 primary choices excluded by actual safety proofs are counted separately. Information-aware play-outs: 13636, clears 426, physical policy losses 5387, unresolved 7823, repeated-public-choice stops 0.
Filled-position exact search: 4096 nodes per candidate at most, within the shared deadline; 3398 calls, 294719 expanded nodes, 154 completely exhausted hypothetical losses. Capped searches stay unresolved; these are not actual loss proofs.
Complete action options: 48/360 sampled options differ from the primary option; 31 two-tap options selected, 25 continuation taps executed, 6 continuations invalidated by public state or knowledge changes. These are separately reported from changed first taps.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
