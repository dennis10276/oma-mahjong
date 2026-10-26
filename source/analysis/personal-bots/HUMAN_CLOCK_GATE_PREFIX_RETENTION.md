# Preserve a valid prefix when the clock information heuristic changes

Default remains adopted23. Trials24-29 unadopted; consecutive count6. This is
an optional implementation correction, not an adopted target repair.

The gated29 campaign restores102 but breaks33 4→8;49 remains improved5→4.
Native59469 exit0 replays162 actual23 taps on33 with zero baseline drift. There
is exactly one candidate suggestion change: try3 tap9, tray1,31 unknown pictures
of77 remaining, clock9. Baseline retains75,27,77,53,22; candidate restarts with
77,53,53,22. The gate has just changed from all to roles at ten→nine moves.
There are63 retained continuation-loss facts but zero reported loss prunes on
this decision. There was no prior different suggestion on the recorded history.

The controller's newly added heuristic-mode reset invalidated a legal retained
prefix without new information or a physical contradiction. Remove that reset.
The clock condition now controls exposure scoring for NEW searches; existing
known legal continuations retain the original reference policy's checks for
expected physical state, legality, information gain and role revisions. A
heuristic boundary alone is not evidence that a known prefix should be discarded.
No stronger clock threshold is fitted to mask this switching bug.

132/132 tests pass17s(native45167 exit0). Existing witness-prefix, clock safety,
visibility, production replay and gate-boundary fixtures remain green. No new
mock mirrors the removed reset. Next actual-history comparisons on33 and49
must verify both the regression context and the intended earlier changes.

Source db390e5cfd787cb97c5b2b2b1950661bdd7c0ff6f96b0525c1dccf26d04d0a9d,
72 files. Profile unchanged from29:
9e97917ceeb98ef08c6ed2243c270573e03f04ee4f20945981f8428ee37517ef.
Retained23 plus rememberProvedContinuations:true, passiveInformation:shortAll,
passiveInformationClockMin:10; all other unadopted strategies off.

Raw .codex-runs/level-measure/: short-all-clock33-native.json,
when-short-all-clock-decisions-v1/short-all-clock/baseline23/10033-salt1.jsonl,
short-all-clock-prefix-suite-01.log. Campaign30 must use the same42 development
boards/20 guards, fresh159-target cohort, and unchanged full159/salts1-3 gate.
A full adoption still needs complete repair, no passing-target regression,
independent replay, strict<2s and terminal native audit. A rejected30 makes7.
