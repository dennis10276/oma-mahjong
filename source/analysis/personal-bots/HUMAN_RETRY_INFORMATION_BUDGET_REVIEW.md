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

## Updated retained10 evidence, catalogv2

This update uses existing measurements of the retained10 actor after the key
memory and drawn-role fixes, including new157. It covers all eight current
three-salt failures, rather than reusing the older06 diagnosis as current fact.

| Board | Tries1/2/3 | Extra searches | Node caps | Deadlines | Largest extra time | Information routes |
|---:|---|---:|---:|---:|---:|---:|
|86|1/1/3|26|24|0|76ms|2|
|144|5/1/1|0|0|0|0ms|0|
|157|3/3/4|34|29|0|130ms|3|
|10011|8/8/8|251|232|0|131ms|3|
|10032|>12/>12/>12|376|283|0|165ms|31|
|10033|5/>12/5|26|3|0|186ms|23|
|10049|>12/>12/>12|97|45|0|112ms|40|
|10052|>12/>12/>12|137|2|0|124ms|126|

Across947 extra searches,618 stop at the node cap(65.3%), none at the deadline,
and228 return information routes. Lab10011 still has232 caps in251 searches
and just3 information routes. The larger-node-budget hypothesis survives the
intervening adopted fixes. It remains unmeasured and must not change the live14
actor. Lab10052 instead finds126 routes in137 calls and has just2 caps, so its
failure still requires a different explanation; the separate immediate-loss
audit now identifies nine one-tap opportunities on its retained10 histories.

Keep the250ms extra deadline and existing outer move bound if an8192-node
candidate is later preregistered. Use the retained actor and updated open
failures after14 finishes; do not assert this old10 table describes14.
The same development/full adoption rule and eight-unadopted-trial stop rule
apply. No new games or strategy experiment ran for this counter aggregation.

Raw summary: .codex-runs/level-measure/retained10-retry-information-budget-v2.json.
Source97f6aa2ca756fd64e249945053bc3a352d89d1a764bad4212d7d81d5f23db675;
profile6b6094dc0a84e0e1988a9f3e3585863da68ddc0a2a00d554d8214c18b7bb21a1.
