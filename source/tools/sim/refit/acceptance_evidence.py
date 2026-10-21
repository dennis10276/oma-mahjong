"""Independent, fail-closed evidence primitives. Reported PASS fields are never inputs."""
import hashlib
import json
import math
import os
import re
from pathlib import Path

NAMES = ('Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda')
GATE_DEPENDENCIES = {'G0': [], 'G1': [], 'G2': [], 'G3': ['G1', 'G2'],
                     'G4': ['G1', 'G2'], 'G5': ['G3', 'G4'],
                     'G6': ['G0', 'G1', 'G2', 'G3', 'G4', 'G5']}
BASELINE_SHA256 = 'e22d59e8eb4c26bbe219ec257cc6963c6296fe6e7ea7fa9df589bfdd88c4f199'
CONTRACT_SHA256 = 'f0f445635577877f122785c5504856fbba2756db113083ded7ac3de2a8ff017b'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def contained(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f'Path escapes repository: {relative}')
    return path


def verify_baseline(root, baseline_bytes):
    errors = []
    if digest(baseline_bytes) != BASELINE_SHA256:
        return ['Independent baseline was changed; do not rebaseline to erase failures']
    baseline = json.loads(baseline_bytes)
    for relative, expected in baseline['immutableFiles'].items():
        path = contained(root, relative)
        if not path.exists() or digest(path.read_bytes()) != expected:
            errors.append(f'Protected historical artifact changed: {relative}')
    prefix = baseline['experimentPrefix']
    history = (root / 'EXPERIMENTS.jsonl').read_bytes()
    if len(history) < prefix['bytes'] or digest(history[:prefix['bytes']]) != prefix['sha256']:
        errors.append('Experiment history was truncated or rewritten')
    ids = set()
    for number, line in enumerate(history.decode('utf-8-sig').splitlines(), 1):
        try:
            experiment = json.loads(line)
            ident = experiment['experimentId']
            if ident in ids:
                errors.append(f'Duplicate experiment ID: {ident}')
            ids.add(ident)
        except (ValueError, KeyError, TypeError):
            errors.append(f'Malformed experiment at line {number}')
    return errors


def parse_contract(raw):
    """One leaf per original requirement line; headings roll up their children.

    Keep the exact original text and source line. Outputs cannot remove inconvenient rows.
    """
    if digest(raw) != CONTRACT_SHA256:
        raise ValueError('Execution contract bytes differ from the user-supplied contract')
    rows, section, headings = [], 0, []
    counts = {}
    for line_number, line in enumerate(raw.decode('utf-8-sig').splitlines(), 1):
        text = line.strip()
        if not text:
            continue
        heading = re.match(r'^(\d+)\. [A-Z]', text)
        if heading:
            section = int(heading[1])
            headings.append((section, line_number, text))
            continue
        # Source path / introduction are requirements too, not invisible comments.
        counts[section] = counts.get(section, 0) + 1
        gate = {0: 'G0', 1: 'G0', 2: 'G0', 3: 'G1', 4: 'G2', 5: 'G3',
                6: 'G4', 7: 'G5', 8: 'G6', 9: 'G0', 10: 'G0'}[section]
        if section == 0 and ('→' in text or 'bypass this pipeline' in text):
            gate = 'G5'
        if section == 3 and ('Bind the actual forecast' in text or 'Preserve existing ledgers' in text):
            gate = 'G0'
        rows.append({'id': f'R{section:02d}.{counts[section]:03d}', 'section': section,
                     'sourceLine': line_number, 'requirement': text, 'gate': gate,
                     'dependsOn': GATE_DEPENDENCIES[gate]})
    # Every numbered section is represented as a parent, in addition to its
    # verbatim subclauses. A parent has no independently editable PASS field.
    for number, line, text in headings:
        children = [r['id'] for r in rows if r['section'] == number]
        gate = {1: 'G0', 2: 'G0', 3: 'G1', 4: 'G2', 5: 'G3', 6: 'G4',
                7: 'G5', 8: 'G6', 9: 'G0', 10: 'G0'}[number]
        rows.append({'id': f'S{number:02d}', 'section': number, 'sourceLine': line,
                     'requirement': text, 'gate': gate, 'dependsOn': GATE_DEPENDENCIES[gate],
                     'children': children})
    return sorted(rows, key=lambda r: r['sourceLine'])


def fidelity_errors(results):
    """A failed person cannot be hidden by average accuracy or a process exit code."""
    errors = []
    if set(results) != set(NAMES):
        errors.append('Fidelity results must include exactly all four people')
    for name in NAMES:
        row = results.get(name, {})
        accuracy = row.get('top1Accuracy', {})
        personal, random = accuracy.get('personalBot'), accuracy.get('randomBaseline')
        if not isinstance(row.get('evaluatedDecisions'), int) or row['evaluatedDecisions'] < 20:
            errors.append(f'{name}: fewer than 20 evaluated decisions')
        if (not finite(personal) or not finite(random) or not 0 <= personal <= 1
                or not 0 < random <= 1 or personal <= random):
            errors.append(f'{name}: personal action accuracy does not beat random ({personal} vs {random})')
        if row.get('personalFidelityVerified') is not True:
            errors.append(f'{name}: evaluator itself reports fidelity unverified')
    return errors


def tray_comparison_errors(results):
    errors = []
    if not isinstance(results, dict) or set(results) != set(NAMES):
        return ['Tray comparison results must include exactly all four people']
    for name in NAMES:
        row = results.get(name, {})
        human = row.get('humanTrayDistribution', {})
        bot = row.get('botTrayDistribution', {})
        comp = row.get('trayComparison', {})
        if not all(isinstance(human.get(str(k)), (int, float)) for k in range(4)):
            errors.append(f'{name}: human tray distribution missing or invalid')
        if not all(isinstance(bot.get(str(k)), (int, float)) for k in range(4)):
            errors.append(f'{name}: simulated bot tray distribution missing or invalid')
        tvd = comp.get('totalVariationDistance')
        if not finite(tvd) or tvd < 0 or tvd > 0.50:
            errors.append(f'{name}: bot-versus-human tray TVD exceeds tolerance ({tvd})')
        if comp.get('replicatesDistribution') is not True:
            errors.append(f'{name}: evaluator reports tray distribution not replicated')
    return errors


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def scoring(prediction, actual):
    if prediction >= 8 and actual >= 8:
        return True
    tolerance = 0 if actual <= 3 else 1 if actual <= 5 else 2
    return abs(prediction - actual) <= tolerance


def point_forecast(distribution):
    mode = min(range(1, 9), key=lambda a: (-distribution.get(f'try{a}', 0), a))
    if distribution.get('noClear', 0) > distribution.get(f'try{mode}', 0):
        mode = 8
    scores = {p: sum(distribution.get(f'try{a}', 0) * scoring(p, a) for a in range(1, 9))
              + distribution.get('noClear', 0) * scoring(p, 8) for p in range(1, 9)}
    best = max(scores.values())
    return min((p for p in scores if abs(scores[p] - best) < 1e-9), key=lambda p: (abs(p - mode), p))


def required_sources(root, forecasts, generator=None):
    """Transitive local imports plus dynamically loaded tables and replay inputs.

    This discovers literal local requires, including path.join(__dirname, ...), rather
    than trusting the candidate's list. Unknown dynamic requires fail closed.
    """
    gen_file = (root / generator).resolve() if generator else (root / 'source/tools/sim/refit/generate_personal_witness_v3.js')
    pending = [gen_file]
    found = set()
    while pending:
        filename = pending.pop().resolve()
        relative = filename.relative_to(root.resolve()).as_posix()
        if relative in found:
            continue
        found.add(relative)
        source = filename.read_text(encoding='utf-8')
        for request in re.findall(r"require\(['\"](\.[^'\"]+)['\"]\)", source):
            dep = (filename.parent / request).resolve()
            if not dep.suffix:
                dep = dep.with_suffix('.js')
            if not dep.is_relative_to(root.resolve()):
                raise ValueError(f'Import escapes repository: {relative}')
            pending.append(dep)
        # The loader uses require(path.join(__dirname, ...)) for layouts.js.
        if 'require(path.join(' in source:
            if filename.name != 'mimic_games.js':
                raise ValueError(f'Unresolved dynamic dependency in {relative}')
            pending.append(root / 'source/www/layouts.js')
        require_calls = re.findall(r'\brequire\s*\(([^\n;]+)', source)
        for call in require_calls:
            if not re.match(r"\s*['\"]", call) and not call.startswith('path.join('):
                raise ValueError(f'Unresolved dynamic dependency in {relative}: {call}')
    found.add('source/analysis/personal-bots/personal-behavioral-fit.json')
    replay_dir = root / 'source/analysis/archive/replays'
    for pid in ('pmuy78xu6tsths9', 'pmv16kj3jr35750', 'pmv2gaa0g00eq3q', 'pmv6yhzz3x9oxs8'):
        found.add((replay_dir / f'{pid}.json').relative_to(root).as_posix())
    # boards.js selects these dynamically via board_versions.js. Include all tables
    # rather than guessing the board version from a forecast's display field.
    found.update(p.relative_to(root).as_posix() for p in (root / 'source/tools/sim/refit/tables').glob('*.js'))
    return found


def validate_sources(root, anchor):
    errors = []
    if os.environ.get('TABLES'):
        errors.append('TABLES overrides default board inputs; external tables require a separately bound candidate')
    bound = anchor.get('quantitativeSourceHashes', {})
    if not isinstance(bound, dict):
        return ['Missing quantitative source hashes']
    expected = required_sources(root, anchor.get('forecasts', []), generator=anchor.get('generator'))
    for relative in sorted(expected - set(bound)):
        errors.append(f'Unbound dependency/input: {relative}')
    for relative, value in bound.items():
        try:
            target = contained(root, relative)
            if not re.fullmatch(r'[a-f0-9]{64}', str(value)) or digest(target.read_bytes()) != value:
                errors.append(f'Source hash mismatch: {relative}')
        except (OSError, ValueError):
            errors.append(f'Unavailable or unsafe bound source: {relative}')
    return errors


def validate_campaigns(anchor):
    """Recompute distributions/points; never accept merely present JSON keys."""
    errors, seen = [], set()
    forecasts = anchor.get('forecasts', [])
    if not forecasts:
        return ['No forecasts']
    for fc in forecasts:
        key = (fc.get('name'), fc.get('lv'))
        label = f'{key[0]} L{key[1]}'
        if key in seen:
            errors.append(f'{label}: duplicate forecast')
        seen.add(key)
        if key[0] not in NAMES:
            errors.append(f'{label}: unknown person')
        count = fc.get('campaignCount')
        campaigns = fc.get('campaignResults')
        if type(count) is not int or count < 2 or not isinstance(campaigns, list) or len(campaigns) != count:
            errors.append(f'{label}: individual campaign results are missing or do not match count')
            continue
        dist = {f'try{a}': 0 for a in range(1, 9)}
        dist['noClear'] = 0
        seeds = set()
        for campaign in campaigns:
            seed, won = campaign.get('seed'), campaign.get('wonOn')
            history = campaign.get('history', [])
            if type(seed) is not int or seed in seeds:
                errors.append(f'{label}: missing or duplicate seed')
            seeds.add(seed)
            if not history or any(h.get('status') not in ('physicalLoss', 'cleared', 'unresolved') for h in history):
                errors.append(f'{label}: missing or invalid physical attempt history')
            if any(h.get('status') != 'physicalLoss' for h in history[:-1]):
                errors.append(f'{label}: retry after clear or numerical censoring')
            if won is None:
                if not history or history[-1].get('status') != 'physicalLoss' or len(history) != 8:
                    errors.append(f'{label}: unresolved/censored campaign cannot be scored as noClear/try8')
                dist['noClear'] += 1 / count
            elif type(won) is int and 1 <= won <= 8:
                if len(history) != won or history[-1].get('status') != 'cleared':
                    errors.append(f'{label}: wonOn does not match actual clear history')
                dist[f'try{won}'] += 1 / count
            else:
                errors.append(f'{label}: invalid clear attempt')
        reported = fc.get('campaignDistribution', {})
        if set(reported) != set(dist) or any(not finite(reported.get(k)) or
                abs(reported[k] - v) > 0.00011 for k, v in dist.items()):
            errors.append(f'{label}: distribution does not reproduce from every campaign')
        if fc.get('predictedAttempt') != point_forecast(dist):
            errors.append(f'{label}: prediction bypasses declared distribution/scoring rule')
        # Stability must be assessed with a preregistered procedure; presence of a
        # delta alone does not prove reliability. This audit intentionally does not
        # invent a tolerance after observing these results.
    return errors


def validate_stability(anchor):
    criterion = anchor.get('convergenceCriterion')
    if not isinstance(criterion, dict):
        return ['No preregistered convergence criterion or complete individual campaign record establishes Monte Carlo stability']
    threshold = criterion.get('threshold')
    metric = criterion.get('metric')
    min_campaigns = criterion.get('minCampaigns', 2)
    if not finite(threshold) or threshold <= 0 or metric != 'halfSplitWasserstein':
        return ['Invalid or unsupported preregistered convergence criterion']
    forecasts = anchor.get('forecasts', [])
    if not forecasts:
        return ['No forecasts to evaluate stability']
    errors = []
    for fc in forecasts:
        label = f"{fc.get('name')} L{fc.get('lv')}"
        campaigns = fc.get('campaignResults')
        if not isinstance(campaigns, list) or len(campaigns) < min_campaigns:
            errors.append(f'{label}: campaign count below minimum ({len(campaigns) if isinstance(campaigns, list) else 0} < {min_campaigns})')
            continue
        half = len(campaigns) // 2
        h1 = campaigns[:half]
        h2 = campaigns[half:]
        d1 = {f'try{a}': 0 for a in range(1, 9)}
        d1['noClear'] = 0
        d2 = {f'try{a}': 0 for a in range(1, 9)}
        d2['noClear'] = 0
        for c in h1:
            w = c.get('wonOn')
            if w is None: d1['noClear'] += 1 / len(h1)
            elif type(w) is int and 1 <= w <= 8: d1[f'try{w}'] += 1 / len(h1)
        for c in h2:
            w = c.get('wonOn')
            if w is None: d2['noClear'] += 1 / len(h2)
            elif type(w) is int and 1 <= w <= 8: d2[f'try{w}'] += 1 / len(h2)
        cdf1, cdf2, w1 = 0, 0, 0
        for a in range(1, 8):
            cdf1 += d1[f'try{a}']
            cdf2 += d2[f'try{a}']
            w1 += abs(cdf1 - cdf2)
        if w1 > threshold + 1e-6:
            errors.append(f'{label}: half-split stability distance {round(w1, 3)} exceeds preregistered threshold {threshold}')
    return errors


def prospective_errors(report):
    errors = []
    if report.get('warnings'):
        errors.extend(report['warnings'])
    if report.get('numericalTarget80Met') is not True:
        errors.append('The scorer has not met the complete per-person prospective target')
    for name in NAMES:
        cohort = report.get('players', {}).get(name, {}).get('cohort', {})
        if any(cohort.get(k) != 20 for k in ('opened', 'completed', 'eligibleFrozenForecasts')):
            errors.append(f'{name}: requires exactly 20 first consecutive games, completed and forecast before opening')
        correct, accuracy = cohort.get('correct'), cohort.get('accuracy')
        if type(correct) is not int or not 16 <= correct <= 20 or not finite(accuracy) or abs(accuracy - correct / 20) > 1e-12:
            errors.append(f'{name}: cohort accuracy must be at least 16/20')
        if cohort.get('pending') != 0 or cohort.get('missingForecastsOrOpening') != 0:
            errors.append(f'{name}: missing, pending, or race-opened games remain in the denominator')
    return errors


def rollup(rows, checks):
    """ALL leaves and ALL dependencies required. Unknown evidence is never success."""
    by_id = {r['id']: r for r in rows}
    if len(by_id) != len(rows):
        raise ValueError('Duplicate requirement IDs')
    if any(r['gate'] not in GATE_DEPENDENCIES for r in rows):
        raise ValueError('Unknown gate cannot disappear from acceptance')
    statuses = {}

    def status_of(row, visiting=None):
        if row['id'] in statuses:
            return statuses[row['id']]
        visiting = set() if visiting is None else visiting
        if row['id'] in visiting:
            return 'UNVERIFIED'
        visiting = visiting | {row['id']}
        if row.get('children'):
            child_status = [status_of(by_id[c], visiting) if c in by_id else 'UNVERIFIED' for c in row['children']]
            status = 'FAIL' if 'FAIL' in child_status else 'PASS' if all(s == 'PASS' for s in child_status) else 'UNVERIFIED'
            statuses[row['id']] = status
            return status
        ids = row.get('checks', [])
        check_status = [checks.get(key, {}).get('status', 'UNVERIFIED') for key in ids]
        status = ('FAIL' if 'FAIL' in check_status else 'UNVERIFIED' if not ids or
                  any(s != 'PASS' for s in check_status) else 'PASS')
        statuses[row['id']] = status
        return status

    evaluated = []
    for row in rows:
        status = status_of(row)
        evaluated.append({**row, 'status': status})
    gates = {}
    for gate, deps in GATE_DEPENDENCIES.items():
        children = [r for r in evaluated if r['gate'] == gate]
        local = bool(children) and all(r['status'] == 'PASS' for r in children)
        dependencies = all(gates[d]['passed'] for d in deps)
        gates[gate] = {'passed': local and dependencies,
                       'status': 'PASS' if local and dependencies else 'BLOCKED' if not dependencies else 'INCOMPLETE',
                       'dependsOn': deps, 'unmetDependencies': [d for d in deps if not gates[d]['passed']],
                       'requirements': len(children), 'verifiedRequirements': sum(r['status'] == 'PASS' for r in children),
                       'unmetRequirements': [r['id'] for r in children if r['status'] != 'PASS']}
    return evaluated, gates
