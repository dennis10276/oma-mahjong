# Human-information reference and Dennis-strength level measuring

ACTIVE and UNMET; Dennis authorized8 survival/key-logic trials48-55. wip/personal-bots.
Authoritative objective: cc8ea8eb-87e0-48be-a531-eeb68c9d5592/goal-objective.md.
Track A first; Track B only after A passes. Use sunflower tiles.

## Rules

- ONE observer: visible face-up pictures, drawn roles on fronts/backs, covered clock
  badges, and current takeability of every geometrically free tile without tapping.
- No hidden pictures, deck, board seed or future reveals. Only public same-board/salt retry memory.
- Publicly proved pictures may enter memory and planning like observations; retain proof provenance; sample consensus is not proof.
- Every level being winnable is an allowed prior. General planning only: no level
  IDs, per-level settings or routes. Every attempt independently replays production.
- Single-thread games, anytime, under2s/move; at most12 concurrent games.
## Track A: strongest human-information player

- All recorded Dennis natural first clears17-156 and later, plus15 recorded labs
  from lab-clears.json(10011-10053 excluding10031). Preserve board provenance.
- Real boards unchanged. Max12 actual tries per board/salt; censored is not a clear.
- Full gates: every board clears on salts1,2,3; each run at most Dennis+1 tries.
- Labs first:10011,10049,10052; natural86 also fails. Repaired10032 remains a control.
- Development: failures plus20 fixed guards, salt1; retain regression controls; full salts1-3; repair>=1 and break none.
- Survival/key logic:avoid proved dead ends;prefer zero-slot pairs with facedown members;rank outs learned from earlier BOT games.

## Mixed strategies: find WHEN to use them

- Compare changed decisions on repaired and broken games using actual public histories.
- Record public tray/clock/slack, unseen fraction, observed roles, retry and free pairs; no hidden labels.
- Fit one readable condition with at most2 public features and round thresholds.
- Fit on development only; retest salt1 development then full cohort salts1-3.
- Adopted06 base clock recovery: tray>=1 AND estimated slack>=50; avoids harmful preparation.
- Adopted06 retry information: after a no-learning physical loss; preserves wins and repairs150.
- Adopted08 remembered-key planning: live clock estimated slack>40; repairs10041.
- Adopted10 back-symbol planning: live-clock estimated slack5-20; repairs10015 without regressions.
- Adopted14 transfer proofs: live clock AND estimated slack<=30; helps10049, preserves10041.
- Adopted14 tight-clock recovery: tray=1 AND estimated slack=3; repairs144 without regressions.
- Adopted19 closed inspection: no live clock AND tray<=2; repairs157, preserves known recovery.
- Adopted19 information probe: primary reports known-dead; broader exposure checks prevent false certificates.
- Adopted23 clock inspection: starting clock10-30 AND tray<=2; bounded peek cost preserves41 while helping33.
- Adopted23 clock rank: starting clock10-30; account for spent moves in estimated slack, never as a proof.
- Adopted40: opening clock<=50 AND visible locks<=3 selects39,otherwise23; latch memory; repairs32,preserves11/41.

## Track B: calibrate only after A passes

- Run all boards at4-5 fixed strengths, including decision budgets and retry-memory
  variants. Report exact tries, within+-1, and tied-rank Spearman for each strength.
- Pick ONE by most boards within+-1; break ties by Spearman. No per-level tuning.
- Gate: at least80% within+-1 of Dennis AND Spearman>=0.6. Never invent censored counts.
- measure() uses that calibrated strength for difficulty; strongest remains for lessons.

## API: ten-line builder contract

1. require('C:/Users/den_k/Idea/OmasMahjong/personal-bot-review/source/tools/sim/refit/human_level_measure.js').measure
2. Call measure(board,{salts:[1,2,3],maxTries:12}).
3. Accepts production game format, including unlabeled lab/unreleased candidates.
4. Salts vary public choices; pictures, roles, clock and board remain unchanged.
5. triesPerSalt follows salt order; null means no verified clear within the limit.
6. firstTryWinRate includes every salt; averageTries is null if any run is censored.
7. lossTypes counts failed tries; slowestMove is milliseconds.
8. minutesPerBoard is elapsed measurement time; valid requires replay and timing.
9. CLI: node C:/Users/den_k/Idea/OmasMahjong/personal-bot-review/source/tools/sim/refit/human_level_measure.js board.json --salts 1,2,3 --max-tries 12.
10. Returns JSON; --out .codex-runs/result.json saves it. No Dennis label needed.

## Process and completion

- Batch48-55 permits at most8 measured trials; WHEN trials count; adoption does not replenish; prior24-47 retained.
- Small commits; goal<=80; one table/run; raw outputs .codex-runs/. Re-deal/luck runs stay STOPPED.
- After A and B pass: freeze; run the next20 progression levels once, when Dennis
  has played them, at BOTH strengths. Keep measure() working on unseen lab boards.
- Final one-screen table: level|Dennis|strong|calibrated; separate labs; adopted
  conditions/reasons, slowest move, minutes/board, and decisions for Dennis.

## Current evidence

- Retained40:158/159 clear every salt,155/159 within Dennis+1; A still unmet; four targets remain.
- 152/152 tests pass23s;batch48-55 used0/8;critic fit53/validate17 nonbenchmark boards;combined pile habit under audit,default40 retained.
- Full40 repairs10032,no target/clearance regressions;6 fresh workers exit0;slowest1717.6ms.
- Adopted40's fresh159-board cohort,77 sources and477 opening selections verified;mean0.5358min/board for3 salts.
- Batch audit:48 workers/616 archived sources/4152 opening selections verified;default477 configs match40;unlabeled API1/1/1,998.4ms.
