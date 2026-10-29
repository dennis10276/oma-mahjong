# Human-v2 lab work

ACTIVE and UNMET. Released human-v1 (18f0348) passes M1/M2. No human-v2 tag exists. Every candidate retains M1/M2 before lab evaluation; all15 targets remain included.

|Run|M1/M2|Dennis before-clock|Complete means/15|Primary rank|Progress/counter|
|---|---|---:|---:|---|---|
|Released v1 baseline|pass|29.66%|6|unresolved|baseline prerequisite|
|retry-clock-tray-01|FAIL phase|30.46%|not measured|not measured|no / 1|
|retry-clock-tray-02|pass|29.20%|7|unresolved|yes / 0|
|retry-key-memory-03|pass|29.20%|8|unresolved|yes / 0|
|retry-locked-carry-04|pass|29.20%|9|unresolved|yes / 0|
|retry-prepare-keys-05|pass|29.20%|9|unresolved|no / 1|
|retry-key-route-value-06|pass|29.20%|9|unresolved|no / 2|
|retry-key-relations-07|pass|29.20%|9|unresolved|no / 3|

Retained research anchor: **retry-locked-carry-04-lab**,9 complete means. Counter **3/8**. Strictly greater completed-board coverage or a qualifying complete primary-rank improvement is required to reset it; infrastructure, individual extra clears and equal-count swaps cannot count.

Typed key identity memory completed10041 and raised10049 from0 to16 clears. Learned locked-carry dependencies completed10045 (20/20, mean3). Trial6 gives10011 one clear and10049 seventeen clears, but six boards still lack complete means:10011,10012,10015,10032,10049,10052. Primary Spearman remains null, not a pass. Restricted-mean/first-failure ranks are diagnostics only.

Sources:f6f53e4 retry tray foresight;8908cc0 bounded clock foresight;b2bc48f typed key identities;349fefb actual-loss key dependencies;59995b9 preparation before a learned trap;ab912ab public key-route value inside the unchanged depth4/beam6 planner. Trial7 research188/188 tests pass and all M1/M2 gates are retained. Latest release remains18f0348.

I fetched origin/wip/level-factory at16c6e3d. Its gameplay export is byte-identical to the original snapshot: no new lab11 winning taps exist. The available lab49 winning play replays165 accepted taps with matching kinds/legality and a physical win, using actual tap timing. Recorded intermediate board snapshots are unavailable, so this is not an independent per-frame tray-state match. Dennis takes the keys at moves9/10, saves the clock at27, and uses25 on-pile pair taps.

Trial7 (0ee5b0e) is implemented and passes188 tests/factory gates; all M1/M2 gates pass and full lab coverage remains9/15, so no-progress counter3/8: remember a same-picture relationship only after both key pictures have actually been known on this board. On a later try, one known picture may recover its related forgotten picture in remembered knowledge. Both-unknown and different-key pictures must remain uninferred; current hidden ice/role/picture masks must remain unchanged. This tests the user-authorized100%-certain inference principle, not a universal assumption that all keys match.

Raw immutable sources, profiles, native exits, preregistrations and the full15-board measurements are under .codex-runs/human-style/lab-ranking/. Complete summaries and monotonic ledger: HUMAN_LAB_V1_BASELINE.json. Factory100/100 clears remain retained. No future forecast accuracy or ranking pass is claimed.

Trial8 (a4455e7) tests remembered live down orientation plus actual public availability witnesses across retries. A witness transfers only when every earlier removed prerequisite is still removed and any required relief is present; no initial hidden role is invented. The physical counterexample wins, fresh choices stay unchanged,189/189 tests pass and factory gates pass. Full M2 calibration is running; no new lab result or progress is claimed.
