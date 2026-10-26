# Public information before intentional loss

## Completed policy comparison

Retained14 and the isolated immediate-match prototype follow the same recorded
histories on86 salt3,10032 salt1 and10052 salt1. All939 taps independently replay;
all three native commands exit0 and original-policy drift is0. The prototype
changes four decisions. Every original decision has knownDead:true and an
exhaustedKnownGraph certificate with reachableUnknown:false, safe removals
explored, all requested roots included and no unsupported transitions.

| Board/salt | Attempt/tap | Original | Alternative | Immediate observation |
|---|---|---:|---:|---|
|86/3|2/61|2|1|no newly visible picture, orientation, role or takeable tile|
|10032/1|9/27|15|29|no newly visible picture, orientation, role or takeable tile|
|10032/1|11/28|15|29|same|
|10052/1|8/32|62|40|tile10 orientation/role becomes visible; tile9 becomes takeable|

Tap indices are zero-based. Original wins and safe clock exits are false at
these positions. The planner deliberately chooses a losing action after its
known-dead report; this is not simply an accidentally ignored matching pair.
The alternative suggestions were not executed as candidate campaigns and no
winning continuation is claimed.

## Check all matching alternatives, not just the first route

A further physical-only audit enumerates every currently legal, known matching
tray alternative with a definite nonlosing public one-step prediction on all
seven retained14 failures, salts1/2/3. There are exactly15 alternatives, the
same15 positions as the earlier first-choice audit; no additional matching
route was missed. Original146 attempts/6138 taps and439 alternate-prefix taps
replay independently(native exit0). No alternative reveals a new picture.
The informative cases are on10052, including orientation/role/takeability
changes. These are actual post-tap observations, not permitted pre-tap inputs.

The first such salt1 opportunity on10052 is attempt8. An otherwise identical
post-selection one-tap override cannot repair its Dennis+1 target of4 on salt1
when its first seven attempts remain unchanged. That is a limitation of this
specific override, not a proof against earlier or multi-step information routes.
On86 and10032 the single alternatives supply no immediate observation gain;
surviving that tap alone does not refute the reported death or establish value.

## Concrete visibility counterexample

On10052 salt1 attempt8, before tap32: moves19, clock42 still blocked with2 moves
remaining, tray[18,17,14]. Tile10 supplied no visible role in the earlier frames
of that salt1 campaign; its opening role, current role, picture and orientation
are all unknown. Taking the known matching tile40 leaves moves20, tray[18,17],
and exposes tile10's orientation as closed and its current role as none. Its
picture remains unknown. Tile9 becomes takeable with visible picture33 and
role none. Clock42 remains blocked with1 move remaining; this is not a clock
rescue. The33-tap prefix/alternative independently replays.

The new orientation is public information that can enter same-board retry
memory. Late role none is not an initial-role deduction. The old declaration
reachableUnknown:false is too broad if read as covering all human-visible
information. This observation does not prove a current winning route exists.

The source explains the mismatch: shortRoles builds the normal exposure
frontier in roles mode, which excludes unknown orientations and covered back
roles. Back-role priority is separately gated by the adopted strategy. Those
planning priorities must not silently define the scope of an information-free
death claim. Preserve the useful strategy conditions while distinguishing
their selected information graph from complete public observability.

## Next prototype, not implemented or measured yet

Prepare an optional dead-end information recovery in the isolated actor:

- After a primary known-dead report, look for a constructive known safe prefix
  to any genuinely new public orientation, picture or drawn role, including
  backs. Use the shared visibility projection and remembered public state only.
- This probe may run on the first attempt and before a no-learning stall. A
  final opportunity on attempt8 is too late; collect useful facts earlier.
- Keep ordinary move priorities and their adopted conditions unchanged when
  the primary policy has a win, safe clock exit or a non-dead decision.
- Share one extra-search allowance with the existing retry-information search:
  default2000 nodes/250ms,1800ms outer window, strict actual under2s. Do not stack
  a second allowance. No new imagined picture may join memory.
- If a full-information-frontier probe is bounded or otherwise incomplete,
  report an unresolved information boundary rather than an information-free
  death certificate. Never convert failed finite search into impossibility.
- Clear inherited death/root-pruning metadata when a constructive information
  route replaces it, and replan from actual observations after physical taps.
- Validate first-attempt recovery, public hidden-world invariance, no fictional
  memory, preserved winning routes and timing. Then preregister development/full
  campaigns against retained14. A strategy trial counts toward the stop rule.

This is a proposed public-information recovery, not a claim that the prepared
one-step override is adopted or that the next strategy already repairs a board.
The retained default remains14; trials15/16 are unadopted, counter2.

Raw comparisons: when-immediate-match-v1/baseline14/ and native logs
immediate-match-policy14-86-salt3-01.log, -10032-salt1-01.log and -10052-salt1-01.log.
All-alternative evidence: adopted14-all-matches-learning-v5.jsonl and summary.
Focused public probe: lab52-alternative-public-role-probe-v1.json.
All paths are under .codex-runs/level-measure/.
