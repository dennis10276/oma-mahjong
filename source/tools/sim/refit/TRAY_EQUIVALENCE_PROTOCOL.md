# Proposed Preregistered Tray Equivalence Protocol

## 1. Problem with the Historical Arbitrary Thresholds
The previous rule asserted that a simulator replicates human tray occupancy fidelity if:
- $\text{TVD}(P_H, P_B) \le 0.50$
- $W_1(P_H, P_B) \le 1.25$

This definition was flawed and rejected by independent audit for multiple reasons:
1. **Sample size blindness**: With small samples (e.g. 20-30 taps), the sampling error of empirical TVD is large. Even if the bot drew from the exact same underlying multinomial distribution, small-sample variance can easily produce TVD $> 0.30$.
2. **Excessive permissiveness**: A TVD of 0.50 means up to 50% of the probability mass can be placed in completely different bins (e.g., human playing at tray length 0 and bot playing at tray length 3), which represents completely non-faithful play.
3. **Absence of statistical hypothesis testing**: The fixed cutoff is an uncalibrated point estimate check rather than a test of distributional equivalence with controlled Type I and Type II error rates.
4. **Conflating metric arithmetic with behavioral fidelity**: Verifying that $\text{TVD} = \frac{1}{2}\sum_k |p_{H,k} - p_{B,k}|$ reproduces from raw counts only proves arithmetic integrity; it does not prove behavioral equivalence.

## 2. Proposed Nonparametric Bootstrap Equivalence Protocol (Wellek 2010)
Before inspecting the final evaluation block, the following protocol must be preregistered:

### 2.1 Hypotheses
For each player $i \in \{\text{Dennis}, \text{Doubtfire}, \text{PUK}, \text{Gerda}\}$:
$$H_{0,i}: \text{TVD}(P_{H,i}, P_{B,i}) \ge \epsilon_0 \quad (\text{Non-equivalence: bot distribution diverges from human by at least } \epsilon_0)$$
$$H_{1,i}: \text{TVD}(P_{H,i}, P_{B,i}) < \epsilon_0 \quad (\text{Equivalence within tolerance } \epsilon_0)$$

Where:
- $\epsilon_0 = 0.20$ is the declared maximum acceptable total variation distance between true asymptotic tray distributions.
- Tray bins are $\{0, 1, 2, 3\}$.

### 2.2 Sample Requirements
- Decisions must be collected across multiple complete games from an independently held-out chronological test block.
- Minimum sample size: $N_H \ge 100$ and $N_B \ge 100$ observations per player.
- Every individual decision, board ID, campaign ID, and per-game raw count tuple $(c_0, c_1, c_2, c_3)$ must be preserved.

### 2.3 Test Procedure via Bootstrap Upper Confidence Limit
1. Compute observed test statistic $\widehat{T}_i = \text{TVD}(\widehat{P}_{H,i}, \widehat{P}_{B,i})$ using `compareTrayCounts` from raw counts.
2. Generate $B = 2,000$ non-parametric bootstrap resamples from the empirical human distribution $\widehat{P}_{H,i}$ (with sample size $N_H$) and bot distribution $\widehat{P}_{B,i}$ (with sample size $N_B$).
3. For each bootstrap iteration $b \in \{1, \ldots, B\}$, compute bootstrap TVD:
   $$T^{*,b} = \text{TVD}(\widehat{P}_{H,i}^{*,b}, \widehat{P}_{B,i}^{*,b})$$
4. Compute the $(1 - \alpha_i)$ Upper Confidence Limit (UCL):
   $$\text{UCL}_i = \text{Quantile}_{1 - \alpha_i}\left(\{T^{*,b}\}_{b=1}^B\right)$$
5. Reject $H_{0,i}$ (declaring tray equivalence) if and only if $\text{UCL}_i < \epsilon_0$.
6. Family-wise Error Rate (FWER) control:
   - Use Holm-Bonferroni step-down procedure across all 4 players at family significance level $\alpha = 0.05$:
     $$\alpha_{(k)} = \frac{\alpha}{4 - k + 1}$$
   - Equivalence across all players requires $\text{UCL}_{(k)} < \epsilon_0$ at the step-down levels.

## 3. Preregistration and Independence
- This protocol must be frozen before final test block inspection.
- Metric calculation integrity (via `independent_tray_metrics.js`) is a prerequisite, not proof of equivalence.
- Until the full test block is collected and the equivalence test is executed, tray distribution fidelity remains UNVERIFIED.
