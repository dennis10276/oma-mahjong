# Key-memory candidate: inherited release-fit check

Passes the registered inherited-fit gate; bulk rerating still required before adoption.

Freeze all exact boards/labels before calls. Full fixed40 campaigns per profile, both planner styles. Candidate must not worsen point-label MAE in ANY of family-weighted live, archived24 lab, published live target, or each first200/225 individual error. These are inherited release datasets, not new held-out validation. Also report actual Dennis tries and censor-aware lab error. No tuning on fit outcomes; if worse, reject this candidate and stop that behavioral change before bulk rerating or adoption.

Archived planner-eval supplies24 lab IDs/targets; dennis-plays supplies their exact boards. targets-85-155 (actually79 rows through174) supplies published Dennis-plus-family-adjusted live targets; family-weighted-tries supplies66 capped family-weighted targets. Keep these metrics distinct: the quoted1.05–1.10 historical live error is not assumed to be the family-weighted MAE. Current live boards are snapshotted here, and the original20 kept designs provide200/225.

| Benchmark | reference MAE | candidate MAE | completed / expected | nonworse |
|---|---:|---:|---|---|
| family-live-weighted | 2.0812121212121206 | 2.0793939393939387 | 66/66; 66/66 | true |
| planner-live-published-target | 1.0093670886075952 | 1.0093670886075952 | 79/79; 79/79 | true |
| planner-lab24 | 1.9454166666666666 | 1.9454166666666666 | 24/24; 24/24 | true |
| planner-first200and225 | 1.0350000000000001 | 1.0350000000000001 | 2/2; 2/2 | true |

Lab rows without a recorded win are lower bounds, not exact winning tries. Censor-aware lab MAE: reference 1.3662499999999997; candidate 1.3662499999999997. The registered conservative point-label gate above is unchanged. Actual Dennis live-try MAE: reference 0.9334177215189876; candidate 0.9334177215189876.

Historical figures are context, not substituted results: the current full two-style planner remeasures the24 exact archived boards at the values above. The family-weighted and Dennis-plus-family-adjusted live targets are different datasets and must not be described as the same MAE.

| Board | actual first win | reference planner | candidate planner |
|---|---:|---:|---:|
| 200 | 5 | 5.15 | 5.15 |
| 225 | 4 | 2.08 | 2.08 |

The candidate fixes only family key-role memory. The skilled profile delegates to the same reference controller and unchanged profile; equal skilled results are expected, and a tap-sequence test verifies that path. This is an explicit experimental entry point and setting, with its own meter fingerprint and no cache migration. The released entry point and protected G2 environment files are unchanged.
