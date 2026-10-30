# Human phase-target audit: clarification required

The active goal's targets are unchanged. The event evidence conflicts with part
of their stated rationale; fitting deliberate failures to that mismatch would
not make a faithful personal simulator. A user question is pending.

## Meaning of clock events

In source/www/js/board.js:675, clockMove emits logLvl('clock') when i equals the
clock tile being removed. It means the clock was saved. ml=0 is a saved clock on
the last available move. Expiry instead calls endLevel('stuck',{ck:1}) at:685.
A clock-save event before a terminal tray loss proves the clock was already gone.
A missing save event alone does not prove expiry: retain phase uncertainty.
The tm field is maximum tray occupancy (board.js:431), not terminal tray size.

## Fresh read-only evidence

Snapshot: .codex-runs/human-style/milestone2/human-phase-audit/.
Only GET requests were used. The exported event audit stops each level at its
first observed win and excludes subsequent replays; incomplete attempts, missing
levels, duplicate terminal records and unproven phases are reported separately.
No level164 result is used; the calibration range remains92-163.

| Dennis level | Observed natural episode | What the clock log proves |
|---|---|---|
|132|Two tray losses,one later restart,then win|Clock saved before all three losses; first two fill tray on the clock-removal move|
|135|First-try win|Clock saved with zero remaining moves; no recorded failed natural attempt|
|142|First-try win|Clock saved with one move remaining; no recorded failed natural attempt|
|144|First-try win|Clock saved with zero remaining moves; no recorded failed natural attempt|

This does not support a requirement that Dennis fail135/142/144 mostly before
the clock. Calling132 a clock-access tray failure is understandable, but that
is distinct from the currently specified before-clock phase.

Across Dennis's71 observed levels there are58 completed losses:14 explicit
clock expiries,42 losses after a saved clock,2 unproven phases. Thus before-clock
share is bounded24.14-27.59% in these records, not55-60%. Seven losses occur on
the clock-removal move. Level98 is missing;5 starts lack terminal records and
are censored;23 groups after first wins and24 daily-mode events are excluded. The bounds do not pretend
this is complete human history or silently count missing ends as losses.

| Person | Completed losses | Before-clock known / unknown | After-clock known |
|---|---:|---:|---:|
|Dennis|58|14 /2|42|
|Mrs. Doubtfire|145|50 /18|77|
|Gerda|495|168 /47|280|
|OmaHanny|61|0 /61|0|

OmaHanny's events lack the necessary clock evidence, so all61 phases remain
unknown. Player ranges, boards, completeness and rules/settings differ; these
counts must not be pooled into a confident universal family percentage.

Mrs. Doubtfire does have substantial before-clock losses on132/135. The pattern
is therefore person-specific, not something to impose identically on both bot
settings. Her144 losses include21 proven after-clock,6 before-clock,4 uncertain.

## Reproduce

Run source/tools/sim/refit/human_event_phase_audit.js with a saved plays JSON
and a new output filename. The pure audit has tests for saved-last-move clocks,
actual expiry, clock-removal tray loss, replay exclusion, missing ends and phase
bounds. Input files remain raw artifacts outside the source commits.

The requested decision is whether to replace the phase/difficult-level targets
with audited person-specific ones, retaining the existing first-try and factory
gates. Until answered, calibration reports show the original gates as written;
no human-v1 release or completion is claimed.

Decision received2026-10-29: Dennis approved replacing the incorrect pooled
phase/case targets with separate audited targets, retaining first/factory gates,
reporting clock-contact separately and repairing142. Current contract/results:
HUMAN_PHASE_V2_CONTRACT.md and HUMAN_PHASE_V2_PROGRESS.md. No further approval
for that change is pending.
