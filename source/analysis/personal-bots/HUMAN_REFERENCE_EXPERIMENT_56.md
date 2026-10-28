# Trial 56: preserve clock-route slack during tray cleanup

First of six additional authorized trials56–61. Build on unadopted trial55's
conditional tray-only strategy: opening clock20–40 and at most four visible
locks. Same two public features and unchanged thresholds, latched across retries.

New algorithm: when a clock is alive, accept a tray-cleanup override only if it
clears that clock or preserves estimated remaining clock-route slack. Estimate
remaining budget minus the public dependency-route cost, before and after the
candidate known prefix. Reuse the public route cache; no hidden pictures, oracle
routes, level IDs, future observations or benchmark-trained weights. This is a
planning preference, never a lower bound or necessity/impossibility proof.
Without a live clock, unrelated cleanup remains useful. Known wins, safe clock
exits and certified necessary continuations keep their existing precedence.
Keep all earlier strategy research; do not equate rejection with uselessness.

Evidence: unchanged55 replay diagnostics have zero drift across301 actual taps.
The new guard changes10/5 choices on10049 salts1/3 and15 on10052 salt1, with
zero baseline drift and all3 native exits0(8700/28110/60628). Every actual
attempt independently replays production. Candidate suggestions are not wins.
All158 tests pass19s(native39642 exit0), including a public-clock fixture where
unrelated cleanup consumes slack and a no-clock control where it stays useful.

Freeze84 sources and profile. Refresh160 targets read-only, then fixed43 salt1
development,max12 actual tries,3 workers. Existing qualifier and prespecified
regression-free unchanged off-salt confirmation path remain. Full160×salts1–3
before adoption:repair at least one complete failed target and zero passing-
target or clearance regressions, every decision under2s, independent production
replay/source integrity and recorded worker/supervisor native exits. Default40
remains until adoption. Starting56 consumes one new trial;5 remain57–61. No62.

Preflight found newly recorded161 (Dennis5), so the initial dispatch stopped
before any worker launched or allowance was consumed. Preserve its failed state
and archive. Frozen40 measures161 at2/2/2;all6 attempts/429 taps independently
production-replayed, native35513 exit0, slowest1501.131ms. Keep original159 boards
and labels identical, append161 and all original42 development boards/20 guards.
Catalogv3/selectionv12 now160/43. Baseline is159/160 clears,156/160 targets.
Relaunch exactly the same candidate as experiment-56-r1; no new variant or charge
for the preflight failure. All original trial55 results retain their159 scope.
