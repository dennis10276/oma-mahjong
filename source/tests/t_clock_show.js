'use strict';
// Dennis 2026-11-16: "we need a clock sign ... you can click to show the clock ... when its buried": a tap on the clock's number
// shows the clock through the tiles on it.
module.exports = [
  { name: 'clock badge: a tap shows the clock and makes the tiles on it see-through', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ state: { name: 'Dennis', pid: 'test-clockshow', level: 301, seenSp: { clock: 1, clockMoves: 1, ice: 1, lock: 1, gold: 1, joker: 1, trayPair: 1 } } });
    await startLevel(p, 300);
    const before = await p.evaluate(() => ({ badge: !!document.getElementById('clockBadge'), on: G.nb.above[G.clock.i].filter(j => G.alive[j]).length }));
    t.ok(before.badge, 'the clock has its badge');
    await p.click('#clockBadge'); await sleep(150);
    const r = await p.evaluate(() => ({ hint: G.tiles[G.clock.i].el.classList.contains('cklit'), mark: !!G.tiles[G.clock.i].el.querySelector('.ckm'), xray: G.nb.above[G.clock.i].filter(j => G.alive[j] && G.tiles[j].el.classList.contains('xray')).length, mv: G.mv }));
    t.eq([r.hint, r.mark, r.xray, r.mv], [true, true, before.on, 0], 'clock tile lights up red with its clock signs, every tile on it is see-through, no move used');
  } },
];
