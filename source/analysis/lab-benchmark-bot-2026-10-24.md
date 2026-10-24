# Codex's human-information bot on the lab boards (2026-10-24, quick run)

Bot: `wip/personal-bots` at 53f413b (Dennis's computer, `personal-bot-review`), run unchanged in a
separate copy with the settings of its latest complete run (130/140: research control + `passiveInformation:
'shortRoles'`), up to 12 tries per board. Boards: `analysis/lab-benchmark.json`. Pass = Dennis 1 try -> bot 1,
else bot fewer than Dennis (the bot's own rule).

| lab board | Dennis | bot | how the bot's tries ended |
|---|---|---|---|
| 11 locks in plain sight | 2 | - | tray full at 82 tiles left, 12 times the same |
| 12 the clock is locked | 6 | - | tray full at 76 left, 12 times the same |
| 15 chain of ice | 11 | 2 | clock, then won |
| 31 chain reaction | 2 | not run | the bot refuses tiles with two roles (this board has one) |
| 32 partners behind locks | 5 | - | tray full at 58 left, 12 times the same |
| 33 blind dig | 5 | - | tray full, then the clock 11 times at 68 left |
| 41 clock in sight, keys buried | 7 | - | tray full at 52 left, 12 times the same |
| 42 don't grab the clock | 4 | 3 | tray, tray, won |
| 44 room in the tray | 1 | 1 | won |
| 45 room in the tray, locked partners | 6 | - | tray full at 54 left, 12 times the same |
| 46 room in the tray, frozen partners | 1 | 1 | won |
| 47 the key to the way out | 1 | 1 | won |
| 48 the frozen key | 2 | 1 | won |
| 49 ice, lock, then the clock | 2 | 2 | tray, won (equal: not a pass) |
| 52 ice, lock, then the clock (tight clock) | 3 | - | the clock at 65 left, 12 times the same |
| 53 partners behind locks (tight clock) | 2 | 1 | won |

7 of 15 pass, 1 equal, 7 never won (and 1 not run). Where it loses, it loses the same way every try:
on these boards a lost try does not change its next try.
