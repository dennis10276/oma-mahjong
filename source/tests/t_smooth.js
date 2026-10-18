'use strict';
/* 1.58: a level opens and plays without the phone redoing the whole pile (see renderBoard in
   board.js, boardFace in tiles.js, fly in fx.js), and the lessons move instead of redrawing. */
const seen = { gold: 1, joker2: 1, ice: 1, lock: 1, clock: 1, clockMoves: 1, trayPair: 1 };
module.exports = [
  { name: 'smooth: the pile is pictures in a few layer groups; glowing tiles rise above it; sparkles leave the canvas alone', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 30, theme: 'classic', seenSp: seen } });
    await startLevel(p, 30);
    const b = await p.evaluate(() => {
      const board = $('#board'), tiles = [...board.querySelectorAll('.tile')];
      const zs = [...new Set(G.tiles.map(t => t.z))];
      return {
        svg: board.querySelectorAll('svg').length, groups: board.querySelectorAll(':scope > .lyr').length, layers: zs.length,
        inGroup: tiles.every(el => el.parentNode.classList.contains('lyr')),
        sameLayer: G.tiles.every(t => t.el.parentNode === board.children[zs.sort((a, b) => a - b).indexOf(t.z)]),
        pictures: [...board.querySelectorAll('.fi')].every(f => getComputedStyle(f).backgroundImage.startsWith('url("data:image/svg+xml')),
        nodes: board.querySelectorAll('*').length, n: G.tiles.length,
        placed: G.tiles.every(t => t.el.style.left === t.r.l + 'px' && t.el.style.top === t.r.t + 'px'),
      };
    });
    t.eq(b.svg, 0, 'no live SVG on the board');
    t.eq([b.groups, b.inGroup, b.sameLayer], [b.layers, true, true], 'one group per layer, each tile in its own layer');
    t.ok(b.pictures, 'every classic face is a shared picture');
    t.ok(b.nodes <= b.n * 4 + b.layers, 'a few elements per tile', b);
    t.ok(b.placed, 'tiles are put in place when they are made');
    // the corner numbers are part of the picture; "numbers off" uses the picture without them
    const pics = await p.evaluate(() => { const f = $('#board .fi'), a = getComputedStyle(f).backgroundImage; document.body.classList.add('nonum'); const z = getComputedStyle(f).backgroundImage; document.body.classList.remove('nonum'); return [a.length, z.length, a === z, f.dataset.f]; });
    t.ok(+pics[3] >= 31 || !pics[2], 'numbers off: another picture for faces with a number', pics);
    // a glowing tile leaves its group (above the whole pile) and goes back afterwards
    const g = await p.evaluate(() => {
      const i = G.tiles.findIndex((t, i) => G.alive[i] && t.z === 0 && free(i));
      const el = G.tiles[i].el, home = el.parentNode;
      glow(i, 'lucky', true); const up = el.parentNode === $('#board');
      glow(i, 'lucky', false); return [up, el.parentNode === home];
    });
    t.eq(g, [true, true], 'glowing tile lifted and put back');
    // a pair: sparkles are elements handed to the graphics chip; the canvas draws nothing
    await p.evaluate(() => { const path = __mj.solveNow(80000); for (const m of path.slice(0, 2)) __mj.onTap(m); });
    await sleep(500);
    const fx = await p.evaluate(() => ({ flying: document.querySelectorAll('#fxl .fxp').length, anims: [...document.querySelectorAll('#fxl .fxp')].every(e => e.getAnimations().length === 1) }));
    t.ok(fx.flying > 0 && fx.anims, 'sparkles fly on their own', fx);
    await sleep(1600);
    t.eq(await p.evaluate(() => document.querySelectorAll('#fxl .fxp').length), 0, 'and are cleaned up');
  }},
  { name: 'smooth: a lesson keeps its tiles from step to step (they move, nothing is redrawn); the clock counts on its own tile', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ size: [360, 640], state: { name: 'Dennis', level: 80, seenSp: seen } });
    await startLevel(p, 80);
    await p.evaluate(() => showClockLesson());
    const first = await p.evaluate(() => { window.__ck = $('.lesson-tile[data-id="ck"]'); return [$('.lz-ck i').textContent, !!__ck.querySelector('.lz-ck')]; });
    t.eq(first, ['3', true], 'the moves left are on the clock tile');
    await sleep(3400);
    const after = await p.evaluate(() => [$('.lesson-demo').dataset.step, $('.lesson-tile[data-id="ck"]') === __ck, $('.lz-ck i') && $('.lz-ck i').textContent, $('.lesson-tile[data-id="a"]').style.transform.startsWith('translate')]);
    t.eq(after, ['1', true, '2', true], 'same tile, one move used, the taken tile glides into the tray');
    await p.evaluate(() => closeModal());
    t.eq(await p.evaluate(() => [lessonTimer, lessonJobs.length]), [null, 0], 'closing stops every timer');
  }},
];
