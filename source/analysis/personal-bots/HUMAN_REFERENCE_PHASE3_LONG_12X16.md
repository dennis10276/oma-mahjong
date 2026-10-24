# Personal reference: seeded first-try noise screen

Profile: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"informationSampling":true,"informationPlayoutNodes":16,"informationPrimaryMs":200,"informationSchedule":"sequential","informationPicturePrior":"diverse","informationActionPaths":false,"informationPrimitivePeeks":true,"informationExactUnknownLimit":8,"informationScoreMode":"progress","informationConfidenceSE":2,"hypothesisMaximumWorlds":12,"captureDecisionDiagnostics":false,"informationPlayoutTaps":16,"informationPlayoutRecovery":false,"retryRiskLearning":true,"clockRetryLearning":true}`.
Source: `47ed2a0c1033cf6fffe3fd4f97b807ebb64aceea66c702f81b7b0784ae4988d2`; input: `08621c705b790e488aa09ca6b526ce70b95feb11f47207abd88fe40b7e5e6a1d`.
Every row is try1 only, with three independent salt workers. Guard membership follows the requested list regardless of historical human attempt counts.

| Level | Group | Baseline salts1/2/3 | Candidate salts1/2/3 | Gains | Losses |
|---:|---|---|---|---:|---:|
|81|failure|L / L / L|L / L / L|0|0|
|93|failure|L / L / L|L / L / L|0|0|
|99|failure|W / L / W|L / L / L|0|2|
|102|failure|L / L / L|L / L / L|0|0|
|107|failure|W / L / W|L / L / L|0|2|
|112|failure|L / L / L|L / L / L|0|0|
|125|failure|L / L / L|L / W / W|2|0|
|137|failure|L / L / L|W / W / W|3|0|
|134|guard|W / W / W|W / W / W|0|0|
|141|guard|W / W / W|W / W / W|0|0|
|143|guard|W / W / W|W / W / W|0|0|
|147|guard|L / W / W|L / L / L|0|2|
|150|guard|L / L / L|L / L / L|0|0|
|151|guard|W / W / W|W / L / L|0|2|
|153|guard|W / W / W|L / W / W|0|1|
|156|guard|W / W / W|W / W / W|0|0|

First-try wins: 20/48; salts: 6/16, 7/16, 7/16.
Valid complete screen: true. Slowest move: 1316.7ms.
Sampling changed 115/3191 contested first taps; mean completed fillings per contested decision: 2.12.
Play-outs evaluated: 46987; confidence overrides: 115; suppressed proposals: 1850.
Baseline 24/48; gains 5, losses 9; adoption gate: false.
Adoption requires a higher total and at most one previously won salt lost per guard.
Capped runs remain unresolved; W requires a verified production clear. Salt changes only the public-state random stream; wall-time budgets can still affect sample counts. This is development evidence, not unseen20 validation.
