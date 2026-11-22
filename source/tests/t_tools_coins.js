'use strict';
/* Hint and shuffle beside the tray (the owner 2026-11-15): they sit just below home and restart, so a slip must cost nothing. */
module.exports = [
  {
    name: 'hint and shuffle: a first tap only wakes the coin, a second uses it; it sleeps again after 3 s; the top and bottom strips ignore taps; room under home; not shown until earned',
    async run(t, { startLevel, click, sleep }) {
      const p = await t.phone({ size: [338, 654], state: { name: 'Dennis', pid: 'test-coins', level: 30 } });
      await startLevel(p, 20); await sleep(300);
      const st = () => p.evaluate(() => ({ hint: [G.usedHint, $('#btnHint').classList.contains('armed')], shuffle: [G.usedShuffle, $('#btnShuffle').classList.contains('armed')] }));
      // room between home/restart and the coins, and the coins' dead top strip
      const r = await p.evaluate(() => { const b = s => document.querySelector(s).getBoundingClientRect(); return { home: b('#btnHome').bottom, hint: b('#btnHint').top, hintB: b('#btnHint').bottom, hintX: b('#btnHint').left + b('#btnHint').width / 2, restart: b('#btnRestart').bottom, shuffle: b('#btnShuffle').top }; });
      t.ok(r.hint - r.home >= 12 && r.shuffle - r.restart >= 12, 'at least 12 px between home/restart and the coins', r);
      await p.mouse.click(r.hintX, r.hint + 4); await sleep(100);
      t.eq((await st()).hint, [false, false], 'a tap on the top strip of the coin does nothing');
      await p.mouse.click(r.hintX, r.hintB - 4); await sleep(100);
      t.eq((await st()).hint, [false, false], 'a tap on the bottom strip (a slip from the pile) does nothing');
      // one tap wakes, the second uses
      await click(p, '#btnHint'); await sleep(100);
      t.eq((await st()).hint, [false, true], 'first tap: woken, not used');
      t.ok(/nog eens/.test(await p.evaluate(() => document.querySelector('#gameMsg').innerText)), 'the top bar says to tap again');
      await click(p, '#btnHint'); await sleep(300);
      t.eq((await st()).hint, [true, false], 'second tap: used');
      // woken shuffle goes back to sleep after 3 s, and a tile tap also puts it to sleep
      await click(p, '#btnShuffle'); await sleep(100);
      t.eq((await st()).shuffle, [false, true], 'shuffle woken');
      await sleep(3200);
      t.eq((await st()).shuffle, [false, false], 'asleep again after 3 s, not used');
      await click(p, '#btnShuffle'); await sleep(100);
      await p.evaluate(() => { const i = G.tiles.findIndex((_, i) => G.alive[i] && free(i)); __mj.onTap(i); });
      t.eq((await st()).shuffle, [false, false], 'a tile tap puts it to sleep');
      // used: the first tap says so at once (no waking)
      await click(p, '#btnHint'); await sleep(100);
      t.eq((await st()).hint, [true, false], 'a used coin does not wake');
      // not earned (from level 50 without 3 stars everywhere): not shown at all
      const q = await t.phone({ size: [338, 654], state: { name: 'Dennis', pid: 'test-coins2', level: 60, stars: {} } });
      await startLevel(q, 55); await sleep(300);
      t.eq(await q.evaluate(() => ['#btnHint', '#btnShuffle'].map(s => { const e = document.querySelector(s), r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).visibility === 'visible'; })), [false, false], 'not earned: no coins');

    },
  },
];
