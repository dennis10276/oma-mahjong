# TASK 12 commands

Working directory: `C:\Users\den_k\Idea\OmasMahjong\codex-rate-traps` unless stated otherwise.

## Checkout and input snapshot

From `C:\Users\den_k\Idea\OmasMahjong`:

```powershell
git -C cc-builder-loop worktree add -b wip/codex-rate-traps ../codex-rate-traps wip/cc-builder-loop
```

The base resolved to `6d6934aa`. The snapshot command was repeated as examples appeared; it refuses to overwrite a changed existing input:

```powershell
node source/tools/builder/bank/rate_traps.js --snapshot
```

The original one-job command below waited without executing campaigns. Its queued wrapper was stopped after Dennis's update about new locks; the shared-budget scheduler supplied to this checkout was then committed (upstream scheduler version `395a7ec5`).

```powershell
node source/tools/builder/loop/heavy.js --label rate-traps-measure -- node source/tools/builder/bank/rate_traps_run.js --phase measure
```

## Successful measurement commands

```powershell
node source/tools/builder/loop/heavy.js --label rate-traps-measure --cores 4 -- node source/tools/builder/bank/rate_traps_run.js --workers 4 --phase measure
node source/tools/builder/loop/heavy.js --label rate-traps-chain-traces --cores 2 -- node source/tools/builder/bank/rate_traps_run.js --workers 2 --phase trace --only chain-
node source/tools/builder/loop/heavy.js --label rate-traps-all-traces --cores 4 -- node source/tools/builder/bank/rate_traps_run.js --workers 4 --phase trace
node source/tools/builder/loop/heavy.js --label rate-traps-bait --cores 4 -- node source/tools/builder/bank/rate_traps_run.js --workers 4 --phase bait
```

The chain trace batch overlapped only the measurement of other, unrated boards; it never wrote a card being measured concurrently. The subsequent all-board trace command reused the six completed chain traces. All active batches finished within the runner's 14-minute watchdog. The final capture command checks capped tries, campaign by campaign, against the full measurements; all matched.

One supplementary attempt failed before writing any bait results because the family wrapper does not accept the skilled wrapper's `allResults` option. The tool was corrected to pass that option only to the skilled bot, then the successful all-board bait command above was run:

```powershell
node source/tools/builder/loop/heavy.js --label rate-traps-chain-bait --cores 2 -- node source/tools/builder/bank/rate_traps_run.js --workers 2 --phase bait --only chain-
```

## Placement and validation

```powershell
node source/tools/builder/bank/place.js --start 250 --count 40 --bank source/analysis/builder/bank/traps --out codex-tasks/results/rate-traps-v1/placement.json
node source/tools/builder/bank/rate_traps_report.js > codex-tasks/results/rate-traps-v1/validation-output.json
node --check source/tools/builder/bank/rate_traps.js
node --check source/tools/builder/bank/rate_traps_run.js
node --check source/tools/builder/bank/rate_traps_report.js
git diff --check
```

No placement overrides were used. The report validator checks board identity, exact original design preservation, protocol, seeds, campaign counts, caps, stability samples, valid traces, raw D40 and capture parity. `played-board-identity.json` records the six lab-5 board hash comparisons against the served `LAB_IDEAS` boards. `witness-validation.json` records the legal full solution replays. Lab-4 281/286/287 were also compared against their served `LAB_IDEAS` boards and matched.

For a fresh rerun, the main `--phase measure`, all-board `--phase trace`, and `--phase bait` commands suffice; the separate chain trace batch is an execution-history detail. To run existing snapshots on another machine, no access to Claude's ignored build folder is needed. All campaign-level ratings are retained in `source/analysis/builder/bank/traps/*.json`.
