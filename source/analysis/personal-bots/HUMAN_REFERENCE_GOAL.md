# Human-information reference: Dennis gate

Worktree: `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review`.
Branch: `wip/personal-bots`. Goal ACTIVE and UNMET.
Current objective: phase 2, information-aware sampled planning.

## Rules

- ONE geometry visibility gate; no screenshot or pixel recognition development.
- Use only visible/remembered pictures and roles from the same actual level.
  A rejected geometrically free tile has ice or a lock, without identifying which.
  Covered clock badges are public. Border visibility permits picture recognition.
- Hypothetical fillings may favor a still-winnable position. Guesses never become
  observed memory, actual winning proofs, or exact hidden-filling loss shares.
- Actual starts/restarts count. Dennis1 requires bot1; Dennis2+ requires fewer.
  Caps remain unresolved. Every accepted actual tap replays in original production.
- Include every recorded first clear and all15 eligible lab boards; exclude only10031.
  Missing old recordings use explicitly labelled reconstructed board comparisons.
- General planning only. Under approximately2s/move, single thread, anytime.
  After all155 pass, freeze unchanged for20 unopened progression levels.
- Small exact-path commits and one short table per run. Keep this file <=80 lines.

## Current verified table

| Set | Passing | Remaining failures |
|---|---:|---|
| Natural |132/140|81,93,99,102,107,112,125,137|
| Lab |9/15|11,32,33,41,49,52|
| Combined |141/155|14 failures; unseen20 not run|

Authoritative full report: `HUMAN_REFERENCE_CATALOG_CAUSAL_AVAILABILITY_2026-10-24.md`.
Mean85.1ms; maximum1505.7ms. No newer full result is claimed.
Latest metadata refresh finds140 natural first clears through156; no newer clears.
No new boards decoded during that refresh.157+ remains unopened.

Experimental results, not promoted:
- Guarded sampling11/18:107 clears1;121 improves2 to1; old passes retained.
- Cache-only10/18:124 regresses from2 to failing both allowed tries.
- Local100ms caps0/3 on107/124/137:107 regresses;124 and137 still fail.
- Added existing key-recovery/access moves to hypothetical solver. Key-only1/3
  retains107; key+100ms1/3 restores124 but loses107.137 still fails both.
- All91 registered offline tests pass. Information-aware sampling is connected:
  fast primary play-outs through production, all contested roots, shared1.3s,
  actual-memory seeding, uncertainty weights and4096-node remembered-board search.
  Exact filled-position DFS is integrated with12 graph/production controls;
  progress breaks ties only for fully exhausted hypothetical losses.
  First screen stopped at81's512-action cap:0/2225 play-outs cleared.
  Influence attribution, all-root death handling and fast-policy costs are fixed.
  Reproduction of reference wins remains open; no new level win is claimed.

## Build now

1. Sampled comparison decides every contested decision with unseen pictures.
   Compare all sensible actions on identical fillings. Primary choice only breaks
   ties; safety may veto only proven losing moves. Reserve about1.3s for sampling.
2. Play each candidate forward through a policy using only information visible
   in that hypothetical world at that time. Reuse the primary policy in fast mode.
   Looking is a real tap; automatic matches, clocks, obstacles and arrivals still apply.
3. Use fully informed search chiefly with few unknown pictures and thousands of
   nodes. Use its progress only as a tie-break in already lost fillings.
4. Weight honest play-outs most when much is unseen; exact planning most on retries.
5. Reference: `origin/wip/det-bot`, `source/tools/sim/detbot/det_bot.js`,
   `rollout.js`, `solver2.js`. Reproduce its81/93/99/137 and lab32/33/41/52 passes
   in the audited pipeline. Its prototype shortcuts need physical/visibility parity.

## Next validation

Quick screen24:81,93,99,102,107,112,125,137,10011,10032,10033,10041,10049,10052,
plus guards92,111,121,123,124,134,141,143,147,150.
Report sampling changes / contested decisions; below5% is insufficient influence.
The corrected24-case screen is running; keep its source fixed.81 still fails1,
now a36-tap physical loss, max1304.2ms; genuine influence1/35 (2.9%), below gate.
Run full155 only after a screen gains a pass without losing one.
Stop standalone proof/cache/micro-speed work unless a failing level requires it.
Do not merge different profiles' wins or infer a full score from subsets.
If impossibility is claimed, supply the exact position, every move's exact loss
share over consistent fillings, and why no move was knowably safe; user decides.
