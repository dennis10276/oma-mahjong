# Inspect before an irreversible third tray tile

## Production safety lemma

A currently takeable, closed tile whose picture is unknown can be inspected
without increasing tray occupancy. A nonmatching first tap only reveals it;
an exact tray match removes it and the waiting picture; an open twin can remove
two board tiles. This uses the actual browser tapTile/exact trayHas rules and
the production physical engine, not an imagined picture or pair-count prior.

The conservative clock bound is two moves. A tighter public bound is two only
when an open twin is possible; otherwise it is one with a nonempty tray, zero
with an empty tray. The clock must have strictly more remaining moves than
that bound. Inspecting the clock tile itself is safe while its clock remains
positive. Already terminal trays/clocks, unknown orientation, known pictures,
the currently open tile and unavailable targets are ineligible.

Production controls cover all37 hidden pictures(0-35 and Joker), tray counts0-3,
with/without an open twin, and clocks absent/on another tile/on the target,
including one/two/three remaining clock moves. Within each public context the
observable inputs are identical across all hidden pictures. All1480 cases and
4442 physical taps independently replay;1073 cases are proved safe. Each of
the11 rejected public contexts has an actual loss counterexample, rather than
being declared unsafe from a bounded search. Maximum actual move increase is2.
Both proof commands exit0. These are first-tap controls, not campaign wins.

## Why a final-loss patch is too late

Both the conservative and tighter safe-inspection predicates find zero such
alternatives at the132 actual final losses of retained14's seven failing
boards. Each audit replays all146 attempts/6138 original taps independently.
A fallback that only activates at those final decisions cannot change those
histories. This does not disprove the value of inspecting earlier.

## Earlier information opportunities

Before a known nonlosing action that raises tray occupancy from2 to3, enumerate
all alternative proved-safe inspections on the same actual public histories.
There are357 alternative taps at143 distinct positions;296 alternatives at106
positions occur without an active clock. Every original tap and11036 alternate
prefix/inspection taps independently replay(native exit0). These are opportunities
before original plan-level protections; no winning continuation is claimed.

| Board | Positions with safe inspection | Positions without active clock |
|---:|---:|---:|
|86|6|6|
|157|37|34|
|10011|21|21|
|10032|21|21|
|10033|40|20|
|10049|13|4|
|10052|5|0|

On10011 and10032, salt1 opportunities already appear on attempt1. On157 they
appear on attempt1 too. This is earlier than the final-loss recovery examined
previously. No-clock inspection will not address the observed10052 opportunities.

The first pressure-audit adaptation accidentally replayed a final-tap prefix
at an earlier decision. The legality assertion rejected it. The corrected v9
uses the exact per-position prefix; failed v8 script/log/output are preserved.
No strategy campaign is counted for these physical-only audits.

## Preregistered experiment18

Retained14 plus deadEndInformation:true and inspectionTrayLimit:2. This keeps
the validated17 recovery available for interactions on newly changed histories;
it does not claim that17 alone improved a count. The new proactive difference
is at tray count2 without an active clock, using the existing recovery-style
inspection logic. Known winning routes, safe clock exits and constructive tray
recovery retain their existing protections. No active-clock inspection policy
or new private model is introduced by this experiment.

Use the same159-board catalog,42 development boards/20 fixed guards, baseline14
and three workers. Full three-salt adoption requires a Dennis+1 repair and no
passing regression; actual moves must stay below2s and every attempt replays
production. Counter before18 is3. Source/profile hashes and native evidence
are pinned in the experiment18 snapshot before play. Default14 stays enabled.

Raw artifacts under .codex-runs/level-measure/: public-safe-closed-inspection-v2.js,
safe-closed-inspection-v2-proof-01.log, adopted14-safe-inspection-opportunities-v6/v7,
adopted14-pressure-inspection-v9.jsonl and its position-summary.json. The earlier
conservative proof and its888-case/2666-tap log remain separate evidence.

## Live19: first-divergence diagnostic

An immutable snapshot of the first46 completed full-run board records contains
36 campaigns whose actions differ from retained14. Their successful-attempt
counts are unchanged in this partial snapshot. This is not the final full-run
metric or an adoption verdict;159 boards and all salts must still finish.

The first difference in each campaign has an identical preceding action history,
including all earlier attempts. Replaying those histories and both alternative
immediate taps independently through production verifies7275 taps(native exit0).
At34 first differences, the candidate inspects an unknown closed tile with two
tray tiles. The other two differences are on25 salts1/3 with one tray tile;
the candidate takes a remembered picture rather than an unknown inspection.
No first-difference position has an active clock, and no candidate immediate
tap loses. A later changed decision may have a different history and is not
claimed to be a comparison at the same public position.

The diagnostic uses actual recorded campaigns without calling either planner,
changing the actor, or inferring any private picture. Only the production
environment holds the complete board. Public features use observeBoard plus
same-salt observed or proved matched-picture memory. These records prepare the
required helpful/harmful decision comparison if the eventual full result is
mixed; they do not establish a useful WHEN condition by themselves.

Raw scripts: compare-recorded-campaign-prefixes.js and
replay-recorded-first-divergences.js. Inputs/output/logs are under experiment-19:
partial-prefix-comparison-01.json and partial-first-divergence-replay-01.json.
Each output pins its input hashes. Both commands exit0; later full records do
not retroactively change this explicitly partial snapshot.
