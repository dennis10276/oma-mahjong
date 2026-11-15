'use strict';
/* Levels 250-300 (1.69): hand-designed trap boards. The table itself is checked in t_reorder_honest.js and t_clocks.js;
   here the real game plays some of them to the end, and an old saved game on such a level starts again. */
module.exports = [
  { name: 'designed levels: 250, 266, 281, 292 and 300 are won by their stored route in the real game', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ state: { name: 'Dennis', pid: 'test-designed', level: 301,
      seenSp: { clock: 1, clockMoves: 1, ice: 1, lock: 1, gold: 1, joker: 1, trayPair: 1 } } });
    for (const lv of [250, 266, 281, 292, 300]) {
      await startLevel(p, lv);
      const info = await p.evaluate(lv => { const d = Hard.get(lv); return { n: d.tiles.length, shown: G.tiles.length, clock: !!G.clock, ob: !!G.ob, hv: Hard.designVersion(lv) }; }, lv);
      const revision = require('../analysis/refit-251-299.json').changedLevels.includes(lv) ? 10 : 9;
      t.eq([info.shown, info.clock, info.ob, info.hv], [info.n, true, true, revision], 'board of level ' + lv + ' is the designed one');
      await p.evaluate(lv => { for (const i of Hard.get(lv).solution) { __mj.onTap(i); if (G.alive[i]) __mj.onTap(i); } }, lv);
      await sleep(4500);
      t.ok(await p.evaluate(lv => G.done && S.stars[lv] > 0, lv), 'level ' + lv + ' is won through the actual game rules and animations');
      await p.evaluate(() => { try { closeModal(); } catch (e) { } });
    }
  } },
  { name: 'designed levels: a game saved on the old board of level 255 starts again, level 249 resumes', async run(t, { startLevel }) {
    const p = await t.phone({ state: { name: 'Dennis', pid: 'test-designed-save', level: 260, seenSp: { clock: 1, clockMoves: 1, ice: 1, lock: 1, gold: 1, joker: 1, trayPair: 1 } } });
    await startLevel(p, 255);
    await p.evaluate(() => { G.mv = 2; saveCur(); const c = JSON.parse(localStorage.getItem(CUR)); c.hv = 8; localStorage.setItem(CUR, JSON.stringify(c)); __mj.startLevel(255); });
    t.eq(await p.evaluate(() => G.mv), 0, 'a 1.68 save of level 255 cannot resume on the new board');
    await p.evaluate(() => { G.mv = 2; saveCur(); __mj.startLevel(255); });
    t.eq(await p.evaluate(() => G.mv), 2, 'a save of the new board resumes');
    await p.evaluate(() => { localStorage.removeItem(CUR); __mj.startLevel(249); });
    await p.evaluate(() => { G.mv = 2; saveCur(); __mj.startLevel(249); });
    t.eq(await p.evaluate(() => [G.mv, JSON.parse(localStorage.getItem(CUR)).hv]), [2, 8], 'level 249 keeps its generation and resumes');
  } },
  { name: 'designed levels: ordinary refits keep 58 px, approved intact moves occupy tenth slots, bars fit the pile', async run(t, { startLevel }) {
    const p = await t.phone({ size: [392, 730], state: { name: 'Dennis', pid: 'test-designed-size', level: 301, seenSp: { clock: 1, clockMoves: 1, ice: 1, lock: 1, gold: 1, joker: 1, trayPair: 1 } } });
    let compact = 0;
    for (let lv = 250; lv <= 300; lv++) {
      await startLevel(p, lv);
      const m = await p.evaluate(() => ({ tw: G.tw, n: G.tiles.length, compact: document.querySelector('#game').classList.contains('compact'), slot: document.querySelector('#tray .slot').clientWidth, btn: document.querySelector('#game .icon-btn').clientWidth }));
      t.ok(m.tw >= (lv % 10 === 0 ? 48 : 58), 'tile size on level ' + lv, m.tw);
      t.eq([m.slot >= 48, m.btn], [true, 44], 'tray slots and buttons keep their size on level ' + lv);
      if (lv % 10 === 0) t.eq(m.n, require('../analysis/refit-251-299.json').tenthTileCounts[lv], 'approved tenth-level board size ' + lv);
      else {
        t.ok(m.n % 2 === 0 && m.n <= 88, 'ordinary board size ' + lv, m.n);
        const reviewed = require('../analysis/refit-251-299.json').rows.find(r => r.level === lv);
        if (reviewed) t.eq(m.n, reviewed.tiles, 'reviewed refit tile count ' + lv);
      }
      if (m.compact) compact++;
    }
    t.ok(compact > 0 && compact < 51, 'piles limited by the height use the narrower bars, the others the ordinary bars', compact);
  } },
];
