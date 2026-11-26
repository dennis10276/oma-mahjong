/* The Winkel (shop) screen: opens from home with four tabs and the coin chip, tabs swipe. */
'use strict';
module.exports = [
  {
    name: 'shop opens from home with 4 tabs and the coin chip',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop', level: 12, coins: 123 } });
      await click(p, '#btnShop'); await sleep(300);
      t.ok(await p.evaluate(() => document.querySelector('#shop').classList.contains('active')), 'shop is active');
      t.eq(await p.evaluate(() => [...document.querySelectorAll('#shop .shop-tabs button')].map(b => b.textContent)), ['Bord', 'Muziek', 'Familie', 'Hulpen'], 'four tabs');
      t.eq(await p.evaluate(() => [document.querySelector('#shopCoins').textContent, '🪙 ' + __mj.S.coins]).then(([a, b]) => a === b), true, 'coin chip shows 🪙 <S.coins>');
      await p.evaluate(() => __mj.show('home')); await sleep(100);
      await p.evaluate(() => __mj.show('themes')); await sleep(100);
      t.ok(await p.evaluate(() => document.querySelector('#shop').classList.contains('active')), 'show(themes) routes to the shop');
    },
  },
  {
    name: 'shop: swipe left moves Bord to Muziek; a tap on a tab jumps',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop2', level: 12 } });
      await click(p, '#btnShop'); await sleep(300);
      const on = () => p.evaluate(() => [document.querySelector('#shop .shop-tabs button.on').textContent, document.querySelector('#shop .shop-tabs').style.getPropertyValue('--slide')]);
      t.eq(await on(), ['Bord', '0'], 'starts on Bord');
      const r = await p.evaluate(() => { const b = document.querySelector('#shop .shop-view').getBoundingClientRect(); return { x: b.left + b.width / 2 + 100, y: b.top + 200 }; });
      await p.mouse.move(r.x, r.y); await p.mouse.down();
      for (let i = 1; i <= 8; i++) await p.mouse.move(r.x - 25 * i, r.y);
      await p.mouse.up(); await sleep(500);
      t.eq(await on(), ['Muziek', '1'], 'swiped to Muziek');
      await p.evaluate(() => document.querySelectorAll('#shop .shop-tabs button')[3].click()); await sleep(500);
      t.eq(await on(), ['Hulpen', '3'], 'tap jumps to Hulpen');
    },
  },
];
