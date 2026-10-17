# Help messages in Live verloop (1.57)

Record the actual ice, key/lock, tray-pair and alarm-clock explanations when
their modal becomes visible. Show their exact localized title and body in the
dashboard feed, with time to the second, level, attempt, language and reason:
first explanation, retry reminder (including failure count), manually opened
help, or clock timeout. No explanation is inferred from a loss or seen flag.

The player pressing Got it produces a separate acknowledgment event; timeout
buttons distinguish Retry and Menu. This records the actual button press,
without claiming the explanation was read or understood. A stable message ID
connects display and acknowledgment. Manual help from home is not attached to
an old attempt. Expanded dashboard messages survive live refreshes, and all
stored text is escaped before rendering.

Events use `plays/<player>` with `k: 'help_msg'`, scalar metadata and numbered
`m0`, `m1`, … text chunks. Each string is at most 40 UTF-16 units, without
splitting surrogate pairs, so the existing Firebase rules and offline upload
queue continue to work. No Firebase-rule change is needed. Animation frames
are not feed events. Historical explanations from older apps are not invented;
logging starts when a phone updates to 1.57.

Tests cover exact Dutch/English text, rule-compatible fields, acknowledgments,
actual retry and timeout paths, manual home help, safe dashboard rendering,
timestamps, preservation during live refresh, and phone-width wrapping.

Boards and prediction numbers are unchanged. The 1.56 prediction file is
archived and kept available to older clients; current metadata supports 1.57.
