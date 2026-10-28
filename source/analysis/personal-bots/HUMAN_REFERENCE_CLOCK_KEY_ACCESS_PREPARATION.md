# Clock-phase key preparation: reach the pair before matching it

Initial prototype prioritizes a known key pair on the pile when a clock is live,
tray<=2, and public dependency routes connect the keys to clock access. It opens
the closed member first and preserves estimated slack.159 tests pass19s. The
fixture's four winning production taps verify unlocked clock access without
additional tray pressure. Heuristic relevance/slack is never a necessity proof.

Actual retained40 comparisons all reproduce with zero drift and zero changes:
10049 salt1 first3(86 taps),10052 salt1 first4(105),86 salt3 first2(152),
10011 salt1 first3(210),10041 salt1 first3(176). All5 native sessions exit0,
729 taps independently replayed,<2s. No campaign/allowance consumed. Archive
frozen-d5c553a606a0-clock-key-freepair-prototype plus raw
clock-key-freepair-unmeasured-audit-v24.json preserve that exact84-source policy.

Diagnosis from public histories:in unprotected live-clock positions with room,
both live key pictures are known on28/51/1 positions of10049/10052/86 respectively,
but both keys are free together on none of them. Immediate pair matching misses
the key-access problem;do not discard the clock strategy after this first screen.

Extended prototype searches a complete known route to remove both keys. It uses
the public remembered identities and current known mechanics,never future reveals
or assumed hidden pictures. A new optional keyAccessPath tray ceiling enforces<=2
through every prefix;default3 preserves the existing planner. At most512 access
nodes/80ms,with the shared decision deadline. Prefer greater estimated ending
clock slack,then fewer taps. Negative estimated slack is a heuristic rejection,
not a proof of loss. Ready zero-pressure pairs retain their fast path.

The buried-key fixture verifies that clearing a blocker pair first yields key
access,keeps the tray<=2 and wins through production. A route may require matching
an extra partner outside the geometry cone,so access routes need nonnegative end
slack rather than unrealistically preserving the geometry-only starting estimate.
Existing wins,clock exits and necessary continuations stay protected. Validate
extended behavior on the actual target windows before any measured trial60.
Two campaigns60–61 remain;default40 unchanged;all completion gates unmet.

The first extended suite failed158/159:the buried-key fixture showed that the
existing access queue greedily ranks keys removed before route length,so it
opened a key prematurely instead of completing a shorter blocker-pair route.
Preserve clock-key-access-suite-01.log. Added an optional shortest-first search
mode used only by this preparation strategy;ordinary planner default stays
unchanged. The fixture now finds the four-tap known key-access route and wins
production while keeping every prefix<=2. All159 normal offline tests pass19s
in suite-02(native35363 exit0). No campaign/allowance consumed yet.
