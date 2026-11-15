# Task 19 review pack

Dennis's manual [tile placement lab](http://127.0.0.1:8269/) now covers all eight
remade and 32 unresolved ordinary boards, using Sunflower tiles. See
[its handoff and user-data location](placement-lab/README.md). Its saved arrangements
are separate from the accepted drafts below and from QA data.

Only the root `level-*.json` records with `certificate.ok === true` and matching
before/after design hashes are accepted drafts. No board is adopted or released.
The six tenth levels stay exactly as released; there are no tenth-level drafts here.

Start with [REPORT.md](REPORT.md) and [summary.json](summary.json). The local
[before/after lab](http://127.0.0.1:8268/) uses the held `3b188bcd` renderer and
its proposed tray spacing on a 392×730 phone, with an explicit 58 px review floor.
The regular builder/export minimum remains 60 px.

`held/` contains three **rejected** historical drafts, retained for regression tests:
253 hides a previously clear lock badge, 258 hides a key badge, and 293 changes an
authored wrong move. Do not copy them into a level sequence. The old freely
repacked `../range-250-300.json` drafts are also not adopted.

`contexts/` contains exact historical role recovery, matched to released geometry,
clock ID and obstacles. The construction replay predates automatic compaction;
the proof of the final board receives no exemption. No ignored pool files are
needed to recheck the accepted historical boards now that the contexts are saved.

`certification.jsonl` and `task19-search.jsonl` are append-only work logs. They
include failed and provisional attempts; they are not acceptance lists. The final
records and `summary.json` supersede those intermediate statuses. Search failure
means no passing result from the bounded methods tried, not impossibility.

`browser.json` binds every browser-loaded board to its design hash and reports
both stored-route wins and renderer measurements. `screenshots/` has a phone
before/after pair for every narrowed level. Test findings/replays were intercepted;
the lab server saves Dennis's later observations beside its ignored lab folder.
