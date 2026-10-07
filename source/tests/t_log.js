/* The play log that feeds the family dashboard. */
'use strict';

module.exports = [
  {
    name: 'log: start, stuck, retry, hint, shuffle, win and pause reach the database',
    async run(t, { startLevel, fillTray, click, solve, sleep }) {
      const p = await t.phone({ state: { level: 16, name: 'Dennis', pid: 'test-log' } });
      await startLevel(p, 16);
      await fillTray(p);
      await click(p, '#sRetry'); await sleep(1200);
      await click(p, '#btnHint'); await sleep(300);
      await click(p, '#btnShuffle'); await sleep(1200);
      await solve(p, 3500);
      await click(p, '#wMenu'); await sleep(800);
      for (let i = 0; i < 4; i++) { const id = await p.evaluate(() => [...document.querySelectorAll('#modalBox button')].map(b => b.id).find(id => id && id !== 'trSee')); if (!id || await p.evaluate(() => document.querySelector('#modal').classList.contains('hidden'))) break; await click(p, '#' + id); await sleep(600); }
      await startLevel(p, 17); await click(p, '#btnHome'); await sleep(1500);
      const ev = p.db.plays('test-log');
      const ks = ev.map(e => e.k + (e.r ? ':' + e.r : '')).join(' ');
      t.ok(/open .*start .*end:stuck .*start .*hint .*shuf .*end:win .*start .*pause/.test(ks), 'events in order', ks);
      const stuck = ev.find(e => e.r === 'stuck'), win = ev.find(e => e.r === 'win');
      t.ok(stuck && stuck.lv === 16 && stuck.at === 1 && stuck.tm === 4 && stuck.left > 0 && stuck.tp >= 4, 'stuck details', stuck);
      t.ok(win && win.at === 2 && win.h === true && win.sh === true && win.st === 1 && win.dur >= 0 && win.tp > 10, 'win details', win);
      t.ok(ev.every(e => e.v && e.dev && e.ses), 'version, device and session on every event');
      t.eq(await p.evaluate(() => JSON.parse(localStorage.getItem('omamj.logq') || '[]').length), 0, 'queue sent');
    },
  },
  {
    name: 'log: nothing is sent for players without a name',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { level: 3 } });
      await startLevel(p, 3); await sleep(800);
      t.eq(p.db.log.filter(r => r.p.startsWith('/plays')).length, 0, 'no plays written');
      t.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('omamj.logq') || '[]').length) > 0, 'events wait in the queue');
    },
  },
  {
    name: 'log: a level that fails to draw still logs its start and clock (the 0-second win bug)',
    async run(t, { startLevel, solve, sleep }) {
      const p = await t.phone({ state: { level: 2, name: 'Rashmi', pid: 'test-rash' } });
      // make drawing the tray fail once, like the iPhone in 1.10
      await p.evaluate(() => { const orig = renderTray; let n = 0; renderTray = function () { if (n++ === 0) throw new Error('test: tray could not be drawn'); return orig.apply(this, arguments); }; });
      await startLevel(p, 2);
      t.ok(await p.evaluate(() => !!(__mj.G.st && __mj.G.attempt && __mj.G.tStart)), 'clock and counters running');
      await sleep(1200);
      await solve(p, 3000);
      const ev = p.db.plays('test-rash');
      t.ok(ev.some(e => e.k === 'start' && e.lv === 2 && e.at === 1), 'start logged');
      t.ok(ev.some(e => e.k === 'err' && /tray could not be drawn/.test(e.msg) && e.w === 'begin'), 'the error itself logged', ev.filter(e => e.k === 'err'));
      const win = ev.find(e => e.k === 'end' && e.r === 'win');
      t.ok(win && win.tp > 10 && win.dur >= 1, 'win has taps and time', win);
    },
  },
];
