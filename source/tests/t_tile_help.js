'use strict';
const fs = require('fs'), path = require('path');
const seen = { gold: 1, joker2: 1, ice: 1, lock: 1, clockMoves: 1, trayPair: 1 };
module.exports = [
  { name: 'tile help: face-down first clears a different pair with three tray tiles; taking a fourth unrelated tile loses', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 20, seenSp: seen } });
    await startLevel(p, 20);
    const result = await p.evaluate(() => {
      const fr = G.tiles.map((_, i) => i).filter(canTake);
      if (fr.length < 5) throw Error('Need five free tiles for the example');
      const [a, b, c, down, twin] = fr;
      [a, b, c].forEach((i, k) => { G.tiles[i].face = k; G.alive[i] = 0; G.tiles[i].el.classList.add('hidden'); });
      G.tray = [a, b, c]; G.tiles[down].face = G.tiles[twin].face = 31;
      G.down[down] = 1; G.down[twin] = 0; G.peek = -1; renderTray();
      __mj.onTap(down);
      const peek = [G.tray.length, !!G.alive[down], G.peek === down, G.mv];
      __mj.onTap(twin);
      return { peek, pair: [G.tray.length, !!G.alive[down], !!G.alive[twin], G.mv, G.busy] };
    });
    t.eq(result.peek, [3, true, true, 0], 'first tap only peeks, no slot or move used');
    t.eq(result.pair, [3, false, false, 2, false], 'different pair clears and tray stays at three');
    await sleep(400);
    await p.evaluate(() => {
      const i = G.tiles.findIndex((_, i) => G.alive[i] && canTake(i));
      G.down[i] = 0; G.tiles[i].face = 33; __mj.onTap(i);
    });
    await sleep(900);
    t.ok(await p.evaluate(() => G.overShown && G.tray.length === 4), 'ordinary fourth unmatched tile still loses');
  }},
];
