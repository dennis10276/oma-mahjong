/* The rules table (www/js/rules.js): changing a value there really changes the game. */
'use strict';
const DENNIS = { name: 'Dennis', pid: 'test-dennis', level: 12 };
// two free tiles with the same picture, both face up
const freePair = () => { const G = __mj.G, L = __mj.Layouts; const fr = G.tiles.map((t, i) => i).filter(i => G.alive[i] && !G.down[i] && L.isFree(i, G.alive, G.nb)); for (const a of fr) for (const b of fr) if (a < b && G.tiles[a].face === G.tiles[b].face) return [a, b]; return null; };

module.exports = [
  {
    name: 'rules: the help table decides who gets which help (here: Dennis gets grandma\'s)',
    async run(t, { startLevel, fillTray, modal, sleep }) {
      const p = await t.phone({ state: DENNIS, tune: { HELP: { normal: { rescue: true, gentle: 1 } } } });
      await startLevel(p, 12);
      t.eq(await p.evaluate(() => __mj.G.ez), 1, 'the gentle deal');
      await fillTray(p);
      const m = await modal(p);
      t.ok(m && m.buttons.includes('rsBack'), 'putting the tray back is offered', m);
      t.ok(await p.evaluate(() => isCarePlayer('pmuy4wmdp17hbws', 'x') && isCarePlayer('p1', 'Oma Riet') && !isCarePlayer('p1', 'Dennis')), 'grandma is known by her id or an "Oma" name');
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
    name: 'rules: from level 50 Hint and Schudden only with 3 stars on every level so far, checked every 5 levels, with a popup (not in grandma mode)',
    async run(t, { startLevel, solve, click, modal, sleep }) {
      const bar = p => p.evaluate(() => ({ shown: getComputedStyle(document.querySelector('.toolbar')).display !== 'none', open: toolsOpen() }));
      const stars = (to, s = 3, extra = {}) => ({ ...Object.fromEntries(Array.from({ length: to }, (_, i) => [i + 1, s])), ...extra });
      const room = p => p.evaluate(() => document.querySelector('#boardWrap').clientHeight);
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
      t.ok(await room(p) > withTools, 'without the buttons the pile gets their space', { withTools, without: await room(p) });
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
      t.eq(await bar(g), { shown: true, open: true }, 'grandma mode: still there at level 60, without any stars');
    },
  },
  {
    name: 'parts: each part of grandma mode works on its own (PUK: only easier after losing); Super-omamodus = all; combos 10 s for everyone',
    async run(t, { FakeDB, startLevel, sleep }) {
      const db = new FakeDB({ scores: {}, plays: {
        'test-cfg-puk': { a: { k: 'cfg', t: 1, adapt: true } },
        'test-cfg-oma': { a: { k: 'cfg', t: 1, news: false } },
        'test-cfg-den': { a: { k: 'cfg', t: 1, super: true }, b: { k: 'cfg', t: 2, rescue: false } },
      } });
      const look = p => p.evaluate(async () => { await loadCfg(); const h = help(); return { sup: careMode(), track: levelTrack(), gentle: h.gentle, adapt: !!h.adapt, retry: h.easierAfterFails, rescue: h.rescue, nudge: !!h.nudge, shuffleLater: !!h.shuffleAfter, lucky: h.lucky.fromLevel, tools: h.toolsGoneFrom, news: villageOn(), combo: h.comboMs }; });
      const puk = await t.phone({ state: { name: 'PUK', pid: 'test-puk', level: 13 }, db });
      t.eq(await look(puk), { sup: false, track: '', gentle: 0, adapt: true, retry: 0, rescue: false, nudge: false, shuffleLater: false, lucky: 10, tools: 50, news: false, combo: 10000 }, 'PUK: only the adaptive part');
      // losing a lot makes his next level easier, winning a lot never makes it harder than normal
      t.eq(await puk.evaluate(() => { S.adapt = { step: 0, hist: [0, 0, 0, 0, 0, 0], since: 6, key: 'L12' }; return easeFor('L13'); }), 0.5, 'losing: half a step easier');
      t.eq(await puk.evaluate(() => { S.adapt = { step: -2, hist: [1, 1, 1, 1, 1, 1], since: 6, key: 'L12' }; return easeFor('L14'); }), 0, 'winning: never harder than normal');
      const oma = await t.phone({ state: { name: 'OmaHanny', pid: 'test-oma', level: 13 }, db });
      t.eq(await look(oma), { sup: true, track: 'care', gentle: 1, adapt: true, retry: 3, rescue: true, nudge: true, shuffleLater: true, lucky: 1, tools: null, news: false, combo: 10000 }, 'grandma: everything, except the news she had switched off');
      const den = await t.phone({ state: { name: 'Dennis', pid: 'test-den', level: 13 }, db });
      const d = await look(den);
      t.ok(d.sup && d.track === 'care' && d.nudge && d.rescue === false, 'Super-omamodus switched on, one part off again', d);
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
];
