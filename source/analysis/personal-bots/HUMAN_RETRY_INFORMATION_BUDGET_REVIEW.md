# Retry information search under matched execution

This is a diagnostic of completed experiment06 salt1 development, not an adopted
change or a new played experiment. Its public-information search kept the global
2000-node and250ms extra bounds. All38 development boards independently replayed,
with a maximum1683.6ms per move. Mean CPU seconds per wall second was1.039.

| Lab | Tries | Searches | Node caps | Deadlines | Largest extra time | Information routes |
|---:|---:|---:|---:|---:|---:|---:|
|10011|8|83|78|0|135ms|1|
|10032|>12|130|95|0|167ms|12|
|10033|>12|80|58|0|198ms|19|
|10041|>12|196|188|0|150ms|0|
|10049|>12|41|29|0|116ms|3|
|10052|>12|54|0|0|87ms|54|

Across these six development cases,448 of584 extra search calls(76.7%) stopped
at the node cap and none at the time deadline. This supports a separate global
node-budget test while preserving the250ms extra deadline and1800ms outer window.
It does not show that a larger budget will find a route or improve any board.
An8192-node candidate is a reasonable first budget increase, subject to the same
development/full adoption rule and strict actual under2s timing. Every measured
budget candidate counts toward the eight-unadopted-trial stop rule.

Lab10052 demonstrates a different limitation: all54 extra calls found a public
information route, yet the campaign still failed. More nodes alone do not address
that result. Follow how the newly observed symbols affect actual replanning and
retry memory. The separately audited late-key identity gap is the first proposed
fix. New useful information must guide the next decisions rather than simply
increase the number of reported routes.

The current retry stall fingerprint contains pictures, orientations and starting
role enums. It does not include the controller's accepted-availability and
cleared-role proof stores. A later audit can check whether physically failed
attempts classified as stalled actually gained a stronger conditional public
proof. That is a hypothesis, not an established bug or measured benefit; compare
semantic proof content, not changing timestamps or repeated observation logs.

No measured actor was edited for this review. Complete full06 first; inspect its
native exits and full comparison before adopting anything. Apply and test the
prepared typed-key fix before drawing conclusions about its effect or combining
it with a larger search budget. Keep the drawn-role and tight-clock candidates
available for separate tests or evidence-based combinations.

Source901550e360d574ab5efe898b5ca410f9e7bd7e9a81b2a82ae93e7f666696b6ab;
profile92b1c12b829d93187b1dc27efd6c8c7760120283ed419f890af879d0b4946049.
Raw inputs: .codex-runs/level-measure/experiment-06/development-shard00.jsonl,
development-shard01.jsonl and development-shard02.jsonl. Values come from each
board's runs[0].retryInformation counters. No new games ran for this analysis.
