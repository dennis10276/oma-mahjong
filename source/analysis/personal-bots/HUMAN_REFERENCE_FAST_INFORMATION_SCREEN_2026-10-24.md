# Interrupted fast information-aware screen

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","keyAccessMacros":true,"clockInformationBeforeRisk":true,"rememberAcceptedTaps":true,"rememberKnownLosses":true,"rememberClearedRoles":true,"usePlacementContract":true,"causalAvailabilityMemory":true,"hypothesisSampling":true,"rememberBlockedTaps":true,"informationSampling":true,"informationPlayoutNodes":1}`
Source at start: `4e3b90ac4794b49863fe5c7a42dc928a7da8d2496379f5926799d4acb05b7e12`.
Input: `5710b9e2772fa2cd5207574a8669159817f3d18d173fb7c7ff4ca4bb0d69a51a`.

The planned24-case screen was stopped after a verified regression on guard111.
The final buffered112 clear is included. Sixteen requested cases remain uncompleted;
no full24-case or155-case score or final runner source-integrity check is claimed.

| Level | Dennis | Bot | Pass | Board source | Slowest ms |
|---:|---:|---:|:---:|---|---:|
| 81 | 1 | >1 | no | versionTable | 1304.2 |
| 92 | 5 | 4 | yes | versionTable | 1305.8 |
| 93 | 1 | >1 | no | versionTable | 1297.8 |
| 99 | 2 | 1 | yes | versionTable | 1301.4 |
| 102 | 2 | >1 | no | recordedOpening | 1302.6 |
| 107 | 1 | >1 | no | recordedOpening | 1298 |
| 111 | 3 | >2 | no | recordedOpening | 1301.8 |
| 112 | 1 | 1 | yes | recordedOpening | 1301.1 |

New strict clears:99 on1 vsDennis2 and112 on1 vsDennis1. Guard111 lost both
allowed attempts, whereas the full baseline cleared on2. These gains cannot be
combined with a different policy to conceal that regression. Every completed row
independently replayed all accepted actual taps through original production.

Sampling changed285/1075 contested decisions (26.5%); one actual safety veto was
counted separately. Maximum observed decision time1305.8ms. The earlier unresolved
counter omitted252 expired verification results; scores already retained those as
unresolved. The accounting bug is fixed for the next run.

Next: compare the same policy with interleaved candidate play-outs on99/111/112,
preserving both new clears while trying to restore the guard, then repeat all24.
