# Exact-search score and time calibration

The complete first exact-gate screens scored17/48 for32x1 and19/48 for12x16.
Both were rejected against the fixed24/48 baseline. This does not establish that
the count gate is unhelpful: its new minimum25% exact score contribution also
changed the policy whenever few survivors were known. Investigate that allocation
before discarding the route.

The candidate separates computation time from score influence. At <=8 alive unseen
pictures, honest score weight is capped at0.95 instead of0.75, so the minimum exact
score weight is5%. When the unseen fraction is smaller, the previous lower honest
weight remains unchanged. Honest time share is separately capped at0.75, retaining
at least a quarter of the comparison budget for4096-node-cap exact sampled search.
Above8, both honest weight and time share remain1 and no exact search runs.

Both schedules retain identical paired fillings, progress scores, paired2SE margins
and the primary fallback. Exact results remain conditional on guessed fillings.
Unknown actual pictures and roles are never copied into policy or memory. Caps are
unresolved. No lower baseline or relaxed guard gate is introduced.

Controls exercise every remaining-board fraction at0/1/7/8/9 unseen alive pictures,
removed unknowns, identical fillings and two schedules. A cooperative clock test
makes honest evaluators consume their allocation and confirms at least248 of992
available milliseconds remain available to exact work in both schedules. A separate
conflicting-signal control keeps a larger honest progress advantage from being
erased by the small speculative exact component at high unseen fractions.

Run the complete48-case screen for each frozen32x1/12x16 profile. These are candidate
settings; choose only after the higher-than24 total and paired guard-loss gate pass.
Full155 and the one-time unseen20 remain required before completing the goal.
