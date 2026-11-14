# Local lab smoke check

14 November 2026 at 20:20 (Europe/Amsterdam).

- Eight distinct boards render, two per yielding idea, with plain-name card titles.
- Played lab 350 (id 193895334) using the visible route button: six taps saved the clock with deadline seven; the UI showed “Op tijd!”.
- Restart worked. The server received the game's own replay journal, including the six taps and the restart event, plus the current-state snapshot.
- Server: unchanged bank/lab_server.js from c582db46, bound only to 127.0.0.1:8266 (PID 20632).
- Unknown test-player ratings were removed from the generated lab copy. No bot rating is displayed.
- The smoke attempts listed in LAB_QA.json are agent QA, not Dennis's playtesting; exclude them when interpreting tries. No stars or difficulty verdict was entered.

Replay file: source/build/new-ideas-lab-replays.json (local, outside the lab folder). Screenshot: LAB.jpg.
