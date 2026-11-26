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
  {
    name: 'shop: buying Hollands with 680 coins leaves 200 and equips it',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop3', level: 12, sunSeen: true, econV: 2, coins: 680 } });
      await click(p, '#btnShop'); await sleep(300);
      await click(p, '#shop .th[data-id="tiles_dutch"] .price'); await sleep(150);
      t.ok(await p.evaluate(() => /Hollands kopen?/.test(document.querySelector('#modalBox h2').textContent)), 'popup asks Hollands kopen?');
      t.ok(await p.evaluate(() => /Daarna heb je nog 200/.test(document.querySelector('#modalBox').textContent)), 'popup says what is left');
      await click(p, '#buyOk'); await sleep(200);
      t.eq(await p.evaluate(() => [__mj.S.coins, __mj.S.theme, __mj.S.owned.tiles.includes('tiles_dutch'), document.querySelector('#shopCoins').textContent]), [200, 'tiles_dutch', true, '🪙 200'], 'coins, equipped, owned, chip');
      t.eq(await p.evaluate(() => { const c = document.querySelector('#shop .th[data-id="tiles_dutch"]'); return [c.classList.contains('on'), !!c.querySelector('.buy')]; }), [true, false], 'card is on, no price');
      t.eq(await p.evaluate(() => document.querySelector('#modal').classList.contains('hidden')), true, 'popup closed');
      t.eq(p.errors, [], 'no page error');
    },
  },
  {
    name: 'shop: tapping an owned look equips it without a popup',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop4', level: 12, sunSeen: true, econV: 2, coins: 50, owned: { tiles: ['classic', 'fruit'], finish: ['fin_ivory', 'fin_slate'], tray: ['tray_honey', 'tray_oak'] } } });
      await click(p, '#btnShop'); await sleep(300);
      await click(p, '#shop .th[data-id="fruit"]'); await sleep(150);
      t.eq(await p.evaluate(() => [__mj.S.theme, document.querySelector('#modal').classList.contains('hidden'), document.querySelector('#shop .th[data-id="fruit"]').classList.contains('on'), document.querySelector('#shop .th[data-id="classic"]').classList.contains('on')]), ['fruit', true, true, false], 'fruit equipped, no popup');
      // finish and tray set the board's look variables; the starter removes them again
      await click(p, '#shop .th[data-cat="finish"][data-id="fin_slate"]'); await click(p, '#shop .th[data-cat="tray"][data-id="tray_oak"]'); await sleep(100);
      t.eq(await p.evaluate(() => ['--tile-face', '--tile-lip', '--tile-rim', '--tray-bg', '--tray-well', '--tray-lip'].map(v => !!document.body.style.getPropertyValue(v))), [true, true, true, true, true, true], 'look variables set');
      await click(p, '#shop .th[data-cat="finish"][data-id="fin_ivory"]'); await click(p, '#shop .th[data-cat="tray"][data-id="tray_honey"]'); await sleep(100);
      t.eq(await p.evaluate(() => ['--tile-face', '--tray-bg'].map(v => document.body.style.getPropertyValue(v))), ['', ''], 'starter items leave the board as it was');
    },
  },
  {
    name: 'shop: not enough coins spends nothing',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop5', level: 12, sunSeen: true, econV: 2, coins: 100 } });
      await click(p, '#btnShop'); await sleep(300);
      t.ok(await p.evaluate(() => document.querySelector('#shop .th[data-id="tiles_dutch"] .price').classList.contains('off')), 'price button greyed');
      await click(p, '#shop .th[data-id="tiles_dutch"] .price'); await sleep(150);
      t.eq(await p.evaluate(() => [document.querySelector('#buyOk').disabled, /Nog 380/.test(document.querySelector('#modalBox').textContent)]), [true, true], 'Kopen disabled, Nog 380 nodig');
      await click(p, '#buyOk'); await sleep(150);
      t.eq(await p.evaluate(() => [__mj.S.coins, __mj.S.owned.tiles.includes('tiles_dutch')]), [100, false], 'nothing spent');
    },
  },
  {
    name: 'shop: double tap on Kopen buys once',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop6', level: 12, sunSeen: true, econV: 2, coins: 680 } });
      await click(p, '#btnShop'); await sleep(300);
      await click(p, '#shop .th[data-id="tiles_dutch"] .price'); await sleep(150);
      await p.evaluate(() => { const b = document.querySelector('#buyOk'); b.click(); b.click(); }); await sleep(200);
      t.eq(await p.evaluate(() => [__mj.S.owned.tiles.filter(x => x === 'tiles_dutch').length, __mj.S.coins]), [1, 200], 'owned once, 480 spent once');
    },
  },
  {
    name: 'shop: old saves keep their looks',
    async run(t, lib) {
      const S = require('./saves_common');
      for (const name of require('fs').readdirSync(S.DIR).filter(f => /.json$/.test(f)).map(f => f.replace(/.json$/, '')).sort()) {
        const p = await S.openWithSave(t, lib, S.read(name));
        await p.evaluate(() => __mj.show('shop')); await lib.sleep(200);
        const r = await p.evaluate(() => {
          const out = {};
          for (const cat of ['tiles', 'bg']) {
            const own = __mj.S.owned[cat], cards = [...document.querySelectorAll('#shop [data-cat="' + cat + '"]')];
            out[cat] = { n: cards.length, wrongPrice: cards.filter(c => own.includes(c.dataset.id) === !!c.querySelector('.buy')).map(c => c.dataset.id), on: cards.filter(c => c.classList.contains('on')).map(c => c.dataset.id) };
          }
          return { out, theme: __mj.S.theme, bg: __mj.S.bg };
        });
        t.ok(r.out.tiles.n >= 7 && r.out.bg.n >= 10, name + ': all cards shown', r.out);
        t.eq(r.out.tiles.wrongPrice.concat(r.out.bg.wrongPrice), [], name + ': owned looks show no price, others do');
        t.eq([r.out.tiles.on, r.out.bg.on], [[r.theme], [r.bg]], name + ': the equipped ones are on');
        t.eq(p.errors, [], name + ': no page error');
      }
    },
  },
];
