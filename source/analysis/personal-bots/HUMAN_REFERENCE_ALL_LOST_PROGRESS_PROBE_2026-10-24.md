# Corrected all-lost progress tie-break: interrupted probe

Runtime: `2ef1dc8`; one-node fast primary, augmented primitive/compound actions,
dispersed-pair prior, sequential comparisons, strong primary200ms, compact public
diagnostics. Oracle progress admitted only when every candidate has an exact loss.
Source: `cae52c8bd561e159ebc9c7347e17501eee486798df92cebbea4977015dec18be`;
independent loaded-source fingerprint reproduced after stopping.
Input: `55119a1c07fdbc9518656e4c629a6deb0874a46aac66b5172b31d193cc512355`.

| Level | Dennis | Bot | Outcome | Verified taps | Slowest ms |
|---:|---:|---:|---|---:|---:|
|93|1|>1|tray loss;30 left|147|1305.3|
|99|2|>1|tray loss;30 left|57|1302|
|111|3|>2|tray losses after46/64 taps;42/34 left|110|1302.6|
|112|1|unresolved|not completed|—|—|
|137|2|unresolved|not completed|—|—|

Stopped intentionally after guard111 failed.0/3 completed cases passed; no
five-case/full score inferred.141/155 remains authoritative; no unseen20 run.
Sampling changed112/299 contested first taps (37.5%), no safety vetoes;
115 complete-option changes,13 compound choices,10 continuation taps,3 invalidations.
Honest play-outs:11252 =91 clears +7792 physical losses +3369 unresolved.
Every accepted actual tap independently replayed in original production.

Public snapshots now expose a separate issue: tiny positive exact weights can
dominate all-zero honest scores while many pictures remain unseen. Examples:
93 choice30 has24 unseen and an exact-only clear;99 choice45 has13 unseen;
111 attempt2 changes its opening with17 unseen, exact clears2 versus primary1,
and no honest clears for either. This is still strategy-fusion optimism.
Next: use an explicit public count limit, allowing exact planning only at <=8
alive unseen pictures; above that compare honest play-outs alone. Keep weighted
mixing below the limit and the corrected all-actions-lost progress requirement.
Conditional-fiction results never become actual observations/impossibility proofs.
