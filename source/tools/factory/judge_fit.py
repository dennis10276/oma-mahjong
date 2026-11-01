"""The difficulty judge (Claude, 2026-11-01). Dennis: "I need the bot to know a level's difficulty based on the
results of tries by me, Gerda and Mrs. Doubtfire: my tries, and if Gerda AND Mrs. Doubtfire needed 8 tries,
add 2 to my tries. It has to match closely, not precisely. Do this for levels 85-155 and my tested factory
levels."

The human-like bot (g2.1) plays every board; the judge turns what it sees (its expected tries and first-try
rate, how its losses happen, the clock's spare, the board's size and specials) into Dennis's tries. A small
linear model, so 76 boards cannot be memorised; every number below is leave-one-out (each board predicted by
a judge fitted without it).
    python3 judge_fit.py <feat-live.jsonl> <targets-85-155.json> <feat-factory.jsonl> <dennis-plays.json> <out.json>
"""
import json, sys, math
import numpy as np

feat_live, targets_file, feat_fac, plays_file, out = sys.argv[1:6]
rd = lambda f: [json.loads(l) for l in open(f) if l.strip()]
T = {r['level']: r for r in json.load(open(targets_file))}
rows = []
for f in rd(feat_live):
    lv = int(f['key'][4:])
    if lv in T: rows.append({**f, 'target': T[lv]['target'], 'src': 'live'})
P = {b['key']: b for b in json.load(open(plays_file))['boards']}
for f in rd(feat_fac):
    b = P.get(f['key'])
    if not b: continue
    tries = b.get('tries') or len(b.get('plays') or [])
    won = (b.get('wins') or 0) > 0 or any(p.get('r') == 'win' for p in (b.get('results') or [])) or any(p.get('r') == 'win' for p in (b.get('plays') or []))
    if not tries: continue
    rows.append({**f, 'target': tries + (0 if won else 1), 'src': 'factory'})

FEATS = ['exp', 'first', 'clockLossShare', 'late', 'reach', 'spare', 'n', 'downShare', 'ice', 'locks']
def x_of(r):
    v = {**r, 'downShare': r['down'] / r['n'], 'spare': r['spare'] if r['spare'] is not None else 2}
    return [v[k] for k in FEATS]
X = np.array([x_of(r) for r in rows], float); y = np.array([r['target'] for r in rows], float)
mu, sd = X.mean(0), X.std(0) + 1e-9

def fit(Xa, ya, lam):
    Z = (Xa - mu) / sd; Z = np.hstack([np.ones((len(Z), 1)), Z])
    A = Z.T @ Z + lam * np.diag([0] + [1] * (Z.shape[1] - 1))
    return np.linalg.solve(A, Z.T @ ya)
def pred(w, Xa):
    Z = (Xa - mu) / sd; Z = np.hstack([np.ones((len(Z), 1)), Z]); return Z @ w

def rank(a):
    o = np.argsort(a, kind='stable'); r = np.empty(len(a)); i = 0
    while i < len(a):
        j = i
        while j + 1 < len(a) and a[o[j + 1]] == a[o[i]]: j += 1
        r[o[i:j + 1]] = (i + j) / 2; i = j + 1
    return r
def spear(a, b): return float(np.corrcoef(rank(np.asarray(a)), rank(np.asarray(b)))[0, 1])
def report(p, mask=None):
    m = np.ones(len(y), bool) if mask is None else mask
    e = np.abs(p[m] - y[m])
    return {'n': int(m.sum()), 'MAE': round(float(e.mean()), 2), 'within1': round(float((e <= 1).mean()), 2), 'within1.5': round(float((e <= 1.5).mean()), 2), 'spearman': round(spear(p[m], y[m]), 3)}

best = None
for lam in [0.3, 1, 3, 10, 30, 100]:
    loo = np.zeros(len(y))
    for i in range(len(y)):
        k = np.arange(len(y)) != i
        loo[i] = max(1.0, pred(fit(X[k], y[k], lam), X[i:i + 1])[0])
    r = report(loo)
    if not best or r['MAE'] < best[1]['MAE']: best = (lam, r, loo)
lam, r, loo = best
w = fit(X, y, lam)
live = np.array([r_['src'] == 'live' for r_ in rows]); fac = ~live
raw = np.array([r_['exp'] for r_ in rows])
res = {
  'about': __doc__.strip().split('\n\n')[0],
  'features': FEATS, 'lambda': lam, 'weights': dict(zip(['intercept'] + FEATS, [round(float(v), 4) for v in w])), 'mu': mu.tolist(), 'sd': sd.tolist(),
  'leaveOneOut': {'all': report(loo), 'live 85-155': report(loo, live), 'factory': report(loo, fac)},
  'rawG21': {'all': report(raw), 'live 85-155': report(raw, live), 'factory': report(raw, fac)},
  'boards': [{'key': r_['key'], 'target': int(y[i]), 'judge': round(float(loo[i]), 2), 'g21': r_['exp']} for i, r_ in enumerate(rows)],
}
json.dump(res, open(out, 'w'), indent=1)
print('lambda', lam)
for k in ['all', 'live 85-155', 'factory']: print(k.ljust(12), 'judge (leave-one-out)', res['leaveOneOut'][k], '| raw g2.1', res['rawG21'][k])
print('weights', res['weights'])
