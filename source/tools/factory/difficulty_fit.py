"""Step 1 (Claude, 2026-11-02): one difficulty per level from every try of Dennis, Gerda and Mrs. Doubtfire.
Dennis: "It is not accurate. Make a plan to make it accurate." One level gives one count of Dennis's tries, and that
count is partly luck; Gerda and Mrs. Doubtfire played the same levels many times. So: every try up to a player's
first win of a level (plays/<pid> end records; a restart counts as a lost try, as in the targets), only on the board
the level has now (same tile count and clock), and

    P(win on try t) = 1 / (1 + exp(-(skill[player] - difficulty[level] + learn * log t)))

fitted by maximum likelihood with a pull of every difficulty towards the average (normal prior, sd SD=0.5: the
strength that predicts held-out tries best; sd 2 predicts them worse than no level difficulty at all). Out:
per level the difficulty and Dennis's expected tries (with this skill and learning), per player the skill.
    python3 difficulty_fit.py <plays-dir> <live-sig.json> <out.json>                                        """
import json, sys, math, os
import numpy as np
from scipy.optimize import minimize

plays_dir, sig_file, out = sys.argv[1:4]
PIDS = {'pmuy78xu6tsths9': 'Dennis', 'pmv6yhzz3x9oxs8': 'Gerda', 'pmv16kj3jr35750': 'MrsD'}
SIG = {int(k): v for k, v in json.load(open(sig_file)).items()}
LV0, LV1 = 85, 174
# a long run of losses counts only up to CAP tries ("needed more than CAP"): one player's 80 tries on a level would
# otherwise weigh as much as 80 levels of Dennis's, and the three of them disagree on which levels are hard for them
CAP = int(os.environ.get('CAP', '12'))

def sequences():
    seqs = []
    for pid, who in PIDS.items():
        d = json.load(open(os.path.join(plays_dir, pid + '.json')))
        vals = list(d.values()) if isinstance(d, dict) else d
        starts = {v['aid']: v for v in vals if isinstance(v, dict) and v.get('k') == 'start' and v.get('aid')}
        ends = sorted((v for v in vals if isinstance(v, dict) and v.get('k') == 'end' and LV0 <= (v.get('lv') or 0) <= LV1), key=lambda v: v['t'])
        by = {}
        for e in ends:
            s = starts.get(e.get('aid'), {})
            ck = s.get('ck', e.get('ck'))
            sig = SIG[e['lv']]
            if e.get('n') != sig['n'] or (s and ck is not None and sig['ck'] is not None and ck != sig['ck']): continue   # another board
            by.setdefault(e['lv'], []).append(e)
        for lv, es in by.items():
            res = []
            for e in es:
                res.append(1 if e['r'] == 'win' else 0)
                if e['r'] == 'win': break
            seqs.append({'who': who, 'lv': lv, 'res': res[:CAP], 'won': res[-1] == 1, 'n': len(res)})
    return seqs

SD = float(os.environ.get('SD', '0.5'))

def fit(seqs, players, levels, sd=None):
    sd = SD if sd is None else sd
    P = {p: i for i, p in enumerate(players)}; L = {l: i for i, l in enumerate(levels)}
    pi, li, t, y = [], [], [], []
    for s in seqs:
        for k, r in enumerate(s['res']):
            pi.append(P[s['who']]); li.append(L[s['lv']]); t.append(math.log(k + 1)); y.append(r)
    pi, li, t, y = map(np.array, (pi, li, t, y))
    nP, nL = len(players), len(levels)
    def f(w):
        sk, dif, g = w[:nP], w[nP:nP + nL], w[-1]
        z = sk[pi] - dif[li] + g * t
        ll = np.sum(y * z - np.logaddexp(0, z))
        pen = np.sum(dif ** 2) / (2 * sd * sd) + np.sum(sk ** 2) / (2 * 25.0)
        p = 1 / (1 + np.exp(-z)); r = y - p
        gs = np.bincount(pi, r, nP) - sk / 25.0
        gd = -np.bincount(li, r, nL) - dif / (sd * sd)
        gg = np.sum(r * t)
        return -(ll - pen), -np.concatenate([gs, gd, [gg]])
    w = minimize(f, np.zeros(nP + nL + 1), jac=True, method='L-BFGS-B').x
    return {p: w[P[p]] for p in players}, {l: w[nP + L[l]] for l in levels}, w[-1]

def exp_tries(skill, dif, g, cap=200):
    e, surv = 0.0, 1.0
    for k in range(1, cap + 1):
        e += surv
        p = 1 / (1 + math.exp(-(skill - dif + g * math.log(k))))
        surv *= 1 - p
    return e

def seq_ll(s, skill, dif, g):
    ll = 0.0
    for k, r in enumerate(s['res']):
        p = 1 / (1 + math.exp(-(skill - dif + g * math.log(k + 1))))
        ll += math.log(p if r else 1 - p)
    return ll

if __name__ == '__main__':
    seqs = sequences()
    players = sorted({s['who'] for s in seqs}); levels = sorted({s['lv'] for s in seqs})
    sk, dif, g = fit(seqs, players, levels)
    rows = []
    for l in levels:
        sq = {s['who']: s for s in seqs if s['lv'] == l}
        rows.append({'level': l, 'difficulty': round(dif[l], 3), 'dennisExpected': round(exp_tries(sk['Dennis'], dif[l], g), 2),
                     'tries': {w: (s['n'], s['won']) for w, s in sq.items()}})
    # held out: each player's sequence on a level predicted by a fit without it, against a fit without levels
    # (skill and learning only); log-likelihood per try
    import random
    random.seed(1); idx = list(range(len(seqs))); random.shuffle(idx); folds = [idx[k::10] for k in range(10)]
    llL = llN = 0.0; ntry = 0
    for fo in folds:
        fs = set(fo); tr = [s for k, s in enumerate(seqs) if k not in fs]
        sk2, dif2, g2 = fit(tr, players, levels)
        sk0, dif0, g0 = fit(tr, players, levels, sd=1e-3)
        for k in fo:
            s = seqs[k]
            llL += seq_ll(s, sk2[s['who']], dif2[s['lv']], g2); llN += seq_ll(s, sk0[s['who']], dif0[s['lv']], g0); ntry += len(s['res'])
    res = {'about': __doc__.strip().split('\n\n')[0], 'cap': CAP, 'skill': {p: round(v, 3) for p, v in sk.items()}, 'learn': round(g, 3),
           'sequences': len(seqs), 'tries': sum(len(s['res']) for s in seqs),
           'heldOut': {'perTryLogLikWithLevels': round(llL / ntry, 4), 'perTryLogLikWithoutLevels': round(llN / ntry, 4)},
           'levels': rows}
    json.dump(res, open(out, 'w'), indent=1)
    print('players', res['skill'], 'learn', res['learn'], '| sequences', len(seqs), 'tries', res['tries'])
    print('held out (10 folds), log-likelihood per try: with level difficulty', res['heldOut']['perTryLogLikWithLevels'], 'without', res['heldOut']['perTryLogLikWithoutLevels'])
