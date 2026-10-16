"""Per person, from their recorded decisions (mimic/<name>.json), with a pull towards the family:
  flipRate: how often they turn a tile over, per situation (tray 0-3, with / without a known safe pair)
  blunder3: with 3 waiting and a safe move known, the chance their move is a fatal 4th tile
Written into the given weights file (default mimic/weights.json).
    python3 mimic_habits.py [weights file]"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
FILE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'mimic', 'weights.json')
HALF = float(sys.argv[2]) if len(sys.argv) > 2 else 0     # recency half-life in games (0: all the same)
UNTIL = sys.argv[3] if len(sys.argv) > 3 else None          # 'train': only the games before the test cut
NAMES = {'Dennisisdebeste': 'Dennisisdebeste', 'Mrs. Doubtfire': 'Mrs_Doubtfire', 'PUK': 'PUK', 'Gerda': 'Gerda'}
PRIOR = 2
def sit(dc, ix):
    t = dc['tray']; F = dc['F']
    moves = [f for f in F if not f[ix['flip']]]
    pair = any(f[ix['isPair']] and (t < 3 or f[ix['overflow']] == 0) for f in moves)
    return f"t{min(t, 3)}{'p' if pair else 'n'}"
flips, blund = {}, {}
for n, f in NAMES.items():
    d = json.load(open(os.path.join(HERE, 'mimic', f + '.json'))); ix = {x: i for i, x in enumerate(d['feat'])}
    c = flips[n] = {}; b = blund[n] = [0, 0]
    games = d['games']
    if UNTIL == 'train':
        cut = json.load(open(FILE))['test'][n]['cut_t']; games = [g for g in games if g['t'] < cut]
    N = len(games)
    for gi, g in enumerate(games):
        rw = 0.5 ** ((N - 1 - gi) / HALF) if HALF else 1.0
        for dc in g['decisions']:
            if dc['k'] < 0: continue
            F = dc['F']; chosen = F[dc['k']]
            if any(x[ix['flip']] for x in F):
                s = sit(dc, ix); a = c.setdefault(s, [0, 0]); a[1] += rw; a[0] += rw if chosen[ix['flip']] else 0
            if dc['tray'] >= 3 and not chosen[ix['flip']]:
                moves = [x for x in F if not x[ix['flip']]]
                if any(x[ix['overflow']] for x in moves) and any(not x[ix['overflow']] for x in moves):
                    b[1] += rw; b[0] += rw if chosen[ix['overflow']] else 0
def famrate(per):
    v = [a / b for a, b in per if b]
    return sum(v) / len(v) if v else 0
fam = {}
for c in flips.values():
    for s, ab in c.items(): fam.setdefault(s, []).append(ab)
fam = {s: famrate(v) for s, v in fam.items()}
fb = famrate(blund.values())
W = json.load(open(FILE))
for n in NAMES:
    c = flips[n]
    key = 'trainHabits' if UNTIL == 'train' else None
    tgt = W['test'][n].setdefault('habits', {}) if key else W['players'][n]
    tgt['flipRate'] = {s: round((c.get(s, [0, 0])[0] + PRIOR * fr) / (c.get(s, [0, 0])[1] + PRIOR), 3) for s, fr in fam.items()}
    a, b = blund[n]
    tgt['blunder3'] = round((a + PRIOR * fb) / (b + PRIOR), 3)
    print(n, UNTIL or 'all', 'flipRate', tgt['flipRate'], '| blunder3', tgt['blunder3'], f'({a:.1f} of {b:.1f})')
json.dump(W, open(FILE, 'w'), indent=1)
