# Verified fixed-board compatibility

Versions1.56 and1.57 reuse1.55 fixed boards, not merely similar difficulty. The normalized-LF
source of all three table dependencies is identical to release commit`bc0c63f` (1.57):

| Local1.55 source | Released source | SHA256 |
| --- | --- | --- |
| `tables/levels-1.55.js` | `source/www/levels-hard.js` | `70e9b955264db64768a6b920156cef3b313e13fd4fe458f473b6a34423783d46` |
| `tables/early-1.55.js` | `source/www/levels-early.js` | `d130573126dc853e29faf103e900256731f86309af9e2033966de6aabf7e470a` |
| `tables/hard-1.55.js` | `source/www/hard.js` | `90f79dbafbc9a81789594df9650f3a9235bb73dc0358aa90eca8baf6c5369175` |

Version1.58 is now independently verified from immutable upstream commit
`0514e550c7a77e8ecba19e7a41228e1ceb396266`. Its core/released version is1.58; all218 fixed
normal-track boards51,53-269 reproduce exact board IDs, physical neighbors and ice neighbors
against1.55. Downloaded source bytes match Git blob IDs. The complete comparison, including the
pre-alias sources, is retained in `app158-compatibility-2026-10-18T15-40-59-893Z` (22 files).
This is a full fixed-table comparison, not an assumption from a single recording of150.

Release instructions explicitly preserve boards for1.56-1.58. `board_versions.js`
maps only these verified versions, plus the existing1.54 alias, to1.55. Unknown later versions
are not guessed compatible. Fixed early levels must never silently fall back to classic boards.
Actual recorded board identity remains the authority for prospective scoring. Compatibility
does not rewrite any old forecast number, miss, opening timestamp or original cohort clock.
