/* Level factory: a level steered onto the curve by the bots (Claude, 2026-11-03).
   Dennis: "what if we let the bot steer the designing and the family bot checks difficulty"; "[too easy:] can also add a
   trap or add more luck moments". Instead of throwing a board away when it misses, it is changed one small step at a
   time, each step measured again and kept only when it brings the level nearer:
     - too hard (family rating above the target): one spare move more on the clock (to 3), a face-down tile the family
       bot keeps losing at turned face-up, or ice it keeps losing at thawed;
     - too easy: one spare move less (to 1), a trap added from the library (a frozen chain, partners behind locks, deep
       keys), or a luck moment added (a covered tile turned face-down) while relief moments >= luck moments - 2;
     - luck without relief (more than relief + 2 luck moments): the tile under the unrelieved dig turned face-up, or a
       relief moment added (a twin of the picture the family bot is stuck with comes free early; also used when too hard);
     - the skilled player ('planner', Dennis's planning) needs more than DENNIS_MAX: as too hard.
   The family profile (human-g6.1) is the meter and decides; a level passes when it is on the target (TOL), the luck rule
   holds, the skilled player can do it, most family losses are at the traps (ATTR) and every special matters.
     HUMAN_BOT=<g6.2 human_bot.js> node steer_design.js <start.jsonl> <out.jsonl>
   start.jsonl: rows {level, target, concept, title, recipe, design} (a designed board to start from).          */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const I = require(path.join(ROOT, 'tools', 'lab', 'ideas.js'));
const L = global.Layouts;
const { roomProfile, trapTiles } = require('./design_traps.js');
const { createMeter, boardKey } = require('./meter.js');
const Moves = require('./moves.js');
const Placement = require('./placement_score.js'), Composer = require('./trap_composer.js');
const Supports = require('./trap_supports.js');

function createSteerer(options = {}) {
const meter = options.meter || createMeter(options);
const measureHuman = meter.measure;
const TOL = options.tolerance ?? +(process.env.TOL || 0.5), DENNIS_MAX = options.skilledMax ?? +(process.env.DENNIS_MAX || 6), ATTR = options.attribution ?? +(process.env.ATTR || 0.6), STEPS = options.steps ?? +(process.env.STEPS || 14);
// Dennis 2026-11-04: the skilled player must need at least 2.5 tries (FACTORY_SKILLED=min,max)
const DENNIS_MIN = options.skilledMin ?? +((process.env.FACTORY_SKILLED || '0').split(',')[0] || 0);
I.setExact(true, { nodes: options.routeNodes ?? 20000, milliseconds: options.routeMilliseconds ?? 1500 });
const EXTRA = ['iceChain', 'lockedPartners', 'deepKeys', ...Object.keys(Composer.MOTIFS)];
// only real bot runs go in the journal (test meters have made-up fingerprints)
const JOURNAL = options.journal !== false && /^[0-9a-f]{64}$/.test(meter.fingerprint || '');
const PRIORS = Moves.priors(Moves.load([Moves.SEED, options.journal || Moves.DEFAULT]));
const boardOf = d => ({ tiles: d.tiles, faces: d.faces, down: d.down, obst: d.obst, clock: d.clock });
const meas = (d, setting, capture) => measureHuman(boardOf(d), { runs: 20, setting, seed: 4711, ...(capture ? { capture: 'tail' } : {}) });
const tilesOf = d => d.tiles.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t);
const routeOf = d => d.solution.indexOf(d.clock.i) + 1;
const luckOk = r => r.ok && r.unrelieved <= 1;   // luck - relief <= 2

// where the family bot loses: the tiles of its last 5 takes and the pictures in its tray when a try ends
function lossSpots(d, m) {
  const tiles = new Map(), faces = new Map(), bump = (mp, k) => mp.set(k, (mp.get(k) || 0) + 1);
  for (const r of m.results) for (const a of r.attempts) {
    if (a.win || a.censored) continue;
    const ds = a.decisions || []; for (const x of ds.slice(-5)) bump(tiles, x.index);
    if (ds.length) for (const f of ds[ds.length - 1].state.tray) bump(faces, f);
  }
  return { tiles: [...tiles.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k), faces };
}
function attribution(d, m) {
  const T = trapTiles(d); let lost = 0, at = 0;
  for (const r of m.results) for (const a of r.attempts) {
    if (a.win || a.censored) continue; lost++;
    if (a.why === 'clock') { at++; continue; }
    const ds = a.decisions || [], last = ds.slice(-4).map(x => x.index), tray = ds.length ? ds[ds.length - 1].state.tray : [];
    if (last.some(i => T.tiles.has(i)) || tray.some(f => T.faces.has(f))) at++;
  }
  return lost ? +(at / lost).toFixed(2) : null;
}
function specialsMatter(d, m0) {
  const ob = d.obst || {}, out = {};
  const test = (k, b2) => { const m = meas(b2, 'family'); out[k] = { without: m.expectedTries, valid: m.valid,
    matters: m.valid === true && (Math.abs(m0.expectedTries - m.expectedTries) >= 0.3 || Math.abs(m.firstTryRate - m0.firstTryRate) >= 0.15) }; };
  if (ob.ice && Object.keys(ob.ice).length) test('ice', { ...d, obst: { ...ob, ice: {} } });
  if (ob.locks && ob.locks.length) test('locks', { ...d, obst: { ...ob, locks: [], keys: [] } });
  if (d.clock) test('clock', { ...d, clock: null });
  return out;
}
// the tiles a take uncovers that started face-down
function uncoveredBy(d, i) {
  const t = tilesOf(d), nb = L.neighbors(t), al = new Uint8Array(t.length).fill(1);
  for (const j of d.solution.slice(0, d.solution.indexOf(i))) al[j] = 0;
  const a2 = al.slice(); a2[i] = 0;
  return d.down.filter(j => a2[j] && !L.isFree(j, al, nb) && L.isFree(j, a2, nb));
}

// the possible small changes, given what the bots saw
function changes(d, state) {
  const out = [], sp = d.clock.n - routeOf(d), withSpare = s => ({ ...d, clock: { ...d.clock, n: routeOf(d) + s } });
  const softer = state.exp > state.target + TOL || state.skilled > DENNIS_MAX;
  const plannerTooEasy = Number.isFinite(state.skilled) && state.skilled < DENNIS_MIN;
  const harder = state.exp < state.target - TOL || plannerTooEasy;
  // Repair an idle special even when the starting board is already on target.
  if (state.idle?.some(k => k !== 'clock')) {
    const ob = { ...d.obst };
    if (state.idle.includes('ice')) ob.ice = {};
    if (state.idle.includes('locks')) { ob.locks = []; ob.keys = []; }
    out.push({ what: 'idle specials removed', d: { ...d, obst: ob } });
  }
  if (!luckOk(state.room)) {
    const last = state.room.tightTiles[state.room.tightTiles.length - 1];
    const under = last !== undefined ? uncoveredBy(d, last) : [];
    if (under.length) out.push({ what: 'luck: tile under the unrelieved dig face-up', d: { ...d, down: d.down.filter(j => !under.includes(j)) } });
  }
  // a relief moment (Dennis 2026-11-03: "It can add luck and relief moments as well where it matters"): the picture the
  // family bot is most often stuck with in its tray gets a twin that comes free early - its buried twin swaps pictures
  // with a tile free from the start - and the way through and the clock are worked out again
  const relief = () => {
    const stuck = [...state.spots.faces.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f)[0];
    if (stuck === undefined) return null;
    const t = tilesOf(d), nb = L.neighbors(t), al = new Uint8Array(t.length).fill(1), sp0 = d.clock.n - routeOf(d);
    const special = i => (d.clock && d.clock.i === i) || (d.obst.keys || []).includes(i) || (d.obst.locks || []).includes(i) || (d.obst.ice || {})[i];
    const twins = d.faces.map((f, i) => f === stuck && !L.isFree(i, al, nb) && !special(i) ? i : -1).filter(i => i >= 0);
    const frees = d.faces.map((f, i) => f !== stuck && L.isFree(i, al, nb) && !special(i) && !d.down.includes(i) ? i : -1).filter(i => i >= 0);
    for (const a of twins.slice(0, 2)) for (const b of frees.slice(0, 3)) {
      const x = I.clone(d); [x.faces[a], x.faces[b]] = [x.faces[b], x.faces[a]];
      const z = I.fix({ ...x, clock: { i: d.clock.i, n: 999 } }, sp0);
      if (z && I.valid(z)) return { what: 'relief: a twin of the stuck picture comes free early', d: z };
    }
    return null;
  };
  if (!luckOk(state.room)) { const r = relief(); if (r) out.push(r); }
  if (softer && state.exp > state.target + 3) {
    // far too hard (177: 18.8 for 7.2, the clock already at 3 spare): bigger steps first
    const ice = Object.keys(d.obst.ice || {});
    if (ice.length) out.push({ what: 'all ice thawed', d: { ...d, obst: { ...d.obst, ice: {} } } });
    const dn = state.spots.tiles.filter(j => d.down.includes(j)).slice(0, 4); if (dn.length > 1) out.push({ what: dn.length + ' tiles face-up where the family loses', d: { ...d, down: d.down.filter(j => !dn.includes(j)) } });
    if ((d.obst.locks || []).length) out.push({ what: 'locks and keys off', d: { ...d, obst: { ...d.obst, locks: [], keys: [] } } });
  }
  // graded steps (the journal: all ice thawed is a cliff, 179 20 -> 4.3): one ice softer or harder, half the ice, one lock
  const iceAt = Object.keys(d.obst.ice || {}).map(Number), rank = new Map(state.spots.tiles.map((j, k) => [j, k]));
  const byLoss = a => a.slice().sort((x, y) => (rank.get(x) ?? 1e9) - (rank.get(y) ?? 1e9));
  // the clock moved along the way, same spare (the journal: one spare move is a cliff, 8 -> 2.8 and 6 -> 13.5; the way to
  // the clock is the strongest lever in predict.js): a tile a little earlier (softer) or later (harder) on the solution,
  // not a special, with the exact route worked out again
  {
    const pos = routeOf(d) - 1, dir = d.clockMate !== undefined ? 0 : softer ? -1 : (harder ? 1 : 0);
    const spec = i => (d.obst.keys || []).includes(i) || (d.obst.locks || []).includes(i) || (d.obst.ice || {})[i] !== undefined;
    for (let k = 2; dir && k <= 6; k++) {
      const i = d.solution[pos + dir * k]; if (i === undefined || pos + dir * k < 3 || spec(i)) continue;
      const z = I.fix({ ...d, clock: { i, n: 999 }, down: d.down.filter(j => j !== i) }, sp);
      // A later tile in one proof can have a much shorter actual clock route.
      // Use the recomputed route, and learn these edits separately from the old
      // position-based changes whose measured effects often went the wrong way.
      if (z && I.valid(z) && Math.sign(routeOf(z) - routeOf(d)) === dir) {
        out.push({ what: 'clock route ' + (dir < 0 ? 'shortened' : 'lengthened'), d: z }); break;
      }
    }
  }
  if (softer) {
    const hard = byLoss(iceAt.filter(j => d.obst.ice[j] >= 2))[0];
    if (hard !== undefined) out.push({ what: 'one ice softer', d: { ...d, obst: { ...d.obst, ice: { ...d.obst.ice, [hard]: d.obst.ice[hard] - 1 } } } });
    if (iceAt.length >= 2) { const half = byLoss(iceAt).slice(0, Math.ceil(iceAt.length / 2)), ice = { ...d.obst.ice }; for (const j of half) delete ice[j];
      out.push({ what: 'half the ice thawed', d: { ...d, obst: { ...d.obst, ice } } }); }
    const locks = d.obst.locks || [];
    if (locks.length >= 2) { const one = byLoss(locks)[0]; out.push({ what: 'one lock off', d: { ...d, obst: { ...d.obst, locks: locks.filter(j => j !== one) } } }); }
  } else if (harder) {
    for(const soft of byLoss(iceAt.filter(j => d.obst.ice[j] < 3)).slice(0,3)) {
      const edited = { ...d, obst: { ...d.obst, ice: { ...d.obst.ice, [soft]: d.obst.ice[soft] + 1 } } };
      const exact = I.fix({ ...edited,clock:{...edited.clock,n:999} },sp);
      if(exact) out.push({what:'one ice harder with exact clock route',d:exact,exactRepaired:true});
    }
  }
  // Reposition a dependency, rather than jumping straight from "on" to "off".
  // Pictures and the whole layout stay fixed; every proposal gets a new exact
  // route with the same spare before a bot is asked about it.
  if(softer || harder) {
    const c=I.ctxOf(d), covered=new Map(), depth=i=>{
      if(!covered.has(i)){const found=new Set(),todo=[i];while(todo.length)for(const j of c.nb.above[todo.pop()])
        if(!found.has(j)){found.add(j);todo.push(j);}covered.set(i,found);}return covered.get(i).size;
    };
    const hidden=new Set(d.down), keys=d.obst.keys||[], locks=d.obst.locks||[];
    const special=i=>i===d.clock.i||keys.includes(i)||locks.includes(i)||(d.obst.ice||{})[i];
    const fixedProposal=(what,edited)=>{const exact=I.fix({...edited,clock:{...d.clock,n:999}},sp);
      if(exact)out.push({what,d:exact,exactRepaired:true});};
    if(keys.length===2) {
      const current=keys.reduce((s,i)=>s+depth(i),0), direction=softer?-1:1;
      const pairs=c.pairs.filter(([a,b])=>!special(a)&&!special(b)&&!hidden.has(a)&&!hidden.has(b)&&
        direction*(depth(a)+depth(b)-current)>=0).sort((a,b)=>
          Math.abs(depth(a[0])+depth(a[1])-current)-Math.abs(depth(b[0])+depth(b[1])-current));
      const nearby=pairs.filter(p=>Math.abs(depth(p[0])+depth(p[1])-current)<=Math.abs((pairs[0]?depth(pairs[0][0])+depth(pairs[0][1]):current)-current)+2);
      const spread=p=>Math.hypot(c.tiles[p[0]].x-c.tiles[p[1]].x,c.tiles[p[0]].y-c.tiles[p[1]].y);
      const away=p=>p.reduce((s,i)=>s+Math.hypot(c.tiles[i].x-c.tiles[d.clock.i].x,c.tiles[i].y-c.tiles[d.clock.i].y),0);
      const candidates=[pairs[0],nearby.slice().sort((a,b)=>spread(b)-spread(a))[0],nearby.slice().sort((a,b)=>away(b)-away(a))[0],...pairs];
      const selected=[...new Map(candidates.filter(Boolean).map(p=>[p.slice(0,2).sort((a,b)=>a-b).join(','),p])).values()].slice(0,4);
      for(const [a,b] of selected)fixedProposal('key pair repositioned on '+(softer?'an equal or shallower dig':'an equal or deeper dig'),
        {...d,obst:{...d.obst,keys:[a,b]}});
    }
    const objective=new Set([d.clock.i,...keys]);
    for(const i of [...objective]){depth(i);for(const j of covered.get(i))objective.add(j);}
    const mates=new Set();for(const [a,b] of c.pairs){if(objective.has(a))mates.add(b);if(objective.has(b))mates.add(a);}
    const movable=byLoss(iceAt.filter(i=>i!==d.clock.i&&!keys.includes(i))).slice(0,2);
    for(const old of movable) {
      const h=d.obst.ice[old], choices=[...new Set([...objective,...mates])].filter(i=>!special(i)&&!hidden.has(i)&&
        c.inb[i].filter(j=>c.pos[j]<c.pos[i]).length>=h).sort((a,b)=>Math.abs(depth(a)-depth(old))-Math.abs(depth(b)-depth(old)));
      for(const next of choices.slice(0,2)){const ice={...d.obst.ice};delete ice[old];ice[next]=h;
        fixedProposal('one frozen dependency moved on the existing dig',{...d,obst:{...d.obst,ice}});}
    }
    const oldLock=byLoss(locks.filter(i=>i!==d.clock.i)).at(0);
    if(oldLock!==undefined){const choices=[...mates].filter(i=>!special(i)&&!hidden.has(i)).sort((a,b)=>
      Math.abs(depth(a)-depth(oldLock))-Math.abs(depth(b)-depth(oldLock)));
      for(const next of choices.slice(0,2))fixedProposal('one partner lock moved on the existing dig',
        {...d,obst:{...d.obst,locks:locks.map(i=>i===oldLock?next:i)}});}
  }
  if (softer) {
    { const r = relief(); if (r) out.push(r); }
    if (sp < 3) out.push({ what: 'clock +1 spare', d: withSpare(sp + 1) });
    const dn = state.spots.tiles.find(j => d.down.includes(j)); if (dn !== undefined) out.push({ what: 'face-up where the family loses', d: { ...d, down: d.down.filter(j => j !== dn) } });
    const ic = state.spots.tiles.find(j => (d.obst.ice || {})[j]); if (ic !== undefined) { const ice = { ...d.obst.ice }; delete ice[ic]; out.push({ what: 'ice thawed where the family loses', d: { ...d, obst: { ...d.obst, ice } } }); }
  } else if (harder) {
    if (sp > 1) out.push({ what: 'clock -1 spare', d: withSpare(sp - 1) });
    for (const k of EXTRA) {
      try {
        const result = Composer.compose(d,[k],I.rngOf(state.step*131+k.length),{ spare:sp,playerFeedback:!!state.playerFeedback });
        if(result) out.push({what:'connected trap added: '+k,d:result.design,trap:k,trapPlan:result.plan});
      } catch (e) { }
    }
    // a luck moment: a covered tile on the family's way turned face-down (only where the luck rule still holds)
    const t = tilesOf(d), nb = L.neighbors(t), al = new Uint8Array(t.length).fill(1);
    const cand = state.spots.tiles.filter(j => !d.down.includes(j) && !L.isFree(j, al, nb) && !(d.clock && d.clock.i === j) && !(d.obst.keys || []).includes(j) && !(d.obst.locks || []).includes(j) && !(d.obst.ice || {})[j]);
    for (const j of cand.slice(0, 2)) { const y = { ...d, down: d.down.concat(j) }; const r = roomProfile(y); if (r.ok && luckOk(r)) { out.push({ what: 'luck moment added', d: y }); break; } }
  }
  // A measured plateau in the first three edits must not hide a later useful trap.
  return out.flatMap(c => {
    if(state.preservePairing && JSON.stringify(c.d.faces)!==JSON.stringify(d.faces)) return [];
    if(state.preserveVisibility && JSON.stringify([...c.d.down].sort((a,b)=>a-b))!==JSON.stringify([...d.down].sort((a,b)=>a-b))) return [];
    if(state.preserveClockTile && c.d.clock.i!==d.clock.i) return [];
    if(state.preserveSpecialKinds && (Object.keys(d.obst.ice||{}).length && !Object.keys(c.d.obst.ice||{}).length ||
      (d.obst.locks||[]).length && !(c.d.obst.locks||[]).length)) return [];
    if(Supports.checks(state).some(check=>check.indices.some(i=>check.kind==='ice' ? !c.d.obst.ice?.[i] : !c.d.obst.locks?.includes(i)))) return [];
    // A structural repair keeps the requested spare on a newly proved shortest
    // route, instead of silently changing how generous the clock becomes.
    if(state.preserveSpare !== undefined) {
      if(c.what.startsWith('clock ') && c.d.clock.n-routeOf(c.d)!==state.preserveSpare) return [];
      if(!c.exactRepaired && c.trapPlan?.authoredBoard!==boardKey(c.d)) {
        const fixed=I.fix({...c.d,clock:{...c.d.clock,n:999}},state.preserveSpare);
        if(!fixed) return []; c={...c,d:fixed};
      }
      if(c.d.clock.n-routeOf(c.d)!==state.preserveSpare) return [];
    }
    return I.valid(c.d) && (!state.playerFeedback || Placement.readable(c.d)) ? [c] : [];
  });
}
function judge(d, target, step, withSpecials = true, checkPlanner = false, context = null) {
  const m = meas(d, 'family', true), spots = lossSpots(d, m), attr = attribution(d, m);
  const exp = m.expectedTries, off = Math.max(0, Math.abs(exp - target) - TOL);
  // Ablations are needed only for a board that could pass. Never pass without them.
  const sm = withSpecials && off === 0 ? specialsMatter(d, m) : null;
  const idle = sm ? Object.entries(sm).filter(([, v]) => !v.matters).map(([k]) => k) : [];
  const supports = withSpecials && off === 0 && context ? Supports.measure({...context,design:d},m,meter,{runs:20,setting:'family',seed:4711}) : {};
  idle.push(...Object.entries(supports.supports||{}).filter(([,v])=>!v.matters).map(([k])=>'support '+k));
  // Route planning is the expensive part. A board off the curve or with idle
  // specials cannot pass: fix that first, then run the skilled player.
  // The local search uses a tighter .35 band than final acceptance. A board
  // within the real .5 band must not get an artificially good score merely
  // because its skilled measurement was skipped at the local boundary.
  const nearAcceptance = Math.abs(exp-target) <= Math.max(TOL,options.acceptanceTolerance ?? .5)+1e-9;
  const md = !idle.length && (off === 0 || checkPlanner || nearAcceptance) ? meas(d, 'planner') : null;
  const skilled = md?.expectedTries ?? null;
  const room = off === 0 ? roomProfile(d) : { ok: true, tightBlind: 0, unrelieved: 0, tightTiles: [], measured: false };
  const luck = room.ok && room.measured !== false ? { luckMoments: room.tightBlind, reliefMoments: Math.max(0, room.tightBlind - room.unrelieved - (room.tightBlind ? 1 : 0)), unrelieved: room.unrelieved } : null;
  const valid = m.valid === true && (!md || md.valid === true);
  const score = off * 2 + Math.max(0, skilled - DENNIS_MAX) + (skilled === null ? 0 : Math.max(0, DENNIS_MIN - skilled) * 2) + (room.ok && luckOk(room) ? 0 : 3) + Math.max(0, ATTR - (attr ?? 1)) * 3 + idle.length * 2 + (valid ? 0 : 100);
  return { d, m, exp, skilled, room, luck, spots, attr, sm, idle, score, target, step, valid, supports,
    pass: valid && off === 0 && md !== null && skilled <= DENNIS_MAX && skilled >= DENNIS_MIN && room.ok && luckOk(room) && (attr === null || attr >= ATTR) && sm !== null && !idle.length };
}

function steer(s, saved = null, checkpoint = () => {}) {
  if (!Number.isFinite(s.target) || s.target < 1 || s.target > 20) throw Error('Target must be between 1 and 20 expected tries');
  if (!s.design?.clock || !I.valid(s.design)) throw Error('Invalid starting board at level ' + s.level);
  const log = saved?.log?.slice() || [], recipe = (saved?.recipe || s.recipe || []).slice();
  let trapPlan = saved?.trapPlan || s.trapPlan;
  const mergePlan = added => added ? { ...(trapPlan || {}), version:trapPlan?.version || Composer.VERSION,
    authoredBoard:trapPlan?.authoredBoard || null, steps:[...(trapPlan?.steps||[]),...added.steps.map(t=>({...t,addedDuringSteering:true}))],
    components:[...(trapPlan?.components||[]),...(added.components||[])] } : trapPlan;
  const seen = new Set(saved?.seen || []);
  let cur = judge(saved?.design || s.design, s.target, saved?.step || 0, true, false, {...s,trapPlan});
  seen.add(boardKey(cur.d));
  if (!saved) log.push(`start: family ${cur.exp} (target ${s.target}) skilled ${cur.skilled}`);
  let nextStep = (saved?.step || 0) + 1;
  const save = step => checkpoint({ step, design: cur.d, recipe, trapPlan, log, seen: [...seen] });
  save(nextStep - 1);
  for (let step = nextStep; step <= STEPS && !cur.pass; step++) {
    const opts = changes(cur.d, { ...cur, step, playerFeedback:s.playerFeedback, preservePairing:s.preservePairing,
      preserveVisibility:s.preserveVisibility,preserveClockTile:s.preserveClockTile,preserveSpare:s.preserveSpare,
      preserveSpecialKinds:s.preserveSpecialKinds,recipe,trapPlan }).filter(o => !seen.has(boardKey(o.d)));
    if (!opts.length) { log.push(`step ${step}: no new change left`); save(step); break; }
    // Small runs rank edits only. A full, unchanged meter decides every accepted edit.
    // ...and what the factory learned from earlier boards (moves.js): with 3+ records of a kind of change, its usual
    // effect counts half (a 6-game scout alone is noisy)
    const scouts = opts.map(o => {
      const m = measureHuman(boardOf(o.d), { runs: options.scoutRuns ?? 6, seeds: 1, setting: 'family', seed: 4711 });
      const scout = m.valid ? Math.abs(m.expectedTries - s.target) : Infinity, ex = Moves.expect(PRIORS, o.what, cur.exp);
      return { o, distance: ex == null || !Number.isFinite(scout) ? scout : (scout + Math.abs(ex - s.target)) / 2, scout: m.valid ? m.expectedTries : null };
    }).sort((a, b) => a.distance - b.distance);
    let best = null;
    for (const { o, scout } of scouts) {
      // Full family rating gives a lower bound: planner/quality penalties can only add to it.
      const m = meas(o.d, 'family', true);
      if (m.valid && JOURNAL) Moves.record({ level: s.level, target: s.target, what: o.what, before: cur.exp, after: m.expectedTries, scout, recipe, n: o.d.tiles.length }, options.journal);
      const bound = Math.max(0, Math.abs(m.expectedTries - s.target) - TOL) * 2;
      if (!m.valid || bound > (best ? best.j.score : cur.score)) continue;
      const repairingPlanner = Number.isFinite(cur.skilled) && (cur.skilled < DENNIS_MIN || cur.skilled > DENNIS_MAX);
      const j = judge(o.d, s.target, step, true, repairingPlanner,
        {...s,recipe:o.trap?[...recipe,o.trap]:recipe,trapPlan:mergePlan(o.trapPlan)});
      // Moving off curve must not look like a planner improvement merely
      // because that candidate's expensive planner run was skipped.
      if (repairingPlanner && j.skilled === null) continue;
      log.push(`step ${step}: ${o.what} -> family ${j.exp} skilled ${j.skilled} score ${j.score.toFixed(2)}`);
      if (!best || j.score < best.j.score) best = { o, j };
      // Stop on a fully checked pass; no need to measure the other edits.
      if (j.pass) break;
    }
    if (best && (best.j.score < cur.score || (best.j.score === cur.score && best.j.pass))) {
      cur = best.j; seen.add(boardKey(cur.d));
      if (best.o.trap) recipe.push(best.o.trap);
      trapPlan = mergePlan(best.o.trapPlan);
      log.push(`step ${step}: kept "${best.o.what}"`);
      save(step);
    } else { log.push(`step ${step}: nothing better`); save(step); break; }
  }
  // A fresh seed is never used for search. A miss stays a review candidate, not a pass.
  let holdout = null, grabFirst = null, grabValid = true;
  if (cur.pass && (s.concept === 'dontGrab' || recipe.includes('dontGrab'))) {
    const forced = meas({ ...cur.d, clock: { ...cur.d.clock, n: 1 } }, 'family');
    grabFirst = forced.expectedTries;
    grabValid = forced.valid === true && grabFirst >= cur.exp + 1;
  }
  if (cur.pass && grabValid) {
    const h = measureHuman(boardOf(cur.d), { runs: 20, seeds: 2, setting: 'family', seed: options.holdoutSeed ?? 18427 });
    holdout = { exp: h.expectedTries, first: h.firstTryRate, valid: h.valid,
      seed: options.holdoutSeed ?? 18427, pass: h.valid === true && Math.abs(h.expectedTries - s.target) <= TOL };
  }
  const d = cur.d;
  const reasons = [];
  if (Math.abs(cur.exp - s.target) > TOL) reasons.push('offCurve');
  if (!cur.valid) reasons.push('invalidMeasurement');
  if (cur.skilled !== null && cur.skilled > DENNIS_MAX) reasons.push('skilledPlayer');
  if (cur.skilled !== null && cur.skilled < DENNIS_MIN) reasons.push('skilledTooEasy');
  if (!luckOk(cur.room)) reasons.push('unrelievedLuck');
  if (cur.attr !== null && cur.attr < ATTR) reasons.push('lossesOutsideTrap');
  if (cur.idle.length) reasons.push('idleSpecials');
  if (!grabValid) reasons.push('clockFirstNotWorse');
  if (holdout && !holdout.pass) reasons.push('holdoutMiss');
  const losses = cur.m.results.flatMap(r => r.attempts).filter(a => !a.win && !a.censored);
  const late = losses.filter(a => a.left <= 0.45 * d.tiles.length).length;
  const warnings = late >= 4 && late / losses.length >= 0.3 ? ['lateSqueeze'] : [];
  return { ...s, recipe, trapPlan, pass: cur.pass && grabValid && holdout?.pass === true, searchPass: cur.pass,
    ...cur.supports,
    g61: { exp: cur.exp, first: cur.m.firstTryRate, version: cur.m.version }, skilled: cur.skilled,
    luck: cur.luck, atTrap: cur.attr, specials: cur.sm, holdout, grabFirst, warnings, reviewReasons: reasons,
    clockSpare: d.clock.n - routeOf(d), n: d.tiles.length, down: d.down.length,
    ice: Object.keys(d.obst.ice || {}).length, locks: (d.obst.locks || []).length,
    design: { ...d, level: s.level, aspect: d.aspect || 1.6 }, log };
}
return { steer, judge, changes, meter };
}

module.exports = { createSteerer };
if (require.main === module) {
  const { runFile } = require('./run_file.js');
  const [startFile, outFile] = process.argv.slice(2);
  if (!startFile || !outFile) {
    console.error('Usage: node source/tools/factory/steer_design.js <start.jsonl> <out.jsonl>');
    process.exitCode = 1;
  } else runFile(startFile, outFile);
}
