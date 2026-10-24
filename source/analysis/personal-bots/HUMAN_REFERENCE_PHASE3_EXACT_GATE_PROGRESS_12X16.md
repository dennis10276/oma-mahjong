# Personal reference: seeded first-try noise screen

Profile: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"informationSampling":true,"informationPlayoutNodes":16,"informationPrimaryMs":200,"informationSchedule":"sequential","informationPicturePrior":"diverse","informationActionPaths":true,"informationPrimitivePeeks":true,"informationExactUnknownLimit":8,"informationScoreMode":"progress","informationConfidenceSE":2,"hypothesisMaximumWorlds":12,"captureDecisionDiagnostics":false}`.
Source: `977b322f0ea99c523124fc9573467ac7e3d0173478b3c3c514a8b4b6c0108d22`; input: `08621c705b790e488aa09ca6b526ce70b95feb11f47207abd88fe40b7e5e6a1d`.
Every row is try1 only, with three independent salt workers. Guard membership follows the requested list regardless of historical human attempt counts.

| Level | Group | Baseline salts1/2/3 | Candidate salts1/2/3 | Gains | Losses |
|---:|---|---|---|---:|---:|
|81|failure|L / L / L|L / L / L|0|0|
|93|failure|L / L / L|L / L / L|0|0|
|99|failure|W / L / W|L / L / L|0|2|
|102|failure|L / L / L|L / L / L|0|0|
|107|failure|W / L / W|L / L / L|0|2|
|112|failure|L / L / L|L / L / L|0|0|
|125|failure|L / L / L|L / W / L|1|0|
|137|failure|L / L / L|W / L / L|1|0|
|134|guard|W / W / W|W / W / W|0|0|
|141|guard|W / W / W|W / L / W|0|1|
|143|guard|W / W / W|W / W / W|0|0|
|147|guard|L / W / W|L / W / L|0|1|
|150|guard|L / L / L|L / L / L|0|0|
|151|guard|W / W / W|W / L / W|0|1|
|153|guard|W / W / W|W / W / W|0|0|
|156|guard|W / W / W|W / W / W|0|0|

First-try wins: 19/48; salts: 7/16, 6/16, 6/16.
Valid complete screen: true. Slowest move: 1305.7ms.
Sampling changed 72/3169 contested first taps; mean completed fillings per contested decision: 1.72.
Play-outs evaluated: 81190; confidence overrides: 74; suppressed proposals: 2038.
Baseline 24/48; gains 2, losses 7; adoption gate: false.
Adoption requires a higher total and at most one previously won salt lost per guard.
Capped runs remain unresolved; W requires a verified production clear. Salt changes only the public-state random stream; wall-time budgets can still affect sample counts. This is development evidence, not unseen20 validation.
