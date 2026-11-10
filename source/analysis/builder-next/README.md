# Builder rebuild experiments

G10 continues the construction/planning experiment after the B3 skilled solver
review. Implementation is under `source/tools/builder-next/`.

Keep a simple record of requested difficulty, construction choices, actual
ratings, repairs, failures and CPU cost. See
[Task G10](../builder/gemini-tasks/TASK-G10-reliable-level-builder.md).

The lead's first B3-based pilot is frozen in `b3-pilot/`. It made zero hits in
16 trials: the old visible component bodies remain too easy for the stronger
skilled bot. Read its report before assuming G9's old skilled calibration still
holds. G9's full original implementation/report remain on `wip/gemini-builder-rebuild`.
