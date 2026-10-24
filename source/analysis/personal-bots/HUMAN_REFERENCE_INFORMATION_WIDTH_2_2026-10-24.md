# Human-information reference development run

Planning: `{"goalRecovery":true,"goalRecoveryMin":1,"riskFirstRecovery":true,"obstacleFrontier":true,"alternativeGoalRoutes":true,"alternativeRecoveryRoutes":true,"safeInformationEscape":true,"inspectBeforeCommit":"recovery","inspectionTrayLimit":1,"exclusiveRoles":true,"cachePublicAnalysis":true,"preservePairFlexibility":true,"knownPairMacros":true,"progressiveReopens":true,"keyRecoveryMacros":true,"passiveInformation":"shortRoles","shortInformation":"recoveryAware","informationWidth":2}`
Source: `b21239e48e7cbe6b45a4dc7815cab67085b55d3316f986b8338166bb5e041ccc`; unchanged: true.

| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |
|---:|---:|---:|:---:|---|---:|---:|
| 50 | 1 | 1 | yes | currentClassicDefinitionAspect1.5 | 162.4 | 735.8 |
| 81 | 1 | 1 | yes | versionTable | 80.9 | 1502.2 |
| 92 | 5 | 1 | yes | versionTable | 67.6 | 482 |
| 121 | 4 | 2 | yes | recordedOpening | 55 | 301.7 |
| 123 | 1 | 1 | yes | recordedOpening | 166 | 1503.7 |
| 137 | 2 | 1 | yes | recordedOpening | 36.8 | 247.8 |
| 147 | 1 | >1 | no | recordedOpening | 102.5 | 421.3 |
| 150 | 3 | 2 | yes | recordedOpening | 234 | 1511.6 |

Passed 7/8; mean 121.9ms; slowest 1511.6ms; dominance stops 0.
Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.
