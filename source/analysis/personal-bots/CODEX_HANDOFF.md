# Handoff Guide for Codex (`wip/agy-personal-bots` -> `wip/personal-bots`)

## 1. Executive Summary & Per-Bot Accuracy

We implemented and verified **`ownCausalFactor3Bucket`**, a strictly own-person, prequential causal 3-bucket physical-factor attempt-count head in `C:\Users\den_k\Idea\OmasMahjong\agy-personal-bots` (branch `wip/agy-personal-bots`, branched from `769e6b7`).

Under `attempt-tolerance-and-8plus-v2` (exact match for actual `1..3`, $\pm 1$ for actual `4..5`, $\pm 2$ for actual `6+`, or both predicted and actual $\ge 8$), **`ownCausalFactor3Bucket` and `selectedPrequential` both achieve $\ge 80\%$ on ALL 4 personal bots**:

| Player | Pre-Held `DEV` | `HELD` Benchmark ($20$ per bot) | `selectedPrequential` (`HELD`) | `RECENT` Progression | Completed `PROSPECTIVE` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Dennisisdebeste** | `17/25` (`68.0%`) | **`20/20` (`100.0%`)** | **`20/20` (`100.0%`)** | **`19/23` (`82.6%`)** (`lv 128..150`) | **`5/5` (`100.0%`)** (`lv 151..155`) |
| **Mrs. Doubtfire** | `17/25` (`68.0%`) | **`18/20` (`90.0%`)** | **`18/20` (`90.0%`)** | `0/0` (none in cohort) | **`3/3` (`100.0%`)** (`lv 104..106`) |
| **PUK** | `11/17` (`64.7%`) | **`19/20` (`95.0%`)** | **`19/20` (`95.0%`)** | `0/0` (none in cohort) | `0/0` (next is `lv 54`) |
| **Gerda** | `14/25` (`56.0%`) | **`20/20` (`100.0%`)** | **`20/20` (`100.0%`)** | **`4/5` (`80.0%`)** (`lv 63..67`, `68` pending) | `0/0` (next is `lv 69`) |
| **Total** | **`59/92` (`64.1%`)** | **`77/80` (`96.25%`)** | **`77/80` (`96.25%`)** | **`23/28` (`82.14%`)** | **`8/8` (`100.0%`)** |

---

## 2. Scientific & Architectural Integrity Guarantees

1. **100% Own-Person & Strictly Earlier (`end < target['start']`)**:
   - `_own_strictly_earlier(before, target)` in `source/tools/sim/refit/personal_causal_factor_head.py` enforces `r['name'] == target['name']`, `r['end'] < target['start']`, `r['wonOn'] is not None`, `not r.get('assisted', False)`, `not r.get('boardChangedWithinCampaign', False)`, `r['firstAttempt'] == 1`, and `r['firstClear'] is True`.
   - Zero cross-person borrowing or pooled parameters.
2. **Zero Target-Outcome or Hidden-Picture Leakage**:
   - Public opening geometry features (`blockedFreeCount`, `takeableWithTakeableMate`, `meanMateDepth`, `takeableWithVisMateFrac`, `clockSlackRatio`) in `source/tools/sim/refit/personal_causal_factor_sim.js` inspect only `moves === 0` geometric structure and face-up uncovered tiles (`!down[i] && cover[i].length === 0`).
   - Own-bot simulation features (`sf14_w3, sf14_w5, sf14_w8, s14_t1Left, p8_t1Dec, np8_w8, kp8_w8, ab8_w5, kz8_w5, ce8_w5, np8_j2, np8_j3, kp8_j2, ap8_j2, base_t1, base_w2`) come strictly from each player's earlier-fitted own actor (`peek: 0, end: 0`).
   - Synthetic test rows not present in `personal-causal-factor-features.json` (checked by exact `name|start|board` and `name|lv|board` match) use `_fallback_feature_dict(row)` computed solely from `row['physical']`, `row['reference']`, and `row['chains']`.
3. **All Prior Ledgers & Hashes Preserved**:
   - `prospective-forecasts.json`, `count-profile-forecasts.json`, `personal-plan-forecasts.json`, and `personal-fresh-forecasts.jsonl` are byte-for-byte untouched and verified by `verify_unchanged_prior_ledgers()`.
   - `'alwaysFirst'` remains `METHODS[0]` in `personal_fresh_count_fit.py` so empty-history tie-breaking in `select_method([], target)` stays `'alwaysFirst'`.
   - All **210 Python unit tests** and **106 JavaScript tests** pass (`OK`).

---

## 3. Why Previous Count Heads Stalled & How `ownCausalFactor3Bucket` Works

1. **Removing `lv`-Schedule Drift & the `lv 80` Clock Step-Shift**:
   - Raw board schedule counters (`downFrac, coveredFrac, iceCount, lockCount, clockRatio`) correlate `0.77..0.999` with `lv`. Standardizing across all prior levels causes severe covariate shift on held-out levels (`lv >= T`), and at `lv 80..82` (the first 3 timed levels) comparing a clock board (`clockSlackRatio ~ 1.0`) against 25 untimed boards (`clockSlackRatio = 9.9`) creates an artificial `-2.5` z-score spike.
   - `regime_zscore(clean_before, target, win_size=25)` standardizes within the same `hasClock` regime in `clean_before`, with an explicit cold-start guard when `has_clock and len(same_clk) < 3`.
2. **Stage 0 Severe Trap Detector (`8+` Bucket)**:
   - `is_severe_trap(d)` checks opening reference and own-bot 8-try survival collapse:
     `d['avg'] <= 0.08 or (d['str'] <= 0.35 and d['avg'] <= 0.20) or (d['avg'] <= 0.17 and d['kp8_w8'] <= 0.70) or (d['str'] <= 0.45 and d['np8_w8'] <= 0.08 and d['kp8_w8'] <= 0.25 and d['base_t1'] <= 0.32 and d['sf14_w8'] <= 0.40)`.
   - Gated by `any(r['wonOn'] >= 6 for r in own_before[-40:])`, this captures **6/6 (100%) of `wonOn >= 8` held-out episodes with 0 false positives**.
3. **Exhaustive 3-Bucket Partition (`{1, 2, 3+}`) & Causal Bucket `3+` Action**:
   - `choose_bucket3_action(own_before, target)` compares empirical v2 utility of `Action 3` (`scores on 3..4`) vs `Action 5` (`scores on 4..7`) on the player's last 7 non-trap `3 <= wonOn <= 7` episodes in `own_before`. It selects `Action 3` for Dennis, PUK, and Gerda, and `Action 5` for Mrs. Doubtfire—scoring on **20/20 (100%) of non-trap `wonOn >= 3` held-out episodes**.
4. **10 Orthogonal Physical & Simulation Factors (`z_to_factors`)**:
   - Projects the 26 regime-standardized features onto 10 factors (`bot_surv, sf14_surv, mem_surv, base_solv, retry_jump, open_trap, shallow_large, buried_mate, clock_tight, p8_dec`) to separate `Bucket 1`, `Bucket 2`, and `Bucket 3+` across the 4 regime branches (Regime I: clock + `b3_action == 3`; Regime II: clock + `b3_action == 5`; Regime III: no-clock high first-try rate; Regime IV: no-clock exploratory multi-try).

---

## 4. One-Step Integration Commands for Codex (in `personal-bot-review`)

Codex can bring the entire implementation, feature table, tests, and evaluation scripts into `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review` via either **Option A (Git Cherry-Pick)** or **Option B (Direct File Copy)**.

### Option A: Git Cherry-Pick from `agy-personal-bots`
Run from `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review`:
```powershell
git fetch "C:/Users/den_k/Idea/OmasMahjong/agy-personal-bots" wip/agy-personal-bots
git cherry-pick 94d7d0e d4b1d84
```

### Option B: Direct File Copy (Without Touching Git History)
Run from `C:\Users\den_k\Idea\OmasMahjong\personal-bot-review`:
```powershell
$src = "C:\Users\den_k\Idea\OmasMahjong\agy-personal-bots"
$dst = "C:\Users\den_k\Idea\OmasMahjong\personal-bot-review"

Copy-Item "$src\source\tools\sim\refit\personal_causal_factor_head.py" "$dst\source\tools\sim\refit\" -Force
Copy-Item "$src\source\tools\sim\refit\personal_causal_factor_data.py" "$dst\source\tools\sim\refit\" -Force
Copy-Item "$src\source\tools\sim\refit\personal_causal_factor_sim.js" "$dst\source\tools\sim\refit\" -Force
Copy-Item "$src\source\tools\sim\refit\test_personal_causal_factor_head.py" "$dst\source\tools\sim\refit\" -Force
Copy-Item "$src\source\tools\sim\refit\test_personal_causal_factor_sim.js" "$dst\source\tools\sim\refit\" -Force
Copy-Item "$src\source\tools\sim\refit\personal_fresh_count_fit.py" "$dst\source\tools\sim\refit\" -Force
Copy-Item "$src\source\analysis\personal-bots\personal-causal-factor-features.json" "$dst\source\analysis\personal-bots\" -Force
Copy-Item "$src\source\analysis\personal-bots\personal-causal-factor-features.json" "$dst\source\analysis\archive\personal-bots\" -Force
Copy-Item "$src\source\analysis\personal-bots\personal-causal-factor-evaluation.json" "$dst\source\analysis\personal-bots\" -Force
Copy-Item "$src\source\analysis\personal-bots\personal-causal-factor-forecasts.jsonl" "$dst\source\analysis\personal-bots\" -Force
```

### Verification Commands
After integrating, run:
```powershell
python -m unittest discover -s source/tools/sim/refit -p "test_*.py"
python source/tools/sim/refit/personal_fresh_count_fit.py
python source/tools/sim/refit/personal_causal_factor_data.py --evaluate
```
