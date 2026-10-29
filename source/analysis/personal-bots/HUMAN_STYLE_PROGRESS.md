# Human-bot progress

**human-v0 passes factory milestone1. Overall goal remains ACTIVE and UNMET.**
Use source/tools/sim/refit/human_bot.js:
`measureHuman(board,{runs:20,setting:'dennis'})`.

| Fixed factory board | First try | Mean tries |
|---|---:|---:|
|factory1-175|75%|1.25|
|factory1-189|75%|1.30|
|factory2-184|95%|1.05|
|factory2-192|100%|1.00|
|factory2-175|40%|2.15|

Twenty campaigns each; all100 clear. The hard board loses before clock19/23
actual losses (82.61%). Release check uses1.4-4.1s/board, slowest move6.34ms.
All taps independently replay;171/171 offline tests pass. This is development
validation, not a prospective result. See HUMAN_V0_FACTORY_REPORT.md and RTM.

The useful238f5ec controller was adopted with a physical closed-tile lookahead
fix and the shared audited runner. We corrected capped means, computational
loss/retry accounting and output shape, preserved the product README, and made
fixed model profiles immutable. All five behavioral gates still pass after fixes.

## Authorized six-experiment batch19-24

| Trial | Change/cohort | Dennis first try | Result |
|---|---|---:|---|
|19|Learned public ice release;74-board screen|32.99%|Family27.92%; Dennis clock-case gate lost|
|20|More weight on short future outs;74-board screen|32.71%|Family25.35%; both risk/clock-case screens pass|
|21|Lower choice temperature;74-board screen|35.97%|Family27.92%; Dennis clock-case gate lost|
|22|New M1: initial four-tap reference handicap|0/5/45/0% easy|d/e fail; timing passes|
|23|Visible sideways access; restore reference tray heuristics|0/0/35/75% easy|d/e fail; repairs192 clock blind spot|
|24|Clock-margin urgency; safer third-slot arbitration|0/0/20/85% easy|d/e fail; hard board loses mostly mid-game|

The last three use the new factory objective and five required boards. Their
source snapshots remain available; no board-specific routes or rules were added.
An independent acceptance audit of external238f5ec then supplied the passing v0.

## Later milestones

Milestone2 requires Dennis50-55% and family25-35% first try on92-163,
clock55-60%/mid30-45%/late<10% loss shares across actual retries, and fixed risk
and clock-case gates. They remain unproven for v0. Do not combine old candidate
metrics with the new controller.

Historical full campaigns: trial12 first29.17/25.83%, both c gates pass;
trial14 first34.24/26.39%, Dennis b passes but c fails; trial17 first33.19/26.67%,
Dennis b passes but135 clock share=.50 fails strict majority. Family b fails.
Those measurements explain development progress; they do not calibrate v0.

Milestone3 lab Spearman ranking and the frozen future progression/factory check
remain outstanding. Raw contracts, profiles, source snapshots and logs are in
.codex-runs/human-style/. CPU-only; no CUDA acceleration claim.

## Complete human-v0 milestone2 baseline

74 boards (72 levels92-163 plus89/91 for the fixed risk cohort),20 campaigns
per setting/board, up to12 actual tries, fixed seed20261028. All four native
workers exit0. Every accepted tap replays:860,010 taps across9,696 attempts;
slowest decision7.24ms; total wall time3.02min, mean0.139min/board for both settings.

| Full-campaign metric | Dennis | Family | Required |
|---|---:|---:|---|
|First-try rate|55.56%|25.69%|Dennis50-55%;family25-35%|
|Clock loss share|45.58%|64.76%|55-60%|
|Mid loss share|51.92%|34.23%|30-45%|
|Late loss share|2.51%|1.00%|<10%|
|Risk minus control loss|1.5pp|9pp|>=10pp|

Dennis's clock-loss fractions on132/135/142/144 are0/0/100/0%; family's are
19.44/44.07/99.42/82.61%. The strict majority requirement therefore fails for
both settings. Factory milestone1 is retained; human-v1 is NOT released.
These are aggregate actual-retry results, not first-attempt phase screens.

The next calibration work must improve the pattern of mistakes while retaining
all five factory gates. Post-clock partner access and tray judgment, clock-route
commitment under pressure, and learning after actual losses are behavioral
hypotheses to investigate. Do not manufacture clock failures or fit per-level
successful-attempt counts merely to satisfy the table.
