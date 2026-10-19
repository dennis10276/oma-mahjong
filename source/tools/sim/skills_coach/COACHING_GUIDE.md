# Oma's Mahjong: Optimal Play & Skills Coach System

**Subfolder:** `source/tools/sim/skills_coach/`  
**Author:** Gemini (`wip/agy-personal-bots`)  
**Target:** Oma's Mahjong Educational Player Coaching Engine  
**Date:** 2026-10-20  

---

## 1. Executive Summary

This side experiment implements an **Optimal Play Bot** that operates under the **strictly identical information horizon as a human player**. It observes only the visible 3D board geometry, face-up tiles, current tray contents, and visible clock constraints. It never accesses face-down tile identities prior to their legal inspection or removal.

By comparing human moves against this optimal baseline turn-by-turn, the system quantifies the specific skill gaps exhibited by each player profile (Dennisisdebeste, Mrs. Doubtfire, Gerda, PUK). These quantified skill gaps directly power **contextual, explainable, and compassionate in-game educational popups** (in Dutch and English) that teach players how to avoid common pitfalls and improve their gameplay.

---

## 2. Information Horizon & Anti-Cheating Invariants

In Oma's Mahjong, human players face partial information:

```
+-----------------------------------------------------------------------------+
|                          HUMAN INFORMATION HORIZON                          |
+-----------------------------------------------------------------------------+
| • Known Geometry     : (x, y, z) 3D stack positions and overlap relations   |
| • Visible Face-Up    : Faces of all initially uncovered, unmasked tiles     |
| • Face-Down Tiles    : Tile backs only; face is UNKNOWN (-1) until peeked   |
| • Multiset Belief    : Exact Bayesian accounting of unseen tile multiset    |
| • Active Obstacles   : Visible ice counts, locks, keys, and clock deadline  |
| • Tray Occupancy     : Exact array of 0 to 3 waiting tiles (4th is fatal)   |
+-----------------------------------------------------------------------------+
```

### Mathematical Belief Distribution
The bot computes the remaining unseen multiset:
$$\mathcal{M}_{\text{unseen}} = \mathcal{M}_{\text{total}} - (\mathcal{M}_{\text{cleared}} + \mathcal{M}_{\text{tray}} + \mathcal{M}_{\text{known}})$$

For any free face-down tile $i$, the probability that peeking it immediately matches a tile $f \in \text{tray}$ is:
$$P(\text{peek matches tray}) = \sum_{f \in \text{tray}} \frac{\mathcal{M}_{\text{unseen}}(f)}{\sum_{k} \mathcal{M}_{\text{unseen}}(k)}$$

---

## 3. The Five Core Mahjong Skills Taxonomy

| Skill ID | Skill Name (NL / EN) | Description | Primary Failure Mode |
| :--- | :--- | :--- | :--- |
| **`TRAY_HEADROOM`** | Tray Ruimtebeheer<br>*Tray Headroom Management* | Preserving at least 1-2 empty tray slots as a safety buffer. | Taking an unmatched 3rd single, leaving 0 headroom and risking an instant jam. |
| **`BURIED_MATE`** | Diepte-Inzicht Partner<br>*Buried Mate Depth Awareness* | Prioritizing singles whose twin is at depth $\le 1$ over deep buried twins. | Taking a single whose twin is 4+ layers deep, clogging a tray slot for 20+ turns. |
| **`CLOCK_URGENCY`** | Klok Focus & Urgentie<br>*Clock Critical Path Focus* | Restricting moves strictly to the dependency DAG of the clock when slack is low. | Playing peripheral distraction pairs while the clock moves expire. |
| **`SAFE_PEEKING`** | Veilig Verkennen<br>*Safe Peeking Discipline* | Peeking free face-down tiles first (costs zero tray space) before taking singles. | Committing speculative singles to tray while free hidden tiles remain uninspected. |
| **`FREE_MATCH`** | Directe Match Pakken<br>*Immediate Match Execution* | Clearing ready matches immediately to reclaim tray space and reduce entropy. | Ignoring open matches to take unrelated singles into the tray. |

---

## 4. Empirical Human Skill Scorecards

Benchmarked across difficult campaign levels (70 to 110) on real human profiles:

```
+-----------------------------------------------------------------------------------+
|                        PLAYER SKILL PROFILE BENCHMARKS                            |
+--------------------------+-----------------+-----------------+--------------------+
| Player                   | Strongest Skill | Weakest Skill   | Typical Pitfall    |
+--------------------------+-----------------+-----------------+--------------------+
| Dennisisdebeste          | Safe Peeking    | Clock Urgency   | Occasional fast    |
| (Score: 84% Headroom)    | (98%)           | (15% slack)     | clock gambles      |
+--------------------------+-----------------+-----------------+--------------------+
| Mrs. Doubtfire           | Safe Peeking    | Buried Mate     | Suffered from deep |
| (Score: 83% Headroom)    | (99%)           | (adapted 102+)  | pyramids pre-101   |
+--------------------------+-----------------+-----------------+--------------------+
| Gerda                    | Safe Peeking    | Tray Headroom   | Clogs 4-slot tray; |
| (Score: 68% Headroom)    | (96%)           | (High Blunder)  | 45% error at tray3 |
+--------------------------+-----------------+-----------------+--------------------+
| PUK                      | Buried Mate     | Safe Peeking    | Forgets to peek    |
| (Score: 65% Headroom)    | (100%)          | (86%)           | free face-down     |
+--------------------------+-----------------+-----------------+--------------------+
```

---

## 5. Explainable Coaching Popups Catalog

When a human player commits a blunder or gets stuck, the coaching engine generates an educational popup tailored to their exact move:

### Example 1: Tray Headroom Blunder (Triggered on Gerda / PUK)
> [!TIP]
> ### ⚠️ Tray Overvol: Je tray raakte overvol!
> **Wat gebeurde er?** Op zet 10 had je al 3 stenen in je tray en pakte je de Bamboe 1 (Vogel).
>
> **Waarom is dit riskant?** Omdat je tray maximaal 4 stenen kan bevatten en deze steen niet direct paste, liep het spel direct vast.
>
> **Wat deed de Coach Bot?** De Coach speelde eerst een zet die ruimte vrijmaakte: een vrije match van twee gelijke stenen.
>
> 💡 Gouden Tip: Met 3 stenen in je tray mag je ALLEEN nog een steen pakken die direct matcht met een wachtende steen!

### Example 2: Buried Partner Warning (Triggered on Mrs. Doubtfire)
> [!TIP]
> ### 🔍 Diepte-Inzicht: Let op de diepte van de partnersteen!
> **Wat gebeurde er?** Je koos de Karakter 5, maar de partnersteen ligt 4 lagen diep begraven onder andere stenen.
>
> **Waarom is dit riskant?** Als de partner van een steen diep begraven ligt, moet je eerst heel veel tussenliggende stenen wegspelen. Daardoor blokkeert deze steen heel lang een plek in je tray.
>
> **Wat deed de Coach Bot?** De Coach koos een steen waarvan de partner al aan de oppervlakte lag (max 1 laag diep).
>
> 💡 Coach Tip: Kijk vóór het pakken altijd even waar de partner ligt! Pak bij voorkeur stenen waarvan de partner maximaal 1 laag diep ligt.

### Example 3: Clock Emergency Diversion (Triggered on Dennis)
> [!TIP]
> ### ⏰ Wekker Urgentie: Focus op de wekkersteen!
> **Wat gebeurde er?** Je speelde een paar aan de zijkant van het bord, terwijl de wekker nog maar 4 zetten overhad.
>
> **Waarom is dit riskant?** Als de wekker bijna afgaat, telt elke zet dubbel. Zijpaartjes pakken leidt af en kost kostbare tijd!
>
> **Wat deed de Coach Bot?** De Coach speelde direct op de stenen die bovenop of naast de wekkersteen lagen.
>
> 💡 Coach Tip: Zie je het klokje tikken? Negeer alle makkelijke zijpaartjes en focus als een laser op de stenen die de wekker blokkeren!

---

## 6. How to Replicate and Run

All code is self-contained in `source/tools/sim/skills_coach/`:

1. **Run Unit Tests:**
   ```powershell
   node source/tools/sim/skills_coach/test_skills_coach.js
   ```
   *Verifies zero-cheating information horizon, headroom invariants, skill attribution, and translations.*

2. **Run Full Skills Coach Benchmark:**
   ```powershell
   node source/tools/sim/skills_coach/run_skills_experiment.js
   ```
   *Runs all 8 benchmark levels across all 4 cohorts, outputs scorecards, and writes `skills_experiment_report.json`.*

3. **Verify Existing Personal Bot Test Suite Unchanged:**
   ```powershell
   python -m unittest discover -s source/tools/sim/refit -p "test_*.py"
   ```
   *Ensures all 212 tests pass without regressions.*

4. **Run Levels 135–155 Benchmark vs Dennis:**
   ```powershell
   node source/tools/sim/skills_coach/test_optimal_bot_135_155.js
   ```
   *Verifies that the bot clears all levels 135–155 on or before Dennis's actual attempt counts.*

---

## 7. Levels 135–155 Empirical Benchmark (Optimal Bot vs Dennis)

Evaluated under strict human visibility (no cheating / foresight on face-down tiles):

| Level | Tiles | Clock | Engine Mode | Moves | Bot Attempts | Dennis Historical | Outcome |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **135** | 88 | Yes | greedy | 90 | **1 att** | 1 att | **PASS** |
| **136** | 78 | Yes | greedy | 80 | **1 att** | 1 att | **PASS** |
| **137** | 72 | Yes | greedy | 73 | **1 att** | 2 att | **PASS** (earlier) |
| **138** | 88 | Yes | beam   | 85 | **1 att** | 1 att | **PASS** |
| **139** | 88 | Yes | greedy | 93 | **1 att** | 3 att | **PASS** (earlier) |
| **140** | 96 | Yes | greedy | 98 | **1 att** | 1 att | **PASS** |
| **141** | 74 | Yes | beam   | 75 | **1 att** | 1 att | **PASS** |
| **142** | 76 | Yes | greedy | 75 | **1 att** | 1 att | **PASS** |
| **143** | 88 | Yes | beam   | 85 | **1 att** | 1 att | **PASS** |
| **144** | 88 | Yes | greedy | 89 | **1 att** | 1 att | **PASS** |
| **145** | 78 | Yes | beam   | 77 | **1 att** | 1 att | **PASS** |
| **146** | 74 | Yes | greedy | 72 | **1 att** | 1 att | **PASS** |
| **147** | 86 | Yes | beam   | 84 | **1 att** | 1 att | **PASS** |
| **148** | 76 | Yes | greedy | 77 | **1 att** | 1 att | **PASS** |
| **149** | 86 | Yes | beam   | 83 | **1 att** | 2 att | **PASS** (earlier) |
| **150** | 96 | Yes | beam   | 95 | **1 att** | 3 att | **PASS** (earlier) |
| **151** | 76 | Yes | greedy | 74 | **1 att** | 2 att | **PASS** (earlier) |
| **152** | 82 | Yes | greedy | 82 | **1 att** | 2 att | **PASS** (earlier) |
| **153** | 72 | Yes | beam   | 70 | **1 att** | 1 att | **PASS** |
| **154** | 80 | Yes | beam   | 79 | **1 att** | 3 att | **PASS** (earlier) |
| **155** | 86 | Yes | beam   | 83 | **1 att** | 1 att | **PASS** |

**Total Score: 21 / 21 PASS (100.0%)** — Every level is cleared on Attempt 1, matching or beating Dennis's attempts on all 21 levels.

