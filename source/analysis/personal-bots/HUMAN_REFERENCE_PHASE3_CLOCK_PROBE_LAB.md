# Lab retry memory: three-salt diagnostic

Profile: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"informationSampling":true,"informationPlayoutNodes":1,"informationPrimaryMs":200,"informationSchedule":"sequential","informationPicturePrior":"diverse","informationActionPaths":true,"informationPrimitivePeeks":true,"informationExactUnknownLimit":8,"informationScoreMode":"progress","informationConfidenceSE":2,"hypothesisMaximumWorlds":32,"captureDecisionDiagnostics":false,"probeUnknownClock":true,"clockProbeTrayLimit":1,"retryRiskLearning":true,"clockRetryLearning":true}`.
Source: `59711b77c1ca393fb4b910425402266ed30ea1acd52f2f0dcc81ff7ec3f331a5`; input: `ea00b9c179bc373daf97d7a97b5a63b12c663291baec3e08597d0edd4fd03eba`.

| Lab | Human tries | Bot salts1/2/3 | Strict passes | Unseen pictures at actual retry starts |
|---:|---:|---|---:|---|
|32|5|>4/unresolved / >4/unresolved / >4/unresolved|0/3|48→24→24→23 / 48→24→24→23 / 48→24→24→23|
|33|5|3 / >4/unresolved / >4/unresolved|1/3|48→33→25 / 48→35→30→26 / 48→35→30→26|
|41|7|>4/unresolved / 4 / >4/unresolved|1/3|51→25→25→16 / 51→28→28→26 / 51→25→24→15|
|52|3|>4/unresolved / >4/unresolved / >4/unresolved|0/3|45→32→21→21 / 45→28→25→21 / 45→31→24→20|

Clears within four actual tries: 2/12; strict human-try passes: 2/12. Valid screen: true.
Slowest move: 1307.2ms; exact-search nodes: 66834.
Every restart counts; only same-level actual observations carry forward. A late clear can pass this four-try diagnostic while failing the strict human-try gate. Caps remain unresolved; no impossibility claim or unseen20 test.
