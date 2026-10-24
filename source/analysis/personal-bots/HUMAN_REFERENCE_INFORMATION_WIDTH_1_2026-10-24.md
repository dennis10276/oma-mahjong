# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","shortInformation":"recoveryAware","informationWidth":1}`
Source: `b21239e48e7cbe6b45a4dc7815cab67085b55d3316f986b8338166bb5e041ccc`; unchanged: true.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 50 | 1 | 1 | yes | currentClassicDefinitionAspect1.5 | 166.8 | 740.1 |
| 81 | 1 | 1 | yes | versionTable | 94.2 | 659.3 |
| 92 | 5 | 2 | yes | versionTable | 191.2 | 1347.4 |
| 121 | 4 | 2 | yes | recordedOpening | 59.1 | 461.2 |
| 123 | 1 | >1 | no | recordedOpening | 264.9 | 1503.4 |
| 137 | 2 | 1 | yes | recordedOpening | 49.3 | 347.9 |
| 147 | 1 | 1 | yes | recordedOpening | 96.4 | 445.7 |
| 150 | 3 | 2 | yes | recordedOpening | 315.5 | 1516.5 |

Passed 7/8; mean 163.8ms; slowest 1516.5ms; dominance stops 0.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
