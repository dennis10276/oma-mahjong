# Claude return — evidence and current state

Prepared 14 November 2026 at 15:39 Europe/Amsterdam. This is a handoff for Claude as lead, with the two feedback streams kept separate. It is a snapshot, not a new design plan.

## Start here

1. Claude’s current baseline is **wip/cc-builder-loop at 56c0218f**, in cc-builder-loop. Task 16 is closed and was taken back by Claude. Resume from that baseline rather than the old Codex continuation branch.
2. Read [PORT-8264.md](PORT-8264.md): seven direct verdicts on the current placed 303–331 set, including the positive 312/316 notes and the 327 copy question.
3. Read [TASK-17.md](TASK-17.md) separately: eight notes on the Task 17 original lab set. The review branch is wip/codex-chained-2 at a22f835c. Its technical bank is delivered; its human review and placement remain open. It is not merged into Claude’s current baseline.
4. Review your current builder and the exact boards using your own design judgment. The technical pass counts and the earlier Codex order are not acceptance decisions about AHA or difficulty.

## Dennis’s direction for this handoff

> See where claude is now. task 17 just got done http://127.0.0.1:8264/ I put in my thoughts. Make it so that everything is clear for claude when he starts again. Do the work you feel like wouldnt make claude get your biases. Claude so far made more original AHA chained moments with the builder so I wont want him on the wrong foot when he picks up as lead again in 2 hours.

Dennis then clarified:

> task 17 is seperate from 8264 feedback.

These are the user’s words. This package preserves them and the exact lab comments rather than inventing a new target, recipe, ordering or interpretation of AHA.

## Current lead state

- Task 16 takeover: 43bfbc3a. Clock-19 / pressure-parks correction: 78c96b8a. Strength-B 250–302: e30ae41d. Current placed 303–331 and lighter tails: 56c0218f.
- Current placed inputs: source/analysis/builder/bank/placed-250-B/ and placed-303/ on Claude’s branch. The latter combines eighteen chained-mix boards with eleven of Claude’s chain boards.
- Current pressure measure: source/tools/builder/bank/feel.js, expert(), and feel_retune.js. Claude’s existing guidance uses about 7.5 pressure parks for a familiar/easy-to-see wrong idea, and 1.5–3 after a hard new-idea chain. This handoff does not retune those settings.
- The older forcedPressure target counts brief visits to the tray that do not establish felt pressure. My earlier “target pass” statements referred to that retired mathematical criterion; they do not establish human difficulty or AHA. Claude’s later correction supersedes them.
- Level 271 stays at clock 19. Dennis explicitly said it works and to keep it. This is already recorded in Claude’s facts.
- Claude’s worktree currently has one untracked lab-10 findings snapshot. This handoff preserves its source separately and leaves the worktree untouched.

## Read-only work completed here

- Captured both raw findings files, both exact served board sets, their board mappings, source commit IDs and SHA-256 hashes. HTTP GET confirmed each local page serves its matching captured manifest.
- Verified all seven port-8264 written verdicts map to the exact current placed boards. Verified all eight Task-17 report rating objects match their live source records.
- Compared all 29 current placed boards 303–331 with all 51 current boards 250–300 under explicit copy fingerprints. Found 0 exact or translated/reflected/picture-relabeled pairing duplicates. The specific 327 result is in PORT-8264.md; thematic repetition is not disproved by this audit.
- Independently checked the exact served 312 solution, shortest clock, and the saved designated losing opening offers. Recorded the limit: outcomes alone cannot identify Dennis’s actual mistakes.
- Kept Task 17’s unrated candidates and human-review limitations explicit. No technical proof is labeled a human AHA proof.

## Superseded Codex work

The post-takeover amendments in codex-builder-continue were removed from the working tree into an explicitly superseded local archive. No later forced-waiter candidate batch was promoted into the lead branch.

- Old branch: wip/codex-builder-continue at e356cc2d; already superseded by Claude’s takeover and corrections.
- Archived post-takeover changes: git object 8d8d9b06c27b90a30aad186d97c44bfebdfc45a3, pinned at refs/archive/codex-task16-post-takeover. Diagnostic history only. It includes the unadopted five-moment amendments and experimental batch.
- Ignored old search outputs remain in that old worktree’s source/build/traps/. They are not current placed levels or recommended inputs.
- This handoff branch starts from Claude’s current baseline and adds only evidence/documents and read-only collection/check scripts. There are no builder, board, level-table, metric, release or Firebase changes in this handoff.

## Open questions, with evidence limits

- Port 8264, 312: named bait offers really lose on the current board, but the saved local outcomes do not reveal whether Dennis used them. His question about the first attempts remains open.
- Port 8264, 327: no mechanical copy was detected under the documented fingerprints. Dennis’s sense of familiarity still needs the lead’s judgment about the wrong idea and its presentation.
- Task 17, original 337: the intended continuation was not clear to Dennis. Keep this exact review issue separate from port 8264’s 312 question.
- Task 17’s weaker-AHA examples and untested variants still need lead review. No new ranking or recipe is prescribed here.

## Reproduce and refresh

From codex-lead-handoff:

```powershell
node codex-tasks/results/lead-return-2026-11-14/collect_evidence.js
node source/tools/builder/loop/heavy.js --label lead-handoff-312-check --cores 1 -- node codex-tasks/results/lead-return-2026-11-14/verify_312.js
node codex-tasks/results/lead-return-2026-11-14/write_handoff.js
```

Refresh reads the current files and local manifests; it writes only this evidence folder. The two local lab servers were left running. No raw rating or served board was changed.
