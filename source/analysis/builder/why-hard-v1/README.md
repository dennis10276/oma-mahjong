# Task11 — reference complete; candidate re-rating in progress

**Checkpoint, not the final handback.** Branch: `wip/codex-why-hard`.

The complete60-board reference error study, all16 brutal both-visible-key
opening checks, per-board human/bot interpretations and three numbered
phone-checked playable diagnostics are in `reference/`. The primary builder v3
ladder is in `v3-reference/`:252 requests,210 readable outputs,148 physical
boards,444 full valid measurements, all exact cache hits. Stored witnesses and
all structural proof inputs matched the earlier readable outputs, so their
proofs were reused with a verification manifest.

All342 inherited human-fit checks passed: weighted family MAE2.081212→2.079394;
planner live1.009367 unchanged; exact lab24 point-label MAE1.945417 unchanged.
`reference/fit/FIT.md` distinguishes the different datasets and censored plays.
The explicit candidate is `family-key-memory-v1`; the released default remains
unchanged and there is no candidate cache migration. The kept20 family
re-rating is already complete:15/20 remain within±1 versus20/20 reference.
The rest of the284-board/852-measurement study is still running.

Read `reference/ERROR-PROFILES.md`, `reference/HUMAN-VS-BOT.md`,
`reference/KEY-MEMORY.md`, `reference/EXAMPLES.md` and
`v3-reference/WAY-LADDER.md`. The results-folder
`reference/playable-examples/` contains the complete local game. All three
stored routes win in the actual game, on a390×820 phone. No external requests,
game-table changes, Firebase writes, slot claims or release.

The top-level Part0 files and the text below are historical checkpoints.
The final candidate memory comparison, complete regression log and plain
summary are pending. Use the folders above for completed reference findings.

## Historical pre-run plan

These are frozen inputs, not completed findings. The live run is under
`source/build/why-hard-v1`; see `source/build/TASK-11-RUNNING.md`.

The trace sample contains24 easy, all12 available middle-band, and24 brutal
Task10 boards. Actual frozen keys are excluded, including the chainReaction
mechanism. Stories and distinct puzzle structures/layouts are balanced within
each band. Previous full ratings define the bands; sampled traces do not
replace those scores. Both planner styles are traced, and the earlier full
measurement determines which style represents the standard skilled player.

The ladder fixes six story/layout pairs, requested way9–15, three construction
seeds and spare1/2. Spare2 changes only the exact clock timer; forced pressure
is recomputed. Of252 requests,212 constructed boards had winning witnesses;
26 additionally failed the existing readable-objective screen, despite zero
hidden planned-dig tiles. The186 readable requests contain128 distinct physical
boards:384 full profile/seed measurements after deduplication.

The full ladder protocol is the requested outcome, so it is not stopped early.
Trace collection samples two campaigns per style, retaining retries through20
because memory and persistent errors are study outcomes. Information-only peeks
are separate from takes/automatic pairs. Engine unknowns are never losses, and
later all-losing states are separated from the first irreversible error.

Task11 measures what builder v3 needs to control. It does not alter the builder,
bot, game rules or published level table. No boards are built just for slots.
Any incidental in-band result must still pass all existing qualification,
originality, fresh-seed, curve-window and preview requirements.
