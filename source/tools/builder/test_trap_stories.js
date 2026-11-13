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

// layouts to try first per trap (found by the yield sweep); the search goes on over all 48 when fewer than 3 build
const FIRST = { keyOnClock: [7, 15, 20, 31, 2, 6], shortThaw: [0, 20, 24], wrongMelt: [0, 3, 5, 20, 21, 24] };
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
tst('shortThaw: frozen clock, a locked neighbour, a plain one, a decoy under a free pair; keys visible', () => {
  for (const b of boards('shortThaw')) {
    const d = b.r.design, bait = b.r.roles.bait, c = B.context(d.tiles);
    assert.equal(d.obst.ice[d.clock.i], 2); assert.ok(d.obst.locks.length >= 1);
    assert.ok(nbOf(c, d.clock.i).includes(bait.decoy) && c.above[bait.decoy].has(bait.pairs[0][0]), 'X lies on the decoy neighbour');
    assert.ok(c.free0[bait.pairs[0][0]] && c.free0[bait.pairs[0][1]], 'the pair is free at the start');
    assert.ok(bait.margin >= 2 && bait.margin <= 5);
    assert.equal(b.r.card.trap.type, 'shortThaw');
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
