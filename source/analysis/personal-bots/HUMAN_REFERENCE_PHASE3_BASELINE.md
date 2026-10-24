# Personal reference: seeded first-try noise screen

Profile: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"informationSampling":true,"informationPlayoutNodes":1,"informationPrimaryMs":200,"informationSchedule":"sequential","informationPicturePrior":"diverse","informationActionPaths":true,"informationPrimitivePeeks":true,"informationExactUnknownLimit":8,"informationScoreMode":"clear","informationConfidenceSE":0,"hypothesisMaximumWorlds":32,"captureDecisionDiagnostics":false}`.
Source: `872d982790f44225a53c927920a033be3c008a845b898cad2fbca564e234e30c`; input: `08621c705b790e488aa09ca6b526ce70b95feb11f47207abd88fe40b7e5e6a1d`.
Every row is try1 only, with three independent salt workers. Guard membership follows the requested list regardless of historical human attempt counts.

| Level | Group | Salt1 / Salt2 / Salt3 | Wins |
|---:|---|---|---:|
|81|failure|L / L / L|0/3|
|93|failure|L / L / L|0/3|
|99|failure|W / L / W|2/3|
|102|failure|L / L / L|0/3|
|107|failure|W / L / W|2/3|
|112|failure|L / L / L|0/3|
|125|failure|L / L / L|0/3|
|137|failure|L / L / L|0/3|
|134|guard|W / W / W|3/3|
|141|guard|W / W / W|3/3|
|143|guard|W / W / W|3/3|
|147|guard|L / W / W|2/3|
|150|guard|L / L / L|0/3|
|151|guard|W / W / W|3/3|
|153|guard|W / W / W|3/3|
|156|guard|W / W / W|3/3|

First-try wins: 24/48; salts: 8/16, 7/16, 9/16.
Valid complete screen: true. Slowest move: 1335ms.
Sampling changed 212/3335 contested first taps; mean completed fillings per contested decision: 1.97.
Play-outs evaluated: 92366; confidence overrides: 0; suppressed proposals: 0.
Capped runs remain unresolved; W requires a verified production clear. Salt changes only the public-state random stream; wall-time budgets can still affect sample counts. This is development evidence, not unseen20 validation.
