# A few retained children, then an earlier fork

User direction: keep a few continuations earlier and work through them, rather
than spreading attempts across every possible route. Trial36 mechanically took
five alternatives on32 but repaired no target; all42 clear counts unchanged.
Its width3 applied to search priorities, not the retry working set itself.

Unmeasured refinement: order productive viable choices by current primary and
retained agenda, and bound the actual retry working set to width3. After one
actual failed play on each child of that working set, allocate the next retry
to an alternative at an earlier accepted fork. The failed-child counts are
heuristic allocation evidence. They do not reject children, prove exhaustion,
invent observations, or establish impossibility. Every deferred root remains
available for later public analysis. Newly changed public choices can affect
the working set; it is not an immutable proof tree.

Preserve the two-feature condition(tray<=2,no active clock), protected known
wins/clock exits/necessary prefixes/recoveries, current public-proof checks,
one accepted switch per attempt and bounded checkpoint/outcome storage.
Counters allocatedWorkingSetsPassed and earlierForkSelections distinguish
moving past an allocated working set from logical branch rejection.

143/143 tests pass18s; native72512 exit0. An expanded production-replay control
has three real failed plays after the same opening, using three late children.
The next request moves to the earlier fork instead of a fourth late child.
All children remain viable under fresh proof. The agenda control now replays
46 physical taps, including24 new taps; the42-tap backtracking control still
clears its second attempt and legacy/clock/unresolved controls remain unchanged.
These fixtures are not campaign improvements or evidence that earlier works
on32. Require actual-history target/control comparisons before registering37.

Default23 unchanged. Five of eight authorized measured trials used,three remain;
no37 registered. Track A/B/unseen20 goal remains unmet. Raw suite log:
.codex-runs/level-measure/survival-bounded-working-set-suite-01.log.

## Actual-history check: not ready for a campaign

Implementation3460b20. Source
afffe6a9e70427a3d4eb63d1630ab23b4277e70db22d144e06cc9c25dbb2415e,
76 files. Profile remains
ea5390b5b3ea18a961cd41ffdc3415922278c9f744ee748a813bf291fd79ef11.
Wrapper58370 and both children exit0, persisted in bounded-branch-native-v1.json.
Actual36 histories32/41 independently replay238/177 physical taps with zero
original-choice drift and zero changed suggestions. Maximum candidate decisions
1643.6/1454.0ms.32 includes seven attempts;41 includes its three-attempt clear.
No candidate campaign was played. Neither proof nor ordering telemetry is a repair.

32 reports zero allocated working sets passed and zero earlier-fork selections
through try7. Thus the new branch-allocation rule is physically controlled but
does not affect the recorded target trajectory early enough. Do not register37
on this evidence. Investigate earlier checkpoint eligibility and whether the
same working set is revisited; do not assume an earlier move is reachable or
discard a valid clock route without an independently verified replacement.
All comparisons terminal; five measured trials used, three still available.
