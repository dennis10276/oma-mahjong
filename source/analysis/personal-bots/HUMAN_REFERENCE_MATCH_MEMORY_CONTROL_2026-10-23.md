# Actual-match memory diagnostic control

Fresh-process `noOutcomeMemory` ablation disables only the new actual-match identity inference. Production rules and independent accepted-tap replay remain unchanged. This is an explicitly modified in-memory policy, not a canonical unchanged-source result. The legacy inspection-on profile matches the accompanying canonical five-case run.

| Level | Dennis tries | Without inferred memory | Pass | Slowest ms |
|---:|---:|---:|:---:|---:|
| 92 | 5 | 3 | yes | 1502 |
| 111 | 3 | 2 | yes | 1502.6 |
| 121 | 4 | >3 | no | 419.2 |
| 124 | 3 | >2 | no | 1122.7 |
| 150 | 3 | 2 | yes | 1504 |

Both this control and the canonical memory-enabled run pass 3/5: 92 on try3, 111 on try2, 150 on try2; 121 and 124 remain failures. There is no measured attempt-count gain on this screen. The memory fix nevertheless retains only identities logically proved by actual production matches; its 222 physical controls and retry integration establish the corrected observation contract, not forecast accuracy or a full-catalog gain.
