# Remembered keys after the clock: next candidate evidence

Actual retained40 salt1 histories independently replayed through production on
86,10011,10049,10052. Read keys only from the production public observer's key
glyphs; retain those facts only across earlier retries of the same board/salt.
No controller decisions, hidden faces or future observations enter this audit.
Raw evidence: .codex-runs/level-measure/key-after-clock-v19.json.

On10011 all seven failed tries end with tray loss after the clock is removed,
with two observed live keys. Across retries2–7 there are23 crowded positions per
retry where a remembered key's glyph is covered again;retry8 has10 more. These
are148 opportunities to use valid remembered identity in crowded post-clock
planning, not148 mistakes or proven winning alternatives. The winning retry
still uses knowledge accumulated on earlier retries. Causal benefit is untested.

Existing keyPlanningAllowed(game,state,40) rejects all post-clock states. Typed
key memory remains available to the public physics layer, but the strategy's
geometry.rules.keys omits covered remembered identities under that gate.

Proposed57 ablation: retained40 plus optional keyPlanningCrowdedAfterClock.
Keep the existing high-slack strategy and default unchanged. Additionally admit
observed key identities to strategy planning when no clock is alive AND tray
occupancy>=2. Two public features, threshold2, no board IDs, no new picture
inference, no learned benchmark labels. Check counterexamples with a live clock,
occupancy0/1, no known keys, removed keys and separate controller instances.
Compare actual10011 histories and regression controls before measuring. Run the
unchanged43 development/160 full, three salts, repair/no-regression and2s gates.

This is a proposed unmeasured variant. Trial56 actor sources remain frozen while
its full campaign runs. No57 allowance consumed, no next trial started yet.
