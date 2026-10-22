# Preregistered Monte Carlo Precision Protocol

## 1. Analysis of the Historical Half-Split Wasserstein Rule
The historical candidates (v1 through v8) used an adaptive stopping rule:
- Sample between 6 and 16 campaigns per board.
- Compute the half-split Wasserstein distance $W_1(H_1, H_2)$ between the first half and second half of generated campaigns.
- Stop when $W_1 \le 2.0$ (or assert convergence if $W_1 \le 2.5$).

As established by the independent audit:
1. **Half-split agreement does not prove convergence**: Small identical samples (e.g. 6 identical outcomes) produce $W_1 = 0$, but have immense sampling uncertainty regarding tail behavior.
2. **Adaptive stopping without martingale corrections inflates error**: Checking a stopping condition repeatedly after every 2 simulations introduces optional stopping bias unless adjusted by sequential boundaries.
3. **The v8 candidate does not satisfy fixed-budget precision**: v8's 6-16 adaptively stopped samples fail the conservative fixed-sample family-adjusted bound in `independent_mc_metrics.py`.

## 2. Conservative Fixed-Budget Protocol (`independent_mc_metrics.py`)
Under Hoeffding's inequality with Union Bound over $K = 8$ outcome classes and family size $M = 96$ target forecasts:
$$\text{Score Error Bound} = \sqrt{\frac{\ln\left(\frac{2 \times K \times M}{\delta}\right)}{2N}}$$

For target precision $\epsilon = 0.05$, family confidence $1 - \delta = 0.95$, and $M = 96$:
$$N \ge \left\lceil \frac{\ln(30,720)}{2 \times (0.05)^2} \right\rceil = \lceil 2,066.3 \rceil = 2,067 \text{ campaigns per target}$$

Requirements under this protocol:
- **Fixed preregistered budget**: Exactly $N = \text{planned\_count}$ campaigns must be executed; early stopping is disallowed.
- **Both halves must agree on the Bayes point prediction**: $\text{best}(H_1) = \text{best}(H_2)$.
- **Strict outcome validation**: Every campaign must have a valid `wonOn` $\in \{1, \ldots, 8, \text{null}\}$.
- **No confusion of censoring with tail**: Any campaign with `status: unresolved` or containing unresolved steps cannot be labeled `noClear`; it remains computationally censored.

## 3. Mathematically Justified Sequential Procedure (Confidence Sequences)
Launching $96 \times 2,067 \approx 198,000$ full physical bot simulations is computationally wasteful if the policy itself has unverified behavioral gaps. To allow early stopping in future implementations without invalidating error guarantees:

### 3.1 Anytime-Valid Confidence Sequences
Using the empirical Bernstein confidence sequence (Howard et al., 2021), for any stopping time $\tau$:
$$P\left( \exists t \ge 1 : |\widehat{\mu}_t - \mu| \ge c_t(V_t, \delta) \right) \le \delta$$
Where $V_t = \sum_{s=1}^t (X_s - \widehat{\mu}_{s-1})^2$ is the intrinsic empirical variance and $c_t$ is the sub-gamma boundary.

### 3.2 Sequential Stopping Criterion
A simulation run on board $b$ may stop at iteration $m$ if and only if:
1. $m \ge m_{\min} = 30$ (minimum exploration budget).
2. The width of the anytime-valid confidence sequence on expected score under the agreed metric satisfies $c_m < \epsilon$.
3. All intermediate runs, seeds, losses, and clearances are immutably appended to `campaignResults`.
4. No campaign is discarded, filtered, or restarted based on observed outcomes.

## 4. Preservation Obligations
- Every seed, attempt trace, and outcome status must be retained.
- Computational censoring (`choiceLimit`, `settleBefore`, timeout) must be explicitly flagged and cannot be classified as `noClear` (loss) or try 8.
- Neither fixed-budget precision nor sequential confidence guarantees constitute prospective human accuracy; they verify only the numeric reliability of the simulated distribution.
