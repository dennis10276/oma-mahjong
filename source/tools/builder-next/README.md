# Experimental target-driven builder

Construction/planning continuation after the B3 solver review. This uses the
G9 component constructors (`f7f6638b`) and the independently checked B3 solver
(`faa0295c`), with a new measured planning loop. Existing builder code, family
pins and game levels remain unchanged.

```powershell
node source/tools/builder/loop/heavy.js --label builder-next -- node source/tools/builder-next/cli.js --target 10 --layout 22 --candidates 6 --campaigns 80 --out source/build/builder-next-result.json
```

Supported component layouts currently are 22/U, 20/castle, 0/arch and
14/hourglass. This is a finite component experiment, not a claim of reliable
construction at every difficulty or on unseen layouts. Unsupported layouts
are refused instead of silently receiving U-shaped tile recipes.

- `yardstick.js` explicitly selects the new skilled solver by source hash.
  The family and reference fingerprints must still match the existing pins.
  The default shared yardstick is unchanged. Both bots see the same deadline.
- `recipes.js` preserves G9 structural proposals and historical *family*
  estimates as exploration priors. Old skilled estimates are discarded by
  the planner. Their historical comments do not establish B3 calibration.
- `planner.js` uses current observations and paired clock-response estimates
  to rank unmeasured proposals for the requested target. A skilled miss
  prioritizes another structure. An estimate never qualifies a board.
- `builder_next.js` remembers measured misses, bounds distinct trials, avoids
  repeating physical boards and reuses results only inside its exact source,
  ruler, gate-profile, body and measurement context. Knowledge defaults to
  ignored `source/build/builder-next/knowledge.json`; `--knowledge` selects an
  isolated file. Failed proof budgets stay unresolved, not impossible.
- `evaluator.js` requires valid numerical ratings, selected-spare static
  checks, resolved proofs and all required trace gates for an experimental
  hit. It applies the existing B7 target limit. Expensive trace checks run on
  numerically promising boards at the requested campaign count, without G9's
  silent 40-campaign clamp.

`EXPERIMENTAL_HIT` is not a release qualification: fresh ACCEPT campaigns,
the sequence's five-level curve constraints and final adoption are separate.
`NO_MEASURED_HIT` means this bounded proposal set did not produce a suitable
board. `SKILLED_TOO_HARD_REVIEW` flags the known need to inspect disputed bot
rejections. The normal skilled band is 2.5-6; minimum 2 requires an explicit
request and is marked as a fallback in the result.

These G9 bodies retain their zero-face-down visible-planning control. It is
not a rule for future levels. New puzzle components and deliberate face-down
placement still need construction evidence under Dennis's design requirements.

Run the small controller regression check with
`node source/tools/builder-next/test_planning.js`. It protects the demonstrated
false-qualification/cycling defects; it is not a large new physics test suite.
