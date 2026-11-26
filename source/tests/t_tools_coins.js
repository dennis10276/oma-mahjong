'use strict';
/* The helper buttons beside the tray (Spieken, Terug): on every level (also past 50 without the earned tools), the count is the
   stock, and a tap on a button never reaches the pile or home/restart above it. */
module.exports = [
  {
    name: 'helper buttons: shown on every level, the count is the stock, they take no room from the pile',
    async run(t, { startLevel, click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-coins', level: 30, econV: 2, peekStock: 2, undoStock: 3 } });
      await startLevel(p, 20); await sleep(300);
      const look = q => q.evaluate(() => ['#btnPeek', '#btnUndo'].map(s => { const e = document.querySelector(s), r = e.getBoundingClientRect(); return [r.width > 0 && getComputedStyle(e).visibility === 'visible', e.querySelector('.cnt').textContent, e.querySelector('b').textContent]; }));
      t.eq(await look(p), [[true, '2', 'Spieken'], [true, '3', 'Terug']], 'level 20: both there, count = stock, names');
      // not earned (from level 50 without 3 stars everywhere): the buttons are still there; only the pile layout keeps the old rule
      const q = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-coins2', level: 60, stars: {}, econV: 2 } });
      await startLevel(q, 55); await sleep(300);
      t.eq(await look(q), [[true, '0', 'Spieken'], [true, '0', 'Terug']], 'level 55 without the earned tools: still there, stock 0');
      // a tap on the toolbar's own gap (between the two cards) does nothing
      const mid = await q.evaluate(() => { const b = document.querySelector('.toolbar').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.bottom - 20 }; });
      await q.mouse.click(mid.x, mid.y); await sleep(100);
      t.eq(await q.evaluate(() => [document.querySelector('#modal').classList.contains('hidden'), document.querySelector('#game').classList.contains('active')]), [true, true], 'the gap between the cards does nothing');
    },
  },
];
