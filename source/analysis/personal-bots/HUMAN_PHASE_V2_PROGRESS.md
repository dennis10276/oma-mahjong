# Human simulator: approved person-specific calibration

Overall goal ACTIVE and UNMET; milestone2 PASSED. human-v1 (18f0348) is the released default. Track A policy40 remains frozen. Historical research profiles retain their development labels.

Dennis approved before-clock shares20-30% and family35-45%, replacing the incorrect pooled55-60% claim. First-try/factory gates are unchanged. Each person has an audited top10-loss and10-zero-observed-loss cohort; the required loss-rate gap is10 percentage points. Clock-contact losses are reported separately, on clock removal or within two further removals.

|Candidate|Dennis first|Family first|Before-clock D/F|Risk gap D/F|Factory d/e|
|---|---:|---:|---:|---:|---|
|shared-ice-full|52.71%|29.24%|45.40/53.71%|26.50/0.50pp|pass|
|key-outs-repair-full|51.04%|29.10%|50.96/50.19%|35.00/4.00pp|pass|
|clock-outs-refined-full|51.18%|29.51%|50.94/50.39%|35.00/3.00pp|pass|
|clock-order-full|51.18%|29.51%|50.94/50.39%|35.00/3.00pp|pass|
|key-priority-refinement-full|54.79%|34.31%|29.66/37.22%|23.50/7.50pp|pass|
|family-balanced-outs-full|54.79%|32.29%|29.66/43.28%|23.50/5.50pp|pass|
|mate-budget-full|53.96%|31.46%|33.09/44.45%|26.50/0.50pp|pass|
|family-clock-priority-full|53.96%|41.04%|33.09/22.96%|26.50/-0.50pp|pass|
|clock-completion-full|54.37%|31.81%|32.30/44.06%|25.50/-0.50pp|pass|
|personal-short-goal-full|54.37%|34.51%|31.12/33.86%|25.50/9.50pp|pass|
|personal-refinement-full|55.21%|33.68%|28.99/37.42%|23.00/9.00pp|pass|
|family-outs-full|54.79%|31.67%|29.66/47.61%|23.50/14.00pp|pass|
|family-clock-outs-balance-full|54.79%|33.96%|29.66/44.74%|23.50/11.50pp|pass|

Latest: **family-clock-outs-balance-full**. Checks: Dennis {"a":true,"b":true,"c":true,"level142":true}; family {"a":true,"b":true,"c":true,"level142":true}. The same candidate must pass all checks; outcomes are not combined across versions. All100 latest factory campaigns clear.

|Setting|Before clock|On/right after clock|Later mid-game|Late|
|---|---:|---:|---:|---:|
|Dennis|29.66%|0.84%|67.38%|2.13%|
|family|44.74%|4.60%|49.00%|1.67%|

Level142: Dennis 19/20 first, 20/20 clear within12; family 2/20 first, 20/20 clear within12. This repairs v0's0/20 clears, while retaining the factory checks. The final default API reproduced these outcomes and passed the full calibration.

The public clock/ice repair reuses required removals. The optional clock-mate route has a public lower-bound budget, applied only when the sampled planning horizon considers the full chain. A personal completion preference models the observed early clock rush without forcing failures. Retry attention increases only after real losses. Source commits:8df9a86, baa07d1,9801bf5,6932e2e; evaluator boundary74f6f15.183/183 offline tests pass (suite09).

Four actual family attempts on132/144 supplied29 independently replayed action choices and exact board parity. On144 the first attempt saved the clock after three removals, then lost under tray pressure; later retries sometimes prepared pairs first. Unknown pictures stay unknown until visible or remembered. The115 key-taking prefix is incomplete and is action evidence only. No per-board routes or settings enter the actor.

Latest valid coverage:74 boards,20 campaigns per setting,12 actual attempts; zero censored campaigns; 831,914 independently verified taps. Slowest decision 10.88ms; longest20-campaign measurement 0.688minutes. Null averageTries denotes uncleared campaigns, never a cap success.

The rejected earlier key-outs-full run remains in history (worker exit2/censoring); it never counted as success. Clock-timing annotation parity and100 default-v0 release outcomes were checked earlier; latest frozen defaults are unchanged. Historical contract1 scores remain attached to their original targets.

Retained progress anchor: **family-clock-outs-balance-full**. Consecutive no-progress experiments: **0/8**. A tradeoff that loses a previously passed check is not progress. human-v1 is tagged18f0348; human-v2, a lab ranking pass and prospective accuracy are not claimed. The first15-board lab baseline is complete:9 means unresolved, primary rank null. Raw source snapshots, profiles, campaigns, native exits and preregistrations: .codex-runs/human-style/phase-v2/.

Final release:183/183 tests (suite10-release), all2960 calibration and100 factory campaigns reproduced from the selected candidate. Source-exact default checks passed before tag18f0348. Slowest8.87ms; maximum20-campaign measurement0.673minutes. HUMAN_V1_RELEASE.md gives the API and proof.
