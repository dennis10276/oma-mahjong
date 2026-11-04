# Factory continuation — Codex, 2026-11-04

Branch: `wip/codex-level-factory`, forked directly from Claude's `13e7ab9`.
The production game and level tables are unchanged.

## What changed

The factory now runs from one checkout, with the g6.2 family meter and calibrated
skilled planner (including learned clock/lock traps). The snapshot comes from
committed Gemini sources plus Claude's patch, with its own offline physics.

`tools/factory/build.js` takes a plan: approved piles, trap concepts and explicit
curve anchors. It reuses measured trap designs on identical coordinates before
constructing a new seed. It checks shape variety, overlap with nearby/played
levels, tile size, towers and big-board placement before bot work.

Steering ranks edits with short family runs, then uses the unchanged full meter
for acceptance. Off-curve boards and idle-special repairs defer the expensive
planner. Exact route searches have a budget; a timed-out edit is unresolved and
skipped. The old loop's first-three-edits limit is gone. Starting boards on the
curve still undergo special-removal checks and can repair idle specials.

Measurements are cached by actual board, bot source, profile/setting, seed and
sample settings. Interrupted runs retain their prepared seeds and accepted
edits. Source/input/settings changes require a new output, while compatible
measurement entries remain reusable. Only the last five decisions are captured
for steering; tests compare every physical tap with full capture.

A pass requires valid family/planner measurements, a family target within 0.5,
planner <=6 expected tries, at most one unrelieved dig, trap loss attribution
>=0.6, meaningful specials, and an independent seed within the same target band.
Don't-grab traps also need a causal clock-first comparison. Late squeeze stays
an advisory warning, as Dennis requested.

## Pilot

`codex-pilot-plan.json` and `codex-pilot-piles.json` are a small software benchmark,
not a proposed new production curve. Three different shapes, all on existing
factory piles, target 2.1 / 2.6 / 3.6 expected tries. No new human calibration is
claimed. Full rows and boards: `codex-pilot-results.jsonl`.

Command (repository root, PowerShell):

```powershell
$env:STEPS = '3'
node source/tools/factory/build.js source/analysis/factory/codex-pilot-plan.json source/build/factory-pilot.jsonl
```

The measured run took 124.8 seconds, 25 new bot calls and one cache hit.
The earlier two-diamond smoke test took 74.8 seconds with 14 new calls and 15
cache hits; it was replaced with this pilot so the shapes also meet batch rules.
These are different workloads, not a controlled before/after speed comparison.

| level | shape | target | family | fresh seed | skilled | result | seconds |
|---|---|---:|---:|---:|---:|---|---:|
| 175 | block | 2.1 | 2 | 1.55 | 1.35 | REVIEW | 74.75 |
| 176 | diamond | 2.6 | 2.6 | 3.45 | 1.95 | REVIEW | 28.09 |
| 177 | frame | 3.6 | 3.63 | 3.73 | 2.75 | PASS | 21.83 |

175 repaired an unrelieved dig and passed search, but the fresh seed rated it
1.55, just outside the target band (minimum 1.6). 176 passed search but the new
seed rated it 3.45, above its 3.1 ceiling. Both remain review candidates. 177's
frame/ice-lock-clock board passes every check. Its specials all change the
family rating and the skilled planner averages 2.75 tries.

The independent-seed misses show why matching one seed is insufficient. This
pilot demonstrates a working build/check path and catches unstable ratings; it
does not establish production throughput or prove that a whole 175–200 batch is
ready. Larger batches should start with a broader pool of trap designs on the
intended curve, retaining misses for review rather than relaxing checks to fill
slots. A node/time budget miss is not proof that a trap is impossible.

## Verification

```powershell
node --test source/tools/factory/test_factory.js source/tools/factory/test_bot.js
```

13 tests pass, including full-vs-tail tap/decision equivalence for family and
planner, persistent cache isolation, interruption/resume, refusal of changed
inputs, idle-special repair, invalid measurements, held-out misses, dont-grab
causality, curve anchoring, exact-search budget exhaustion, and constructing a valid new
trap from an empty inventory. The separate new-seed smoke check built an
82-tile ice/lock/clock board with a complete verified solution in 1.5 seconds
(before difficulty tuning). The browser suite
was not run: changes are offline tools and bot snapshots; game assets are
unchanged.

Usage and configuration: `source/tools/factory/README.md`. The historical
factory README remains intact, including Dennis's verdicts and discarded
approaches. No release or production write was made.
