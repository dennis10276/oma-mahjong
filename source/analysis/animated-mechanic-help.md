# Animated tile explanations

Approved for release by Dennis on 2026-10-17, with ice above/below demonstrated
explicitly and Hint/Shuffle removed from the clock explanation.

Ice, keys/locks, the alarm clock and the face-down pair trick now have small
four-step demonstrations using the game's own tile pictures. Each loops in
9.6 seconds with pause/replay controls; reduced-motion users start paused.
The examples run entirely locally and never change the player's board or moves.
The wording and captions are available in Dutch and English.

Rules explained:

- Ice counts touching tiles beside, above, on top of and below it; the Dutch
  explanation explicitly lists "ernaast, erboven, erop én eronder". One or two
  of these tiles must actually be removed from the board. Peeking
  does not melt it, and the thawed tile still needs to be free.
- Both marked key tiles must leave the board. The first key leaves locks shut;
  the second opens all locks. An unlocked tile still needs to be free.
- The clock counts removed tiles, not seconds: one tile costs one move and a
  pair costs two. Peeking and blocked taps are free. Taking the clock
  tile stops it; its twin can wait. The final allowed move is safe.
- With three tray slots occupied, peek at a free face-down tile first, then
  tap a free matching tile. Both disappear without using another slot. Taking
  the peeked tile instead would fill the fourth slot and lose.

First encounters retain the existing seen flags. New ice/key explanations wait
for acknowledgment before saving the flag. The new tray-pair explanation is
introduced on level 50, after any unseen obstacle lesson has been acknowledged
on an earlier start; players beyond 50 learn it through reminders or manual help.
Clock explanations still appear on the first clock level and every timeout,
now with the animation.

On fresh level attempts with at least three recorded failures (`S.fails`), show
one relevant reminder before play. Rotate through ice, keys, face-down pairs,
and clocks as failures accumulate, including only mechanics on that level.
The tray-pair reminder is also available below level 50 when face-down tiles exist.
Resuming an unfinished attempt does not trigger another reminder. Existing
failure counting (including manual restarts) and clearing it on a win are kept.
An unseen first-use lesson takes priority over reminders, and only one lesson
opens per start. All four can be reopened from Settings → How to play → Tile tips.

Verification: `t_tile_help` exercises acknowledgment, third-loss rotation,
resume behavior, pause/replay, reduced motion, both languages at 360×640, no
mutation of the live game, and the actual three-slot pair/fourth-tile loss.
`t_clocks` checks complete timeout explanations and small-phone buttons.
The first full offline run finished with 130/131 passing (330 seconds), including
all new lesson checks and all existing clock/mechanics/gameplay checks. The
remaining check compared Windows CRLF text with generated LF text. The builder's
check now normalizes CRLF before comparing, without changing level data. The
complete suite is run again for the release.

No levels, difficulty or live player data are changed. Publishing updates the
game files and builds a fresh APK with the existing signing certificate.
