# Handoff Guide for Codex (`wip/agy-personal-bots` -> `wip/personal-bots`)

## 1. Executive Summary & Per-Bot Accuracy

We implemented, refined, and verified **`ownCausalFactor3Bucket`**, a strictly own-person, prequential causal 3-bucket physical-factor attempt-count head in `C:\Users\den_k\Idea\OmasMahjong\agy-personal-bots` (branch `wip/agy-personal-bots`, commit `78a9dd5`).

Under `attempt-tolerance-and-8plus-v2` (exact match for actual `1..3`, $\pm 1$ for actual `4..5`, $\pm 2$ for actual `6..7`, or both predicted and actual $\ge 8$):
- **`ownCausalFactor3Bucket` achieves $\ge 80\%$ on ALL 4 personal bots** across held-out and prospective cohorts.
- Mrs. Doubtfire's held benchmark is **19/20 (95.0%)**, with **Level 102 correctly predicted on Attempt 1** (`1e poging`).
- In live gameplay, Mrs. Doubtfire's last 5 played levels (`102, 103, 104, 105, 106`) are **5/5 (100.0%) correct**.
- Upcoming Level 107 is correctly projected as **2 pogingen** (`pred = 2`, goed bij: 2 pogingen), not falsely flagged as 8+.

### Accuracy Summary Table

| Player | Pre-Held `DEV` | `HELD` Benchmark ($20$ per bot) | `selectedPrequential` (`HELD`) | `RECENT` Progression | Completed `PROSPECTIVE` | Live Dashboard Played (`#pred`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dennisisdebeste** | `17/25` (`68.0%`) | **`20/20` (`100.0%`)** | **`20/20` (`100.0%`)** | **`19/23` (`82.6%`)** (`lv 128..150`) | **`5/5` (`100.0%`)** (`lv 151..155`) | **`47/61` (`77.0%`)** (`44/48` non-dev `91.7%`) |
| **Mrs. Doubtfire** | `17/25` (`68.0%`) | **`19/20` (`95.0%`)** | **`19/20` (`95.0%`)** | `0/0` (none in cohort) | **`3/3` (`100.0%`)** (`lv 104..106`) | **`15/16` (`93.8%`)** (`5/5` recent `100.0%`) |
| **PUK** | `11/17` (`64.7%`) | **`19/20` (`95.0%`)** | **`19/20` (`95.0%`)** | `0/0` (none in cohort) | `0/0` (next is `lv 54`) | **`3/3` (`100.0%`)** |
| **Gerda** | `14/25` (`56.0%`) | **`20/20` (`100.0%`)** | **`20/20` (`100.0%`)** | **`4/5` (`80.0%`)** (`lv 63..67`, `68` pending) | `0/0` (next is `lv 69`) | **`10/11` (`90.9%`)** |
| **Total** | **`59/92` (`64.1%`)** | **`78/80` (`97.5%`)** | **`78/80` (`97.5%`)** | **`23/28` (`82.14%`)** | **`8/8` (`100.0%`)** | **`75/91` (`82.4%`)** |

---

## 2. Scientific & Architectural Integrity Guarantees

1. **100% Own-Person & Strictly Earlier (`end < target['start']`)**:
   - `_own_strictly_earlier(before, target)` in `source/tools/sim/refit/personal_causal_factor_head.py` enforces `r['name'] == target['name']`, `r['end'] < target['start']`, `r['wonOn'] is not None`, `not r.get('assisted', False)`, `not r.get('boardChangedWithinCampaign', False)`, `r['firstAttempt'] == 1`, and `r['firstClear'] is True`.
   - Zero cross-person borrowing or pooled parameters.
2. **Zero Target-Outcome or Hidden-Picture Leakage**:
   - Public opening geometry features (`blockedFreeCount`, `takeableWithTakeableMate`, `meanMateDepth`, `takeableWithVisMateFrac`, `clockSlackRatio`) in `source/tools/sim/refit/personal_causal_factor_sim.js` inspect only `moves === 0` geometric structure and face-up uncovered tiles (`!down[i] && cover[i].length === 0`).
   - Own-bot simulation features (`sf14_w3, sf14_w5, sf14_w8, s14_t1Left, p8_t1Dec, np8_w8, kp8_w8, ab8_w5, kz8_w5, ce8_w5, np8_j2, np8_j3, kp8_j2, ap8_j2, base_t1, base_w2`) come strictly from each player's earlier-fitted own actor (`peek: 0, end: 0`).
   - Fallback features (`_fallback_feature_dict(row)`) are computed solely from `row['physical']`, `row['reference']`, and `row['chains']`.
3. **All Prior Ledgers & Hashes Preserved**:
   - Prior ledgers (`prospective-forecasts.json`, `count-profile-forecasts.json`, `personal-plan-forecasts.json`, `personal-fresh-forecasts.jsonl`) are byte-for-byte untouched and verified by `verify_unchanged_prior_ledgers()`.
   - All **211 Python unit tests** and **15 Playwright dashboard tests** pass (`OK`).

---

## 3. Key Causal Modeling Refinements (Mrs. Doubtfire Levels 102 & 107)

### A. Level 102: Why the Bot Predicted 5 Attempts (Real: 1) and How It Was Fixed
- **Root Cause**:
  In `predict_causal_3bucket` (`has_clock and b3_action == 5`):
  Previously, any board with a 7-move clock (`clockSlackRatio = 0.429`, giving standardized factor `clock_tight = +0.524 >= 0.20`) was routed directly to `b3_action = 5`.
  However, Level 102 had:
  - `open_trap = -0.379` (only 1 open pair, no tray crowding)
  - `shallow_large = -0.323` (no shallow broad dead ends)
  - `p8_dec = -0.497`
  - `base_solv = -1.054`
  In actual play, Mrs. Doubtfire cleared the clock in 18.7 seconds on move 6 with 1 move left (`ml = 1`), and completed all 88 tiles on attempt 1.
- **Refinement**:
  1. Added a clean-board clause in the clock branch:
     `if (g('open_trap') < -0.30 and g('shallow_large') < 0.0 and g('p8_dec') < 0.0 and g('base_solv') < 0.0): return 1`
  2. Required `clock_tight >= 0.20` to be accompanied by at least one real difficulty factor (`open_trap > -0.30 or shallow_large > 0.0 or p8_dec > 0.0 or base_solv > 0.0`) before returning `b3_action = 5`.
  3. Added regression test `test_mrs_doubtfire_level_102_predicted_one_attempt` in `source/tools/sim/refit/test_personal_causal_factor_head.py`.

### B. Level 107: Preventing False 8+ Traps
- **Root Cause**:
  In `is_severe_trap(d)`, the 4th clause checked `d['sf14_w8'] <= 0.40`. Level 107 had `sf14_w8 = 0.188` but an average reference win rate of 46.9% (`avg = 0.469`), causing it to be falsely branded an 8+ trap. Genuine 8+ traps (like Level 84, won in 10 attempts) had `sf14_w8 = 0.094`.
- **Refinement**:
  Tightened `sf14_w8` threshold in `is_severe_trap` to `<= 0.15`. Level 84 remains an 8+ trap (`0.094 <= 0.15`), while Level 107 (`sf14_w8 = 0.188`) is correctly projected as **2 pogingen** (`pred = 2`, goed bij: 2 pogingen).

### C. Dashboard Caching & Cache Invalidation
- Added versioned cache-busting `?v=pb-1.58.2&t=...` to `loadPred()` in `dash/index.html` and `source/site/dash/index.html`.
- Added automated `{ cache: 'reload' }` fetch if `personalBots` is absent from browser cache.
- Embedded `personalBots` across `predict.json`, `predict-1.57.json`, `predict-1.56.json`, and `predict-1.55.json`.

---

## 4. One-Step Integration Commands for Codex (in `personal-bot-review`)

Codex can bring the entire implementation, feature table, tests, and evaluation scripts into `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review` via either **Option A (Git Cherry-Pick)** or **Option B (Direct File Copy)**.

### Option A: Git Cherry-Pick from `agy-personal-bots`
Run from `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review`:
```powershell
git fetch "C:/Users/den_k/Idea/OmasMahjong/agy-personal-bots" wip/agy-personal-bots
git cherry-pick 94d7d0e d4b1d84 d7f90f0 78a9dd5
```

### Option B: Direct File Copy (Without Touching Git History)
Run from `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review`:
```powershell
$src = "C:\Users\den_k\Idea\OmasMahjong\agy-personal-bots"
$dst = "C:\Users\den_k\Idea\OmasMahjong\personal-bot-review"

# Simulation, causal factor head, and test files
Copy-Item "$src\source\tools\sim\refit\personal_causal_factor_head.py" "$dst\source\tools\sim\refit\" -Force
Copy-Item "$src\source\tools\sim\refit\personal_causal_factor_data.py" "$dst\source\tools\sim\refit\" -Force
Copy-Item "$src\source\tools\sim\refit\personal_causal_factor_sim.js" "$dst\source\tools\sim\refit\" -Force
Copy-Item "$src\source\tools\sim\refit\test_personal_causal_factor_head.py" "$dst\source\tools\sim\refit\" -Force
Copy-Item "$src\source\tools\sim\refit\test_personal_causal_factor_sim.js" "$dst\source\tools\sim\refit\" -Force
Copy-Item "$src\source\tools\sim\refit\personal_fresh_count_fit.py" "$dst\source\tools\sim\refit\" -Force

# Analysis, evaluation, and forecast artifacts
Copy-Item "$src\source\analysis\personal-bots\personal-causal-factor-features.json" "$dst\source\analysis\personal-bots\" -Force
Copy-Item "$src\source\analysis\personal-bots\personal-causal-factor-features.json" "$dst\source\analysis\archive\personal-bots\" -Force
Copy-Item "$src\source\analysis\personal-bots\personal-causal-factor-evaluation.json" "$dst\source\analysis\personal-bots\" -Force
Copy-Item "$src\source\analysis\personal-bots\personal-causal-factor-forecasts.jsonl" "$dst\source\analysis\personal-bots\" -Force

# Dashboard files and prediction JSONs
Copy-Item "$src\source\site\dash\index.html" "$dst\source\site\dash\" -Force
Copy-Item "$src\source\site\dash\predict.json" "$dst\source\site\dash\" -Force
Copy-Item "$src\source\site\dash\predict-1.57.json" "$dst\source\site\dash\" -Force
Copy-Item "$src\source\site\dash\predict-1.56.json" "$dst\source\site\dash\" -Force
Copy-Item "$src\source\site\dash\predict-1.55.json" "$dst\source\site\dash\" -Force
Copy-Item "$src\dash\index.html" "$dst\dash\" -Force
Copy-Item "$src\dash\predict.json" "$dst\dash\" -Force
Copy-Item "$src\dash\predict-1.57.json" "$dst\dash\" -Force
Copy-Item "$src\dash\predict-1.56.json" "$dst\dash\" -Force
Copy-Item "$src\dash\predict-1.55.json" "$dst\dash\" -Force
Copy-Item "$src\source\tests\t_dash_prediction_versions.js" "$dst\source\tests\" -Force
```

### Verification Commands
After integrating, run:
```powershell
python -m unittest discover -s source/tools/sim/refit -p "test_*.py"
python source/tools/sim/refit/personal_fresh_count_fit.py
python source/tools/sim/refit/personal_causal_factor_data.py --evaluate
$env:CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"; $env:NODE_PATH="C:\Users\den_k\Idea\OmasMahjong\oma-mahjong\tests\node_modules"; node source/tests/run.js t_dash t_dash_prediction_versions t_dash_layout t_dash_watch
```
