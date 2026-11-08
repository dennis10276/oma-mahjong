# G5 visible-choice builder: results and integration

Original experiment: Gemini, 2026-11-08, commit 9c2247f2. Lead review and integration corrections: Codex, 2026-11-09. The original report is retained in Git history; this report corrects its numeric and seed claims from the stored run summaries and receipts.

The new constructor is opt-in: use mode visibleChoice. It prioritizes visible keys, limits hidden route tiles, places authored tempting pairs, and pairs the stored tail. Its offline validation still decides whether an actual board is suitable. The default builder path remains unchanged apart from dispatching the explicit mode.

## Historical v3 results

All modes attempted the frozen first 500 brief/seed indices. These were v3 spare-2-screened experiments, not a v4 clock-specific qualification sweep. The raw JSONL ledgers are preserved unchanged.

| Mode | Attempts | Built | Static passes | Screen passes | Planner passes | Curve passes | Trace passes | Library candidates | CPU s | Wall s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| library-baseline | 500 | 455 | 168 | 19 | 3 | 3 | 0 | 0 | 465.360 | 421.744 |
| library-vc | 500 | 449 | 428 | 33 | 2 | 2 | 1 | 1 | 334.064 | 305.470 |
| library-vc-fallback | 500 | 449 | 428 | 33 | 10 | 10 | 3 | 3 | 762.407 | 715.341 |

Baseline static failures by first failing gate: {"A2":273,"A3":9,"A4":3,"A1":2}. Static pass rates are 168/455 = 36.9% baseline and 428/449 = 95.3% visible choice. Screen yield rose from 19/500 (3.8%) to 33/500 (6.6%). CPU includes cache reuse, so it is not a cold speed comparison. The 30-survivor dial study remains inconclusive.

## What actually reached acceptance

The sole normal-band library candidate was 1325d1da… (80 tiles, stored S=3.02 at spare 2). The fallback library also includes 7640c6e7… (96 tiles, stored S=2.00 at spare 2, selected spare 3) and 7ce431c5… (84 tiles, S=2.33 at selected spare 2). A library entry is not a finished level.

The original fixed fallback plan provisionally filled 250 and 252 and left eight holes. Its receipt accepted 250 at spare 2: primary family D=10.105 from 160 ACCEPT campaigns, independent D=9.485 from 160 campaigns, skilled S=2.33. Required E5 profile gates, C1/C2 and C4 passed. A5/A7 and B7/C3 are report-only; they must not be described as all passing original strict A1-A9/B1-B7 criteria. The board retains an A6 warning about re-deals lost regardless of the choice.

Seeds 4711 and 18427 are CURVE measurement seeds, not fresh ACCEPT seeds. The primary acceptance used ACCEPT blocks 0-4, with blocks 0-8 reserved; the independent baseline and ablations used blocks 8-12. ACCEPT block j starts at 29717 + 15838*j under the pinned settings. These used reservations are preserved in the lead ledger.

The lead's full 80-campaign trace checks refused 7640c6e7… on B6 (0.685 > 0.65) and 1325d1da… on B2 (0.194 < 0.20). The latter first needed an A4 warning interpretation correction; its required static proof is complete, but that does not rescue its failing trace check. No seed retry was made. See ../g5-review/REVIEW.md and its frozen evidence.

## Corrections before WIP integration

- The pipeline now measures S and C2/C3 at each eligible spare, stores S.bySpare, and isolates mode-specific rejection/resume identity with the construction source hash. Historical spare-2 scores are not silently copied to other settings.
- The constructor only calls an authored choice proven when it matches an authored pair, has a proved winning alternative, and has positive clock cost 1-2 or an explicitly fair proven losing branch. Zero-cost, unrelated, unknown or unfair moves do not establish that intent.
- The constant proven-calm-tail flag was removed. The card instead contains measured tray information for the stored witness, explicitly scoped to that witness; real trace gates decide pacing.
- The constructor applies the shared E5 profile rather than relaxing luck thresholds to 99 or bypassing failed required static gates. Existing primitive gate defaults and the family's target curve are unchanged.
- The ineffective shuffle call is corrected. New results therefore require a separate output directory/source identity; the historical 500-build ledgers are not a measurement of this corrected constructor.
- Fake aggregate work=1000 was removed. Individual proof searches remain node-bounded; aggregate work is reported as unmeasured. Unsupported keep/hardWork/softWork options fail explicitly. A wall deadline fails the build rather than returning a different board.
- Used ACCEPT reservations were reconciled by id and interval; no measurement was dropped or allowed to overlap.

## Next use

Run the normal pipeline through heavy.js with --mode visibleChoice and --gate-profile e5-v1 in a fresh library. Start with a small frozen pilot; compare normal skilled minimum 2.5 before the explicit minimum-2 fallback. Use assignment's --allow-curve only provisionally, then accept_levels.js on the fixed plan. Preserve holes and refusals. The updated commands and acceptance semantics are in ../process-v1/PIPELINE-AND-ACCEPTANCE.md.

This is an experimental builder integrated into the WIP branch. It has not supplied a complete accepted 250-259 window, and its one experimentally accepted fallback board still carries the recorded luck warning. Main, game levels, Firebase and releases are unchanged.
