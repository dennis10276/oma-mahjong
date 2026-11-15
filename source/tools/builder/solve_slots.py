"""Assign original tile identities to a compact pile without changing the puzzle data."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'build' / 'footprint-solver'))
from ortools.sat.python import cp_model


def solve(request):
    d, slots = request['design'], request['hint']
    n = len(slots)
    model = cp_model.CpModel()
    position = {tile: rank for rank, tile in enumerate(d['solution'])}
    slot_at_rank = [model.new_int_var(0, n - 1, f'slot{r}') for r in range(n)]
    rank_at_slot = [model.new_int_var(0, n - 1, f'rank{s}') for s in range(n)]
    model.add_inverse(slot_at_rank, rank_at_slot)
    tile_slot = [slot_at_rank[position[i]] for i in range(n)]
    for i, slot in request.get('fixedTileSlots', []):
        model.add(tile_slot[i] == slot)
    true, false = model.new_constant(1), model.new_constant(0)

    def conjunction(values):
        values = list(values)
        if not values:
            return true
        q = model.new_bool_var('and')
        model.add_bool_and(values).only_enforce_if(q)
        model.add_bool_or([v.Not() for v in values] + [q])
        return q

    def less(variable, value):
        q = model.new_bool_var('lt')
        model.add(variable < value).only_enforce_if(q)
        model.add(variable >= value).only_enforce_if(q.Not())
        return q

    above, below, left, right, adjacent = [[[] for _ in range(n)] for _ in range(5)]
    for i, (x, y, z) in enumerate(slots):
        for j, (xx, yy, zz) in enumerate(slots):
            if i == j:
                continue
            dx, dy, dz = abs(x - xx), abs(y - yy), abs(z - zz)
            if dx < 2 and dy < 2:
                if zz > z:
                    above[i].append(j)
                    model.add(rank_at_slot[j] < rank_at_slot[i])
                elif zz < z:
                    below[i].append(j)
            if zz == z and dy < 2:
                if xx == x - 2:
                    left[i].append(j)
                if xx == x + 2:
                    right[i].append(j)
            if dz == 0 and dx <= 2 and dy <= 2 and (dx < 2 or dy < 2) or dz == 1 and dx < 2 and dy < 2:
                adjacent[i].append(j)
        if left[i] and right[i]:
            l = model.new_int_var(0, n - 1, 'leftmax')
            r = model.new_int_var(0, n - 1, 'rightmax')
            model.add_max_equality(l, [rank_at_slot[j] for j in left[i]])
            model.add_max_equality(r, [rank_at_slot[j] for j in right[i]])
            model.add_bool_or([less(l, rank_at_slot[i]), less(r, rank_at_slot[i])])

    removed_before = {}

    def gone(slot, step):
        key = (slot, step)
        if key not in removed_before:
            removed_before[key] = less(rank_at_slot[slot], step)
        return removed_before[key]

    free_cache, thaw_cache = {}, {}

    def geometry_free(step):
        if step not in free_cache:
            free_cache[step] = [conjunction([
                conjunction(gone(j, step) for j in above[s]),
                conjunction([conjunction(gone(j, step) for j in left[s]).Not(),
                             conjunction(gone(j, step) for j in right[s]).Not()]).Not()
            ]) for s in range(n)]
        return free_cache[step]

    def thaw_count(step):
        if step not in thaw_cache:
            values = []
            for s in range(n):
                count = model.new_int_var(0, len(adjacent[s]), 'goneNeighbours')
                model.add(count == sum(gone(j, step) for j in adjacent[s]))
                values.append(count)
            thaw_cache[step] = values
        return thaw_cache[step]

    ice = {int(k): v for k, v in (d.get('obst') or {}).get('ice', {}).items()}
    locks = set((d.get('obst') or {}).get('locks', []))
    keys = (d.get('obst') or {}).get('keys', [])

    def free_tile(i, step):
        if i in locks and any(position[k] >= step for k in keys):
            return false
        ready = model.new_bool_var('ready')
        model.add_element(tile_slot[i], geometry_free(step), ready)
        if i not in ice:
            return ready
        count = model.new_int_var(0, n, 'thawCount')
        model.add_element(tile_slot[i], thaw_count(step), count)
        thawed = less(count, ice[i]).Not()
        return conjunction([ready, thawed])

    # Ordinary geometric readiness follows from the upper/side ordering above.
    for i in ice:
        model.add(free_tile(i, position[i]) == 1)
    constraints = request['constraints']
    tables = {'above': above, 'below': below, 'ice': adjacent, 'left': left, 'right': right}
    seen = set()
    for i, rules in enumerate(constraints['rules']):
        for rule in rules:
            j = rule['other']
            for kind in ['above', 'below'] + (['ice'] if rule['ice'] else []) + (['left', 'right'] if rule['horizontal'] else []):
                key = (i, j, kind)
                if key in seen:
                    continue
                seen.add(key)
                pairs = [(s, t) for s in range(n) for t in tables[kind][s]]
                expected = rule['adjacent'] if kind == 'ice' else rule[kind]
                if expected:
                    model.add_allowed_assignments([tile_slot[i], tile_slot[j]], pairs)
                else:
                    model.add_forbidden_assignments([tile_slot[i], tile_slot[j]], pairs)
    for i, step in constraints['opens']:
        if step >= 0:
            model.add(free_tile(int(i), step) == 1)
            if step:
                model.add(free_tile(int(i), step - 1) == 0)
    for i, step in request.get('availableAt', []):
        model.add(free_tile(i, step) == 1)
    for i, neighbours in request.get('iceGraphs', []):
        neighbours = set(neighbours)
        pairs = [(s, t) for s in range(n) for t in adjacent[s]]
        for j in range(n):
            if i == j:
                continue
            if j in neighbours:
                model.add_allowed_assignments([tile_slot[i], tile_slot[j]], pairs)
            else:
                model.add_forbidden_assignments([tile_slot[i], tile_slot[j]], pairs)
    for i, allowed in request.get('visibleSlots', []):
        model.add_allowed_assignments([tile_slot[i]], [[s] for s in allowed])

    identity_cache = {}

    def identities_at(ids, slot):
        key = (tuple(sorted(ids)), slot)
        if key not in identity_cache:
            q = model.new_bool_var('roleAtSlot')
            model.add_allowed_assignments([rank_at_slot[slot], q],
                [(r, int(d['solution'][r] in ids)) for r in range(n)])
            identity_cache[key] = q
        return identity_cache[key]

    # A closed set of physically blocked tiles proves that the clock cannot be
    # reached while one original prerequisite is pinned. This preserves causal
    # depth without freezing every ordinary tile's exact old coordinates.
    ice_groups = {h: [i for i in ice if ice[i] == h] for h in set(ice.values())}
    obligations = {}
    for pin in request.get('necessary', []):
        if pin != d['clock']['i']:
            obligations.setdefault(pin, set()).add(d['clock']['i'])
    for pin, goal in request.get('necessaryTargets', []):
        if pin != goal:
            obligations.setdefault(pin, set()).add(goal)
    for pin, goals in obligations.items():
        stuck = [model.new_bool_var('pinnedClosure') for _ in range(n)]
        model.add_element(tile_slot[pin], stuck, 1)
        for goal in goals:
            model.add_element(tile_slot[goal], stuck, 1)
        key_stuck = []
        for k in keys:
            q = model.new_bool_var('keyStuck')
            model.add_element(tile_slot[k], stuck, q)
            key_stuck.append(q)
        some_key = conjunction(q.Not() for q in key_stuck).Not() if key_stuck else false
        for s in range(n):
            up = conjunction(stuck[j].Not() for j in above[s]).Not()
            l = conjunction(stuck[j].Not() for j in left[s]).Not()
            r = conjunction(stuck[j].Not() for j in right[s]).Not()
            blockers = [up, conjunction([l, r])]
            if locks:
                blockers.append(conjunction([identities_at(locks, s), some_key]))
            outside = sum(stuck[j].Not() for j in adjacent[s])
            for h, group in ice_groups.items():
                blockers.append(conjunction([identities_at(group, s), less(outside, h)]))
            blocked = conjunction(q.Not() for q in blockers).Not()
            model.add_bool_or([stuck[s].Not(), identities_at([pin], s), blocked])

    masks = {}

    def free_mask(i, removed, ablate):
        key = tuple(sorted(removed))
        if key not in masks:
            ranks = {position[j] for j in removed}
            gone_slots = []
            for s in range(n):
                q = model.new_bool_var('removed')
                model.add_allowed_assignments([rank_at_slot[s], q], [(r, int(r in ranks)) for r in range(n)])
                gone_slots.append(q)
            geo = [conjunction([
                conjunction(gone_slots[j] for j in above[s]),
                conjunction([conjunction(gone_slots[j] for j in left[s]).Not(),
                             conjunction(gone_slots[j] for j in right[s]).Not()]).Not()
            ]) for s in range(n)]
            counts = []
            for s in range(n):
                count = model.new_int_var(0, len(adjacent[s]), 'removedNeighbours')
                model.add(count == sum(gone_slots[j] for j in adjacent[s]))
                counts.append(count)
            masks[key] = geo, counts
        if i in locks and ablate != ['lock', i] and not all(k in removed for k in keys):
            return false
        geo, counts = masks[key]
        ready = model.new_bool_var('routeReady')
        model.add_element(tile_slot[i], geo, ready)
        if i not in ice or ablate == ['ice', i]:
            return ready
        count = model.new_int_var(0, n, 'routeThawCount')
        model.add_element(tile_slot[i], counts, count)
        return conjunction([ready, less(count, ice[i]).Not()])

    for kind in ['forbid', 'require']:
        for route in request.get(kind, []):
            removed, possible = set(), []
            for action in route['actions']:
                take = action['pair'] if isinstance(action, dict) else [action]
                possible.extend(free_mask(i, removed, route.get('ablate')) for i in take)
                removed.update(take)
            if kind == 'forbid':
                model.add_bool_or([q.Not() for q in possible])
            else:
                model.add_bool_and(possible)
    for kind, value in [('forbidState', 0), ('requireState', 1)]:
        for state in request.get(kind, []):
            model.add(free_mask(state['tile'], set(state['removed']), state.get('ablate')) == value)

    unchanged = []
    for i in range(n):
        model.add_hint(tile_slot[i], i)
        q = model.new_bool_var('unchanged')
        model.add(tile_slot[i] == i).only_enforce_if(q)
        model.add(tile_slot[i] != i).only_enforce_if(q.Not())
        unchanged.append(q)
    model.maximize(sum(unchanged))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = request.get('seconds', 20)
    solver.parameters.num_search_workers = request.get('workers', 8)
    solver.parameters.random_seed = request.get('seed', 1)
    solver.parameters.stop_after_first_solution = True
    status = solver.solve(model)
    result = dict(status=solver.status_name(status), seconds=solver.wall_time)
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        result['tiles'] = [slots[solver.value(tile_slot[i])] for i in range(n)]
        result['unchangedSlots'] = round(solver.objective_value)
    return result


if __name__ == '__main__':
    result = solve(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')))
    Path(sys.argv[2]).write_text(json.dumps(result), encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'tiles'}), flush=True)
