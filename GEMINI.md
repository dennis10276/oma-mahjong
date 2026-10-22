# Gemini: your only assignment (Dennis, 22 Oct 2026)

This file replaces every earlier instruction for this folder: GEMINI_NEXT_WORK.md,
TELEMETRY_DISCOVERY_TASK.md, ACCEPTANCE_PROTECTION.md, ACCEPTANCE_REVIEW.md,
source/analysis/personal-bots/acceptance/EXECUTION_CONTRACT.txt, the RTMs and the acceptance gates.
Those files stay as history only. Do not execute them.

/goal Personal player bots that predict each family member's winning try, proven on locked predictions

GOAL
For Dennisisdebeste, Mrs. Doubtfire, PUK and Gerda: one personal bot per person that plays upcoming
levels like that person does, including retries and what they remember from lost tries. Many
simulated campaigns on the real board give a distribution of the winning try; that distribution
gives the prediction. No separate count predictor, no manual adjustments, no per-person thresholds.

Milestone 1: beat the plain guess "always 1 try" for every person.
Done: for every person, one model version gets at least 16 of its first 20 locked levels right.

THE ONLY SCORE THAT COUNTS
The "Voorspeltest" card on https://dennis10276.github.io/oma-mahjong/dash/
- Correct = exact for 1-3 tries, ±1 for 4-5, ±2 for 6-7, or both 8 or more.
- A prediction counts only if it was locked in Firebase before the person first opened that level.
- Only tries from the person's own known device in a normal app session count. Anything else shows
  as "niet geverifieerd" and is left out. Only Dennis approves a new device.
- Each model version is judged on its own levels (its first 20 opened levels per person).
  Gaps inside a model's run of levels show as "overgeslagen".
Your own files, ledgers, hashes, RTMs and reports are not evidence. Copy numbers from the card.

HOW TO LOCK A PREDICTION
PUT https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app/forecasts/<pid>/<level>.json
body: {"p": <1-8, 8 = 8 or more>, "t": {".sv": "timestamp"}, "by": "gemini", "model": "<version>"}
Several new levels at once: PATCH .../forecasts/<pid>.json with {"<level>": {...}, ...}
- One write per level, ever. A refused write means that level is already locked.
- Lock unbroken runs of each person's next unopened levels. Never skip a level that looks hard.
- Lock a full block of 20 levels per person with one model version before switching versions.
  A new version starts at the next unlocked level. Old blocks stay on the card.
- Players move on every day, and every level opened before its lock is lost for the test.
  Lock block 1 today with your best current model, then improve for the next block.
Player ids: Dennisisdebeste pmuy78xu6tsths9 · Mrs. Doubtfire pmv16kj3jr35750 ·
            PUK pmv2gaa0g00eq3q · Gerda pmv6yhzz3x9oxs8
Status 22 Oct 23:30: Dennisisdebeste is on 157, Mrs. Doubtfire finished 126, PUK is on 58,
Gerda is on 109. Check Firebase right before locking: next level = highest opened level + 1.

DATA
- Get fresh data only from Firebase: plays/ (every event), replays/ (recorded games, last 30 days),
  scores/. All publicly readable.
- The tools read the local copy in source/analysis/archive/realdata/ (refreshed by Claude on
  22 Oct 23:35). Refresh it yourself before every analysis and right before locking, for example:
    curl -o source/analysis/archive/realdata/plays.json https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app/plays.json
    curl -o source/analysis/archive/realdata/scores.json https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app/scores.json
  (PowerShell: Invoke-WebRequest <url> -OutFile <file>). Old copies are why you thought no new games
  existed after 20 Oct.
- Everyone plays the same boards (since 1.55, unchanged through 1.59). Use the game code in
  source/www (hard.js, layouts.js) for the physics.
- Train only on games already played. Results of locked levels may improve later versions;
  they can never change a locked prediction.

FORBIDDEN
- Writing anything to Firebase except new entries in forecasts/. Never touch plays/, scores/,
  replays/ or hearts/, and never write test data under real players.
- Editing the dashboard, forecast-score.js, the Firebase rules or AGENTS.md of the main repository.
- Calling your own work "complete", "verified", "passed" or "certified".

STOP DOING
- TELEMETRY_DISCOVERY_TASK.md, local file inventories, protected verifier packages, administrator
  installs, and RTM/acceptance-gate bookkeeping. This goal replaces GEMINI.md's old content and
  GEMINI_NEXT_WORK.md.
- Keep the old local ledgers v2-v8 as an archive. Don't make new local ledgers.

HOW TO WORK
1. Pull fresh Firebase data. As a starting point (not a test result), score the old v2-v8
   predictions and "always 1 try" on games already played.
2. Today: lock block 1 (the next 20 levels per person) with your best current model.
3. Between blocks, improve each person's bot: pace, flipping tiles, tray risk, the clock, retries
   and memory. Check changes on older held-out games of that person.
4. Report once a day or after each block, max one screen: per person and model, the card numbers
   next to "always 1", what you changed, and what you'll try next.
5. Small commits on wip/agy-personal-bots. ../personal-bot-review stays read-only.
