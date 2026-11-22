/* The rules table (www/js/rules.js): changing a value there really changes the game. */
'use strict';
const DENNIS = { name: 'Dennis', pid: 'test-dennis', level: 12 };
// two free tiles with the same picture, both face up
const freePair = () => { const G = __mj.G, L = __mj.Layouts; const fr = G.tiles.map((t, i) => i).filter(i => G.alive[i] && !G.down[i] && L.isFree(i, G.alive, G.nb)); for (const a of fr) for (const b of fr) if (a < b && G.tiles[a].face === G.tiles[b].face) return [a, b]; return null; };

module.exports = [
  {
    name: 'rules: grandma is known by her id or an "Oma" name; with no saved settings she gets her own levels and no gentler deal',
    async run(t, { startLevel, fillTray, modal }) {
      const p = await t.phone({ state: { name: 'OmaRiet', pid: 'test-oma-new', level: 12 } });
      t.ok(await p.evaluate(() => isCarePlayer('pmuy4wmdp17hbws', 'x') && isCarePlayer('p1', 'Oma Riet') && !isCarePlayer('p1', 'Dennis')), 'grandma is known by her id or an "Oma" name');
      await startLevel(p, 12);
      t.eq(await p.evaluate(() => [__mj.G.o.track, __mj.G.ez]), ['care', 0], 'her own levels, no gentler deal on top');
      await fillTray(p);
      const m = await modal(p);
      t.ok(m && m.buttons.includes('sRetry') && !m.buttons.includes('rsBack'), 'a full tray ends the level', m);
    },
  },
  {
    name: 'rules: points, tools and the prize level follow the rules table',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 6 }, tune: { RULES: { score: { pair: 100 }, tools: { fromLevel: 5 }, sunflower: { level: 5 } } } });
      await startLevel(p, 6);
      t.ok(await p.evaluate(() => !document.querySelector('#btnHint').classList.contains('locked')), 'hint open from level 5');
      const pair = await p.evaluate(freePair);
      if (t.ok(pair, 'a free pair')) {
        await p.evaluate(([a, b]) => { __mj.onTap(a); __mj.onTap(b); }, pair); await sleep(600);
        t.eq(await p.evaluate(() => __mj.G.score), 100, 'a pair is worth 100');
      }
      t.ok(await p.evaluate(() => sunUnlocked()), 'the prize theme after level 5');
    },
  },
  {
    name: 'rules: from level 50 Hint and Schudden only with 3 stars on every level so far, checked every 5 levels, with a popup (the same for grandma)',
    async run(t, { startLevel, solve, click, modal, sleep }) {
      const bar = p => p.evaluate(() => ({ shown: getComputedStyle(document.querySelector('.toolbar')).display !== 'none', open: toolsOpen() }));
      const stars = (to, s = 3, extra = {}) => ({ ...Object.fromEntries(Array.from({ length: to }, (_, i) => [i + 1, s])), ...extra });
      // the pile area measured with the ordinary bars (a tall pile narrows them, board.js fitGeo)
      const room = p => p.evaluate(() => { const g = document.querySelector('#game'), c = g.classList.contains('compact'); g.classList.remove('compact'); const h = document.querySelector('#boardWrap').clientHeight; g.classList.toggle('compact', c); return h; });
      // every level 3 stars: the buttons are there in 50-54, and the pile leaves room for them
      const p = await t.phone({ state: { name: 'Dennis', pid: 'test-dennis', level: 56, stars: stars(49, 3, { 50: 3, 51: 2, 52: 3, 53: 3, 54: 3, 55: 3 }) } });
      await startLevel(p, 49);
      t.eq(await bar(p), { shown: true, open: true }, 'level 49: there as always');
      await startLevel(p, 50);
      t.eq(await bar(p), { shown: true, open: true }, 'level 50: earned (1-49 all 3 stars)');
      const withTools = await room(p);
      await startLevel(p, 54);
      t.eq(await bar(p), { shown: true, open: true }, 'level 54: same block, still there (51 having 2 stars counts from 55)');
      await startLevel(p, 55);
      t.eq(await bar(p), { shown: false, open: false }, 'level 55: checked again, gone (level 51 has 2 stars)');
      // hint and shuffle sit beside the tray (Dennis 2026-11-15): with or without them the pile has the same room
      t.eq(await room(p), withTools, 'the buttons take no room from the pile');
      t.eq(await p.evaluate(() => toolsMissing(55)), [51], 'knows which level is missing');
      await p.evaluate(() => { __mj.S.stars[51] = 3; });
      await startLevel(p, 56);
      t.eq(await bar(p), { shown: true, open: true }, 'level 51 played again for 3 stars: back');

      // the popup: level 12 has 2 stars, winning level 49 leads to level 50 -> told they are not there, and why
      const q = await t.phone({ state: { name: 'Dennis', pid: 'test-dennis', level: 49, stars: stars(48, 3, { 12: 2 }) } });
      const winAndFind = async (lv, id) => {
        await startLevel(q, lv);
        t.ok(await solve(q), `level ${lv} won`);
        let html = null;
        await click(q, '#wNext');
        for (let k = 0; k < 12 && !html; k++) { await sleep(500); const m = await modal(q); if (m && m.buttons.includes(id)) { html = await q.evaluate(() => document.querySelector('#modalBox').innerText); await click(q, '#' + id); } else if (m && m.buttons.length) await click(q, '#' + m.buttons[0]); }
        return html;
      };
      let txt = await winAndFind(49, 'tgOk');
      t.ok(txt && /Even zonder Hint en Schudden/.test(txt) && /level 12\b/.test(txt) && /alle levels|al je levels/i.test(txt) && /Elke 5 levels/.test(txt), 'popup: not earned, which level, and the rule', txt);
      t.eq(await q.evaluate(() => __mj.S.toolsSt), { b: 50, on: false }, 'remembered');
      // level 12 again for 3 stars (set here), then a win in the same block: told they are back
      await q.evaluate(() => { __mj.S.stars[12] = 3; __mj.S.level = Math.max(__mj.S.level, 51); });
      txt = await winAndFind(50, 'tgOk');
      t.ok(txt && /Verdiend/.test(txt) && /level 50 t\/m 54/.test(txt), 'popup: earned again', txt);
      t.eq(await q.evaluate(() => __mj.S.toolsSt.on), true, 'remembered as on');

      const g = await t.phone({ state: { name: 'OmaHanny', pid: 'test-oma', level: 60 } });
      await startLevel(g, 60);
      t.eq(await bar(g), { shown: false, open: false }, 'grandma: the same rule as everyone, gone at level 60 without the stars');
    },
  },
  {
    name: 'parts: her own levels are the one part left (switchable); old settings of deleted parts are ignored; combos 10 s for everyone',
    async run(t, { FakeDB, startLevel, sleep }) {
      const db = new FakeDB({ scores: {}, plays: {
        'test-cfg-puk': { a: { k: 'cfg', t: 1, adapt: true, rescue: true, nudge: true } },
        'test-cfg-oma': { a: { k: 'cfg', t: 1, news: false }, b: { k: 'cfg', t: 2, rescue: false, adapt: false } },
        'test-cfg-den': { a: { k: 'cfg', t: 1, super: true }, b: { k: 'cfg', t: 2, rescue: false } },
        'test-cfg-lev': { a: { k: 'cfg', t: 1, levels: true } },
        'test-cfg-off': { a: { k: 'cfg', t: 1, levels: false } },
      } });
      const look = p => p.evaluate(async () => { await loadCfg(); const h = help(); return { sup: careMode(), track: levelTrack(), keys: Object.keys(h).sort().join(), lucky: h.lucky.fromLevel, tools: h.toolsGoneFrom, combo: h.comboMs }; });
      const normal = { keys: 'comboMs,jokersGoneFrom,lucky,toolsGoneFrom', lucky: 10, tools: 50, combo: 10000 };
      const puk = await t.phone({ state: { name: 'PUK', pid: 'test-puk', level: 13 }, db });
      t.eq(await look(puk), { sup: false, track: '', ...normal }, 'PUK: old switches of deleted parts change nothing');
      const oma = await t.phone({ state: { name: 'OmaHanny', pid: 'test-oma', level: 13 }, db });
      t.eq(await look(oma), { sup: true, track: 'care', ...normal }, 'grandma: her own levels, the help everyone gets');
      const den = await t.phone({ state: { name: 'Dennis', pid: 'test-den', level: 13 }, db });
      t.eq(await look(den), { sup: true, track: 'care', ...normal }, 'Super-omamodus from an old setting: her own levels');
      const lev = await t.phone({ state: { name: 'Lev', pid: 'test-lev', level: 13 }, db });
      t.eq((await look(lev)).track, 'care', 'the levels part on its own');
      const off = await t.phone({ state: { name: 'OmaOff', pid: 'test-off', level: 13 }, db });
      t.eq((await look(off)).track, '', 'the levels part switched off for a grandma: the normal levels');
      const plain = await t.phone({ state: { name: 'Rashmi', pid: 'test-rash', level: 13 } });
      t.eq((await look(plain)).combo, 10000, 'everyone: 10 seconds for a combo');
    },
  },
  {
    name: 'rules: "redo from level 75" from the database sends a player back once (stars, points and tries from there wiped)',
    async run(t, { FakeDB, sleep }) {
      const stars = Object.fromEntries(Array.from({ length: 79 }, (_, i) => [i + 1, 3]));
      const db = new FakeDB({ scores: {}, plays: { 'test-cfg-dennis': { a: { k: 'cfg', t: 1, redo: 75, redoId: 'r1' } } } });
      const p = await t.phone({ db, state: { name: 'Dennis', pid: 'test-dennis', level: 80, stars, lvlPts: { 74: 900, 75: 800, 79: 700 }, att: { L75: 3, L74: 1 } } });
      await p.evaluate(() => loadCfg()); await sleep(300);
      t.eq(await p.evaluate(() => [__mj.S.level, __mj.S.stars[74], __mj.S.stars[75], __mj.S.stars[79], __mj.S.lvlPts[75], __mj.S.lvlPts[74], __mj.S.att.L75, __mj.S.att.L74]), [75, 3, undefined, undefined, undefined, 900, undefined, 1], 'back to 75, everything from 75 wiped, before kept');
      await p.evaluate(() => { __mj.S.level = 77; save(); }); await p.reload(); await p.waitForFunction(() => window.__mjReady); await p.evaluate(() => loadCfg()); await sleep(300);
      t.eq(await p.evaluate(() => __mj.S.level), 77, 'only once');
    },
  },
  {
    name: 'rules: no win replays: RULES.pro and proCheck are gone',
    async run(t) {
      const p = await t.phone({ state: { name: 'Anna', level: 60 } });
      t.ok(await p.evaluate(() => typeof RULES.pro === 'undefined' && typeof proCheck === 'undefined' && typeof proShow === 'undefined'), 'no win replay code');
    },
  },
];
