# TASK 15 — chained mixes

Complete: twenty independently re-proved boards, two per shape across ten extended chain shapes.

Branch `wip/codex-chained-mixes` was created from `wip/codex-trap-variety` (`b73fe838`) and merged local `wip/cc-builder-loop` (`2126579d`, merge `da2f54f3`) before implementation. The frozen-key/lock markers, subtler thaw glow and special-tile tap priority from Task 13 are retained. The ribbon implementation, packed extension, prototype entry, lesson strings and tests are removed. No levels were placed or released. Main and Firebase were not touched. No player bots or ratings were run.

## Shapes and what to see

A base signature keeps Claude’s notation. The waiting-clock/lookalike combinations join two existing gate links to two authored links (four total); the other shapes add a link to existing ice/lock/key gates. Cards give the resulting chain length and the engine effect of every special. `clock<waitForTwin` moves the alarm onto the exposed twin of the old gated clock picture; the preceding `clock<...` links describe that gated twin. `keyB<clockRoof` puts the tempting real key on the clock’s roof. `keyPair<lookalikeChoice` adds two ordinary copies of the key picture. `thaw<innerIce` freezes an additional neighbour within the chain. Two-front cards also name a proven lonely neighbour on each of two different icy hosts. These use the existing game rules only.

| Shape | Signature | Chain links | What the player must see |
|---|---|---:|---|
| lookalikeCoverThaw | `clock<cover:ice; coverThaw<lock; keyA<cover:ice; keyPair<lookalikeChoice` | 4 | The wrong matching key picture leaves the thaw tile locked; first melt the true key roof, then the clock roof. |
| waitLookalikeWay | `clock<lock; keyA<way:ice; clock<waitForTwin; keyPair<lookalikeChoice` | 4 | Leave the clock exposed and refuse the ordinary key lookalike; the icy way to the true key must be prepared before either can be paired safely. |
| lookalikeWay | `clock<lock; clock<cover:ice; keyA<way:ice; keyPair<lookalikeChoice` | 4 | The matching lookalike spends the wrong key; thaw the way to the true partner before the separate clock roof. |
| roofThawKey | `clock<ice; thaw<lock; keyA<cover:ice; keyB<clockRoof` | 4 | The roof key uncovers the clock but cannot thaw it: first reach its partner through ice, then unlock the thaw neighbour. |
| waitLookalikeRoof | `clock<lock; keyA<cover:ice; clock<waitForTwin; keyPair<lookalikeChoice` | 4 | The free clock and the easy matching key lookalike both spend the space needed to thaw the real key roof and open the clock twin. |
| lookalikeThaw | `clock<ice; thaw<lock; keyA<cover:ice; keyPair<lookalikeChoice` | 4 | A matching ordinary picture cannot replace the guarded key: save the true key pair to unlock the neighbour that thaws the clock. |
| lookalikeCover | `clock<lock; clock<cover:ice; keyA<cover:ice; keyPair<lookalikeChoice` | 4 | Reject the easy lookalike pair, thaw the real key roof, then open the lock and melt the separate clock roof. |
| waitThawWay | `clock<ice; thaw<lock; keyA<way:ice; clock<waitForTwin` | 4 | The free clock must wait while an icy way yields the key pair that opens its twin’s thaw neighbour. |
| waitThawKey | `clock<ice; thaw<lock; keyA<cover:ice; clock<waitForTwin` | 4 | Prepare the frozen key roof, use both keys to open the thaw tile, and melt the clock picture before collecting its exposed clock twin. |
| waitNested | `clock<lock; clock<cover:ice; coverThaw<ice; clock<waitForTwin` | 4 | The free clock is only the end of the route: keys open its twin, but two nested melts still need the tray first. |

## Board table

| Card | Shape | Layout | Layers | Tiles | k + spare | Winning starts | Tail | Face down | Tail waiting 0 / 1 / 2 / 3 |
|---|---|---:|---:|---:|---|---:|---:|---:|---|
| [lookalikeCoverThaw-L36-s3-p1](../../../source/analysis/builder/bank/chained-v1/examples/lookalikeCoverThaw-L36-s3-p1.md) | lookalikeCoverThaw | 36 | 4 | 76 | 10 + 1 | 2 | 0.2025 | 25.0% | 0.394 / 0.47 / 0.106 / 0.03 |
| [waitLookalikeWay-L14-s5-p1](../../../source/analysis/builder/bank/chained-v1/examples/waitLookalikeWay-L14-s5-p1.md) | waitLookalikeWay | 14 | 3 | 80 | 9 + 1 | 4 | 0.2288 | 25.0% | 0.324 / 0.493 / 0.169 / 0.014 |
| [lookalikeWay-L14-s3-p1](../../../source/analysis/builder/bank/chained-v1/examples/lookalikeWay-L14-s3-p1.md) | lookalikeWay | 14 | 3 | 80 | 18 + 1 | 4 | 0.2537 | 25.0% | 0.387 / 0.484 / 0.113 / 0.016 |
| [roofThawKey-L18-s4-p1](../../../source/analysis/builder/bank/chained-v1/examples/roofThawKey-L18-s4-p1.md) | roofThawKey | 18 | 3 | 76 | 10 + 1 | 3 | 0.22 | 25.0% | 0.333 / 0.5 / 0.167 / 0 |
| [waitLookalikeRoof-L14-s5-p2](../../../source/analysis/builder/bank/chained-v1/examples/waitLookalikeRoof-L14-s5-p2.md) | waitLookalikeRoof | 14 | 3 | 80 | 7 + 2 | 5 | 0.1625 | 25.0% | 0.37 / 0.493 / 0.123 / 0.014 |
| [lookalikeThaw-L31-s1-p1](../../../source/analysis/builder/bank/chained-v1/examples/lookalikeThaw-L31-s1-p1.md) | lookalikeThaw | 31 | 3 | 76 | 10 + 1 | 3 | 0.1875 | 25.0% | 0.394 / 0.485 / 0.106 / 0.015 |
| [lookalikeCover-L31-s1-p1](../../../source/analysis/builder/bank/chained-v1/examples/lookalikeCover-L31-s1-p1.md) | lookalikeCover | 31 | 3 | 76 | 10 + 1 | 3 | 0.1237 | 25.0% | 0.318 / 0.485 / 0.182 / 0.015 |
| [waitThawWay-L31-s3-p1](../../../source/analysis/builder/bank/chained-v1/examples/waitThawWay-L31-s3-p1.md) | waitThawWay | 31 | 3 | 76 | 11 + 1 | 4 | 0.2238 | 25.0% | 0.369 / 0.477 / 0.123 / 0.031 |
| [waitThawKey-L14-s2-p2](../../../source/analysis/builder/bank/chained-v1/examples/waitThawKey-L14-s2-p2.md) | waitThawKey | 14 | 3 | 80 | 9 + 2 | 4 | 0.26 | 25.0% | 0.38 / 0.493 / 0.113 / 0.014 |
| [waitNested-L31-s2-p2](../../../source/analysis/builder/bank/chained-v1/examples/waitNested-L31-s2-p2.md) | waitNested | 31 | 3 | 76 | 11 + 2 | 4 | 0.165 | 25.0% | 0.354 / 0.462 / 0.138 / 0.046 |
| [lookalikeCoverThaw-L18-s4-p1](../../../source/analysis/builder/bank/chained-v1/examples/lookalikeCoverThaw-L18-s4-p1.md) | lookalikeCoverThaw | 18 | 3 | 76 | 12 + 1 | 3 | 0.15 | 25.0% | 0.391 / 0.484 / 0.109 / 0.016 |
| [waitLookalikeWay-L31-s5-p1](../../../source/analysis/builder/bank/chained-v1/examples/waitLookalikeWay-L31-s5-p1.md) | waitLookalikeWay | 31 | 3 | 76 | 13 + 1 | 4 | 0.2512 | 25.0% | 0.349 / 0.492 / 0.143 / 0.016 |
| [lookalikeWay-L18-s1-p1](../../../source/analysis/builder/bank/chained-v1/examples/lookalikeWay-L18-s1-p1.md) | lookalikeWay | 18 | 3 | 76 | 12 + 1 | 3 | 0.1525 | 25.0% | 0.391 / 0.484 / 0.109 / 0.016 |
| [roofThawKey-L0-s7-p1](../../../source/analysis/builder/bank/chained-v1/examples/roofThawKey-L0-s7-p1.md) | roofThawKey | 0 | 5 | 80 | 12 + 1 | 4 | 0.2637 | 25.0% | 0.368 / 0.485 / 0.132 / 0.015 |
| [waitLookalikeRoof-L18-s5-p1](../../../source/analysis/builder/bank/chained-v1/examples/waitLookalikeRoof-L18-s5-p1.md) | waitLookalikeRoof | 18 | 3 | 76 | 7 + 1 | 3 | 0.2313 | 25.0% | 0.362 / 0.493 / 0.13 / 0.014 |
| [lookalikeThaw-L18-s2-p1](../../../source/analysis/builder/bank/chained-v1/examples/lookalikeThaw-L18-s2-p1.md) | lookalikeThaw | 18 | 3 | 76 | 11 + 1 | 5 | 0.2775 | 25.0% | 0.354 / 0.492 / 0.138 / 0.015 |
| [lookalikeCover-L18-s3-p1](../../../source/analysis/builder/bank/chained-v1/examples/lookalikeCover-L18-s3-p1.md) | lookalikeCover | 18 | 3 | 76 | 13 + 1 | 5 | 0.19 | 25.0% | 0.317 / 0.492 / 0.175 / 0.016 |
| [waitThawWay-L14-s2-p1](../../../source/analysis/builder/bank/chained-v1/examples/waitThawWay-L14-s2-p1.md) | waitThawWay | 14 | 3 | 80 | 15 + 1 | 3 | 0.2338 | 25.0% | 0.354 / 0.477 / 0.138 / 0.031 |
| [waitThawKey-L18-s4-p1](../../../source/analysis/builder/bank/chained-v1/examples/waitThawKey-L18-s4-p1.md) | waitThawKey | 18 | 3 | 76 | 13 + 1 | 2 | 0.2338 | 25.0% | 0.381 / 0.476 / 0.111 / 0.032 |
| [waitNested-L36-s3-p1](../../../source/analysis/builder/bank/chained-v1/examples/waitNested-L36-s3-p1.md) | waitNested | 36 | 4 | 76 | 7 + 1 | 3 | 0.2475 | 25.0% | 0.377 / 0.464 / 0.116 / 0.043 |

2/20 needle boards (fewer than three proven winning first moves); at most four are allowed. 17/20 boards have at most three layers. Layouts were searched with three layers first, ranked by `T.readableLayouts`; cards disclose every deeper exception.

## Obviousness check and dial

The greedy check uses public information and retains every tied choice: a visible tray match first, otherwise any free visible pair, otherwise a visible clock, key or thaw neighbour, then any other visible single. A route fails if both of its first two taps belong to those greedy tie sets, recomputing after its first tap. A route also fails when any two tiles needed on its stored pre-clock route are an already free, face-up matching pair at move zero. This is a concrete opening test, not a claim to measure human insight across the whole solution.

Dial 0 applies both mandatory rejection rules; dial 2 additionally requires at least one proven bait among the greedy first choices. Every card includes the route taps, both complete greedy tie sets, both rejection booleans and any greedy-preferred baits. Spare 1 versus spare 2 remains an independent timing dial.

Recorded worker jobs: 1704; successful raw/finished jobs: 168. Obvious-opening attempt rejections: `{"obvious:greedyPrefix":997,"obvious:freeRoutePair":523}`. These count observed attempts, not impossible hosts; terminated workers only report the last completed attempt.

## Two traps and engine evidence

Every board has at least two disjoint, separately losing bait decisions on a chain of at least three links. The added free clock, roof key or lookalike is a link in the existing chain. The other bait is an early key or lonely thaw neighbour with at least a two-link dependency. Medium-link evidence identifies the blocked partner or the buried twin and thaw host. The two-front card additionally prices two lonely neighbours on two different icy hosts independently, on the existing connected chain. These qualify under the permitted hard-chain-plus-medium-trap alternative. They share gates and tray room, but the cards do not claim a proven change in the marginal cost of the second mistake after the first.

Each bait is independently re-priced from k through min(k+3,19). A reported loss means no completion anywhere in that tested horizon; a positive cost is the independently proven extra deadline needed. A bait must lose at the shipped deadline. Each individual ice and lock must shorten the exact clock route when removed, or make a previously losing bait win at the shipped deadline. The complete unrelated visible-pair/single-twin control is also re-priced. Every card lists all these counterfactuals.

## Tail, visibility and variety

Tail tuning calls the unchanged `bank/tail.js` with band 0.10–0.28. The reported diagnostic uses seed 977 and 800 playouts. Added face-down tiles target 25% (accepted 23–30%) and are outside the special mechanism and shortest stored pre-clock route. The final verifier checks every hidden tile, not just newly added ones. This diagnostic is the prescribed greedy tail measure, not a player rating.

The stored tail is rerouted with strict singles so one waiting tile is common: share at one at least 0.40, at two at most 0.20, at three at most 0.05, and no more than six consecutive steps with two or more waiting. Occupancy is counted BEFORE each tail tap and every card gives all four shares and the longest run. Matching removes a waiter, so zero and one naturally alternate on parts of the route.

Twin separation requires zero visibly close twins, zero close copies within a four-copy picture group, and at most 5% close pairs overall. The history snapshot excludes all thirty lab-7 candidates, including unplayed siblings, and all 53 placed boards at 250–302. Exact special-placement fingerprints and layout-plus-extended-signature pairs are checked against that history and across this bank. These cards are a candidate bank, not a scheduled run of twenty numbered levels; the lead’s placement spacing rules still apply when scheduling them.

## Failures and limits

The collection evolved during tuning; totals span those versions. Every shipped card uses the final whole-route obviousness test. Complete counts are in [the rejection summary](../../../source/analysis/builder/bank/chained-v1/rejection-summary.json), with representative [finishing traces](../../../source/analysis/builder/bank/chained-v1/failure-samples.json). Full raw candidates and development logs stay in ignored local folders.

| Worker outcome | Count |
|---|---:|
| noProvenMix | 1016 |
| hardWall | 344 |
| separation | 119 |
| tailPressure | 38 |
| tailBand | 9 |
| independentVerification | 4 |
| strictMinimum | 3 |
| exception | 2 |
| finalProof:twoMeaningfulBaits | 1 |

| Most common attempt rejection | Count |
|---|---:|
| noChain | 34726 |
| noClockPartnerHolders | 9839 |
| noRoofKeyCell | 9786 |
| noRepeatedKeyPair | 7959 |
| noProvenBait | 3757 |
| clockTwinNotGate | 2655 |
| noInnerMelt | 2595 |
| twoMeaningfulBaits | 2149 |
| digPictures | 1663 |
| obvious:greedyPrefix | 997 |
| mixedDig | 986 |
| fixedTwinsClose | 849 |
| noSecondMeltBait | 581 |
| obvious:freeRoutePair | 523 |
| clockShortest | 518 |

The dedicated two-lonely-front placement recipes did not produce a finished host in the recorded bounded sweep. Instead, the existing lookalike/locked-thaw chain on layout 36 had a second already-present lonely neighbour on its other frozen front. Its pictures and positions were kept; both first mistakes were independently priced and the card was rebuilt and re-audited. A connected two-front trap is therefore delivered, without counting the unsuccessful recipes as finished shapes.

A failed wall-limited host search is not proof that the host is impossible. Unknown searches never count as losses. Twin repair, hidden-tile placement, tail tuning and tail rerouting are each allowed to reject a raw board. Engine solvability does not predict how Dennis will rate its AHA moment. The report distinguishes structural link count, observed openings and the fixed greedy tail measure from design judgment.

## Show Dennis first

- [lookalikeCoverThaw-L36-s3-p1](../../../source/analysis/builder/bank/chained-v1/examples/lookalikeCoverThaw-L36-s3-p1.md) ([game image](lookalikeCoverThaw-L36-s3-p1.png)): The wrong matching key picture leaves the thaw tile locked; first melt the true key roof, then the clock roof. Each of two frozen fronts has its own proven lonely-neighbour bait.
- [lookalikeThaw-L31-s1-p1](../../../source/analysis/builder/bank/chained-v1/examples/lookalikeThaw-L31-s1-p1.md) ([game image](lookalikeThaw-L31-s1-p1.png)): A matching ordinary picture cannot replace the guarded key: save the true key pair to unlock the neighbour that thaws the clock.
- [roofThawKey-L18-s4-p1](../../../source/analysis/builder/bank/chained-v1/examples/roofThawKey-L18-s4-p1.md) ([game image](roofThawKey-L18-s4-p1.png)): The roof key uncovers the clock but cannot thaw it: first reach its partner through ice, then unlock the thaw neighbour.

These are my choices for contrasting trap ideas and readable hosts, not human playtest results.

## Verification and reproduction

Fresh independent audit: 20/20, passed. Regression checks: passed. The audit imports declarative shape metadata and engine helpers, and never imports either story module, calls a story proof, or uses the construction clock-minimum routine. It replays the full strict witness and proves k−1 unsatisfiable directly, re-prices all baits/controls, checks each ablation and every winning first-move claim, and re-measures the tail and visibility facts.

No edits to `trap_stories.js`, `bank/*` or `builder-next/construct.js`. Heavy work reserves cores through `loop/heavy.js`, uses disposable workers with hard outer deadlines, and stays within the shared twelve-core / 80% limit. Each collection run also has a total wall.

The saved boards can be re-audited without regeneration. Collection seeds and outcomes are recorded in the collection JSON files. Game checks use the existing local Playwright dependency and installed Chrome:

```powershell
$env:NODE_PATH='C:/Users/den_k/Idea/OmasMahjong/oma-mahjong/tests/node_modules'
$env:CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
node source/tools/builder/loop/heavy.js --label chained-collect --cores 4 -- node source/tools/builder/run_chained_mixes.js --workers 4 --minutes 20 --layers 3 --rounds 2
node source/tools/builder/loop/heavy.js --label chained-check --cores 4 -- node source/tools/builder/check_chained_mixes.js --workers 4
node source/tools/builder/report_chained_mixes.js
```
