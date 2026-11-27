/* The gold coin (Rashmi, 2026-11-27): every 🪙 on screen shows the game's own gold coin picture, not the
   phone's emoji (silver on an iPhone). The text itself stays 🪙. SHOT=<folder> saves screenshots. */
'use strict';
const SHOT = process.env.SHOT;
const coins = p => p.evaluate(() => [...document.querySelectorAll('.coin')].filter(c => c.offsetParent).map(c => {
  const s = getComputedStyle(c), r = c.getBoundingClientRect();
  return { text: c.textContent, pic: s.backgroundImage.startsWith('url("data:image/svg+xml'), w: Math.round(r.width) };
}));
module.exports = [
  {
    name: 'coin: the home chip and the shop prices show the gold coin, text unchanged',
    async run(t, { click, sleep, closeModal }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Rashmi', pid: 'test-coin', level: 30, coins: 1250 } });
      await sleep(300); await closeModal(p); await sleep(200);
      t.eq(await p.evaluate(() => document.querySelector('#homeCoins').textContent === '🪙 ' + __mj.S.coins), true, 'home chip text stays 🪙 <coins>');
      const home = await p.evaluate(() => { const c = document.querySelector('#homeCoins .coin'); return !!c && c.textContent === '🪙'; });
      t.ok(home, 'home chip has a gold coin');
      if (SHOT) await p.screenshot({ path: SHOT + '/home.png' });
      await click(p, '#btnShop'); await sleep(400);
      await p.evaluate(() => { const b = [...document.querySelectorAll('#shop .shop-tabs button')].pop(); b && b.click(); }); await sleep(400); await closeModal(p); await sleep(200);
      const shop = await coins(p);
      t.ok(shop.length >= 3, 'shop shows several gold coins', shop.length);
      t.ok(shop.every(c => c.text === '🪙' && c.pic && c.w > 8), 'every coin is the picture, with 🪙 as its text', shop.slice(0, 3));
      t.eq(await p.evaluate(() => document.querySelector('#shopCoins').textContent === '🪙 ' + __mj.S.coins), true, 'shop chip text');
      if (SHOT) { await p.evaluate(() => document.querySelector('#modal').classList.add('hidden')); await sleep(1500); await p.screenshot({ path: SHOT + '/shop.png' }); }
      // a chip rewritten by the game (textContent) gets its coin back
      await p.evaluate(() => { document.querySelector('#shopCoins').textContent = '🪙 7'; });
      await sleep(50);
      t.ok(await p.evaluate(() => !!document.querySelector('#shopCoins .coin')), 'rewritten chip shows the gold coin again');
    },
  },
];
