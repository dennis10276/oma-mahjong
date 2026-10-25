# Human-information reference and Dennis-strength level measuring

ACTIVE and UNMET. Branch wip/personal-bots; checkout personal-bot-review.
Authoritative objective: cc8ea8eb-87e0-48be-a531-eeb68c9d5592/goal-objective.md.
Track A first; Track B only after A passes. Use sunflower tiles.

## Rules

- ONE observer: visible face-up pictures, drawn roles on fronts/backs, covered clock
  badges, and current takeability of every geometrically free tile without tapping.
- Hidden pictures, deck, board seed and future reveals are forbidden. Only public
  same-board/salt retry memory. Proven deductions may enter memory; sample consensus is not proof.
- Every level being winnable is an allowed prior. General planning only: no level
  IDs, per-level settings or routes. Every attempt independently replays production.
- Single-thread games, anytime, under2s/move; at most12 concurrent games.

## Track A: strongest human-information player

- All recorded Dennis natural first clears17-156 and later, plus15 recorded labs
  from lab-clears.json(10011-10053 excluding10031). Preserve board provenance.
- Real boards unchanged. Max12 actual tries per board/salt; censored is not a clear.
- Full gates: every board clears on salts1,2,3; each run at most Dennis+1 tries.
- Labs first:10011,10015,10032,10033,10041,10049,10052; natural150,86,144 also fail.
- Development: failing boards plus20 fixed passing guards, salt1. Keep additional
  regression controls. Full salts1-3 before adopting; repair>=1 and break none.
- Sum-of-tries and human correlation are not Track A gates under the revised goal.

## Mixed strategies: find WHEN to use them

- Compare changed decisions on repaired and broken games using actual public histories.
- Record public position features: tray count, clock remaining/slack estimate, unseen
  fraction, observed roles, retry, known free pairs; never use hidden labels as inputs.
- Fit one readable condition with at most2 public features and round thresholds.
- Fit on development only; retest salt1 development then full cohort salts1-3.
- List adopted strategies, their condition and a one-line reason here. Currently none.

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

- After8 consecutive experiments without adoption, stop; report table/open failures
  and let Dennis decide. A WHEN-condition trial counts. Prior relevant trials remain.
- Small commits; goal<=80 lines; one short table/run; raw outputs in .codex-runs/.
- Certified re-deal/luck runs remain STOPPED and archived. detbot audit is recorded.
- After A and B pass: freeze; run the next20 progression levels once, when Dennis
  has played them, at BOTH strengths. Keep measure() working on unseen lab boards.
- Final one-screen table: level|Dennis|strong|calibrated; separate labs; adopted
  conditions/reasons, slowest move, minutes/board, and decisions for Dennis.

## Current evidence

- Retained baseline-v2:148/155 clear every salt,145/155 within Dennis+1; A unmet.
- 117/117 tests pass. Trials01-04 unadopted;04 repaired4 but broke lab10045.
- Existing04 development ran3 salts before revision; subsequent development uses1.
- WHEN comparison complete; condition(tray>=1, estimated clock slack>=50) trial05 next.
- Unlabeled lab61 cleared1/1/1 on an earlier source; final-version recheck pending.
