"""What kind of move people make, per situation, from their recorded decisions (newest games weighted).
Situation: tiles waiting (0-3) x a safe pair known (p/n) x a face-down tile left to turn over (or '-')
x a seen match for a waiting tile free (m). Kinds: flip, match (a tile that fits a waiting one),
pair, single, fatal (a 4th tile without a partner).
    python3 mimic_types.py [half-life=20] [weights file]   (writes kinds into the weights file:
    players[name].kinds from all games, test[name].kinds from the games before the test cut)"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
HALF = float(sys.argv[1]) if len(sys.argv) > 1 else 20
FILE = sys.argv[2] if len(sys.argv) > 2 else None
PRIOR = 2
KINDS = ['flip', 'pair', 'single', 'fatal']
NAMES = {'Dennisisdebeste': 'Dennisisdebeste', 'Mrs. Doubtfire': 'Mrs_Doubtfire', 'PUK': 'PUK', 'Gerda': 'Gerda'}
def kind(f, t, ix):
    if f[ix['flip']]: return 'flip'
    if f[ix['overflow']]: return 'fatal'
    if f[ix['isPair']]: return 'pair'
    return 'single'
def table(games):
    N = len(games); tab = {}
    for gi, g in enumerate(games):
        rw = 0.5 ** ((N - 1 - gi) / HALF) if HALF else 1.0
        for dc in g['decisions']:
            if dc['k'] < 0: continue
            F = dc['F']; t = min(3, dc['tray'])
            kinds = [kind(f, t, IX) for f in F]
            key = f"t{t}{'p' if 'pair' in kinds else 'n'}{'' if 'flip' in kinds else '-'}"
            r = tab.setdefault(key, {}); r['n'] = r.get('n', 0) + rw
            c = kinds[dc['k']]; r[c] = r.get(c, 0) + rw
    return tab
def rates(tabs):
    fam = {}
    for tab in tabs.values():
        for k, r in tab.items():
            fam.setdefault(k, []).append({c: r.get(c, 0) / r['n'] for c in KINDS})
    fam = {k: {c: sum(x[c] for x in v) / len(v) for c in KINDS} for k, v in fam.items()}
    out = {}
    for n, tab in tabs.items():
        out[n] = {k: {c: round((tab.get(k, {}).get(c, 0) + PRIOR * f[c]) / (tab.get(k, {}).get('n', 0) + PRIOR), 3) for c in KINDS} for k, f in fam.items()}
    return out
D = {}
for n, fn in NAMES.items():
    d = json.load(open(os.path.join(HERE, 'mimic', fn + '.json'))); IX = {x: i for i, x in enumerate(d['feat'])}
    D[n] = d['games']
W = json.load(open(FILE)) if FILE else None
allR = rates({n: table(g) for n, g in D.items()})
trainR = rates({n: table([x for x in g if x['t'] < W['test'][n]['cut_t']]) for n, g in D.items()}) if W else None
for n in NAMES:
    print(n)
    for k in sorted(allR[n]):
        print(f"  {k:6s} " + '  '.join(f"{c} {allR[n][k][c]:.2f}" for c in KINDS))
    if W:
        W['players'][n]['kinds'] = allR[n]; W['test'][n]['kinds'] = trainR[n]
if W: json.dump(W, open(FILE, 'w'), indent=1)
