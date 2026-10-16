"""Per person: how often they turn a tile over in each situation (tray 0, 1, 2 with / without a known
pair, 3 with / without a safe pair), from mimic/<name>.json, with a pull towards the family (so a
situation they rarely met borrows from everyone). Writes flipRate into mimic/weights.json."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = {'Dennisisdebeste': 'Dennisisdebeste', 'Mrs. Doubtfire': 'Mrs_Doubtfire', 'PUK': 'PUK', 'Gerda': 'Gerda'}
def sit(dc, ix):
    t = dc['tray']; F = dc['F']
    moves = [f for f in F if not f[ix['flip']]]
    pair = any(f[ix['isPair']] and (t < 3 or f[ix['overflow']] == 0) for f in moves)
    return f"t{min(t, 3)}{'p' if pair else 'n'}"
counts = {}
for n, f in NAMES.items():
    d = json.load(open(os.path.join(HERE, 'mimic', f + '.json'))); ix = {x: i for i, x in enumerate(d['feat'])}
    c = counts[n] = {}
    for g in d['games']:
        for dc in g['decisions']:
            if dc['k'] < 0 or not any(F[ix['flip']] for F in dc['F']):
                continue          # only where turning a tile over was possible
            s = sit(dc, ix); a = c.setdefault(s, [0, 0]); a[1] += 1; a[0] += 1 if dc['F'][dc['k']][ix['flip']] else 0
# the family's rate per situation: the average of the persons' own rates (not pooled counts, so the
# person with the most games does not decide it for everyone)
fam = {}
for c in counts.values():
    for s, (a, b) in c.items():
        if b: fam.setdefault(s, []).append(a / b)
fam = {s: [sum(v) / len(v), 1] for s, v in fam.items()}
PRIOR = 2
W = json.load(open(os.path.join(HERE, 'mimic', 'weights.json')))
for n, c in counts.items():
    rate = {}
    for s, (a, b) in fam.items():
        mine = c.get(s, [0, 0]); fr = a / b
        rate[s] = round((mine[0] + PRIOR * fr) / (mine[1] + PRIOR), 3)
    W['players'][n]['flipRate'] = rate
    print(n, rate, {s: c.get(s, [0, 0]) for s in sorted(fam)})
json.dump(W, open(os.path.join(HERE, 'mimic', 'weights.json'), 'w'), indent=1)
