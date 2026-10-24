# Human-information reference: Phase 3

Worktree: C:\Users\den_k\Idea\OmasMahjong\personal-bot-review
Branch: wip/personal-bots. Goal ACTIVE and UNMET.

## Rules

- Only human-visible or remembered same-level facts. One geometry visibility gate.
  Exposed borders permit recognition; covered clock badges are public.
  A rejected free tile means ice or lock, without identifying which.
- No hidden pictures, inventory, seed or future reveals in policy.
  Hypothetical fillings remain guesses, never actual memory or safety proofs.
- Every accepted tap independently replays through original production.
  Real retries count; finite search/time caps remain unresolved.
- Under2s per move; about1.3s contested-decision budget.
  Up to12 CPU workers side by side, one per salt; each campaign remains single-thread.
- General planning only. No proof/cache/speed side projects unless a failure needs one.
- One short Markdown table per screen. Keep this file <=80 lines, without process logs.

## Current verified scope

| Set | Passing | Remaining |
|---|---:|---|
| Natural |132/140|81,93,99,102,107,112,125,137|
| Lab |9/15|11,32,33,41,49,52|
| Historical full |141/155|Phase3 official salt1 score not yet measured|

Full155 contains natural first clears17-156 and15 labs, excluding only10031.
Dennis1 requires bot1; Dennis2+ requires strictly fewer actual tries.
Unopened progression157+ remains held out; unseen20 has not run.
Prior unsalted single-run screens are exploratory, never seeded adoption evidence.
Seeded baseline24/48; progress32x1=22/48, rejected: +4/-6 and156 loses2 salts.

## Required seeded measurement

1. Mix run salt1,2,3 into the public-state random seed. No level IDs.
2. Noise screen is TRY1 ONLY, all16 levels for each salt =48 cases:
   failures81,93,99,102,107,112,125,137;
   guards134,141,143,147,150,151,153,156.
   Guard membership follows the requested list irrespective of human try labels.
3. Always finish every screen. Show gains and losses side by side.
   Adopt only if first-try wins increase AND no guard loses more than one
   previously won salt. Invalid source/timing/error screens cannot establish adoption.
4. Every few adopted changes run full155 with salt1 as the official score.

## Planner work and validation

- Honest play-outs score share of tiles cleared; a verified clear scores1.
  Censored partial play-outs retain partial scores and their unresolved status.
- Compare all actions on the SAME fillings; primary is the fallback.
  Override only with paired mean improvement greater than2 standard errors.
  Fewer than2 completed fillings cannot justify a confidence override.
- Exact sampled planning only at <=8 unseen ALIVE pictures, thousands of nodes.
  Below that limit mix honest and exact scores by the unseen fraction.
  Oracle progress ties require every compared action proved lost in that filling.
- Calibrate32 fillings/1-node play-outs against12 fillings/16-node play-outs.
  Report requested caps AND actual completed fillings under the shared budget.
- Check lab32/33/41/52 with salts1-3, retaining actual same-level retry memory.
- Registered offline tests cover visibility, production replay, scores, paired
  margins, salts, public clock probes and the48-case harness; 100/100 pass offline.

## Next and completion

Baseline24/48; progress22/20, primitive19/20, long20 and recovery13 all rejected.
Compiled progress19/21 and primitive21 rejected; compiled lab and risk control0/12.
Risk control:6 matching decisions,0 penalized choices,0 penalized clock-exit choices.
Exact visibility parity passes86,016 cases. Exact <=8 count-gate candidate testing
32x1/12x16 and lab retries, salts1-3; unknown fractions previously disabled this gate.
Lab41 trace:176 replayed taps, repeated second carrier, clock frontier never tested.
Test buffered uncertain-clock probes with32x1 progress/paired2SE, salts1-3.
Done only when full155 passes with salt1, salts2/3 each pass >=150, then the
unseen20 runs ONCE with the unchanged frozen bot. Summarize natural/lab tries,
planner changes, slowest move and any decision needed. Goal is not complete.
