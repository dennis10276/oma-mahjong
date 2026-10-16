/* Everyone plays the same levels: the screen shape and the phone's speed do not change a level.
   Levels 51 and 53-69 come from the ready-made table www/levels-early.js (the boards Gerda played), 70+ from
   levels-hard.js; the daily level is built for the same fixed shape. */
'use strict';
const path = require('path'), fs = require('fs'), vm = require('vm');
const { execFileSync } = require('child_process');

const board = p => p.evaluate(() => {
  const G = __mj.G;
  return { tiles: G.tiles.map(t => [t.x, t.y, t.z, t.face]), down: G.tiles.map((t, i) => G.down[i] ? i : -1).filter(i => i >= 0), clock: G.clock ? G.clock.i : null };
});

module.exports = [
  {
    name: 'same levels: the ready-made levels 51 and 53-69 match their builder and Gerda\'s boards (51 and 53 switched)',
    cpu: true,
    async run(t) {
      const root = path.join(__dirname, '..');
      const out = execFileSync('node', [path.join(root, 'tools', 'build_early.js'), '--check'], { encoding: 'utf8' });
      t.ok(/matches/.test(out), 'levels-early.js is what tools/build_early.js builds', out.slice(0, 200));
      const ctx = { console }; vm.createContext(ctx);
      for (const f of ['www/layouts.js', 'www/hard.js', 'www/levels-early.js'])
        vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8').replace("typeof module !== 'undefined'", 'false') + (f.endsWith('layouts.js') ? ';this.Layouts=Layouts;' : f.endsWith('hard.js') ? ';this.Hard=Hard;' : ''), ctx);
      const H = ctx.Hard;
      for (let lv = 51; lv <= 69; lv++) {
        if (lv === 52) continue;
        const s = H.earlySpec(lv);
        t.ok(s && s.tiles.length === s.made.faces.length && s.tiles.length % 2 === 0, `level ${lv}: a whole board in the table`);
      }
      t.ok(H.appliesEarly(51, '') && H.appliesEarly(53, '') && !H.appliesEarly(52, '') && !H.appliesEarly(50, '') && !H.appliesEarly(70, '') && !H.appliesEarly(51, 'care'),
        'the table is for levels 51 and 53-69 of the normal track only (lower levels and 52 as before)');
      // the standard is the board Gerda played: her recorded boards, exactly
      const G = JSON.parse(fs.readFileSync(path.join(root, 'analysis', 'early-gerda.json'), 'utf8'));
      t.ok(G.boards[51] && G.boards[53], 'her levels 51 and 53 are recorded');
      const SWAP = { 51: 53, 53: 51 };
      for (const [src, b] of Object.entries(G.boards)) {
        const lv = SWAP[src] || +src;
        if (lv < 51 || lv === 52) continue;
        const d = H.earlySpec(lv).made, ice = (d.obst && d.obst.ice) || {};
        t.eq([d.tiles, d.faces, d.down.slice().sort((a, b) => a - b), d.gold, ice], [b.tiles, b.faces, b.down, b.gold, (b.obst && b.obst.ice) || {}], `level ${lv}: Gerda's board of her level ${src}`);
      }
    },
  },
  {
    name: 'same levels: a narrow phone and a tablet get exactly the same level (51, 53, 60, designed) and daily level',
    async run(t, { startLevel, sleep }) {
      const sizes = [[360, 740], [768, 1024]];
      const got = [];
      for (const size of sizes) {
        const p = await t.phone({ state: { level: 80 }, size });
        const r = {};
        for (const L of [51, 53, 60, 72]) { await startLevel(p, L); r[L] = await board(p); }
        await p.evaluate(() => { localStorage.removeItem('omamj.cur'); __mj.startDaily(todayKey()); });
        await p.waitForFunction(() => __mj.G && __mj.G.key && __mj.G.key[0] === 'D', null, { timeout: 30000 });
        await sleep(700);
        r.daily = await board(p);
        got.push(r);
      }
      for (const k of Object.keys(got[0])) t.eq(got[1][k], got[0][k], `${k}: the same board on both screens`);
    },
  },
];
