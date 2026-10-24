# Four-node fast primary play-outs: interrupted development probe

Runtime: `d565084`; augmented primitive/compound options, dispersed-pair prior,
strong primary200ms, sequential comparisons, `informationPlayoutNodes:4` and
compact public decision diagnostics. Shared1300ms deadline, single thread.
Source: `5d9aa140859ae693b257bf7400696483d7cbee3f9eb0ef0df903ac9906235833`;
independent loaded-source fingerprint reproduced after stopping.
Input: `55119a1c07fdbc9518656e4c629a6deb0874a46aac66b5172b31d193cc512355`.

| Level | Dennis | Bot | Outcome | Verified taps | Slowest ms |
|---:|---:|---:|---|---:|---:|
|93|1|>1|tray loss;48 left|38|1303.5|
|99|2|>1|tray loss;30 left|63|1301.2|
|111|3|>2|tray losses after40/33 taps;48/50 left|73|1302.5|
|112|1|>1|tray loss;34 left|64|1301.6|
|137|2|unresolved|not completed|—|—|

Stopped intentionally after guard111 failed;112 had completed in buffered output.
0/4 completed cases passed. No promotion or full score inferred;141/155 remains
the authoritative full result. No unseen20 test was run.

Sampling changed22/222 contested first taps (9.9%);23 complete-option changes.
13 compound options selected,10 continuation taps executed,3 invalidated.
Honest play-outs:7803 =19 clears +320 physical losses +7464 unresolved;
1993 stopped on repeated public choices. Four nodes did not improve this probe.
Every accepted actual tap independently replayed through original production.

Public snapshots show zero-clear ties changed by oracle progress, for example
93 choice28 at tray[12,24], and112 choices59/62. The implementation allowed
per-action exhausted-loss progress even when other candidates were unresolved.
That does not establish that the entire filling is already lost. Correct this:
use progress only after every compared candidate in that filling is proved lost.
Return to the earlier one-node fast policy while testing that scoring correction.
This is a conditional-fiction ranking fix, never an actual impossibility proof.
