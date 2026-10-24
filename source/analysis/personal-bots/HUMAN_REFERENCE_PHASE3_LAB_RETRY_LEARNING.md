# Lab retry memory: three-salt diagnostic

Profile: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"informationSampling":true,"informationPlayoutNodes":1,"informationPrimaryMs":200,"informationSchedule":"sequential","informationPicturePrior":"diverse","informationActionPaths":true,"informationPrimitivePeeks":true,"informationExactUnknownLimit":8,"informationScoreMode":"clear","informationConfidenceSE":0,"hypothesisMaximumWorlds":32,"captureDecisionDiagnostics":false,"retryRiskLearning":true,"clockRetryLearning":true}`.
Source: `f62b6421703749ec1e1cd14de91315767c8889c1de1e67c3228444973d41000c`; input: `ea00b9c179bc373daf97d7a97b5a63b12c663291baec3e08597d0edd4fd03eba`.

| Lab | Human tries | Bot salts1/2/3 | Strict passes | Unseen pictures at actual retry starts |
|---:|---:|---|---:|---|
|32|5|>4/unresolved / >4/unresolved / >4/unresolved|0/3|48→24→24→23 / 48→24→24→23 / 48→24→24→23|
|33|5|>4/unresolved / >4/unresolved / >4/unresolved|0/3|48→35→30→26 / 48→35→30→26 / 48→42→32→27|
|41|7|>4/unresolved / >4/unresolved / >4/unresolved|0/3|51→25→24→14 / 51→25→24→14 / 51→25→24→14|
|52|3|>4/unresolved / >4/unresolved / >4/unresolved|0/3|45→28→25→19 / 45→28→25→19 / 45→28→25→19|

Clears within four actual tries: 0/12; strict human-try passes: 0/12. Valid screen: true.
Slowest move: 1324.2ms; exact-search nodes: 0.
Every restart counts; only same-level actual observations carry forward. A late clear can pass this four-try diagnostic while failing the strict human-try gate. Caps remain unresolved; no impossibility claim or unseen20 test.
