# First human-v1 lab baseline

Milestones1/2 remain passed. Milestone3 is **UNMET**: primary Spearman is unresolved because nine of15 boards have incomplete campaign means. All15 targets and300 campaigns are retained; 126 campaigns did not clear within12 actual attempts. No computation caps occurred.

|Level|Human tries|Complete model mean|Clears/20|
|---|---:|---:|---:|
|10011|2|unresolved|0|
|10012|6|unresolved|12|
|10015|11|unresolved|0|
|10032|5|unresolved|0|
|10033|5|unresolved|18|
|10041|7|unresolved|17|
|10042|4|1|20|
|10044|1|1.1|20|
|10045|6|unresolved|7|
|10046|1|1|20|
|10047|1|1|20|
|10048|2|4.3|20|
|10049|2|unresolved|0|
|10052|3|unresolved|0|
|10053|2|1.95|20|

The restricted-mean rank (.491) and first-failure rank (.450) are diagnostics, not substitutes for the preregistered complete-mean gate (rho>=.5). No board is dropped and12 is never substituted as its winning attempt. Longest20-campaign measurement .839minutes; slowest decision10.78ms; native exit0.

The major failures differ:10011/10032 predominantly fill the tray after saving the clock;10015/10049/10052 never clear before-clock trouble in240 attempts each. A captured10011 campaign contains many repeated known peeks before the same blocked tray ending;10049 repeats similar clock-route tray failures across retries. Next test: after a real pre-clock loss, increase tray planning during clock routing from three to four physical actions, retaining the existing short clock cone and all first-attempt choices. This is a general retry strategy, not a per-level route.

Baseline is prerequisite evidence, not completion. The new M3 experiment ledger starts at0; stop after8 experiments without progress and retain every earlier history. Released human-v1 remains18f0348. Raw outputs: .codex-runs/human-style/lab-ranking/human-v1-first.

Trial1 (f6f53e4): retry clock-tray depth4 retains all1480 Dennis first-attempt outcomes and factory100 clears, but before-clock30.46% exceeds30%. No new lab score was consumed; not adopted; no-progress counter1/8.183 tests pass, native workers0. Next, test the same tray strategy with one extra clock dependency on retries after real losses, still bounded at four and preserving first attempts.

Trial2 (8908cc0): combined four-step clock/tray retry planning retains all M1/M2 gates (Dennis before-clock29.20%) and factory100 clears. Full15-board lab coverage: complete means6->7, with10033 clearing20/20 at mean6.2 versus human5. Eight boards remain unresolved; no primary rank or human-v2 pass. Counter resets to0 for this actual coverage improvement; all failures/history retained. Next: typed observed-key location memory across retries.
