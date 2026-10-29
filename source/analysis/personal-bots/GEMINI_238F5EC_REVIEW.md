# Review of238f5ec: adopted controller with corrected evaluation

Adopted into human-v0 (bcac396) after independent production replay and factory
validation. The original README replacement and evaluation runner were not adopted.

| Fixed20-run factory check | Original proposal | Corrected human-v0 |
|---|---:|---:|
|factory1-175|95%|75%|
|factory1-189|100%|75%|
|factory2-184|90%|95%|
|factory2-192|100%|100%|
|factory2-175|25%|40%|
|Hard-board clock share|76.67%|82.61%|

Both versions meet the predeclared behavioral d/e point-estimate thresholds.
Only the corrected version was released. Correcting physical tap cost changes
results materially; original numbers must not be presented as audited v0 results.

Useful ideas retained: whole visible sideways-row geometry, short planning,
partner-access attraction for existing tray pictures, stochastic choices,
closed-picture forgetting, and learning from actual failed clock/dig attempts.
No level ID, label, human try target or stored winning route enters the policy.

Corrections required:

1. The original lookahead removes a known unmatched closed tile in one thought
   step. Production requires a peek first. The corrected model always does so.
2. The original mean substitutes the attempt limit for uncleared campaigns.
   The released API returns null for a complete mean whenever a run is uncleared.
3. The original runner calls every non-win a physical loss and retries. The
   audited shared runner classifies computation censoring separately and stops.
4. Every accepted tap is independently replayed in original production, matching
   terminal outcomes/logs/traces. This was missing from the proposed runner.
5. Output supplies numeric runs, loss shares and separate loss counts, plus
   explicit validity/censoring metadata. Family remains experimental.
6. The greedy escape estimate is named/described as a heuristic, not an
   exhaustive dead-end certificate. It never supplies an impossibility claim.
7. Fixed model profiles are immutable. The product's README remains intact.

Evidence: gemini238f5ec-audit-04.log (original proposal independently replayed),
gemini238f5ec-adoption01/, human-v0-release-check/, and171/171 offline checks.
The validation boards are development data. Broader family calibration, lab
ranking and a frozen subsequent-level check remain required by the active goal.
