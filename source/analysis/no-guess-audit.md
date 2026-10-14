# Solvability and guessing audit

**Conclusion: all 190 pending levels 80–269 are provably beatable. A guarantee that every level can be solved purely by deduction has NOT been established. This audit also does not establish that guessing is unavoidable.**

The game, level files, rules and live app were left unchanged. Only offline audit scripts and reports were added. No player reset, deployment, installation or publication was performed.

## What is proved

Every pending board has a complete winning removal sequence. Each was replayed against the legal-move rules, including the four-slot tray, ice, locks and the clock deadline: **190/190 passed**. The saved published 1.49 boards were checked independently against the same legality rules: **190/190 passed**.

These are existence proofs. The route finder knows hidden identities, so these proofs do not establish that a first-time player can deduce the route.

## Fresh measurements

The existing focused player ran **1,024 new games per pending level**, on seeds independent of level selection: **194,560 games** and **5,266,048 decisions**. There were **59,120 wins**.

For this audit, an *unknown-partner selection* means deliberately choosing a single tile when no matching face is known in the tray or elsewhere on the board. It does **not** mean the move is necessarily a guess: parking a tile can be a logically safe way to reveal information. Conversely, choosing between known pairs can still require uncertain foresight.

- **199,296 decisions (3.78%)** selected a tile with no known partner.
- **7,882 wins (13.33% of wins)** contained no such selection.
- These wins occurred on **39 of the 190 levels**.
- For the remaining **151 levels**, this bot did not produce a win without such a selection in the sample. That is not a proof that no such route exists.

| Pending level | Wins / 1,024 games | Wins with zero unknown-partner selections |
|---|---:|---:|
| 80 | 656 | 0 |
| 85 | 658 | 0 |
| 86 | 594 | 83 |
| 100 | 454 | 0 |
| 120 | 315 | 0 |
| 150 | 298 | 0 |
| 200 | 256 | 0 |
| 269 | 176 | 0 |

The fresh sample is descriptive, not a replacement for the existing larger difficulty calibration. In particular, a bot's win percentage is not the probability that a human must guess.

## Searches for stronger evidence

A separate bounded search sought routes in which every deliberate removal has an identified matching partner. It simulates actual face-down peeks, memory and automatic peek matches. The matching partner can be blocked; it need not be immediately removable. This condition is more restrictive than sensible play and is not equivalent to a no-guess strategy. The search can also use hindsight to find the route order.

| Visibility assumption | Verified routes meeting this restricted condition | Hit 30,000-node limit | No route under this restricted policy |
|---|---:|---:|---:|
| Only fully uncovered face-up faces known | 0 | 24 | 166 |
| All face-up identities granted known, even when covered | 37 | 141 | 12 |

The second model intentionally gives the player extra information. Its 37 certificates are conditional witnesses, **not certificates of actual no-guess play**. Failure in either model is not proof of unavoidable guessing: the fixed free-inspection order and the known-partner requirement exclude other legitimate strategies. Search limits are explicitly inconclusive.

An exact AND/OR information-state search additionally checked **256 individually solvable hidden-tile alternatives each for levels 80, 86 and 150**. Every alternative preserved tile counts, geometry, visible face-up identities, ice, locks and clock. All had independently validated full winning witnesses. In each finite set, the search found a strategy that can adapt to free observations and win every alternative. This is positive evidence that an unseen partner need not make a move a guess. It is **not** a universal proof: the alternative set is finite, and this search grants all face-up identities plus non-removing free peeks.

## Visibility and actual game checks

Tapping a blocked tile can temporarily make its covering tiles transparent without using a move. A free face-down tile can be inspected without using a move unless it automatically matches a tray or peeked tile; an automatic match counts the tiles removed. Thus treating every covered face as permanently unknown would exaggerate uncertainty.

The conservative search does not depend on x-ray. The optimistic search grants more visibility than x-ray can guarantee. Actual browser checks found some initially face-up tiles could not be tapped directly, so it would be wrong to assume universal inspection merely because x-ray exists.

Four conditional winning tap sequences (82, 86, 104, 267) were replayed through the actual game handler with an isolated fake player and fake database. All cleared the board, matched the predicted removals and move counts, and used reachable action targets. This validates the tap simulation, **not the ability to identify every partner used by the optimistic certificate**.

## Audit validation and reproducibility

Eight audit checks passed, including rejection of invalid/incomplete certificates, automatic peek matching, and correct handling of computation limits. A separate ten-tile fixture has two indistinguishable, individually solvable boards requiring opposite first moves. The exact information search correctly proves that no observation-only strategy can guarantee winning both. This demonstrates that the audit can detect a real guessing trap; that fixture was not added to the game.

Source hashes match those recorded before the audit. No production files changed.

Run from the project root:

```powershell
node tools/sim/audit_information.js 30000 all uncovered
node tools/sim/audit_information.js 30000 all all-face-up
node tools/sim/measure_information.js 1024
node tools/sim/audit_guaranteed.js 80 256
node tools/sim/audit_guaranteed.js 86 256
node tools/sim/audit_guaranteed.js 150 256
node tools/sim/check_information_audit.js
$env:CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe'
node build/audit_information_ui.js
```

Raw results and certificates are in `information-measurement.json`, `information-audit-uncovered.json`, `information-audit-all-face-up.json`, `information-guarantee-80.json`, `information-guarantee-86.json`, `information-guarantee-150.json`, `information-ui-check.json` and `information-audit-checks.json` alongside this report.

To claim a universal no-guess guarantee, a further proof would need an observation-based strategy that succeeds for every relevant solvable hidden arrangement consistent with the real UI observations, accounting for memory, inspection and inference. This audit does not substitute a known winning sequence or a bot success rate for that proof.
