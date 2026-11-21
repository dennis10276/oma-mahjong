#!/usr/bin/env node
/* Makes the saved-game fixtures for tests/t_saves.js: tests/fixtures/saves/<name>.json = { v1, cur, expect }.
   Run it ONCE, on unchanged code (it needs Playwright, set CHROME=/path/to/chrome if it is not found):
     node source/tools/make_save_fixtures.js
   It plays into each state on a test phone (a fake database, test- players only), keeps the two saved keys (omamj.v1 and
   omamj.cur) and records what the player then sees (the home label, the level, the half-played board). */
'use strict';
const fs = require('fs'), path = require('path');
const lib = require('../tests/lib'), SV = require('../tests/saves_common');
const { FakeDB, sleep, GRANDMA, GRANDMA_CFG, cfgEvents, cfgPath } = lib;
const SEEN = { gold: 1, gift: 1, joker: 1, joker2: 1, ice: 1, lock: 1, clock: 1, clockMoves: 1, trayPair: 1 };
const stars = (a, b) => Object.fromEntries(Array.from({ length: b - a + 1 }, (_, i) => ['L' + (a + i), 3]));
const NEWS = { updated: 4102444800000, items: Array.from({ length: 6 }, (_, i) => ({ id: 'n' + i, t: new Date('2026-10-07T12:00:00').getTime() - i * 3 * 3600e3, title: `Testbericht ${i}`, text: `Iets leuks, nummer ${i}.`, src: 'Test' })) };
const grandmaDb = (cfg = GRANDMA_CFG) => new FakeDB({ scores: {}, plays: { [cfgPath(GRANDMA.pid)]: cfgEvents(cfg) } });
const made = [];
const pages = [];

const phone = async o => { const p = await lib.phone(o); pages.push(p); return p; };
const keys = p => p.evaluate(() => { save(); return { v1: JSON.parse(localStorage.getItem('omamj.v1')), cur: JSON.parse(localStorage.getItem('omamj.cur') || 'null') }; });
// the first moves of the solver (tapped the way tests/lib.js solve() taps them), stopped once at least `moves` were played
// and a tile waits in the tray: the board is "half played"
async function play(p, moves) {
  const sol = await p.evaluate(() => __mj.solveNow(80000));
  if (!sol) throw new Error('no solution');
  await p.evaluate(([sol, moves]) => {
    for (let k = 0; k < sol.length; k++) {
      const m = sol[k], G = __mj.G;
      if (k >= moves && G.tray.length > 0 && G.tray.length < 3) break;
      if (!G.alive[m]) continue;
      __mj.onTap(m);
      const twinNext = sol[k + 1] !== undefined && G.tiles[sol[k + 1]].face === G.tiles[m].face && G.tray.length >= 3 && G.peek === m;
      if (G.alive[m] && !twinNext) __mj.onTap(m);
    }
  }, [sol, moves]);
  await sleep(1500);
  await p.evaluate(() => saveCur());
}
async function record(name, p, { withBoard }) {
  const { v1, cur } = await keys(p);
  if (v1.pid && !v1.pid.startsWith('test-')) v1.pid = 'test-' + name;      // the game made a random id: a fixture never carries one that looks real
  const fx = { v1, cur: withBoard ? cur : null };
  if (withBoard && !cur) throw new Error(name + ': no saved board');
  await p.ctx.close();
  // what the player sees when this save is found again: exactly the way t_saves.js loads it
  const t = { ok() { }, eq() { }, async phone(o) { const q = await phone(o); return q; }, log() { } };
  const q = await SV.openWithSave(t, lib, fx);
  const expect = await SV.home(q);
  if (withBoard) { await SV.resume(q, lib, fx.cur.key); expect.board = await SV.board(q); if (!expect.board || expect.board.key !== fx.cur.key) throw new Error(name + ': saved board did not resume'); }
  else expect.board = null;
  if (q.errors.length) throw new Error(name + ': page errors ' + q.errors);
  fx.expect = expect;
  fs.mkdirSync(SV.DIR, { recursive: true });
  fs.writeFileSync(path.join(SV.DIR, name + '.json'), JSON.stringify(fx));
  made.push(`${name}: home "${expect.home}", level ${expect.level}${withBoard ? ', board ' + fx.cur.key + ' alive ' + expect.board.alive.reduce((a, b) => a + b, 0) + '/' + expect.board.alive.length + ' tray ' + expect.board.tray.length : ''}`);
  await q.ctx.close();
}
const withState = (state, db) => phone({ state: { seenTray: true, seenDown: true, seenSp: SEEN, ...state }, db });

(async () => {
  await lib.setup();
  try {
    // 1. progress only
    { const p = await phone({ state: null }); await record('fresh', p, { withBoard: false }); }
    { const p = await withState({ level: 60, stars: stars(50, 59) }); await record('level60', p, { withBoard: false }); }
    { const p = await withState({ level: 250, stars: stars(240, 249) }); await record('level250', p, { withBoard: false }); }
    { const p = await withState({ ...GRANDMA, level: 50, stars: stars(40, 49) }, grandmaDb()); await sleep(500); await record('grandma', p, { withBoard: false }); }
    // 2. a level half played
    { const p = await withState({ level: 20, stars: stars(10, 19) }); await lib.startLevel(p, 20); await play(p, 11); await record('cur-generated', p, { withBoard: true }); }
    { const p = await withState({ level: 120, stars: stars(100, 119), sunSeen: true }); await lib.startLevel(p, 120); await play(p, 3); await record('cur-designed', p, { withBoard: true }); }
    { const p = await withState({ ...GRANDMA, level: 50, stars: stars(40, 49) }, grandmaDb()); await sleep(500); await lib.startLevel(p, 50); await play(p, 9); await record('cur-grandma', p, { withBoard: true }); }
    { const p = await withState({ level: 30, stars: stars(20, 29) }); await p.evaluate(() => { localStorage.removeItem('omamj.cur'); __mj.startDaily('2026-10-07'); }); await p.waitForFunction(() => __mj.G && __mj.G.key === 'D2026-10-07'); await sleep(900); await lib.closeModal(p); await play(p, 15); await record('cur-daily', p, { withBoard: true }); }
    // 3. a grandma save with the tray rescue used (she has the rescue part on: 1.72 saves `rescued: true`)
    { const p = await withState({ ...GRANDMA, level: 12 }, grandmaDb({ ...GRANDMA_CFG, rescue: true })); await sleep(500);
      await lib.startLevel(p, 12);
      if (await lib.fillTray(p) !== 4) throw new Error('tray did not fill');
      await lib.click(p, '#rsBack'); await sleep(1200);
      await play(p, 4);
      await record('cur-rescued', p, { withBoard: true });
      const fx = JSON.parse(fs.readFileSync(path.join(SV.DIR, 'cur-rescued.json'), 'utf8'));
      if (fx.cur.rescued !== true || fx.expect.board.rescued !== true) throw new Error('cur-rescued: rescued flag not set'); }
    // 4. fields that 1.72 features write into the saved progress: S.vg (the news), S.adapt (difficulty follows her results),
    //    S.proSeen (a win replay shown after 5 lost tries), S.cfg. A made-up player with exactly those three parts on.
    { const me = { name: 'FieldTest', pid: 'test-fields' }, cfg = { news: true, adapt: true, pro: true };
      const db = new FakeDB({ scores: {}, plays: { [cfgPath(me.pid)]: cfgEvents(cfg) } });
      const p = await phone({ news: NEWS, db, state: { ...me, cfg, level: 3, sunSeen: true, seenTray: true, seenDown: true, seenSp: SEEN } });
      await p.waitForFunction(() => S.cfg && S.cfg.news && S.cfg.adapt && S.cfg.pro);
      await p.evaluate(() => loadNews(true)); await sleep(400);
      await lib.tune(p, { RULES: { pro: { url: lib.server.url + 'pro/', closeAfterMs: 600 } } });
      // news (S.vg) and adapt (S.adapt): win level 3 and click through the news that follows
      await lib.startLevel(p, 3);
      if (!await lib.solve(p)) throw new Error('level 3 not solved');
      await lib.click(p, '#wNext');
      let m = null;
      for (let k = 0; k < 14 && !(m && m.buttons.includes('vgOk')); k++) { await sleep(500); m = await lib.modal(p); if (m && !m.buttons.includes('vgOk') && m.buttons.length) await lib.click(p, '#' + m.buttons[0]); }
      if (!(m && m.buttons.includes('vgOk'))) throw new Error('news did not show');
      await lib.click(p, '#vgOk'); await sleep(2800);
      // pro (S.proSeen): the 5th lost try of a level far ahead shows the film
      await p.evaluate(() => { S.fails.L132 = 4; save(); });
      await lib.startLevel(p, 132);
      await p.evaluate(() => restart());
      await p.waitForSelector('#proView', { timeout: 8000 });
      await p.click('#proView .pro-x'); await sleep(600);
      const f = await p.evaluate(() => ({ vg: !!S.vg && S.vg.n > 0, adapt: !!S.adapt && S.adapt.hist.length > 0, pro: !!S.proSeen && !!S.proSeen.L132, cfg: !!S.cfg }));
      if (!(f.vg && f.adapt && f.pro && f.cfg)) throw new Error('old-fields not all written: ' + JSON.stringify(f));
      await p.evaluate(() => { __mj.show('home'); localStorage.removeItem('omamj.cur'); });
      await record('old-fields', p, { withBoard: false }); }
    console.log(made.join('\n'));
  } finally { await lib.teardown(); }
})().catch(e => { console.error(e); process.exit(1); });
