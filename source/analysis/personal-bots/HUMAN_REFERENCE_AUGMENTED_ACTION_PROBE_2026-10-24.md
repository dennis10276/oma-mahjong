# Primitive peeks plus complete action options: interrupted probe

Runtime: `82b1ea1`; strong-primary/dispersed-pair profile plus
`informationActionPaths: true, informationPrimitivePeeks: true`.
Single thread, 1300ms shared decision budget, one-node fast primary play-outs.
Source: `25f76d2261b9b10270bad68735c75c089c7e099658df370a7a964aa21494ddc6`;
independent loaded-source fingerprint reproduced after stopping.
Input: `55119a1c07fdbc9518656e4c629a6deb0874a46aac66b5172b31d193cc512355`.

| Level | Dennis | Bot | Outcome | Verified taps | Slowest ms |
|---:|---:|---:|---|---:|---:|
|93|1|>1|tray loss; 48 tiles left|37|1302.6|
|99|2|1|pass|87|1300.5|
|111|3|>2|tray after73 taps, clock after7; 38/68 left|80|1302.5|
|112|1|unresolved|not completed|—|—|
|137|2|unresolved|not completed|—|—|

Stopped intentionally after guard111 regressed. Only1/3 completed cases passed;
no five-case or full score is inferred. Level99 also cleared in the prior
compound-only variant, but this is not an unchanged-profile replication.
No promotion; the full-catalog result remains141/155.

Sampling changed35/177 contested first taps (19.8%), no safety vetoes.
Complete option changes36/177;12 two-tap options selected,11 continuations
executed,1 cancelled after public state or knowledge changed.
Honest play-outs:5783 evaluations =97 clears +3403 physical losses +2283 unresolved.
Every accepted actual tap independently replayed in original production.
Conditional sample losses/caps are not actual impossibility proofs. No hidden deck,
private kind count, seed, future reveal or unseen20 validation was used.

Next: calibrate the fast primary play-out from one to four search nodes, preserving
the shared deadline and all candidate comparisons. Inspect compact public-only
decision diagnostics on failing cases instead of inferring causes from totals.
