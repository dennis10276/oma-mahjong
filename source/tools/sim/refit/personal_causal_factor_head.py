import json
from pathlib import Path

import numpy as np

from attempt_count_fit import is_correct, own_mode


ROOT = Path(__file__).resolve().parents[3]
FEATURE_ARCHIVE = ROOT / 'analysis/personal-bots/personal-causal-factor-features.json'
FALLBACK_ARCHIVE = ROOT / 'analysis/archive/personal-bots/personal-causal-factor-features.json'

RAW_FEATURE_NAMES = (
    'str',
    'avg',
    'hasClock',
    'n',
    'openPairs',
    'blockedFreeCount',
    'takeableWithTakeableMate',
    'meanMateDepth',
    'takeableWithVisMateFrac',
    'clockSlackRatio',
    'sf14_w3',
    'sf14_w5',
    'sf14_w8',
    's14_t1Left',
    'p8_t1Dec',
    'np8_w8',
    'kp8_w8',
    'ab8_w5',
    'kz8_w5',
    'ce8_w5',
    'np8_j2',
    'np8_j3',
    'kp8_j2',
    'ap8_j2',
    'base_t1',
    'base_w2',
)
RAW_IDX = {name: i for i, name in enumerate(RAW_FEATURE_NAMES)}

FACTOR_NAMES = (
    'bot_surv',
    'sf14_surv',
    'mem_surv',
    'base_solv',
    'retry_jump',
    'open_trap',
    'shallow_large',
    'buried_mate',
    'clock_tight',
    'p8_dec',
)
F_IDX = {name: i for i, name in enumerate(FACTOR_NAMES)}

_TABLE_CACHE = None


def _load_table():
    global _TABLE_CACHE
    if _TABLE_CACHE is None:
        if FEATURE_ARCHIVE.exists():
            _TABLE_CACHE = json.loads(FEATURE_ARCHIVE.read_text(encoding='utf-8'))
        elif FALLBACK_ARCHIVE.exists():
            _TABLE_CACHE = json.loads(FALLBACK_ARCHIVE.read_text(encoding='utf-8'))
        else:
            _TABLE_CACHE = {'byStart': {}, 'byLevelBoard': {}}
    return _TABLE_CACHE


def _fallback_feature_dict(row):
    phys = [float(x) for x in row.get('physical', [72, 0.5, 3, 20, 2, 0.1, 1, 0, 0, 0, 36])]
    ref = row.get('reference', {'strong': 0.8, 'average': 0.5})
    str_r = float(ref.get('strong', 0.8))
    avg_r = float(ref.get('average', str_r))
    chains = row.get('chains', {})
    c_b0 = chains.get('ownOutcomeBase0') or next(iter(chains.values()), {'within': [0.5] * 8})
    c_s0 = chains.get('ownOutcomeStyles0') or c_b0
    w_b = [float(x) for x in c_b0.get('within', [0.5] * 8)]
    w_s = [float(x) for x in c_s0.get('within', [0.5] * 8)]
    while len(w_b) < 8:
        w_b.append(w_b[-1] if w_b else 0.5)
    while len(w_s) < 8:
        w_s.append(w_s[-1] if w_s else 0.5)
    b_t1 = float(c_b0.get('first', w_b[0]))
    s_t1 = float(c_s0.get('first', w_s[0]))
    has_clk = float(phys[6]) if len(phys) > 6 else 0.0
    clk_ratio = float(phys[5]) if len(phys) > 5 else 0.0
    return {
        'str': str_r,
        'avg': avg_r,
        'hasClock': has_clk,
        'n': float(phys[0]),
        'openPairs': float(phys[4]),
        'blockedFreeCount': max(0.0, float(phys[3]) - 2.0 * float(phys[4])),
        'takeableWithTakeableMate': 2.0 * float(phys[4]),
        'meanMateDepth': 0.5 * float(phys[2]),
        'takeableWithVisMateFrac': max(0.0, 1.0 - float(phys[1])),
        'clockSlackRatio': (1.0 / max(clk_ratio, 0.05)) if has_clk == 1.0 else 9.9,
        'sf14_w3': w_s[2],
        'sf14_w5': w_s[4],
        'sf14_w8': w_s[7],
        's14_t1Left': max(0.0, 1.0 - s_t1),
        'p8_t1Dec': 0.35,
        'np8_w8': w_s[7],
        'kp8_w8': w_s[7],
        'ab8_w5': w_s[4],
        'kz8_w5': w_s[4],
        'ce8_w5': w_s[4],
        'np8_j2': w_s[1] - s_t1,
        'np8_j3': w_s[2] - s_t1,
        'kp8_j2': w_s[1] - s_t1,
        'ap8_j2': w_s[1] - s_t1,
        'base_t1': b_t1,
        'base_w2': w_b[1],
    }


def feature_dict_of(row):
    if 'causalFactorFeatures' in row:
        base = dict(row['causalFactorFeatures'])
    else:
        table = _load_table()
        board = row.get('board', '')
        name = row.get('name', '')
        rec = None
        if row.get('kind') != 'future' and 'start' in row:
            rec = table['byStart'].get(f"{name}|{row['start']}|{board}")
        if rec is None and 'lv' in row:
            rec = table['byLevelBoard'].get(f"{name}|lv={row['lv']}|{board}")
        if rec is not None:
            base = dict(rec['features'])
        else:
            base = _fallback_feature_dict(row)
    if 'reference' in row:
        if 'strong' in row['reference']:
            base['str'] = float(row['reference']['strong'])
        if 'average' in row['reference']:
            base['avg'] = float(row['reference']['average'])
    if 'physical' in row and len(row['physical']) >= 7:
        base['n'] = float(row['physical'][0])
        base['openPairs'] = float(row['physical'][4])
        base['hasClock'] = float(row['physical'][6])
    return base


def feature_vector_of(row):
    d = feature_dict_of(row)
    return np.array([float(d[k]) for k in RAW_FEATURE_NAMES], dtype=np.float64)


def is_severe_trap(d):
    return (
        d['avg'] <= 0.08
        or (d['str'] <= 0.35 and d['avg'] <= 0.20)
        or (d['avg'] <= 0.17 and d['kp8_w8'] <= 0.70)
        or (
            d['str'] <= 0.45
            and d['np8_w8'] <= 0.08
            and d['kp8_w8'] <= 0.25
            and d['base_t1'] <= 0.32
            and d['sf14_w8'] <= 0.40
        )
    )


def regime_zscore(clean_before, target, win_size=25):
    d_t = feature_dict_of(target)
    t_clk = d_t['hasClock']
    same_clk = [r for r in clean_before if feature_dict_of(r)['hasClock'] == t_clk][-win_size:]
    recent_all = clean_before[-win_size:]
    x_t = feature_vector_of(target)
    if len(same_clk) >= 3:
        Xs = np.array([feature_vector_of(r) for r in same_clk], dtype=np.float64)
        mt = np.mean(Xs, axis=0)
        st = np.maximum(np.std(Xs, axis=0), 1e-6)
    else:
        X_rec = np.array([feature_vector_of(r) for r in recent_all], dtype=np.float64)
        mt = np.mean(X_rec, axis=0)
        st = np.maximum(np.std(X_rec, axis=0), 1e-6)
    return np.clip((x_t - mt) / st, -2.5, 2.5)


def z_to_factors(z_vec):
    g = lambda k: z_vec[..., RAW_IDX[k]]
    bot_surv = (g('sf14_w5') + g('sf14_w8') + g('np8_w8') + g('ab8_w5') + g('kz8_w5') + g('ce8_w5')) / 6.0
    sf14_surv = (g('sf14_w3') + g('sf14_w5') + g('sf14_w8')) / 3.0 - 0.5 * g('s14_t1Left')
    mem_surv = (g('kz8_w5') + g('ce8_w5') + g('np8_w8') + g('ab8_w5')) / 4.0
    base_solv = (g('avg') + g('base_t1') + g('base_w2')) / 3.0
    retry_jump = (g('np8_j2') + g('np8_j3') + g('kp8_j2') + g('ap8_j2')) / 4.0
    open_trap = (g('openPairs') + g('blockedFreeCount') + g('takeableWithTakeableMate')) / 3.0
    shallow_large = (g('n') - g('meanMateDepth')) / 1.41421356
    buried_mate = (g('meanMateDepth') - g('takeableWithVisMateFrac')) / 1.41421356
    clock_tight = -g('clockSlackRatio')
    p8_dec = g('p8_t1Dec')
    return np.stack(
        [bot_surv, sf14_surv, mem_surv, base_solv, retry_jump, open_trap, shallow_large, buried_mate, clock_tight, p8_dec],
        axis=-1,
    )


def choose_bucket3_action(before_all, target):
    own_before = _own_strictly_earlier(before_all, target)
    b_37 = [b for b in own_before if not is_severe_trap(feature_dict_of(b)) and 3 <= b['wonOn'] <= 7][-7:]
    if not b_37:
        return 3
    u3 = sum(is_correct(3, b['wonOn']) for b in b_37)
    u5 = sum(is_correct(5, b['wonOn']) for b in b_37)
    mean_w = float(np.mean([b['wonOn'] for b in b_37]))
    has_clk = feature_dict_of(target)['hasClock'] == 1.0
    if u5 > u3 or (u5 == u3 and mean_w > 4.05 and has_clk):
        return 5
    return 3


def _own_strictly_earlier(before, target):
    t_name = target.get('name')
    t_start = target.get('start', float('inf'))
    return sorted(
        [
            r
            for r in before
            if r.get('name') == t_name
            and r.get('wonOn') is not None
            and r.get('end', t_start) < t_start
            and not r.get('assisted', False)
            and not r.get('boardChangedWithinCampaign', False)
            and r.get('firstAttempt', 1) == 1
            and r.get('firstClear', True) is True
        ],
        key=lambda r: r['end'],
    )


def predict_causal_3bucket(before, target):
    own_before = _own_strictly_earlier(before, target)
    if len(own_before) < 6:
        return own_mode(own_before, target)

    d_t = feature_dict_of(target)
    has_recent_8plus = any(r['wonOn'] >= 6 for r in own_before[-40:])
    if is_severe_trap(d_t) and has_recent_8plus:
        return 8

    clean_before = [r for r in own_before if not is_severe_trap(feature_dict_of(r))]
    if len(clean_before) < 6:
        return own_mode(own_before, target)

    z_t = regime_zscore(clean_before, target, win_size=25)
    f_t = z_to_factors(z_t)
    g = lambda k: float(f_t[F_IDX[k]])

    has_clock = d_t['hasClock'] == 1.0
    same_clk = [r for r in clean_before if feature_dict_of(r)['hasClock'] == d_t['hasClock']]
    if has_clock and len(same_clk) < 3:
        if g('base_solv') <= -1.20 and g('open_trap') >= 1.80:
            return 8
        return 1

    b3_action = choose_bucket3_action(own_before, target)
    recent_clean = clean_before[-25:]
    p_ge3_rate = float(np.mean([r['wonOn'] >= 3 for r in recent_clean]))
    p2_rate = float(np.mean([r['wonOn'] == 2 for r in recent_clean]))

    if has_clock and b3_action == 3:
        if (
            g('sf14_surv') < -0.35
            and g('retry_jump') < -0.40
            and (g('p8_dec') > -1.20 or g('open_trap') > 1.00)
            and g('base_solv') < 1.00
            and (
                (g('clock_tight') > 0.0 and (g('base_solv') > -0.60 or g('buried_mate') >= 1.50))
                or (g('sf14_surv') < -1.30 and g('base_solv') <= -1.20 and g('clock_tight') < 0.0)
            )
        ) or (g('clock_tight') >= 1.20 and g('base_solv') >= -0.70 and g('sf14_surv') >= 1.20):
            return b3_action
        if (
            (g('base_solv') <= -1.20 and g('clock_tight') < 0.20 and g('buried_mate') < 0.70)
            or (
                g('open_trap') >= 1.30
                and g('buried_mate') < 0.0
                and g('shallow_large') > -0.15
                and (g('clock_tight') < 1.10 or g('sf14_surv') < 1.20)
            )
            or (
                g('sf14_surv') < -0.35
                and g('retry_jump') < -0.40
                and g('buried_mate') < 0.70
                and g('clock_tight') > -1.00
                and g('base_solv') < 1.00
                and g('p8_dec') > -1.20
            )
        ):
            return 2
        return 1

    if has_clock and b3_action == 5:
        if (
            g('mem_surv') >= 0.15
            and g('open_trap') < 1.40
            and not (g('base_solv') <= -1.20 and g('retry_jump') < -0.55)
        ) or (g('buried_mate') >= 1.85 and g('open_trap') <= -0.60):
            return 1
        if (g('open_trap') >= 1.40 and g('base_solv') > 0.50 and g('p8_dec') > 1.50) or (
            g('base_solv') <= -1.20 and g('retry_jump') < -0.55 and g('mem_surv') >= 0.15
        ):
            return 2
        if g('open_trap') >= 1.40 or g('clock_tight') >= 0.20:
            return b3_action
        return 2

    if not has_clock and not (p_ge3_rate >= 0.16 and (p2_rate >= 0.20 or len(clean_before) < 20)):
        if g('sf14_surv') < -2.00:
            if g('retry_jump') > 0.0 and g('sf14_surv') < -2.50:
                return 2
            if g('retry_jump') <= 0.0 and (g('buried_mate') > 1.00 or g('open_trap') >= 1.80):
                return b3_action
        if g('retry_jump') >= 1.45 and g('buried_mate') >= 2.60:
            return 2
        return 1

    if g('sf14_surv') < -2.50 and g('base_solv') <= -1.20 and g('open_trap') >= 1.40:
        return 8
    if (
        1.40 <= g('shallow_large') <= 2.10
        and g('open_trap') < 1.20
        and (g('sf14_surv') - g('mem_surv')) < 1.40
    ) or (
        g('retry_jump') >= 1.15 and g('open_trap') > 0.20 and g('shallow_large') < 1.40
    ) or (
        g('p8_dec') <= -1.50
    ):
        return 2
    if (
        (g('open_trap') <= -1.00 and (g('sf14_surv') < -2.00 or (g('mem_surv') >= 0.95 and g('buried_mate') >= 0.30)))
        or (0.85 <= g('shallow_large') < 1.40 and (g('base_solv') < 0.0 or g('open_trap') <= -1.00) and g('p8_dec') < 1.70)
        or g('sf14_surv') >= 1.40
    ):
        return b3_action
    return 1
