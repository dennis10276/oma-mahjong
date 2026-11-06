/* Fast gate test (helper C, 2026-11-06): six representative briefs from briefs-v1.json, seed 1, built and run through
   gate.js's static checks (replay, honest clock, no face-down tile free, pictures, no idle special).
     node --test source/tools/builder/test_gate.js                       (about 2-5 s on a quiet machine)
   The six: keys on the other island, ice + lock + clock, frozen guards, a chain reaction, the deep clock, and locked
   partners (holders). Known builder issue (gate-report.md): unused holders keep their lock; that check is a todo. */
'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const B = require('./builder.js'), G = require('./gate.js');
const BRIEFS = require('./briefs-v1.json');
const PICK = ['keysOnIsland-letterH-26', 'iceLockClock-arch-28', 'frozenGuards-frame-18', 'chainReaction-arch-12', 'deepClock-vase-11', 'roomInTrayLocked-frame-45'];

const built = {};
for (const id of PICK) {
  test(`${id} (seed 1): builds, every intent proven, static checks clean`, () => {
    const brief = BRIEFS.find(b => b.id === id);
    assert.ok(brief, 'brief ' + id + ' is in briefs-v1.json');
    const b = { ...brief, seed: 1 }, r = B.build(b, { ms: 15000 });
    assert.equal(r.fail, undefined, `build failed: ${r.fail} ${r.detail || ''} ${JSON.stringify(r.fails || {})}`);
    for (const it of r.intents) assert.ok(it.proven, `intent not proven: ${it.name} (${it.detail})`);
    const c = G.checkDesign(r.design, b);
    built[id] = c;
    assert.ok(c.faces.ok, 'pictures: ' + JSON.stringify(c.faces));
    assert.deepEqual(c.downFree, [], 'no face-down tile free at the start');
    assert.ok(c.replay.ok, 'solution replays: ' + JSON.stringify(c.replay));
    assert.equal(c.clock.k + (brief.frame.spare ?? 1), r.design.clock.n, 'clock = fewest moves + spare');
    assert.equal(c.clock.winAtK, 'win', 'winnable with the clock at the fewest moves');
    assert.notEqual(c.clock.atKminus1, 'win', 'not winnable with one move less');
    assert.deepEqual(c.problems.filter(p => p.kind === 'specials' || p.kind === 'clock'), []);
    const idle = c.specials.filter(e => e.verdict === 'idle' && !e.holderStory);
    assert.deepEqual(idle.map(e => e.special), [], 'every lock and ice tile makes the fewest way to the clock longer');
  });
}

test('locked partners: every holder holds the twin of a tile taken on the way', { todo: 'builder keeps the lock on holders it did not use (gate-report.md)' }, () => {
  const c = built['roomInTrayLocked-frame-45'];
  assert.ok(c, 'the holder brief was built');
  assert.deepEqual(c.specials.filter(e => e.verdict === 'idle').map(e => e.special), []);
});
