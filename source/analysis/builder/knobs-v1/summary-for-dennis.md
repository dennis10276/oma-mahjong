# Task 10 done

Branch: `wip/codex-builder-knobs`. Results: `codex-tasks/results/builder-knobs-v1/`.

The builder makes boards quickly (30 ms median construction time for successful pilot builds), but it cannot yet place readable, original levels on this curve reliably. Of 347 studied boards, only one reached both bands. The pilot built 11 of 24 fixed requests; none qualified. All 20 existing levels and their gold are preserved exactly. **208, 210, 215, 216, 217 and 221 remain missing.**

These are the median changes in tries for each requested change, not dependable conversion rates:

| Change | Family | Skilled |
|---|---:|---:|
| Three waiting +2 | +0.14 | +0.08 |
| Three waiting +4 | 0.00 | +0.03 |
| Luck +1, with hidden route | 0.00 | 0.00 |
| Luck +2, with hidden route | 0.00 | +0.15 |
| One designed trap | 0.00 | +0.05 |
| Two designed traps | −0.04 | −0.06 |
| One extra clock move | −0.71 | −0.21 |

No pressure/luck/trap control passed the 80% family-direction test. Clock spare worked in 23/24 comparisons, but frozenGuards had an 11.2-try cliff. Excluding that story, spare worked in 20/21, with median −1.13 family / −0.32 skilled tries and no cliffs. Keep it as a secondary family control; do not use it to promise an exact rating.

The one in-band brief was **deepClock, way18, three2, luck2, hiddenOnWay2, traps0, spare1**: family10.30 / skilled5.08. Its actual card was way19 / three3 / luck1 / two hidden dig tiles. On new whole layouts, every successful pilot build failed the existing readable-objective rule. No cropped big boards or blocks were used. Level210's one compatible request had exactly96 tiles.

The plain additive table missed held-out cells by a median **3.78 family / 2.63 skilled tries**. That is too much error for placement within ±1. Repeated construction seeds also produced large jumps. Full tables and per-story cliff splits are in `REPORT.md` and `summary.json`.

The pilot confirmed **0/11 first-check hits** against the 50% goal: three complete pooled checks all missed, and eight were stopped early with no full rating. This is the screened pipeline's hit rate, not an estimate of the eight unknown full scores. Early stopping used460 family campaigns instead of880, saving420 (48%), including screening overhead. Calibration rejected12/696 potentially qualifying earlier boards (1.72%); the conservative skilled check rejected0/119. The main grid had already run in full, so saved no campaigns. See `SPEED.md`.

Frozen keys need a milder, more readable story. On a hard example, removing their ice while keeping exact spare changed family20→3.40 and skilled9.10→1.00; keeping one weak frozen key gave2.99/1.10, too easy. Face-up versions unexpectedly made the skilled bot worse, so these ratings also expose a policy/peek-action artifact, not a human difficulty scale. A visible guard chain and genuine choices on the critical route are better next experiments than adding hidden keys or free off-route pairs. No new mild variant is claimed qualified.

168 builder/factory tests passed. All 20 preserved levels passed phone previews and their stored solutions in the real game. The portable handback verifies from cached full evidence with zero new bot calls. No game table, bot, Firebase or release was changed.
