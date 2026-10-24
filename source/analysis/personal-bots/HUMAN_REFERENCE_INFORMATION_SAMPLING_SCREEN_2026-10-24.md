# Interrupted information-aware screen

The planned24-case screen was intentionally stopped after its first completed row
hit the production action cap. The other23 cases remain unresolved; no24-case or
full155 score is claimed. A cap is not a physical loss or a free restart.

Source at start: `7ca4488b0e40e665f899c56475adbc520bc7ea630570ff6bbd5dfa5b61bbbb65`.
Input: `5710b9e2772fa2cd5207574a8669159817f3d18d173fb7c7ff4ca4bb0d69a51a`.
The interrupted runner did not reach its final source-integrity check.
Profile: the full causal-availability profile plus hypothesisSampling,
rememberBlockedTaps, informationSampling and informationPlayoutNodes4.

| Level | Dennis | Bot | Status | Accepted taps | Tiles left | Slowest ms |
|---:|---:|---|---|---:|---:|---:|
|81|1|unresolved on1|production action cap|512|63|1305|
|Other23 requested cases|—|unresolved|screen stopped|—|—|—|

All512 accepted taps on81 independently replayed in original production.
There were2225 information-aware play-outs:0 clears,6 physical policy losses,
2219 unresolved.513 balanced worlds completed. The old raw changed counter481/512
included safety-veto fallbacks, so it is not a valid sampling-influence metric.

Follow-up fixes separate actual safety vetoes from sampled choices, retain existing
all-root death certificates, stop repeated simulated public choices as unresolved,
and reduce fast-policy planning overhead. The known trap regression independently
replays a real physical loss rather than converting a cap into a counted failure.
