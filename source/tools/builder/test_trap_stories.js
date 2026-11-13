'use strict';
/* Tests for builder/trap_stories.js (traps 1-3 of the merged trap spec, analysis/builder/process-v2/trap-design-2026-11-12.md).
     node --test source/tools/builder/test_trap_stories.js
     node source/tools/builder/test_trap_stories.js --sweep [trap] [seeds]     yield over all 48 layouts (light: construction + proofs only)
     node source/tools/builder/test_trap_stories.js --examples                 writes source/build/traps/examples/<trap>-<layout>.json
   Light runs only: a few boards per trap, no bots, no Firebase. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const T = require('./trap_stories.js'), B = require('./builder.js'), E = require('./engine.js'), D = require('./loop/detour.js'), O = require('./loop/obvious.js');
const SG = require('./loop/static_gates.js'), GP = require('./loop/gate_profile.js'), M = require('../factory/meter.js');
const VC = require('../builder-next/construct.js');
const { shownAll } = require('./shown.js'), SEP = require('./bank/separate.js');

// layouts to try first per trap (found by the yield sweep); the search goes on over all 48 when fewer than 3 build
const FIRST = { keyOnClock: [7, 15, 20, 6, 31, 2], wrongMelt: [0, 5, 21, 24, 3, 20], lockedMelt: [46, 36, 31], guardedKey: [4, 9, 13, 17, 12, 47] };
const WANT = 3;
const CLI = require.main === module && (process.argv.includes('--sweep') || process.argv.includes('--examples'));
const tst = CLI ? () => {} : test;   // the CLI modes (sweep, examples) do not run the tests
const cache = {};
function boards(name, want = WANT, extra = {}) {
  const key = name + want + JSON.stringify(extra);
  if (cache[key]) return cache[key];
  const out = [], order = FIRST[name].concat([...Array(48).keys()].filter(l => !FIRST[name].includes(l)));
  for (const layout of order) {
    if (out.length >= want) break;
    for (const seed of [1, 2, 3]) {
      const r = T.build(name, { layout, seed, stage: 'edge', ...extra }, { tries: 30 });
      if (r.design) { out.push({ layout, seed, r }); break; }
    }
  }
  return (cache[key] = out);
}

// ---------- independent checks on a built board ----------
const nbOf = (c, i) => c.inb[i].filter(j => !c.above[i].has(j) && !c.above[j].has(i));
function mechanism(c, design) {
  const ob = design.obst, ice = Object.keys(ob.ice).map(Number), roleTiles = [design.clock.i, ...ob.keys, ...ob.locks, ...ice];
  const nbs = ice.flatMap(i => nbOf(c, i)), base = new Set([...roleTiles, ...nbs]);
  const covers = [...base].flatMap(i => [...c.above[i]]);
  return { roleTiles, nbs: new Set(nbs), covers: new Set(covers), all: new Set([...base, ...covers]) };
}
// bait tiles are role tiles, thaw-neighbours, covers of those (key/clock/neighbour covers) or the twin (same picture) of one of them
function isStructural(c, design, t) {
  const m = mechanism(c, design);
  if (m.all.has(t)) return true;
  return [...m.all].some(u => u !== t && design.faces[u] === design.faces[t]);
}
function checkBoard(name, b) {
  const { r, layout } = b, d = r.design, roles = r.roles, bait = roles.bait, c = B.context(d.tiles);
  assert.equal(bait.type, name);
  assert.equal(r.card.trap.type, name);
  const spare = r.card.clock.spare; assert.ok(spare === 1 || spare === 2, 'spare 1 by default, 2 as the fallback'); assert.equal(d.clock.n - r.card.clock.fewestMoves, spare);
  assert.ok(E.replay(d, d.solution).ok, 'stored witness replays');
  // all role tiles and the whole mechanism are face-up and in sight at move 0
  const g = E.game(d), s0 = E.start(g), vr = O.visibleRoles(g, s0), m = mechanism(c, d), down = new Set(d.down);
  for (const i of [...Object.keys(d.obst.ice).map(Number), ...d.obst.locks, ...d.obst.keys]) assert.ok(vr[i], `role overlay of tile ${i} in sight at move 0`);
  for (const i of [...m.all, ...bait.tiles, ...bait.keepUp]) assert.ok(!down.has(i), `tile ${i} of the mechanism is face-up`);
  // structural bait
  for (const t of bait.tiles) assert.ok(isStructural(c, d, t), `bait tile ${t} is structural`);
  // pairs really are pairs
  for (const [x, y] of bait.pairs) assert.equal(d.faces[x], d.faces[y]);
  // the engine proof, redone from scratch: lose, or a cost of at least spare+1, exact; never unknown
  const nShipMax = Math.min(19, r.card.clock.fewestMoves + 3), C = D.clockGames(d), k = r.card.clock.fewestMoves;
  const take = bait.single || bait.pairs[0], p = D.priceMove(C, E.start(C.at(d.clock.n)), { take }, { base: k, nShipMax, nodes: 200000, w: D.work(8e6) });
  assert.equal(p.exact, true); assert.notEqual(p.result, 'unknown');
  assert.ok(p.result === 'lose' || p.cost >= spare + 1, `bait costs: ${p.result} ${p.cost}`);
  // no placement rule on the uncovered share or the position of the clock (Dennis 2026-11-13: "the tile itself is fine to be covered more"); shares are information only
  assert.equal(r.card.trap.shown.clock, shownAll(d.tiles)[d.clock.i]);
  // the control comparison: every bait costs strictly more than the dearest unrelated free move (lose counts as the loosest spare + 1)
  const tcc = r.card.trap; assert.ok(tcc.control && Number.isFinite(tcc.control.value) && !tcc.control.unknown, 'control recorded');
  assert.ok(tcc.baits.length >= 1);
  for (const b of tcc.baits) { assert.ok(b.value > tcc.control.value, 'bait ' + b.name + ' ' + b.value + ' above control ' + tcc.control.value); assert.ok(b.result === 'lose' || b.cost >= spare + 1); }
  // the card data
  const tc = r.card.trap;
  assert.ok(tc.bait.tiles.length >= 1 && tc.cost.exact === true && tc.see.length > 20 && !tc.see.includes('\n'));
  assert.ok(tc.decisive.first != null && tc.decisive.shareFirst != null, 'decisive window recorded');
  return { layout, k, p, tc };
}

for (const name of T.NAMES) {
  test(`${name}: builds with its own proof on at least ${WANT} different layouts`, () => {
    const bs = boards(name);
    assert.ok(bs.length >= WANT, `${name}: only ${bs.length} layouts built`);
    assert.equal(new Set(bs.map(b => b.layout)).size, bs.length);
    for (const b of bs) checkBoard(name, b);
  });
}

tst('keyOnClock: the stored route takes the keys consecutively, after a dig; the near key is free on the clock stack', () => {
  for (const b of boards('keyOnClock')) {
    const d = b.r.design, [A, Bk] = b.r.roles.bait.keyA === d.obst.keys[0] ? d.obst.keys : d.obst.keys.slice().reverse(), sol = d.solution;
    const c = B.context(d.tiles), ia = sol.indexOf(b.r.roles.bait.keyA), ib = sol.indexOf(b.r.roles.bait.keyB);
    assert.equal(Math.abs(ia - ib), 1); assert.ok(Math.min(ia, ib) >= 3, 'a real dig before the keys');
    assert.ok(c.free0[b.r.roles.bait.keyB] && c.above[d.clock.i].has(b.r.roles.bait.keyB), 'B is free and lies on the clock');
    assert.deepEqual(d.obst.locks, [d.clock.i]);
  }
});
tst('shortThaw is retired: not in the buildable name list, its code stays', () => {
  assert.ok(!T.NAMES.includes('shortThaw')); assert.deepEqual(T.RETIRED, ['shortThaw']); assert.ok(T.STORIES.shortThaw.place && T.STORIES.shortThaw.prove);
});
tst('no clock placement rule: shares are information only, a fully covered or top-row clock is not rejected by the stories', () => {
  assert.ok(shownAll([[10, 10, 0], [10, 10, 1]])[0] < 0.3, 'a tile straight on it hides most of the face - allowed');
  const src = fs.readFileSync(path.join(__dirname, 'trap_stories.js'), 'utf8'); assert.ok(!/timerFacts|timerShown|timerCut/.test(src), 'no timer/position rule in the stories');
  assert.ok(!fs.existsSync(path.join(__dirname, 'shown.js')) || !/timerFacts/.test(fs.readFileSync(path.join(__dirname, 'shown.js'), 'utf8')));
  for (const name of T.NAMES) { const sh = boards(name)[0].r.card.trap.shown; assert.ok(sh.clock >= 0 && sh.clock <= 1 && sh.minRole >= 0 && sh.minRole <= 1 && sh.roles); }
});
tst('keyOnClock: the free key lies on the clock (original recipe)', () => {
  for (const b of boards('keyOnClock')) {
    const bait = b.r.roles.bait, d = b.r.design, c = B.context(d.tiles);
    assert.ok(c.above[d.clock.i].has(bait.keyB) && c.free0[bait.keyB]);
  }
});
tst('lockedMelt: frozen clock, locked neighbours, a lonely free neighbour with a buried twin, a near key and a far key; both baits proven; lock and ice not idle', () => {
  for (const b of boards('lockedMelt')) {
    const d = b.r.design, bait = b.r.roles.bait, c = B.context(d.tiles), tc = b.r.card.trap;
    assert.equal(d.obst.ice[d.clock.i], 2); assert.ok(d.obst.locks.length >= 1); assert.equal(d.obst.keys.length, 2);
    for (const l of bait.locked) assert.ok(nbOf(c, d.clock.i).includes(l) && d.obst.locks.includes(l), 'a locked thaw-neighbour');
    for (const f of bait.wrong) assert.ok(nbOf(c, d.clock.i).includes(f) && c.free0[f] && !d.obst.locks.includes(f), 'the lonely neighbour is free');
    assert.ok(c.above[bait.twins[0]].size >= 2 && d.faces[bait.twins[0]] === d.faces[bait.wrong[0]], 'its twin is buried');
    assert.ok(c.free0[bait.keyNear] && c.above[bait.keyFar].size >= 1 && c.above[bait.keyFar].size <= 3, 'near key free, far key under 1-3');
    assert.deepEqual(tc.baits.map(x => x.name).sort(), [...bait.wrong.map(() => 'lonelyNeighbour'), 'nearKeyFirst'].sort());
    assert.ok(tc.idle.kNoLock < tc.idle.k && tc.idle.kNoIce < tc.idle.k, 'lock and ice are not idle');
    assert.ok(d.solution.indexOf(bait.locked[0]) < d.solution.indexOf(d.clock.i), 'the stored route melts with the locked neighbour');
  }
});
tst('guardedKey: locked clock, key A under exactly one frozen cover g, free key B; the bait is B first; ice and lock not idle', () => {
  for (const b of boards('guardedKey')) {
    const d = b.r.design, bait = b.r.roles.bait, c = B.context(d.tiles), tc = b.r.card.trap;
    assert.deepEqual(d.obst.locks, [d.clock.i]); assert.equal(d.obst.ice[bait.guard], 2); assert.equal(Object.keys(d.obst.ice).length, 1);
    assert.equal(c.above[bait.keyA].size, 1); assert.ok(c.above[bait.keyA].has(bait.guard)); assert.ok(c.free0[bait.keyB] && c.free0[bait.guard]);
    const vr = O.visibleRoles(E.game(d), E.start(E.game(d))); assert.ok(vr[bait.keyA] && vr[bait.guard], 'A shows with g present');
    assert.ok(tc.idle.kNoIce <= tc.idle.k - 1 && tc.idle.kNoLock < tc.idle.k);
    assert.ok(d.solution.indexOf(bait.guard) < d.solution.indexOf(bait.keyA));
  }
});
tst('wrongMelt: frozen clock, no keys, a free neighbour whose twin is buried', () => {
  for (const b of boards('wrongMelt')) {
    const d = b.r.design, bait = b.r.roles.bait, c = B.context(d.tiles);
    assert.equal(d.obst.ice[d.clock.i], 2); assert.deepEqual(d.obst.locks, []); assert.deepEqual(d.obst.keys, []);
    const L1 = bait.single[0], T1 = bait.twins[0];
    assert.ok(nbOf(c, d.clock.i).includes(L1) && c.free0[L1], 'L is a free thaw neighbour');
    assert.ok(c.above[T1].size >= 2, 'its twin is buried'); assert.equal(d.faces[L1], d.faces[T1]);
  }
});

tst('one board per trap passes the static gates under traps-v1 (A5 met by the story proof); e5-v1 would not need it', () => {
  const prof = GP.loadProfile('traps-v1');
  for (const name of T.NAMES) {
    const b = boards(name)[0], r = b.r;
    const raw = SG.staticGates(r.design, { story: name });
    const withProof = GP.applyStatic(raw, prof, { storyProof: r.trap }), without = GP.applyStatic(raw, prof);
    for (const g of ['A1', 'A2', 'A3', 'A4', 'A6', 'A9']) assert.equal(withProof.gates[g].pass, true, `${name} ${g}`);
    assert.equal(withProof.gates.A5.pass, true); assert.equal(withProof.pass, true, name);
    if (!raw.gates.A5.pass) { assert.equal(withProof.gates.A5.storyProof, true); assert.equal(without.pass, false, 'without the story proof A5 stays required and fails'); }
    assert.ok(withProof.shipSpares.includes(r.card.clock.spare), 'A4 holds at the shipped spare');
  }
});

tst('gate profile traps-v1 differs from e5-v1 only in A5 (required, story-met); e5-v1 is unchanged', () => {
  const e5 = GP.loadProfile('e5-v1'), tr = GP.loadProfile('traps-v1');
  assert.deepEqual(e5.static.reportOnly, ['A5', 'A7']); assert.equal(e5.static.storyMet, undefined);
  assert.deepEqual(tr.static.reportOnly, ['A7']); assert.deepEqual(tr.static.storyMet, ['A5']);
  assert.deepEqual(tr.static.required, e5.static.required.concat(['A5']).sort());
  assert.deepEqual(tr.traces, e5.traces); assert.deepEqual(tr.evidence, e5.evidence);
  // the story proof only rescues A5, and only when it stands
  const rep = { pass: false, shipSpares: [1], gates: Object.fromEntries(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'].map(g => [g, { pass: g !== 'A5' }])) };
  assert.equal(GP.applyStatic(rep, tr).pass, false);
  assert.equal(GP.applyStatic(rep, tr, { storyProof: { ok: false } }).pass, false);
  assert.equal(GP.applyStatic(rep, tr, { storyProof: { ok: true } }).pass, true);
  rep.gates.A4.pass = false; assert.equal(GP.applyStatic(rep, tr, { storyProof: { ok: true } }).pass, false, 'no other gate is rescued');
  assert.equal(GP.applyStatic(rep, e5).pass, false);
});

// boardKeys of four old-story boards, computed with the UNCHANGED construct.js before the three hooks went in (git HEAD): the hooks are no-ops
const OLD = [
  [{ layout: 5, story: 'iceLockClock', stage: 'edge', seed: 3, frame: { spare: 1 }, targets: { trayRoom: 1, traps: 1, maxDown: 0.2 } }, '57090b554723727770997086efb0d4cd0b7c4f04b4d092f3c8fbd93e3e0aa685'],
  [{ layout: 12, story: 'keysFarSide', stage: 'top', seed: 7, frame: { spare: 1 }, targets: { trayRoom: 0, traps: 2, maxDown: 0.2 } }, 'eec4eaf009005792a3c664d3a375218c42c2fff12012429f3cc2875808befc43'],
  [{ layout: 20, story: 'deepClock', stage: 'edge', seed: 11, frame: { spare: 2 }, targets: { trayRoom: 1, traps: 1, maxDown: 0.1 } }, '5a8a202e114a06b3e6bff54e438701f3a673db897f84ac9a4ba4dfdd223dde9b'],
  [{ layout: 30, story: 'lockBeside', stage: 'top', seed: 2, frame: { spare: 1 }, targets: { trayRoom: 1, traps: 1, maxDown: 0.2 } }, '443a78b4ef53d368f03706a9791385e5cb3df00ea0c14540fab54b33a03e0b08'],
];
tst('old stories build byte-identical boards after the hooks (boardKey before == after)', () => {
  for (const [brief, key] of OLD) {
    const r = VC.build(brief, { tries: 20 });
    assert.ok(r.design, brief.story + ' ' + r.fail);
    assert.equal(M.boardKey(r.design), key, brief.story);
    assert.equal(r.trap, undefined); assert.equal(r.card.trap, undefined);
    assert.equal(B.STORIES[brief.story].place, undefined); assert.equal(B.STORIES[brief.story].prove, undefined);
  }
});

tst('trap builds are deterministic and unknown trap names fail cleanly', () => {
  const a = T.build('keyOnClock', { layout: 10, seed: 1, stage: 'edge' }, { tries: 30 }), b = T.build('keyOnClock', { layout: 10, seed: 1, stage: 'edge' }, { tries: 30 });
  assert.ok(a.design); assert.equal(M.boardKey(a.design), M.boardKey(b.design));
  assert.equal(T.build('nope', {}).fail, 'unknownTrapStory');
});


// ---------- chain traps (compositional generator) ----------
// shape index -> a layout that hosts it (found by trap_chain_sweep.js); the test builds each of these from scratch
const CHAIN_AT = require('./trap_chain_hosts.json');
const chainCache = {};
function chainBoard(si) {
  if (chainCache[si]) return chainCache[si];
  const sig = T.CHAIN_SHAPES[si];
  for (const layout of CHAIN_AT[si]) { const r = T.build('chain', { chain: sig, layout, seed: 1, stage: 'edge' }, { tries: 30 }); if (r.design) return (chainCache[si] = { r, layout, sig }); }
  return null;
}
tst('chain: grammar - distinct signatures of length 2-4 covering frozen clock, frozen lock/locked tile, frozen key cover, frozen way tiles, lock on the clock, on a clock cover, on a thaw-neighbour', () => {
  assert.equal(new Set(T.CHAIN_SHAPES).size, T.CHAIN_SHAPES.length); assert.ok(T.CHAIN_SHAPES.length >= 10);
  for (const d of T.CHAIN_DEFS) assert.ok(d.length >= 2 && d.length <= 4, d.sig + ' length ' + d.length);
  const has = f => T.CHAIN_DEFS.some(f);
  assert.ok(has(d => d.ck === 'ice') && has(d => d.ck === 'lock') && has(d => d.cover === 'ice') && has(d => d.cover === 'lock') && has(d => d.nb === 'lock') && has(d => d.nb === 'ice') && has(d => d.keyA === 'cover') && has(d => d.keyA === 'way') && has(d => d.keyB === 'cover'));
  assert.equal(T.build('chain', { chain: 'nope', layout: 4 }).fail, 'unknownChainShape');
  assert.ok(/overlay per tile/.test(T.CHAIN_UI_NOTE));
});
tst('chain: at least 10 different shapes build with their own proof; every special matters and is connected; baits are proven above the control', { timeout: 1500000 }, () => {
  const built = Object.keys(CHAIN_AT).map(Number).map(si => ({ si, b: chainBoard(si) })).filter(x => x.b);
  assert.ok(built.length >= 10, 'shapes built: ' + built.length);
  for (const { si, b } of built) {
    const { r, sig } = b, d = r.design, tc = r.card.trap, spare = r.card.clock.spare, k = r.card.clock.fewestMoves, ob = d.obst, c = B.context(d.tiles);
    assert.equal(r.card.trapType, 'chain:' + sig); assert.equal(tc.shape, sig); assert.equal(tc.type, 'chain'); assert.equal(tc.trapType, 'chain:' + sig);
    assert.ok(E.replay(d, d.solution).ok); assert.equal(d.clock.n - k, spare); assert.ok(tc.see.length > 30 && !tc.see.includes('\n'));
    // one overlay per tile: no tile is frozen and a key / locked / the clock's lock at once (the game would show only the ice)
    const ice = Object.keys(ob.ice).map(Number), roleList = [...ice, ...ob.locks, ...ob.keys];
    assert.equal(new Set(roleList).size, roleList.length, sig + ': a tile carries two roles'); assert.ok(ice.every(t => !ob.keys.includes(t)), 'no frozen key tile');
    // all role tiles in sight at move 0 and face-up
    const g = E.game(d), vr = O.visibleRoles(g, E.start(g)), down = new Set(d.down);
    for (const t of roleList) { assert.ok(vr[t], sig + ': overlay of ' + t + ' in sight'); assert.ok(!down.has(t)); }
    for (const t of r.roles.bait.keepUp) assert.ok(!down.has(t), 'mechanism tile face-up');
    // baits: 1-2, proven exactly, strictly dearer than the control
    assert.ok(tc.baits.length >= 1 && tc.baits.length <= 2); assert.ok(Number.isFinite(tc.control.value));
    const C = D.clockGames(d), s0 = E.start(C.at(d.clock.n)), nShipMax = Math.min(19, k + 3);
    for (const bt of tc.baits) {
      const p = D.priceMove(C, s0, { kind: bt.tiles.length > 1 ? 'pair' : 'single', take: bt.tiles }, { base: k, nShipMax, nodes: 200000, w: D.work(8e6) });
      assert.equal(p.exact, true); assert.ok(p.result === 'lose' || p.cost >= spare + 1, sig + ' ' + bt.name + ' costs ' + p.result + ' ' + p.cost); assert.ok(bt.value > tc.control.value, sig + ' bait ' + bt.name + ' above control');
    }
    // every lock and every ice matters (recomputed here): the proven shortest clock route gets shorter without it, or the bait turns harmless
    assert.equal(tc.idle.length, ob.locks.length + ice.length);
    const kOf = mod => E.clockShortest(E.game(JSON.parse(JSON.stringify({ ...d, obst: { ...ob, ...mod }, clock: { ...d.clock, n: 99 } }))), { nodes: 300000, ms: Infinity, finishNodes: 100000, finishMs: Infinity }).k;
    for (const l of ob.locks) { const row = tc.idle.find(x => x.kind === 'lock' && x.tile === l); assert.ok(kOf({ locks: ob.locks.filter(x => x !== l) }) < k || row.harmlessBait, sig + ': lock ' + l + ' idle'); }
    for (const f of ice) { const i2 = { ...ob.ice }; delete i2[f]; const row = tc.idle.find(x => x.kind === 'ice' && x.tile === f); assert.ok(kOf({ ice: i2 }) < k || row.harmlessBait, sig + ': ice ' + f + ' idle'); }
    // connected: every special reaches the clock over the recorded links
    assert.equal(tc.connected, true); const adj = {}; for (const [x, y] of tc.links) { (adj[x] = adj[x] || []).push(y); (adj[y] = adj[y] || []).push(x); }
    const seen = new Set([d.clock.i]), st = [d.clock.i]; while (st.length) for (const j of adj[st.pop()] || []) if (!seen.has(j)) { seen.add(j); st.push(j); }
    for (const t of roleList) assert.ok(seen.has(t), sig + ': special ' + t + ' not connected');
    // the gates (traps-v1) hold and shapes with a frozen clock really freeze the clock, shapes with a locked clock lock it
    const sg = GP.applyStatic(SG.staticGates(d, { story: 'chain' }), GP.loadProfile('traps-v1'), { storyProof: { ok: true } }); assert.ok(sg.pass, sig + ' static gates');
    const def = T.CHAIN[sig]; if (def.ck === 'ice') assert.ok(ob.ice[d.clock.i] > 0); if (def.ck === 'lock') assert.ok(ob.locks.includes(d.clock.i)); if (def.cover) assert.ok(c.above[d.clock.i].size >= 1);
    // the bait tiles are role tiles, covers, neighbours or twins (structural), as in the other stories
    for (const t of r.roles.bait.tiles) assert.ok(isStructural(c, d, t) || r.roles.bait.twins.includes(t), 'bait tile structural');
  }
});
tst('chain: deterministic from the seed', () => {
  const si = +Object.keys(CHAIN_AT)[0], sig = T.CHAIN_SHAPES[si], l = CHAIN_AT[si][0];
  const a = T.build('chain', { chain: sig, layout: l, seed: 1, stage: 'edge' }, { tries: 30 }), b = T.build('chain', { chain: sig, layout: l, seed: 1, stage: 'edge' }, { tries: 30 });
  assert.equal(M.boardKey(a.design), M.boardKey(b.design));
});
tst('separate: a chain board keeps its proof, k and roles when its twins are moved apart', { timeout: 900000 }, () => {
  const si = +Object.keys(CHAIN_AT)[0], b = chainBoard(si), before = SEP.closeTwins(b.r.design), o = T.separateBoard('chain', b.r, { wallMs: 30000 });
  assert.ok(o.proofOk && o.validated, 'chain proof after separation ' + o.proofWhy); assert.ok(o.after.count < before.count); assert.deepEqual(o.design.obst, b.r.design.obst); assert.deepEqual(o.design.tiles, b.r.design.tiles);
  assert.ok(E.replay(o.design, o.design.solution, { strict: true }).ok);
});

// ---------- twins apart (bank/separate.js) ----------
tst('closeTwins: touching, diagonal, stacked and same-row-nothing-between twins are close; a tile in between or far apart is not', () => {
  const cnt = tiles => SEP.closeTwins({ tiles, faces: tiles.map((_, i) => i < 2 ? 0 : i), down: [] }).count;
  assert.equal(cnt([[0, 0, 0], [2, 0, 0]]), 1, 'side by side'); assert.equal(cnt([[0, 0, 0], [2, 2, 0]]), 1, 'diagonal');
  assert.equal(cnt([[0, 0, 0], [1, 1, 1]]), 1, 'stacked'); assert.equal(cnt([[0, 0, 0], [4, 0, 0]]), 1, 'one tile of space, nothing between');
  assert.equal(cnt([[0, 0, 0], [4, 0, 0], [2, 0, 0]]), 0, 'a tile between'); assert.equal(cnt([[0, 0, 0], [6, 0, 0]]), 0, 'two tiles apart'); assert.equal(cnt([[0, 0, 0], [0, 6, 0]]), 0, 'far in the column');
});
tst('separate: one built trap board per kind loses its close twins, keeps replay, k, readability and the story proof', { timeout: 900000 }, () => {
  for (const name of T.NAMES) {
    const b = boards(name, 1)[0], r = b.r, before = SEP.closeTwins(r.design);
    const o = T.separateBoard(name, r, { wallMs: 30000 });
    assert.ok(o.proofOk, name + ' proof after separation: ' + o.proofWhy); assert.ok(o.validated);
    assert.ok(E.replay(o.design, o.design.solution, { strict: true }).ok);
    assert.equal(E.clockShortest(E.game(JSON.parse(JSON.stringify(o.design)))).k, r.card.clock.fewestMoves, 'clock k unchanged');
    assert.ok(o.after.count < before.count && o.after.visible <= before.visible, name + ': close ' + before.count + ' -> ' + o.after.count);
    assert.ok(o.after.share <= 0.2, name + ' close share after ' + o.after.share);
    // tiles, specials, clock are untouched; only pictures moved; the bait pairs are still twins
    assert.deepEqual(o.design.tiles, r.design.tiles); assert.deepEqual(o.design.obst, r.design.obst); assert.deepEqual(o.design.down, r.design.down); assert.equal(o.design.clock.i, r.design.clock.i);
    for (const [x, y] of r.roles.bait.pairs) assert.equal(o.design.faces[x], o.design.faces[y], 'bait pair still twins');
  }
});
test('separate is deterministic from its seed (synthetic 4x4 board)', () => {
  const tiles = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) tiles.push([x * 2, y * 2, 0]);
  const faces = tiles.map((_, i) => i >> 1), d = { tiles, faces, down: [], gold: [], obst: { ice: {}, locks: [], keys: [] }, clock: { i: 0, n: 99 }, solution: [...tiles.keys()] };
  const val = dd => ({ ok: E.replay(dd, dd.solution, { strict: true }).ok });
  const r1 = SEP.separate(d, { seed: 3, wallMs: 4000, validate: val }), r2 = SEP.separate(d, { seed: 3, wallMs: 4000, validate: val });
  assert.deepEqual(r1.design.faces, r2.design.faces); assert.ok(r1.ms < 6000); assert.ok(r1.after.count <= r1.before.count);
});

// ---------- CLI: yield sweep and example boards ----------
const WALL = +(process.env.WALL_MS || 12000);
function sweep(name, seeds) {
  const rows = [], fails = {}; let attempts = 0, ok = 0;
  for (let layout = 0; layout < 48; layout++) {
    let built = 0, att = 0; const ks = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const r = T.build(name, { layout, seed, stage: 'edge' }, { tries: 30, wallMs: WALL });
      if (r.design) { built++; att += r.card.attempt + 1; ks.push(r.card.clock.fewestMoves + '+' + r.card.clock.spare); } else { att += r.fails ? Object.values(r.fails).reduce((a, b) => a + b, 0) : 30; for (const [f, n] of Object.entries(r.fails || {})) fails[f] = (fails[f] || 0) + n; }
    }
    rows.push({ layout, built, seeds, attempts: att, k: ks }); ok += built; attempts += att;
    if (process.env.VERBOSE) console.log(name, layout, `${built}/${seeds}`, ks.join(','));
  }
  return { name, seeds, builds: ok, buildsOf: 48 * seeds, layoutsWithBuild: rows.filter(r => r.built).length, provenPerAttempt: `${ok}/${attempts}`, fails, rows };
}
function examples() {
  const dir = path.resolve(__dirname, '../../build/traps/examples'); fs.mkdirSync(dir, { recursive: true });
  const used = [];
  for (const name of T.NAMES) {
    let n = 0;
    for (const b of boards(name, 2)) {
      const r = b.r, lay = B.LAYOUTS[b.layout];
      const file = path.join(dir, `${name}-${b.layout}.json`);
      fs.writeFileSync(file, JSON.stringify({ trap: name, layout: b.layout, shape: lay.shape, seed: b.seed, tiles: r.design.tiles.length, boardKey: M.boardKey(r.design),
        bait: r.roles.bait.tiles, card: r.card.trap, clock: r.card.clock, story: r.card.story, sentence: r.card.sentence, design: r.design }, null, 1));
      used.push(file); if (++n >= 2) break;
    }
  }
  return used;
}
if (require.main === module && process.argv.includes('--sweep')) {
  const i = process.argv.indexOf('--sweep'), names = T.NAMES.includes(process.argv[i + 1]) ? [process.argv[i + 1]] : T.NAMES, seeds = +(process.argv[i + 2] || (T.NAMES.includes(process.argv[i + 1]) ? 2 : process.argv[i + 1]) || 2) || 2;
  for (const n of names) { const s = sweep(n, seeds); console.log(JSON.stringify({ ...s, rows: undefined })); console.log(s.rows.map(r => `${r.layout}:${r.built}/${r.seeds}`).join(' ')); }
} else if (require.main === module && process.argv.includes('--examples')) {
  console.log(examples().join('\n'));
}
module.exports = { sweep, examples, boards, isStructural };
