# Dispersed-pair prior: interrupted development probe

Runtime: `c0e7855`; same strong-primary profile as the preceding screen, with
`informationPicturePrior: "diverse"`. Single thread, 1300ms shared decision budget.
Source: `f66568880e9ecc4bfef59c3702e605d1290b166059948ac2dfdcb592b1c62f39`;
independent loaded-source fingerprint reproduced after stopping.
Input: `55119a1c07fdbc9518656e4c629a6deb0874a46aac66b5172b31d193cc512355`.

| Level | Dennis | Bot | Outcome | Verified taps | Slowest ms |
|---:|---:|---:|---|---:|---:|
|93|1|1|pass|270|1305.4|
|99|2|>1|tray loss; 28 tiles left|60|1299.7|
|111|3|>2|tray loss after378 taps, then clock loss after6|384|1305.5|
|112|1|unresolved|not completed|—|—|
|137|2|unresolved|not completed|—|—|

Stopped intentionally after guard111 regressed. Only1/3 completed cases passed;
no five-case or full-catalog score is inferred. The level93 gain does not authorize
promotion with this guard lost. The previous full result remains141/155.

Sampling changed380/704 contested first taps (54.0%); no safety vetoes.
Honest play-outs:16759 evaluations =62 clears +15053 physical losses +1644 unresolved.
Every accepted actual tap independently replayed in the original production engine.
Hypothetical losses and finite-budget failures do not prove actual impossibility.
The prior uses visible counts/public generation with broad backoff; no actual deck,
private kind count, seed or future reveal enters policy. No unseen20 test was run.
