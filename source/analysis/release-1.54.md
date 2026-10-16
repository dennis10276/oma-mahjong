# Release 1.54

Dennis authorized publication on 2026-10-16 after reviewing the local level-92+ reorder.
This supersedes the original instruction to leave that work unpublished.

- Levels 1–91 are unchanged. The 178 existing boards from 92–269 are moved exactly once,
  preserving pictures, hidden tiles, specials, clocks and solution witnesses. Large boards
  remain at every tenth level. The order uses both fitted personal models and retries.
- Generation-7 saved games through 91 still resume. The reordered range uses generation 8
  and rejects an old saved board at its replaced level number. Stars and progress stay intact.
- The reviewed four-person forecast draft is bound to 1.54. The old 1.53 forecast is retained
  verbatim as `source/site/dash/predict-1.53.json`. The dashboard selects the matching version
  and does not compare old 92+ results with replacement boards. Sample counts are shown correctly.
- Dashboard column/readability fixes published concurrently through main commit 9539a1a are retained.
- No database rules change or player reset is needed.

Validation: the prior implementation passed 125/125 offline tests. Release preparation adds
a version-selection regression covering old clients, update transitions, historical results,
and unsupported versions. The complete suite must pass before the signed APK/site release.
