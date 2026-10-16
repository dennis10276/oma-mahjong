"""Per-player prediction model, tested on the future.

The test players measure how hard each board is (board_features.js). A small logistic model per
player turns that into their chances:
    first try:  logit P(win) = a_player + b * z
    retry t:    logit P(win) = a_player + r_player + b * z + d * log(t - 1)      (t = 2, 3, ...)
z = the board's difficulty: logit of a test player's first-try chance. The slope b is shared by all
players (more data), the levels a and r are per player, all with a mild pull towards the family
average (ridge), so a player with few tries borrows from the others.

Walk-forward test: every level is predicted with only the tries made before it was first played
(all players), then compared with what really happened. Baselines:
    rate:  the player's own share of wins so far (first tries and retries apart), no board info
    bot:   the raw test player number (first tries only)
Scores: log-loss per try (lower is better) and, for first tries, how often the harder-looking of two
boards really went worse (concordance; 0.5 = no better than chance).

    python3 predict_model.py [feature=average] [warmup days=3]
"""
import json, sys, math, glob, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FEATURE = sys.argv[1] if len(sys.argv) > 1 else 'average'
WARM = float(sys.argv[2]) if len(sys.argv) > 2 else 3
PLAYERS = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']

A = json.load(open(os.path.join(HERE, 'attempts.json')))
F = {}
for f in glob.glob(os.path.join(HERE, 'features-*.json')):
    F.update(json.load(open(f)))
A = [a for a in A if a['name'] in PLAYERS and a['key'] in F and a.get('t')]
A.sort(key=lambda a: a['t'])

def logit(p):
    p = min(0.985, max(0.015, p))
    return math.log(p / (1 - p))

def z_of(key, feat=FEATURE):
    if feat == 'mix':
        return np.mean([logit(F[key][k]) for k in ('strong', 'sensible', 'average', 'weak')])
    return logit(F[key][feat])

PI = {p: i for i, p in enumerate(PLAYERS)}
NP = len(PLAYERS)

def design(a, feat=FEATURE):
    """columns: a_player (NP), r_player (NP), b (z), d (log(t-1) for retries), z*retry"""
    x = np.zeros(2 * NP + 3)
    i = PI[a['name']]
    x[i] = 1
    retry = a['at'] > 1
    if retry:
        x[NP + i] = 1
        x[2 * NP + 1] = math.log(a['at'] - 1)
    z = z_of(a['key'], feat)
    x[2 * NP] = z
    if retry:
        x[2 * NP + 2] = z
    return x

def fit(rows, feat=FEATURE, lam=1.0):
    X = np.array([design(a, feat) for a in rows])
    y = np.array([1.0 if a['r'] == 'win' else 0.0 for a in rows])
    w = np.zeros(X.shape[1])
    # ridge towards 0 for the per-player retry offsets and slopes; the per-player levels towards
    # their common mean (done by a shared intercept-free penalty on differences)
    for _ in range(50):
        p = 1 / (1 + np.exp(-X @ w))
        g = X.T @ (y - p)
        H = -(X.T * (p * (1 - p))) @ X
        # penalties
        P = np.eye(len(w)) * lam
        Pa = np.eye(NP) - np.ones((NP, NP)) / NP      # pull a_player together
        P[:NP, :NP] = Pa * lam
        P[NP:2 * NP, NP:2 * NP] = (np.eye(NP) - np.ones((NP, NP)) / NP) * lam + np.ones((NP, NP)) / NP * 0.1
        P[2 * NP, 2 * NP] = 0.01
        g = g - P @ w
        H = H - P
        step = np.linalg.solve(H, g)
        w = w - step
        if np.max(np.abs(step)) < 1e-7:
            break
    return w

def prob(w, a, feat=FEATURE):
    return float(1 / (1 + math.exp(-(design(a, feat) @ w))))

def ll(p, won):
    p = min(0.99, max(0.01, p))
    return -math.log(p if won else 1 - p)

def concordance(pairs):
    """pairs: (predicted chance, won) for first tries; share of (win, loss) pairs ranked right"""
    wins = [p for p, w in pairs if w]
    losses = [p for p, w in pairs if not w]
    if not wins or not losses:
        return None
    good = sum((pw > pl) + 0.5 * (pw == pl) for pw in wins for pl in losses)
    return good / (len(wins) * len(losses))

def walk_forward(feat=FEATURE, warm_days=WARM):
    # each player's second half is predicted (their first half is only used to learn from)
    half = {p: sorted(a['t'] for a in A if a['name'] == p) for p in PLAYERS}
    half = {p: (v[len(v) // 2] if v else 0) for p, v in half.items()}
    levels = {}
    for a in A:
        levels.setdefault((a['name'], a['key']), []).append(a)
    order = sorted(levels.items(), key=lambda kv: kv[1][0]['t'])
    res = {p: {'model': [], 'rate': [], 'bot': [], 'first_model': [], 'first_rate': [], 'first_bot': [], 'levels': []} for p in PLAYERS}
    for (name, key), tries in order:
        start = tries[0]['t']
        if start < half[name]:
            continue
        past = [a for a in A if a['t'] < start]
        if len([a for a in past if a['name'] == name]) < 5:
            continue
        w = fit(past, feat)
        mine = [a for a in past if a['name'] == name]
        f_rate = (sum(a['r'] == 'win' for a in mine if a['at'] == 1) + 1) / (sum(a['at'] == 1 for a in mine) + 2)
        r_rate = (sum(a['r'] == 'win' for a in mine if a['at'] > 1) + 1) / (sum(a['at'] > 1 for a in mine) + 2)
        lv = {'lv': tries[0]['lv'], 'key': key, 'tries': [a['r'] for a in tries]}
        for a in sorted(tries, key=lambda a: a['at']):
            won = a['r'] == 'win'
            pm = prob(w, a, feat)
            pr = f_rate if a['at'] == 1 else r_rate
            res[name]['model'].append(ll(pm, won))
            res[name]['rate'].append(ll(pr, won))
            if a['at'] == 1:
                pb = F[key][{'Dennisisdebeste': 'strong'}.get(name, 'average')]
                res[name]['bot'].append(ll(pb, won))
                res[name]['first_model'].append((pm, won))
                res[name]['first_rate'].append((pr, won))
                res[name]['first_bot'].append((pb, won))
                lv['first'] = {'model': round(pm, 3), 'rate': round(pr, 3), 'bot': round(pb, 3), 'won': won}
        # chance to need at least as many tries as really happened (model)
        lv['n'] = len(tries)
        res[name]['levels'].append(lv)
    return res

if __name__ == '__main__':
    out = {}
    for feat in ['strong', 'sensible', 'average', 'weak', 'mix']:
        res = walk_forward(feat)
        tot = {k: [] for k in ('model', 'rate', 'bot')}
        for p in PLAYERS:
            for k in tot:
                tot[k] += res[p][k]
        out[feat] = {k: round(sum(v) / max(1, len(v)), 4) for k, v in tot.items()}
        out[feat]['n'] = len(tot['model'])
        print(feat, json.dumps(out[feat]))
    best = min(out, key=lambda f: out[f]['model'])
    res = walk_forward(best)
    print('\nbest feature:', best)
    for p in PLAYERS:
        r = res[p]
        if not r['model']:
            continue
        m = lambda v: round(sum(v) / len(v), 3)
        print(f"{p:16s} tries {len(r['model']):3d}  log-loss model {m(r['model'])}  own rate {m(r['rate'])}  | first tries {len(r['first_model']):2d}: model {m([ll(q, w) for q, w in r['first_model']])} rate {m([ll(q, w) for q, w in r['first_rate']])} bot {m(r['bot'])}  concordance model {concordance(r['first_model'])} bot {concordance(r['first_bot'])}")
    json.dump({'feature': best, 'scores': out, 'walk': {p: res[p]['levels'] for p in PLAYERS}}, open(os.path.join(HERE, 'model-backtest.json'), 'w'), indent=1)
