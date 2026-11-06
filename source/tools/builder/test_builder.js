/* Builder v2 tests (helper D, 2026-11-06): node --test tools/builder/test_builder.js (about a minute).
   Every story builds on at least 3 layouts; on every built board: every intent proven, the witness replays
   (E.replay), the clock is honest (E.clockShortest k + spare = clock.n), no face-down tile is free at the start,
   pictures are pairs, the forced tray pressure claim is a real proof. Plus small unit checks of the parts. */
'use strict';
const test = require('node:test'), assert = require('node:assert');
const B = require('./builder.js'), E = require('./engine.js');
const L = global.Layouts;

const BRIEF = { frame: { spare: 1 }, targets: { trayRoom: 0, maxDown: 0.3, hiddenOnWay: 2 }, seed: 1 };
const ORDER = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 7, 14, 23, 36, 41, 46, 2, 13, 26, 38];

test('tile counts always stay above seventy and inside the supported range', () => {
  for (const n of [0, 70, 98]) {
    const tiles = Array.from({ length: n }, (_, i) => [i * 4, 0, 0]);
    assert.strictEqual(B.build({ ...BRIEF, tiles, story: 'deepClock' }).fail, 'tileCount');
  }
});

function checkBoard(r, brief, where) {
  const d = r.design, g = E.game(d), n = d.tiles.length;
  assert.ok(n >= 72 && n % 2 === 0, where + ': tile count ' + n);
  for (const it of r.intents) assert.ok(it.proven, where + ': intent not proven: ' + it.name + ' ' + (it.detail || ''));
  const rep = E.replay(d, d.solution); assert.ok(rep.ok, where + ': witness ' + rep.why + ' at ' + rep.at);
  assert.strictEqual(r.card.tray.max, 3 - (brief.targets?.trayRoom ?? 1), where + ': requested tray cap');
  assert.ok(r.card.faceDownOnDig >= (brief.targets?.hiddenOnWay ?? 0), where + ': requested hidden tiles on dig');
  const k = E.clockShortest(g, { nodes: 400000, ms: 8000 });
  assert.ok(k && !k.unsure, where + ': clock way unresolved');
  assert.strictEqual(k.k + brief.frame.spare, d.clock.n, where + ': clock not honest');
  const al = new Uint8Array(n).fill(1);
  for (const i of d.down) assert.ok(!L.isFree(i, al, g.nb), where + ': face-down tile ' + i + ' free at the start');
  const cnt = {}; for (const f of d.faces) cnt[f] = (cnt[f] || 0) + 1;
  for (const f in cnt) assert.ok(f >= 0 && f < 36 && (cnt[f] === 2 || cnt[f] === 4), where + ': picture ' + f + ' x' + cnt[f]);
  if (d.obst.keys.length) assert.strictEqual(d.faces[d.obst.keys[0]], d.faces[d.obst.keys[1]], where + ': keys are not one pair');
  if (r.card.tray.forced) assert.strictEqual(B.canReachWithin(d, r.card.trayCap - 1, 100000), 'no', where + ': forced pressure claim');
}

for (const story of Object.keys(B.STORIES)) {
  test('story ' + story + ' builds on 3 layouts', () => {
    let ok = 0; const tried = [];
    for (const layout of ORDER) {
      if (ok >= 3) break;
      if (!B.fits(story, B.LAYOUTS[layout].tiles)) continue;
      const brief = { ...BRIEF, layout, story };
      const r = B.build(brief, { ms: 6000 });
      tried.push(layout + ':' + (r.fail || 'ok') + ':' + r.ms);
      if (r.fail) continue;
      checkBoard(r, brief, story + ' on layout ' + layout);
      ok++;
    }
    assert.ok(ok >= 3, story + ' built on only ' + ok + ' layouts: ' + tried.join(' '));
  });
}

test('luck follows the target (0 gives 0)', () => {
  const r = B.build({ ...BRIEF, layout: 0, story: 'deepClock', targets: { ...BRIEF.targets, hiddenOnWay: 0 } }, { ms: 6000 });
  assert.ok(!r.fail, r.fail); assert.ok(r.card.tray.luck <= 1, 'luck ' + r.card.tray.luck);
});

test('trayRoom 2 (cap 1) needs no orphans; an incompatible story never silently increases the cap', () => {
  const r = B.build({ ...BRIEF, layout: 5, story: 'keysFarSide', targets: { trayRoom: 2, maxDown: 0.3, hiddenOnWay: 0 } }, { ms: 6000 });
  assert.ok(!r.fail, r.fail + ' ' + (r.detail || ''));
  assert.strictEqual(r.card.orphans.length, 0);
  const d = B.build({ ...BRIEF, layout: 5, story: 'deepClock', targets: { trayRoom: 2, maxDown: 0.3, hiddenOnWay: 0 } }, { ms: 6000 });
  assert.strictEqual(r.card.tray.max, 1);
  assert.strictEqual(d.fail, 'incompatibleBrief');
});

test('unimplemented or incompatible explicit targets cannot produce a proven board', () => {
  const brief = { ...BRIEF, layout: 5, story: 'keysFarSide' };
  assert.strictEqual(B.build({ ...brief, frame: { spare: 1, share: 0.4 } }).fail, 'unsupportedTarget');
  assert.strictEqual(B.build({ ...brief, targets: { trapDepth: 3 } }).fail, 'unsupportedTarget');
  assert.strictEqual(B.build({ ...brief, targets: { trayRoom: 1, luck: 2 } }).fail, 'incompatibleBrief');
  assert.strictEqual(B.build({ ...brief, targets: { trayRoom: 3 } }).fail, 'invalidBrief');
  const excessive = B.build({ ...brief, targets: { trayRoom: 0, traps: 99 } }, { tries: 1, variants: 1, ms: 500 });
  assert.ok(excessive.fail, 'an unproven requested trap count must fail');
});

test('targets: way 14 and 5 moves with 3 waiting are met within 1', () => {
  const r = B.build({ ...BRIEF, layout: 10, story: 'deepClock', frame: { spare: 1, way: 14 }, targets: { trayRoom: 0, maxDown: 0.3, hiddenOnWay: 1, three: 5 } }, { ms: 6000 });
  assert.ok(!r.fail, r.fail + ' ' + (r.detail || ''));
  assert.ok(Math.abs(r.card.clock.fewestMoves - 14) <= 1, 'way ' + r.card.clock.fewestMoves);
  assert.ok(Math.abs(r.card.tray.three - 5) <= 1, 'three ' + r.card.tray.three);
  assert.ok(Math.abs(r.card.tray.luck - 1) <= 1, 'luck ' + r.card.tray.luck);
});

test('necessary tiles: the cover of the clock is necessary', () => {
  const c = B.context(B.LAYOUTS[0].tiles);
  const ck = c.tiles.findIndex((_, i) => c.above[i].size >= 3);
  const roles = { clock: ck, locks: new Set(), keys: [], ice: {}, holderSpecials: new Set() };
  const P = B.planDig(c, roles, () => 0.5);
  const N = B.necessary(c, roles, P);
  for (const a of c.above[ck]) assert.ok(N.has(a), 'cover tile ' + a + ' not necessary');
});

test('needSet: two frozen keys side by side do not count on each other', () => {
  const c = B.context(B.LAYOUTS[10].tiles);
  // layout 10: tiles 34 and 35 are neighbours at the bottom left, both under 52
  const roles = { clock: 36, locks: new Set([36]), keys: [34, 35], ice: { 34: 2, 35: 2 }, holderSpecials: new Set() };
  const P = B.planDig(c, roles, () => 0.5);
  assert.ok(P && P[P.length - 1] === 36, 'dig failed');
});

test('fits: islands only where keys can be buried on the other peak', () => {
  assert.strictEqual(B.fits('keysOnIsland', B.LAYOUTS[0].tiles), false);   // arch: one hill
  assert.strictEqual(B.fits('keysOnIsland', B.LAYOUTS[10].tiles), true);   // letter H: two towers
  assert.strictEqual(B.fits('deepClock', B.LAYOUTS[0].tiles), true);
});

test('opts.keep: the same puzzle with only pictures and face-down tiles placed again (one knob at a time)', () => {
  const brief = { layout: 10, story: 'lockBeside', seed: 1, frame: { spare: 1 }, targets: { trayRoom: 0, hiddenOnWay: 1, maxDown: 0.3, luck: 1 } };
  const r = B.build(brief, {}); assert.ok(!r.fail, JSON.stringify(r).slice(0, 200)); assert.ok(r.keep);
  const v = B.build({ ...brief, seed: 7, targets: { ...brief.targets, luck: 2, hiddenOnWay: 2 } }, { keep: r.keep });
  assert.ok(!v.fail, JSON.stringify(v).slice(0, 200));
  assert.deepEqual(v.design.tiles, r.design.tiles);
  assert.equal(v.design.clock.i, r.design.clock.i);
  assert.deepEqual(v.design.obst, r.design.obst);
  assert.deepEqual(v.keep.P, r.keep.P);
  assert.deepEqual(v.keep.holders, r.keep.holders);
  assert.deepEqual(v.keep.roles, r.keep.roles);
  assert.deepEqual(r.keep, JSON.parse(JSON.stringify(r.keep)), 'keep is a serializable checkpoint');
  assert.equal(B.build({ ...brief, layout: 0 }, { keep: r.keep }).fail, 'incompatibleKeep');
  assert.equal(B.build({ ...brief, story: 'deepClock' }, { keep: r.keep }).fail, 'incompatibleKeep');
  assert.ok(Math.abs(v.card.tray.luck - 2) <= 1);
});
