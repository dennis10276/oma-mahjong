/* Tap selection must not turn a blocked-tile tap into an unrelated move. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../www/js/main.js'), 'utf8');
const picker = source.slice(source.indexOf('function pickTile('), source.indexOf("$('#boardWrap').addEventListener"));
function scene(rects, tw = 50) {
  const ctx = {
    G: { tw, alive: rects.map(r => r.alive === undefined ? 1 : r.alive), tiles: rects.map(r => ({ r })) },
    $: () => ({ getBoundingClientRect: () => ({ left: 30, top: 70 }) }),
    free: i => !rects[i].blocked,
  };
  vm.createContext(ctx); vm.runInContext(picker, ctx);
  return (x, y) => ctx.pickTile(x + 30, y + 70);
}
const rect = (l, top, zi, extra = {}) => ({ l, t: top, w: 50, h: 62, zi, ...extra });

module.exports = [
  {
    name: 'tapping: direct hits keep blocked tiles and the uppermost overlapping tile',
    cpu: true,
    async run(t) {
      const pick = scene([rect(0, 0, 1, { blocked: true }), rect(52, 0, 2)]);
      t.eq(pick(48, 30), 0, 'blocked tile does not select its free neighbour');
      t.eq(pick(60, 30), 1, 'direct free hit');
      const overlap = scene([rect(0, 0, 1), rect(20, 0, 10001, { blocked: true })]);
      t.eq(overlap(25, 30), 1, 'blocked tile above a free tile keeps the tap');
      t.eq(scene([rect(0, 0, 1, { alive: 0 })])(25, 30), -1, 'removed tiles cannot be hit');
    },
  },
  {
    name: 'tapping: empty-space help picks the nearest tile with a small circular allowance',
    cpu: true,
    async run(t) {
      t.eq(scene([rect(0, 0, 1), rect(60, 0, 10001)])(53, 30), 0, 'nearer tile beats higher layer');
      t.eq(scene([rect(0, 0, 1), rect(60, 0, 10001)])(55, 30), 1, 'equal distances prefer the upper tile');
      t.eq(scene([rect(0, 0, 1, { blocked: true })])(53, 30), -1, 'empty-space help skips blocked tiles');
      t.eq(scene([rect(0, 0, 1)])(-6, -6), -1, 'outside the circular corner allowance');
      t.eq(scene([rect(0, 0, 1)])(-4, -4), 0, 'close corner miss still works');
      const large = scene([rect(0, 0, 1, { w: 148.5, h: 184.5 })], 150);
      t.eq(large(-10, 30), 0, 'tablet help reaches 10px');
      t.eq(large(-11, 30), -1, 'tablet help never grows to 24px');
      t.eq(scene([rect(0, 0, 1)], 25)(-6, 30), 0, 'small tiles retain 6px help');
    },
  },
  {
    name: 'tapping: tablet touch coordinates follow visible tiles after portrait and landscape resizing',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { level: 72 }, size: [768, 1024] });
      await startLevel(p, 72); await sleep(1500);
      for (const size of [[768, 1024], [1024, 768], [820, 1180]]) {
        await p.setViewportSize({ width: size[0], height: size[1] }); await sleep(300);
        const result = await p.evaluate(() => {
          const hits = [];
          for (let i = 0; i < G.tiles.length; i++) {
            if (!G.alive[i]) continue;
            const el = G.tiles[i].el, r = el.getBoundingClientRect();
            const x = r.left + r.width / 2, y = r.top + r.height / 2;
            if (document.elementFromPoint(x, y)?.closest('.tile') !== el) continue;
            hits.push({ i, picked: pickTile(x, y), x, y });
          }
          return hits;
        });
        t.ok(result.length > 0, 'visible tile centres found ' + size);
        t.ok(result.every(h => h.i === h.picked), 'visible tile centres pick exactly that tile ' + size, result.filter(h => h.i !== h.picked));
        // Exercise the actual touch listener too, without removing any tiles.
        const hit = result[0];
        if (hit) {
          const picked = await p.evaluate(h => {
            const original = onTap; let picked = -1;
            onTap = i => { picked = i; };
            try {
              $('#boardWrap').dispatchEvent(new PointerEvent('pointerdown', { clientX: h.x, clientY: h.y, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
            } finally { onTap = original; }
            return picked;
          }, hit);
          t.eq(picked, hit.i, 'touch listener forwards the intended tile ' + size);
        }
      }
    },
  },
];
