'use strict';
const fs = require('fs'), path = require('path');
const markerTiles = [[0, 0, 0], [4, 0, 0], [8, 0, 0], [12, 0, 0],
  [0, -2, 0], [4, -2, 0], [8, -2, 0], [12, -2, 0],
  [0, 2, 0], [4, 2, 0], [8, 2, 0], [12, 2, 0]];
const markerOb = { ice: { 0: 2, 1: 1, 2: 1, 3: 2 }, locks: [1, 3], keys: [0, 2] };
// A fixed display fixture, supplied through the ordinary board renderer, with real ice neighbours.
async function board(p, tiles = markerTiles, obst = markerOb) {
  await p.evaluate(({ tiles, obst }) => {
    localStorage.removeItem('omamj.cur');
    begin({ mode: 'level', level: 5, key: 'L5', title: 'Frozen keys and locks',
      makeSpec: () => ({ seed: 13, tiles: tiles.map(([x, y, z]) => ({ x, y, z })),
        made: { faces: tiles.map((_, i) => i % 2), down: [], gold: [], obst } }) }, true);
  }, { tiles, obst });
}
const markers = p => p.evaluate(() => G.tiles.slice(0, 4).map(t => {
  const o = t.el.querySelector('.ob');
  return o ? [o.dataset.k, o.dataset.marker || ''] : null;
}));
async function shot(p, name) {
  if (!process.env.UI_MARKERS_SHOTS) return;
  fs.mkdirSync(process.env.UI_MARKERS_SHOTS, { recursive: true });
  await p.locator('#game').screenshot({ path: path.join(process.env.UI_MARKERS_SHOTS, name), animations: 'disabled' });
}
module.exports = [
  {
    name: 'ui markers: frozen keys and locks retain both badges through cracks, thaw, redraw and unlock',
    async run(t) {
      const p = await t.phone({ state: { name: 'Dennis', theme: 'fruit', level: 5 } });
      await board(p);
      const both = [['ice2', 'key'], ['ice', 'lock'], ['ice', 'key'], ['ice2', 'lock']];
      t.eq(await markers(p), both, 'initial batch renderer shows both roles with thin and thick ice');
      t.eq(await p.evaluate(() => G.tiles.slice(0, 4).map((_, i) => [obKind(i), canTake(i)])),
        [['ice2', false], ['ice', false], ['ice', false], ['ice2', false]], 'ice-first callers and taking rules are unchanged');
      t.ok(await p.evaluate(() => G.tiles.slice(0, 4).every(t => {
        const o = t.el.querySelector('.ob'), before = getComputedStyle(o, '::before'), after = getComputedStyle(o, '::after');
        return /🔑|🔒/.test(before.content) && after.content.includes('❄') && before.top !== after.top;
      })), 'actual CSS draws distinct key/lock and snowflake badges');
      await shot(p, 'frozen-keys-and-locks.png');
      await p.evaluate(() => { G.tiles.forEach((_, i) => decorate(i)); renderBoard(false); });
      t.eq(await markers(p), both, 'decoration and redraw preserve both roles');
      await p.setViewportSize({ width: 640, height: 390 });
      await p.evaluate(() => renderBoard(false));
      t.eq(await markers(p), both, 'landscape redraw preserves both roles');
      await p.setViewportSize({ width: 390, height: 820 });
      await p.evaluate(() => {
        for (let i = 4; i < 8; i++) { G.alive[i] = 0; G.tiles[i].el.classList.add('hidden'); }
        updateObstacles();
      });
      t.eq(await markers(p), [['ice', 'key'], ['lock', ''], ['key', ''], ['ice', 'lock']], 'one neighbour removed: thick ice cracks, thin ice thaws');
      await p.evaluate(() => {
        for (let i = 8; i < 12; i++) { G.alive[i] = 0; G.tiles[i].el.classList.add('hidden'); }
        updateObstacles();
      });
      t.eq(await markers(p), [['key', ''], ['lock', ''], ['key', ''], ['lock', '']], 'only normal key/lock overlays remain after thaw');
      await board(p);
      await p.evaluate(() => unlockAll());
      t.eq(await markers(p), [['ice2', ''], ['ice', ''], ['ice', ''], ['ice2', '']], 'unlocking removes secondary badges while preserving ice');
      await p.evaluate(() => { G.ob = null; G.tiles.forEach((_, i) => decorate(i)); });
      t.eq(await p.locator('#board .ob').count(), 0, 'all overlays removed when obstacles are cleared');
    },
  },
  {
    name: 'ui markers: frozen tap hints all alive thaw neighbours including covered, side-blocked and frozen tiles',
    async run(t, { sleep }) {
      const p = await t.phone({ state: { name: 'Dennis', theme: 'fruit', level: 5 } });
      await board(p, [[0, 0, 0], [2, 0, 0], [4, 0, 0], [0, 2, 0], [1, 3, 1],
        [-1, -2, 0], [6, 0, 0], [8, 0, 0], [0, -1, 1], [1, -2, 0]],
      { ice: { 0: 3, 5: 1 }, locks: [1], keys: [6, 7] });
      await p.evaluate(() => {
        G.alive[8] = 0; S.highlight = false; renderBoard(false);
        $('#gameTitle').textContent = 'Thaw hint: covered tiles too';
      });
      t.eq(await p.evaluate(() => [free(0), free(1), free(3), canTake(5), canTake(9)]), [true, false, false, false, true], 'fixture includes side-blocked, covered, frozen and takeable neighbours');
      const before = await p.evaluate(() => JSON.stringify([Array.from(G.alive), obState(), G.mv, G.tray]));
      await p.locator('#board .tile[data-i="0"]').tap();
      t.eq(await p.evaluate(() => G.tiles.flatMap((t, i) => t.el.classList.contains('obhint') ? [i] : [])), [1, 3, 5, 9], 'all and only alive ice-neighbours are hinted');
      t.eq(await p.evaluate(() => JSON.stringify([Array.from(G.alive), obState(), G.mv, G.tray])), before, 'blocked tap changes no board, obstacle, move or tray state');
      t.ok(await p.evaluate(() => {
        const el = G.tiles[3].el, r = el.getBoundingClientRect();   // the same subtle glow as on free tiles (Dennis 2026-11-14), no extra rim or tint
        let visible = false;
        for (const x of [.1, .3, .7, .9]) for (const y of [.1, .3, .7, .9]) {
          const hit = document.elementFromPoint(r.left + r.width * x, r.top + r.height * y);
          if (hit && hit.closest('.tile') === el) visible = true;
        }
        return visible && !parseFloat(getComputedStyle(el, '::after').borderTopWidth) && getComputedStyle(el).boxShadow !== 'none' && el.parentNode.classList.contains('lyr');
      }), 'covered neighbour has a visible highlighted part and stays in its original layer');
      await shot(p, 'thaw-hint-covered-neighbour.png');
      await sleep(1450);
      t.eq(await p.locator('#board .obhint').count(), 0, 'all thaw hints expire');
    },
  },
  {
    name: 'ui markers: coach replay shows combined badges and removes ice after neighbouring takes',
    async run(t) {
      const p = await t.phone({ state: { level: 5, theme: 'classic' } });
      await p.evaluate(({ tiles, obst }) => {
        $('#modal').classList.remove('hidden'); $('#modalBox').innerHTML = coachDemoHTML();
        const n = tiles.length;
        coachPlay($('.coach-demo'), { tiles, faces: tiles.map((_, i) => i % 2),
          ob: { need: obst.ice, locks: obst.locks, keys: obst.keys, unlocked: false },
          segs: [{ start: { a: Array(n).fill(1), d: Array(n).fill(0), tray: [] },
            acts: [['take', 4], ['take', 8], ['end', 'ok']], caps: ['', ''], marks: [] }] });
      }, { tiles: markerTiles, obst: markerOb });
      t.eq(await p.locator('.cz-board .ob[data-marker="key"]').count(), 2, 'coach draws frozen key badges');
      t.eq(await p.locator('.cz-board .ob[data-marker="lock"]').count(), 2, 'coach draws frozen lock badges');
      await p.waitForSelector('.cz-board [data-i="0"] .ob[data-k="key"]', { timeout: 12000 });
      t.eq(await p.locator('.cz-board [data-i="0"] .ob').getAttribute('data-marker'), null, 'coach thaw removes ice and the secondary badge');
      await p.evaluate(() => stopCoach());
    },
  },
];
