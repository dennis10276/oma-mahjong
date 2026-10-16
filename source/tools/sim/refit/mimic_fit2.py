"""Behaviour cloning, step 2: the weights of each player's own test player, learned from their moves.

Each decision: the parts of every possible move (mimic/<name>.json, from mimic_data.js) and the
move they made. The chance of a move is softmax(w . parts). w is fitted by maximum likelihood with a
pull towards the whole family's weights (so a player with few recorded moves borrows from the rest).

Honest test: fitted on each player's older games, then scored on their newest quarter:
    log-loss per decision (lower = better) and how often the move it rates highest is the one they made.
Compared with the fixed test players (strong / sensible / average) and the family-wide weights.

    python3 mimic_fit.py [out=mimic/weights.json]

Weights have common-sense signs (bounds): being stuck for sure, a 4th tile (overflow), the clock
ringing are never good, a waiting tile is never good, a pair never bad. The rare fatal parts are
fixed (people almost never meet them, so their weight cannot be learned from the moves; a person's
own habit of a fatal 4th tile is p.blunder3, outside these weights).
"""
import json, os, math, sys
import numpy as np
from scipy.optimize import minimize

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']
FILES = {n: os.path.join(HERE, 'mimic', n.replace('. ', '_').replace(' ', '_') + '.json') for n in NAMES}
FILES['Mrs. Doubtfire'] = os.path.join(HERE, 'mimic', 'Mrs_Doubtfire.json')
CAP = 50.0
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'mimic', 'weights.json')
# HALF: a game this many games before the person's newest counts half (people learn: Gerda turned
# no tiles over on her first day). 0 = all games count the same.
HALF = float(sys.argv[2]) if len(sys.argv) > 2 else 0
KIND = len(sys.argv) > 3 and sys.argv[3] == 'kind'   # fit which move within the chosen kind
# per part: (low, high); None = free. Fixed: (v, v)
BOUNDS = {'tray2': (None, 0), 'tray3': (None, 0), 'depthKnown': (None, 0), 'unknownTerm': (None, 0), 'pairs': (0, None),
          'stuckHard': (-20, -20), 'stuckSoft': (None, 0), 'clockDead': (-20, -20), 'clockPressure': (None, 0), 'clockDepth': (None, 0),
          'reveal': (0, None), 'isPair': (0, None), 'rang': (-20, -20), 'overflow': (-50, -50), 'flip': (0, 0), 'flipHit': (0, 0)}
def bounds(feat):
    return [BOUNDS.get(f, (None, None)) for f in feat]
def clip(w, feat):
    w = w.copy()
    for i, (lo, hi) in enumerate(bounds(feat)):
        if lo is not None: w[i] = max(w[i], lo)
        if hi is not None: w[i] = min(w[i], hi)
    return w   # parts are capped so one huge value cannot dominate (depth sums etc.)

def load(name):
    d = json.load(open(FILES[name]))
    games = [g for g in d['games'] if g['decisions']]
    return d['feat'], games

def decisions(games):
    out = []
    N = len(games)
    for gi, g in enumerate(games):
        rw = 0.5 ** ((N - 1 - gi) / HALF) if HALF else 1.0
        for dc in g['decisions']:
            if dc['k'] < 0 or len(dc['F']) < 2:
                continue
            F = np.clip(np.array(dc['F'], dtype=float), -CAP, CAP)
            # turning a tile over is decided by the per-situation habit (mimic_situ.py); the weights
            # are learned from the real moves only
            isflip = F[:, 19] > 0
            if isflip[dc['k']]:
                continue
            # KIND: only the options of the kind they chose (pair / single / fatal): which move of that kind
            if KIND:
                kd = np.where(isflip, 0, np.where(F[:, 18] > 0, 3, np.where(F[:, 14] > 0, 2, 1)))
                keep = kd == kd[dc['k']]
            else:
                keep = ~isflip
            if keep.sum() < 2:
                continue
            k = int(np.sum(keep[:dc['k']]))
            out.append((F[keep], k, rw))
    return out

def nll(w, ds, w0=None, lam=0.0):
    s = 0.0
    g = np.zeros_like(w)
    for F, k, rw in ds:
        v = F @ w
        m = v.max()
        e = np.exp(v - m)
        z = e.sum()
        s -= rw * (v[k] - m - math.log(z))
        p = e / z
        g -= rw * (F[k] - p @ F)
    if w0 is not None:
        s += lam * np.sum((w - w0) ** 2)
        g += 2 * lam * (w - w0)
    return s, g

FEAT_NAMES = None
def fit(ds, w0, lam):
    b = bounds(FEAT_NAMES)
    r = minimize(lambda w: nll(w, ds, w0, lam), clip(w0, FEAT_NAMES), jac=True, method='L-BFGS-B', bounds=b, options={'maxiter': 500})
    return r.x

def score(w, ds):
    ll, top = 0.0, 0
    for F, k, _ in ds:
        v = F @ w
        p = np.exp(v - v.max()); p /= p.sum()
        ll -= math.log(max(1e-4, p[k]))
        top += int(np.argmax(v) == k)
    return ll / max(1, len(ds)), top / max(1, len(ds))

def persona_w(feat, temp, tray, deep, unknown, free, pairs, clock, clockFocus, reveal):
    w = np.array([-tray[1], -tray[2], -tray[3], -deep, -unknown, -1, free, pairs, -1000, -20, -1000, -clock, -clockFocus, reveal, 0, 0, 0, -1e4, -1e4, 0, 0], dtype=float)
    return np.clip(w / temp, -200, 200)

if __name__ == '__main__':
    feat = None
    data = {}
    for n in NAMES:
        feat, games = load(n)
        cut = int(len(games) * 0.75)
        data[n] = {'train': decisions(games[:cut]), 'test': decisions(games[cut:]), 'all': decisions(games), 'games': len(games)}
    P = dict(tray=[0, 1, 3, 9], deep=1.0, free=0.25, pairs=0.8, clock=3)
    personas = {
        'strong': persona_w(feat, 1.5, unknown=0, clockFocus=1, reveal=8, **P),
        'sensible': persona_w(feat, 3, unknown=0, clockFocus=4, reveal=8, **P),
        'average': persona_w(feat, 4.5, unknown=0, clockFocus=4, reveal=8, **P),
    }
    FEAT_NAMES = feat
    start = clip(personas['sensible'] / 10, feat)
    # the family's weights (train parts of everyone)
    fam_train = sum((data[n]['train'] for n in NAMES), [])
    w_fam = fit(fam_train, start, 0.05)
    results = {}
    for n in NAMES:
        d = data[n]
        row = {'games': d['games'], 'train': len(d['train']), 'test': len(d['test'])}
        for pn, pw in personas.items():
            row[pn] = score(pw, d['test'])
        row['family'] = score(w_fam, d['test'])
        best = None
        for lam in (0.01, 0.1, 1.0, 10.0):
            w = fit(d['train'], w_fam, lam)
            sc = score(w, d['test'])
            row[f'own(lam={lam})'] = sc
            if best is None or sc[0] < best[1][0]:
                best = (lam, sc)
        row['best_lam'] = best[0]
        # the train-only weights and the moment the test part starts (for testing wins and losses)
        _, games = load(n)
        cut = int(len(games) * 0.75)
        row['train_w'] = fit(d['train'], w_fam, best[0]).tolist()
        row['cut_t'] = games[cut]['t'] if cut < len(games) else None
        results[n] = row
        print(n, json.dumps({k: (tuple(round(x, 3) for x in v) if isinstance(v, tuple) else v) for k, v in row.items() if k != 'train_w'}))
    # final weights: family on everything, each player on all their games with their best pull
    all_fam = sum((data[n]['all'] for n in NAMES), [])
    w_fam_all = fit(all_fam, start, 0.05)
    out = {'feat': feat, 'family': w_fam_all.tolist(), 'players': {}, 'test': results}
    for n in NAMES:
        w = fit(data[n]['all'], w_fam_all, results[n]['best_lam'])
        out['players'][n] = {'w': w.tolist(), 'lam': results[n]['best_lam'], 'decisions': len(data[n]['all']), 'peek': json.load(open(FILES[n])).get('peek', 1)}
        print(n, 'weights', ' '.join(f'{f}={x:.2f}' for f, x in zip(feat, w)))
    json.dump(out, open(OUT, 'w'), indent=1, default=lambda o: list(o) if isinstance(o, tuple) else o)
