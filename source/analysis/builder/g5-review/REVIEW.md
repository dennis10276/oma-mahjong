# Lead checks of the first G5 results

Recorded 2026-11-08. Gemini's construction checkout was read only throughout this work. Its implementation was still uncommitted when the evidence was copied; this is a review of frozen boards and results, not approval to merge or publish the whole G5 implementation.

## Result

One fallback board has a verified experimental acceptance receipt for level 250: skilled 2.33, family 10.105 on 160 primary ACCEPT campaigns, and 9.485 on 160 independent campaigns. Locks and the clock both pass the existing C4 effect checks. Its known luck warning is retained below. The 250-259 batch is incomplete and is not ready for release.

Two other frozen candidates fail the larger 80-campaign trace check. Their original 40-campaign passes are not values of record for final acceptance. No failed board was retried on other seeds to obtain a pass, no threshold was changed to admit one, and neither refusal consumed any ACCEPT campaigns.

## Completed v3 construction sweeps

Source: `supply-snapshot.json`, copied from the completed Gemini run summaries with source digests and runtime fingerprints.

| Mode | Attempts | Built | Static passes | Family screen passes | Skilled screen passes | Library candidates | CPU seconds |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline, skilled minimum 2.5 | 500 | 455 | 168 | 19 | 3 | 0 | 465.36 |
| Visible choice, skilled minimum 2.5 | 500 | 449 | 428 | 33 | 2 | 1 | 334.064 |
| Visible choice, explicit minimum-2 fallback | 500 | 449 | 428 | 33 | 10 | 3 | 762.407 |

The static yield is much better on the visible-choice boards: 428/449 versus 168/455. Those totals do not establish a finished-level yield or CPU cost per finished level. The sweeps used v3's shared spare-2 skilled screen; the v4 fix below changes qualification and needs a separate comparison. CPU figures include cache reuse and should not be read as a cold speed benchmark. The initial runtime manifest omitted `visible_choice.js`; exact frozen board contents are preserved, and the snapshot records current construction-source hashes without claiming those hashes prove what ran earlier.

## Frozen board checks

### First pilot candidate: `7640c6e7…`

- 96 tiles, minimum clock route k=6, only spare 3 kept by the candidate pipeline. The stored skilled score was 2.00 at spare 2.
- Direct diagnostic on the frozen design: S(2)=2.00 and **S(3)=2.08**. The selected setting qualifies for the permitted minimum-2 fallback, not the normal 2.5 minimum.
- Full trace check at spare 3: B6 post-clock loss share **573/837 = 0.685**, over 0.65. The original 40-campaign result was 232/364 = 0.637. B1-B5 pass at 80 campaigns.
- Final-check result: **refused at traceGates**. No fresh difficulty or special-ablation campaigns followed that refusal.

Evidence: `first-candidate/library.jsonl`, `snapshot.json`, `plan.json`, `acceptance.json`, `skilled-spares.json`. The standalone level-260 slot is diagnostic only; no complete surrounding batch exists.

### Sole normal-band library candidate: `1325d1da…`

- 80 tiles, k=12, spares 1 and 3 kept. The old screen stored S=3.02 at spare 2; that is not a measured S for every spare.
- The diagnostic keeps Gemini's preselected slot, level 252/spare 3. No prior ACCEPT reservation existed for this puzzle in either checkout when the snapshot was taken.
- After correcting the A4 warning interpretation below, the static proof is complete for this spare. The engine-only recheck confirms this without using bot seeds.
- Full 80-campaign trace check: B2 trap attribution **0.194**, below 0.20. B1 and B3-B6 pass. This is a borderline threshold failure, not evidence that Dennis would dislike the board.
- Final-check result: **refused at traceGates**. The chosen-spare skilled rating, fresh ACCEPT and special-ablation checks were therefore not reached. No seed retry was made.

Evidence: `normal-candidate/library.jsonl`, `snapshot.json`, `plan.json`, `acceptance.json`, plus `proof-recheck.json`.

### Verified fallback receipt: `7ce431c5…`

- 84 tiles, k=17, chosen spare 2, level-250 target 10. Actual chosen-setting skilled rating **2.33**, explicitly using the allowed fallback.
- Primary family D **10.105** from 160 campaigns; independent D **9.485** from 160 campaigns. Both are within one try of 10.
- Primary ACCEPT reservation [0,8); independent reservation [8,12). No overlap. The sequential check used its first 160 campaigns, while all eight potential primary blocks remain consumed.
- C4, on the independent baseline and seeds: without locks D=1.13, drop=8.36; without clock D=1.05, drop=8.44. Both exceed the required effect of about 1.39. There are no ice tiles to ablate.
- The receipt's full frozen content, entry digest, profile, ruler fingerprints, per-spare clock budget, required gate verdicts, independent rating and expected ablation set were checked against the saved entry. The static engine checks were also rerun after the zero-win unknown-state fix; no required proof remains unresolved.
- **Remaining quality warning:** A6 reports three forks where some re-deal of unseen pictures loses whatever the player does. E5's current experimental profile does not reject this warning. Do not omit it or present this board as having proved freedom from all luck-only failure mechanisms.

Evidence: `fallback-evidence/library.jsonl`, `receipt.json`, `verification.json`, `proof-recheck.json`. The two already-used ACCEPT reservations were imported into the lead's `library/accept-ledger.json`, so a later handoff cannot silently reuse them. This preserves an existing receipt; it does not manufacture a second independent acceptance by replaying the same seeds.

## Tool corrections made from these results

1. **Skilled ratings belong to a clock setting.** `pipeline-v4-skilled-spares` measures every statically eligible spare before the curve, filters settings by that spare's actual S, and performs C2/C3 at each surviving setting. It stores `S.bySpare`; assignment and queries use the matching S and trust flag. A tight setting can qualify even if spare 2 is too easy, and a loose setting cannot borrow spare 2's score. The v3 outputs above remain unchanged.
2. **An incidental unknown opening move is not an incomplete required proof.** A4 can establish two or more winning alternatives even when other actions are unresolved. Final acceptance now permits that case only if the chosen spare has at least two proved opening wins, no non-obvious forced moves and no unresolved potentially forced witness states. Budget exhaustion still blocks. The static gate now also counts a witness state with zero proved wins and unresolved actions; it cannot vanish from the proof-completeness count. Neither change promotes an unknown action to win.
3. **One active builder job blocks the next even below one sampled CPU core.** The busy check now detects running pipeline/acceptance/research processes explicitly. Queued `heavy.js` wrappers are excluded to avoid deadlocking queues. The real checks were run through `heavy.js` between Gemini jobs.

Regression tests cover all three corrections. The next construction step should improve supply under the current rules, including the remaining luck mechanism, rather than rerun borderline candidates until their trace numbers pass. G5's opt-in code still needs its final handoff/review and v4 requalification; no new 500-build sweep was launched by the lead.

No main, game level, production asset or Firebase write was made.
