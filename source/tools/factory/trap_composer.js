'use strict';
// Authoring only. Structural scores choose a puzzle idea, never its difficulty.
const I = require('../lab/ideas.js');
const L = global.Layouts;
const { boardKey } = require('./meter.js');
const Placement = require('./placement_score.js');
const {makeLowerBound}=require('../lab/exact.js');
const VERSION = 'connected-traps-v3';
const MOTIFS = Object.freeze({
  keyGuardIce: 'Thaw a guard on the existing key dig before opening the existing locks.',
  partnerRelay: 'Thaw partners of singles carried on the existing clock dig.',
  thawRelay: 'Clear a frozen neighbour before thawing the existing clock or key guard.',
  midgameRelay: 'Carry one single through the clock, then release its frozen partner on a visible midgame route.',
});
const INTENTS = ['linked', 'cross-board', 'staged', 'tray-escape'];
const ids = b => [...new Set([...(b.obst?.keys || []), ...(b.obst?.locks || []),
  ...Object.keys(b.obst?.ice || {}).map(Number), ...(b.clock ? [b.clock.i] : [])])];
const same = (a, b) => JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify([...b].sort((x, y) => x - y));
const known = key => key === 'clockBesideLock' || !!I.IDEAS[key] || !!MOTIFS[key];
const authored = row => row.trapPlan?.version === VERSION && row.trapPlan.authoredBoard === boardKey(row.design);

function context(b, rng) {
  const c = I.ctxOf(b), priority = c.tiles.map(() => rng());
  // Candidate enumeration may vary; pos and the actual witness never change.
  c.candidateOrder = xs => xs.slice().sort((a, q) => priority[a] - priority[q]);
  c.candidateRank = priority;
  c.pairs = c.pairs.slice().sort((a, q) => priority[a[0]] - priority[q[0]]);
  return c;
}
function geometry(b) {
  const c = I.ctxOf(b), covers = new Map();
  const cover = i => {
    if (!covers.has(i)) {
      const found = new Set(), todo = [i];
      while (todo.length) for (const j of c.nb.above[todo.pop()]) if (!found.has(j)) { found.add(j); todo.push(j); }
      covers.set(i, found);
    }
    return covers.get(i);
  };
  return { ...c, cover };
}

function preserves(before, after) {
  if (before.clock && before.clock.i !== after.clock?.i) return 'replaced the existing clock';
  if (before.clockMate !== undefined && before.clockMate !== after.clockMate) return 'replaced the waiting clock partner';
  if ((before.obst?.locks || []).some(i => !(after.obst?.locks || []).includes(i))) return 'removed an earlier lock';
  if ((before.obst?.keys || []).length && !same(before.obst.keys, after.obst?.keys || [])) return 'replaced the shared key pair';
  if (Object.entries(before.obst?.ice || {}).some(([i, h]) => (after.obst?.ice?.[i] || 0) < h)) return 'removed an earlier ice dependency';
  const protectedFaces = [...ids(before), ...(before.clockMate !== undefined ? [before.clockMate] : [])];
  if (protectedFaces.some(i => before.faces[i] !== after.faces[i])) return 'changed an earlier role picture';
  if((before.trapObjectives||[]).some(g=>!(after.trapObjectives||[]).some(q=>q.kind===g.kind&&q.tile===g.tile)))return 'removed an earlier phase objective';
  return null;
}

function relayPhase(b, tile) {
  if(!b.clock || !b.obst?.ice?.[tile])return {ok:false,reason:'missing clock or frozen partner'};
  const c=I.ctxOf(b),alive=new Uint8Array(c.n).fill(1),initial=alive.slice(),tray=[];
  const o=b.obst,clockMove=c.pos[b.clock.i]+1,rules={ice:o.ice||{},iceNb:c.inb,locks:new Set(o.locks||[]),keys:o.keys||[]};
  let remainingAtClock=null,carriedBy=null,availableMove=null,minimumAfterClock=null;
  for(let step=0;step<=b.solution.length;step++){
    if(step===clockMove){remainingAtClock=(o.ice[tile]||0)-c.inb[tile].filter(i=>!alive[i]).length;
      carriedBy=alive[tile]?tray.find(i=>b.faces[i]===b.faces[tile])??null:null;
      minimumAfterClock=makeLowerBound({tiles:c.tiles,nb:c.nb,faces:b.faces,rules},tile)(alive);}
    if(availableMove===null&&alive[tile]&&L.takeable(tile,alive,c.nb,rules,initial)&&
      (tray.length<3||tray.some(i=>b.faces[i]===b.faces[tile])))availableMove=step+1;
    if(step===b.solution.length)break;
    const i=b.solution[step],mate=tray.findIndex(j=>b.faces[j]===b.faces[i]);
    if(mate<0)tray.push(i);else tray.splice(mate,1);alive[i]=0;
  }
  return {ok:remainingAtClock>0&&carriedBy!==null&&minimumAfterClock>=3&&availableMove>clockMove&&availableMove<=c.n*.6,
    clockMove,remainingAtClock,carriedBy,availableMove,minimumAfterClock,latestMidgameMove:c.n*.6};
}

function analyze(b) {
  const c = geometry(b), o = b.obst || {}, edges = [], need = new Set(), todo = [];
  const add = (from, to, kind) => { edges.push({ from, to, kind }); if (!need.has(to)) { need.add(to); todo.push(to); } };
  for (const i of [b.clock?.i, b.clockMate,...(b.trapObjectives||[]).map(g=>g.tile)].filter(Number.isInteger)) { need.add(i); todo.push(i); }
  while (todo.length) {
    const i = todo.pop();
    for (const j of c.nb.above[i]) add(i, j, 'cover');
    if ((o.locks || []).includes(i)) for (const k of o.keys || []) add(i, k, 'unlock');
    // This is a witness dependency, not a claim every alternative uses these neighbours.
    const thaw = c.inb[i].filter(j => c.pos[j] < c.pos[i]).sort((a, q) => c.pos[a] - c.pos[q]).slice(0, o.ice?.[i] || 0);
    for (const j of thaw) add(i, j, 'thaw');
  }
  const route = b.clock ? b.solution.indexOf(b.clock.i) + 1 : 0;
  const prefix = b.solution.slice(0, route), tray = [];
  let peak = 0, relief = 0;
  for (const i of prefix) {
    const q = tray.findIndex(j => b.faces[j] === b.faces[i]);
    if (q >= 0) tray.splice(q, 1); else tray.push(i);
    peak = Math.max(peak, tray.length); if (q >= 0 && tray.length <= 1) relief++;
  }
  const partners = new Set();
  for (const [a, q] of c.pairs) if (need.has(a) !== need.has(q)) {
    const from = need.has(a) ? a : q, to = from === a ? q : a;
    partners.add(to); edges.push({ from, to, kind: 'partner' });
  }
  const bounds = ['x', 'y'].map(k => [Math.min(...c.tiles.map(t => t[k])), Math.max(...c.tiles.map(t => t[k]))]);
  const distance = (a, q) => Math.hypot((c.tiles[a].x - c.tiles[q].x) / Math.max(1, bounds[0][1] - bounds[0][0]),
    (c.tiles[a].y - c.tiles[q].y) / Math.max(1, bounds[1][1] - bounds[1][0]));
  const keys = o.keys || [], linked = ids(b).filter(i => need.has(i) || partners.has(i));
  const keyDepth = keys.length ? keys.reduce((s, i) => s + c.cover(i).size, 0) / keys.length : 0;
  const spread = keys.length === 2 ? distance(keys[0], keys[1]) : 0;
  const clockKeyDistance = b.clock && keys.length ? keys.reduce((s, k) => s + distance(k, b.clock.i), 0) / keys.length : 0;
  const sector = i => i == null ? '-' : bounds.map(([lo, hi], k) => Math.min(2, Math.floor(3 * (c.tiles[i][k ? 'y' : 'x'] - lo) / Math.max(1, hi - lo + .01)))).join('');
  return { edges, needed: [...need], partners: [...partners], linkedSpecials: linked.length,
    unrelatedSpecials: ids(b).length - linked.length, clockDepth: b.clock ? c.cover(b.clock.i).size : 0,
    keyDepth, keySpread: +spread.toFixed(3), clockKeyDistance: +clockKeyDistance.toFixed(3),
    thawSteps: edges.filter(e => e.kind === 'thaw').length, peakTray: peak, relief, route,
    phaseGoals:(b.trapObjectives||[]).map(g=>({...g,...relayPhase(b,g.tile)})),
    signature: [sector(b.clock?.i), keys.map(sector).sort().join('/'),
      Object.keys(o.ice || {}).map(i => sector(+i)).sort().join('/'), (o.locks || []).map(sector).sort().join('/'), Math.floor(keyDepth / 3),
      edges.filter(e => e.kind === 'thaw').length, Math.floor(route / 8)].join(':') };
}

function augment(b, key, rng) {
  const c = geometry(b), x = I.clone(b), o = x.obst ||= { ice: {}, locks: [], keys: [] };
  o.ice ||= {}; o.keys ||= []; o.locks ||= [];
  const occupied = new Set(ids(b)), order = xs => xs.slice().sort((a, q) => rank[a] - rank[q]);
  const rank = c.tiles.map(() => rng()), keys = o.keys || [];
  const routeDig = new Set(analyze(b).needed);
  const keyDig = new Set(keys.flatMap(i => [...c.cover(i)]));
  const freeToFreeze = i => !occupied.has(i) && c.inb[i].some(j => c.pos[j] < c.pos[i]);
  const freeze = (i, height, newRoute=false) => {
    const h = height ?? Math.min(2, c.inb[i].filter(j => c.pos[j] < c.pos[i]).length);
    if (!h) return false;
    if(newRoute&&c.inb[i].length<h)return false;
    o.ice[i] = h; x.down = x.down.filter(j => j !== i); return true;
  };
  if (key === 'clockBesideLock') {
    if (b.clock || keys.length !== 2) return null;
    const clocks = order(c.P.filter(i => !occupied.has(i) && c.pos[i] > 3 && c.pos[i] < c.n*.4 &&
      c.cover(i).size >= 2 && c.cover(i).size <= 5 && keys.every(k => c.pos[k] > c.pos[i])));
    const clock = clocks.find(i => [...c.nb.left[i],...c.nb.right[i],...c.nb.above[i]].some(j =>
      o.locks.includes(j) && c.pos[j] > c.pos[i]+2 && !c.cover(i).has(j)));
    if (clock === undefined) return null;
    x.clock = {i:clock,n:999}; x.down = x.down.filter(i=>i!==clock);
  } else if (key === 'keyGuardIce') {
    // Freeze an actual blocker of the current keys, never an arbitrary spare tile.
    if (keys.length !== 2) return null;
    const candidates = order([...keyDig].filter(freeToFreeze));
    if (!candidates.length || !freeze(candidates[0])) return null;
  } else if (key === 'partnerRelay' || key === 'trayJuggleFrozen' || key==='midgameRelay') {
    if (!b.clock || !routeDig.size) return null;
    const mates = [];
    for (const [a, q] of c.pairs) {
      if (routeDig.has(a) && !routeDig.has(q) && c.pos[q] > c.pos[a]) mates.push(q);
      if (routeDig.has(q) && !routeDig.has(a) && c.pos[a] > c.pos[q]) mates.push(a);
    }
    const clockPos=c.pos[b.clock.i],midgame=key==='midgameRelay';
    const goneAtClock=i=>c.inb[i].filter(j=>c.pos[j]<=clockPos).length;
    const relayHeight=i=>Math.max(goneAtClock(i),c.inb[i].filter(j=>c.cover(i).has(j)).length)+1;
    const choices = order([...new Set(mates)].filter(i=>midgame ? !occupied.has(i)&&c.pos[i]>clockPos&&
      relayHeight(i)<=3&&c.inb[i].length>=relayHeight(i)&&c.pairs.some(([a,q])=>
        (a===i&&c.pos[q]<=clockPos)||(q===i&&c.pos[a]<=clockPos)) : freeToFreeze(i)));
    if(!choices.length)return null;
    const target=choices[0];
    if(!freeze(target,midgame?relayHeight(target):undefined,midgame))return null;
    if(midgame){
      x.trapObjectives=[...(x.trapObjectives||[]),{kind:'midgameRelay',tile:target}];
      const visible=new Set([target,...c.cover(target),...c.inb[target],...c.inb[target].flatMap(i=>[...c.cover(i)])]);
      x.down=x.down.filter(i=>!visible.has(i));
    }
  } else if (key === 'thawRelay' || key === 'iceChain') {
    const targets = [...Object.keys(o.ice || {}).map(Number)].filter(i => routeDig.has(i) || keyDig.has(i) || i === b.clock?.i);
    const choices = order([...new Set(targets.flatMap(i => c.inb[i].filter(j =>
      c.tiles[i].z === c.tiles[j].z && c.pos[j] < c.pos[i])))].filter(freeToFreeze));
    if (!choices.length || !freeze(choices[0])) return null;
  } else if (key === 'frozenGuards') {
    if (!b.clock) return null;
    const guards = order(c.nb.above[b.clock.i].filter(freeToFreeze));
    if (guards.length < 2) return null;
    guards.slice(0, 2).forEach(freeze);
  } else if (key === 'lockedPartners' || key === 'trayJuggleLocked') {
    if (keys.length !== 2) return null;
    const dig = key === 'trayJuggleLocked' ? routeDig : keyDig;
    const choices = [];
    for (const [a, q] of c.pairs) for (const [t, mate] of [[a, q], [q, a]])
      if (dig.has(t) && !dig.has(mate) && !keyDig.has(mate) && !occupied.has(mate) && c.pos[mate] > c.pos[keys[0]] && c.pos[mate] > c.pos[keys[1]]) choices.push(mate);
    const selected = order([...new Set(choices)]).slice(0, 2);
    if (!selected.length) return null;
    o.locks = [...(o.locks || []), ...selected]; x.down = x.down.filter(i => !selected.includes(i));
  } else return null;
  return x;
}

function score(a, intent) {
  const phaseChallenge=Math.min(4,Math.max(0,...(a.phaseGoals||[]).map(g=>(g.minimumAfterClock||0)-2)));
  const base = 3 * a.linkedSpecials / Math.max(1, a.linkedSpecials + a.unrelatedSpecials) - a.unrelatedSpecials * .2 + phaseChallenge;
  if (intent === 'cross-board') return base + 3 * a.keySpread + 2 * a.clockKeyDistance;
  if (intent === 'staged') return base + Math.min(a.thawSteps, 4) + Math.min(a.keyDepth, 8) * .3 + Math.min(a.route, 30) * .06;
  if (intent === 'tray-escape') return base + (a.peakTray === 2 ? 2 : 0) + Math.min(a.relief, 3) * .5;
  return base + Math.min(a.thawSteps, 3) * .6 - a.clockKeyDistance * .3;
}

function compose(b, recipe, rng, options = {}) {
  if (!recipe.length || recipe.some(k => !known(k))) throw Error('Unknown or empty trap recipe: ' + recipe.join(' + '));
  const intent = options.intent || INTENTS[Math.min(INTENTS.length - 1, Math.floor(rng() * INTENTS.length))];
  if (!INTENTS.includes(intent)) throw Error('Unknown trap placement intent: ' + intent);
  const diagnostics = options.diagnostic || {}, rejected = diagnostics.rejected = {};
  const reject = reason => { rejected[reason] = (rejected[reason] || 0) + 1; };
  const maxProbes = options.probes ?? 3, beamWidth = options.beam ?? 2, started = Date.now();
  const milliseconds = options.milliseconds ?? 1200, probeMilliseconds = options.probeMilliseconds ?? 400;
  if (!Number.isInteger(maxProbes) || maxProbes < 1 || maxProbes > 12 || !Number.isInteger(beamWidth) || beamWidth < 1 || beamWidth > 4)
    throw Error('Trap placement needs 1–12 probes and a beam of 1–4');
  if (![milliseconds, probeMilliseconds].every(x => Number.isFinite(x) && x > 0)) throw Error('Trap placement needs a positive time budget');
  const make = options.make || require('./design_traps.js').placeIdea;
  const fix = options.fix || I.fix, valid = options.valid || I.valid;
  const routeCache = new Map();
  let beam = [{ design: I.clone(b), steps: [], components:[], analysis: analyze(b), score: 0, protectedFaces: [], protectedHidden: [] }], probes = 0;
  for (const [stage, key] of recipe.entries()) {
    const choices = new Map(), proposed = new Set();
    const stageDeadline = started + milliseconds * (stage + 1) / recipe.length;
    for (let probe = 0; probe < maxProbes; probe++) for (const parent of beam) {
      // Inner legacy searches share this deadline too. A solver completion can
      // slightly overshoot; expiry never licenses an unproved clock route.
      if (Date.now() >= stageDeadline) { reject('placement search budget'); break; }
      probes++;
      const before = parent.design, existing = !!before.clock;
      const adapter = !!MOTIFS[key] || existing && ['frozenGuards', 'trayJuggleFrozen', 'iceChain'].includes(key) ||
        (before.obst?.keys || []).length && ['lockedPartners', 'trayJuggleLocked', 'clockBesideLock'].includes(key);
      const probeDeadline = Math.min(stageDeadline, Date.now() + probeMilliseconds);
      const candidate = I.withSearchBudget(probeDeadline, () => adapter ? augment(before, key, rng) : make(before, key, rng, context(before, rng)), routeCache);
      if (!candidate) { reject('no suitable ' + key + ' placement'); continue; }
      const lost = preserves(before, candidate); if (lost) { reject(lost); continue; }
      if (parent.protectedFaces.some(i => candidate.faces[i] !== before.faces[i])) { reject('changed an earlier partner pairing'); continue; }
      if (parent.protectedHidden.some(i => !candidate.down.includes(i))) { reject('revealed an earlier memory trap'); continue; }
      if (boardKey(before) === boardKey(candidate)) { reject('no new puzzle role'); continue; }
      const proposal = boardKey(candidate); if (proposed.has(proposal)) continue; proposed.add(proposal);
      let design = I.withSearchBudget(probeDeadline, () => fix(candidate, options.spare ?? 2), routeCache);
      if (!design || !valid(design)) { reject('no legal exact route'); continue; }
      if((design.trapObjectives||[]).some(g=>!relayPhase(design,g.tile).ok)){reject('relay does not survive the clock and resolve by midgame');continue;}
      let analysis = analyze(design), revealed = [];
      if (options.playerFeedback && stage === recipe.length - 1) {
        const protectedMemory = [...parent.protectedHidden, ...design.down.filter(i => !before.down.includes(i))];
        const prepared = Placement.prepare(design, analysis, protectedMemory);
        if (!prepared.design) { reject(prepared.reason); continue; }
        design = prepared.design; revealed = prepared.revealed;
        if (!valid(design)) { reject('visibility preparation invalid'); continue; }
        analysis = analyze(design);
      }
      const id = boardKey(design), placementScore = Placement.score(design, recipe, options.shape || '', analysis);
      const protectedFaces = [...new Set([...parent.protectedFaces, ...before.faces.map((f, i) => f !== design.faces[i] ? i : -1).filter(i => i >= 0)])];
      const protectedHidden = [...new Set([...parent.protectedHidden, ...design.down.filter(i => !before.down.includes(i)),
        ...(key === 'blindTwins' ? design.down.filter(i => Object.keys(design.obst?.ice || {}).some(j => design.faces[j] === design.faces[i])) : [])])];
      const added = ids(design).filter(i => !ids(before).includes(i));
      const components=parent.components.slice();
      for(const kind of ['ice','locks']){const own=kind==='ice'?Object.keys(design.obst?.ice||{}).map(Number).filter(i=>!before.obst?.ice?.[i]):
        (design.obst?.locks||[]).filter(i=>!(before.obst?.locks||[]).includes(i));
        if(own.length)components.push({name:key+'@'+stage+':'+kind,recipe:key,kind,indices:own});}
      const hidden = design.down.filter(i => !before.down.includes(i)), changedPictures = before.faces.map((f, i) => f !== design.faces[i] ? i : -1).filter(i => i >= 0);
      const changed = new Set([...added, ...hidden, ...changedPictures]);
      const steps = parent.steps.concat({ recipe: key, placement: adapter ? 'extend existing roles' : 'place new roles',
        clock: design.clock?.i ?? null, keys: design.obst?.keys || [], addedSpecials: added, addedHidden: hidden, changedPictures,
        connections: analysis.edges.filter(e => changed.has(e.from) || changed.has(e.to)) });
      const novelty = (options.seen || []).includes(analysis.signature) ? -3 : 0;
      choices.set(id, { design, steps, components, analysis, protectedFaces, protectedHidden, placementScore, revealed,
        score: placementScore.total + score(analysis, intent) + novelty });
    }
    beam = [...choices.values()].sort((a, q) => q.score - a.score).slice(0, beamWidth);
    if (!beam.length) { diagnostics.failedRecipe = key; diagnostics.probes = probes; return null; }
  }
  const best = beam[0]; diagnostics.probes = probes;
  return { design: best.design, plan: { version: VERSION, intent, recipe: recipe.slice(), steps: best.steps,
    components:best.components,
    analysis: best.analysis, placementScore: best.placementScore, revealedForReadability: best.revealed,
    structuralScore: +best.score.toFixed(3), probes, authoredBoard: boardKey(best.design) } };
}
module.exports = { VERSION, MOTIFS, INTENTS, known, authored, preserves, relayPhase, analyze, augment, compose };
