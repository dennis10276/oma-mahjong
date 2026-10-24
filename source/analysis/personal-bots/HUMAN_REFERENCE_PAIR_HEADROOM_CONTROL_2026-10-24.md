# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","shortInformation":"recoveryAware","informationWidth":"pairHeadroom"}`
Source: `52f073531e13a6356ad9034d59f3b59485c0a63d3bf94fefb5de7ea8de5e6b66`; unchanged: true.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 50 | 1 | 1 | yes | currentClassicDefinitionAspect1.5 | 98.2 | 392.4 |
| 81 | 1 | 1 | yes | versionTable | 48.2 | 1038.5 |
| 92 | 5 | 1 | yes | versionTable | 42.7 | 273.4 |
| 121 | 4 | 2 | yes | recordedOpening | 31.3 | 221.2 |
| 123 | 1 | >1 | no | recordedOpening | 142.3 | 539.5 |
| 137 | 2 | 1 | yes | recordedOpening | 48.9 | 364.7 |
| 147 | 1 | 1 | yes | recordedOpening | 104 | 433.7 |
| 150 | 3 | >2 | no | recordedOpening | 299.6 | 1508.7 |

Passed 6/8; mean 100.1ms; slowest 1508.7ms; dominance stops 0.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
