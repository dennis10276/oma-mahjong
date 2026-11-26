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
    name: 'shop: gift sends once and takes the coins only after the database says OK',
    async run(t, { FakeDB, click, sleep }) {
      const db = new FakeDB({ scores: { pkees1: { name: 'Kees', avatar: '🐱', frame: 'none', level: 20, points: 500 } } });
      const p = await t.phone({ db, size: [392, 785], state: { name: 'Dennis', pid: 'test-shop7', level: 12, sunSeen: true, econV: 2, coins: 680 } });
      await click(p, '#btnShop'); await sleep(300);
      await click(p, '#shop .th[data-id="tiles_dutch"] .gift'); await sleep(150);
      t.eq(await p.evaluate(() => [document.querySelector('#modalBox h2').textContent, document.querySelectorAll('#modalBox .gbtn').length]), ['Cadeau: Hollands', 1], 'picker shows the family');
      await p.evaluate(() => { const b = document.querySelector('#modalBox .gbtn'); b.click(); b.click(); }); await sleep(400);
      t.eq(db.log.filter(r => r.m === 'PUT' && /gift-/.test(r.p)).length, 1, 'one gift write');
      t.eq(await p.evaluate(() => [__mj.S.coins, document.querySelector('#shopCoins').textContent, document.querySelector('#modal').classList.contains('hidden'), document.querySelector('#toast').textContent]), [200, '🪙 200', true, '🎁 Cadeau verstuurd naar Kees'], 'coins gone after OK, toast');
      t.eq(p.errors, [], 'no page error');
    },
  },
  {
    name: 'shop: gift picker without family offers only Annuleren',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop8', level: 12, sunSeen: true, econV: 2, coins: 680 } });
      await click(p, '#btnShop'); await sleep(300);
      await click(p, '#shop .th[data-id="tiles_dutch"] .gift'); await sleep(150);
      t.eq(await p.evaluate(() => [document.querySelectorAll('#modalBox .gbtn').length, document.querySelector('#modalBox').textContent.includes('Nog geen familie in de ranglijst'), document.querySelectorAll('#modalBox button').length]), [0, true, 1], 'message and one button');
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
  {
    name: 'shop: every music and sound title and line fits on one line',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop9', level: 12, sunSeen: true, econV: 2, coins: 50 } });
      await click(p, '#btnShop'); await sleep(300);
      await p.evaluate(() => document.querySelectorAll('#shop .shop-tabs button')[1].click()); await sleep(500);
      const cut = await p.evaluate(async () => {
        await document.fonts.ready;
        const c = document.createElement('canvas').getContext('2d'), out = [];
        const els = [...document.querySelectorAll('#shop .row-item .tx b, #shop .row-item .tx small')];
        for (const el of els) {
          const cs = getComputedStyle(el); c.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
          const w = c.measureText(el.textContent).width;
          if (w > el.clientWidth) out.push(el.textContent + ' ' + Math.round(w) + '>' + el.clientWidth);
        }
        return { cut: out, n: els.length };
      });
      t.ok(cut.n >= 60, 'all rows measured', cut.n);
      t.eq(cut.cut, [], 'no title or line is wider than its box');
    },
  },
  {
    name: 'shop: music rows preview with the play button, one at a time, and equip on a tap on the row',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop10', level: 12, sunSeen: true, econV: 2, coins: 50, owned: { music: ['mus_piano', 'mus_sunflower', 'mus_rain'] } } });
      await p.evaluate(() => { window.__pv = []; Sound.previewMusic = id => (__pv.push(id), true); Sound.stopPreview = () => __pv.push('stop'); });
      await click(p, '#btnShop'); await sleep(300);
      await p.evaluate(() => document.querySelectorAll('#shop .shop-tabs button')[1].click()); await sleep(500);
      const txt = id => p.evaluate(i => document.querySelector('#shop .pbtn[data-play="' + i + '"]').textContent, id);
      await click(p, '#shop .pbtn[data-play="mus_rain"]');
      t.eq([await txt('mus_rain'), await p.evaluate(() => __pv)], ['■', ['mus_rain']], 'preview starts, shows ■');
      await click(p, '#shop .pbtn[data-play="mus_rain"]');
      t.eq([await txt('mus_rain'), await p.evaluate(() => __pv)], ['▶', ['mus_rain', 'stop']], 'second tap stops it');
      await click(p, '#shop .pbtn[data-play="mus_rain"]');
      await p.evaluate(() => document.querySelectorAll('#shop .shop-tabs button')[2].click()); await sleep(500);
      t.eq(await p.evaluate(() => __pv.slice(-1)[0]), 'stop', 'leaving the tab stops the preview');
      await p.evaluate(() => document.querySelectorAll('#shop .shop-tabs button')[1].click()); await sleep(500);
      await click(p, '#shop .row-item[data-id="mus_rain"] .tx');
      t.eq(await p.evaluate(() => [__mj.S.musicTrack, document.querySelector('#shop .row-item[data-id="mus_rain"]').classList.contains('on')]), ['mus_rain', true], 'tap on an owned row equips it');
      await click(p, '#shop .pbtn[data-play="mus_piano"]');
      await p.evaluate(() => __mj.show('home'));
      t.eq(await p.evaluate(() => __pv.slice(-1)[0]), 'stop', 'leaving the shop stops the preview');
      t.eq(p.errors, [], 'no page error');
    },
  },
  {
    name: 'shop: claim free Spieken fills one dot and the button turns to Koop',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop11', level: 12, sunSeen: true, econV: 2, coins: 680, peekStock: 0, undoStock: 3 } });
      await click(p, '#btnShop'); await sleep(300);
      await p.evaluate(() => document.querySelectorAll('#shop .shop-tabs button')[3].click()); await sleep(500);
      const card = () => p.evaluate(() => { const c = document.querySelector('#shop .help-card[data-help="peek"]'); return { dots: c.querySelectorAll('.stock i.f').length, btn: c.querySelector('.big-btn').textContent, cls: c.querySelector('.big-btn').className, stock: c.querySelector('.stock span').textContent }; });
      let c = await card();
      t.eq([c.dots, /Gratis pakken/.test(c.btn), /play/.test(c.cls), c.stock], [0, true, true, '0 van 3 op voorraad'], 'free to claim, empty stock');
      await click(p, '#shop .help-card[data-help="peek"] .big-btn'); await sleep(150);
      c = await card();
      t.eq([c.dots, /Koop · 450 🪙/.test(c.btn), /daily/.test(c.cls), /Deze week nog 2 te koop/.test(c.btn), await p.evaluate(() => __mj.S.peekStock)], [1, true, true, true, 1], 'one dot, orange Koop button');
      const full = await p.evaluate(() => { const b = document.querySelector('#shop .help-card[data-help="undo"] .big-btn'); return [b.className.includes('off'), b.disabled, /Voorraad vol/.test(b.textContent)]; });
      t.eq(full, [true, true, true], 'a full stock shows the grey Voorraad vol');
      t.eq(p.errors, [], 'no page error');
    },
  },
  {
    name: 'shop: buying a helper token asks first; after 2 bought the button says Al 2 gekocht deze week',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop12', level: 12, sunSeen: true, econV: 2, coins: 1000, peekStock: 0 } });
      await click(p, '#btnShop'); await sleep(300);
      await p.evaluate(() => { document.querySelectorAll('#shop .shop-tabs button')[3].click(); }); await sleep(500);
      await click(p, '#shop .help-card[data-help="peek"] .big-btn'); await sleep(100);   // free
      await click(p, '#shop .help-card[data-help="peek"] .big-btn'); await sleep(150);   // Koop opens the popup
      t.eq(await p.evaluate(() => [document.querySelector('#modalBox h2').textContent, __mj.S.coins, __mj.S.peekStock]), ['Spieken kopen?', 1000, 1], 'a first tap spends nothing');
      await p.evaluate(() => { const b = document.querySelector('#buyOk'); b.click(); b.click(); }); await sleep(200);
      t.eq(await p.evaluate(() => [__mj.S.coins, __mj.S.peekStock]), [550, 2], 'bought once');
      await click(p, '#shop .help-card[data-help="peek"] .big-btn'); await sleep(150);
      await click(p, '#buyOk'); await sleep(200);
      t.eq(await p.evaluate(() => [__mj.S.coins, __mj.S.peekStock]), [100, 3], 'second bought');
      const b = await p.evaluate(() => { const x = document.querySelector('#shop .help-card[data-help="peek"] .big-btn'); return [x.textContent, x.disabled]; });
      t.ok(/Al 2 gekocht deze week/.test(b[0]) && /Maandag weer te koop en 1 gratis/.test(b[0]) && b[1], 'week limit shows Al 2 gekocht deze week', b);
      t.eq(p.errors, [], 'no page error');
    },
  },
  {
    name: 'shop: too few coins greys the helper button with Nog N nodig and a gift left unconfirmed is finished on boot',
    async run(t, { FakeDB, click, sleep }) {
      const rec = { k: 'shop_gift', t: 1700000000000, gid: 'g_test_1', from: 'test-shop13', name: 'Dennis', cat: 'tiles', item: 'tiles_dutch' };
      const db = new FakeDB({ scores: {}, plays: { pkees1: { g_test_1: rec } } });
      const pending = { gid: 'g_test_1', toPid: 'pkees1', cat: 'tiles', item: 'tiles_dutch', price: 480, path: 'plays/pkees1/g_test_1', payload: rec };
      const p = await t.phone({ db, size: [392, 785], state: { name: 'Dennis', pid: 'test-shop13', level: 12, sunSeen: true, econV: 2, coins: 600, peekStock: 1, pendingGiftOut: pending } });
      await sleep(800);
      t.eq(await p.evaluate(() => [__mj.S.pendingGiftOut, __mj.S.coins]), [null, 120], 'the pending gift was settled, charged once');
      await click(p, '#btnShop'); await sleep(300);
      await p.evaluate(() => document.querySelectorAll('#shop .shop-tabs button')[3].click()); await sleep(500);
      await click(p, '#shop .help-card[data-help="peek"] .big-btn'); await sleep(150);   // the free one
      const b = await p.evaluate(() => { const x = document.querySelector('#shop .help-card[data-help="peek"] .big-btn'); return [x.textContent, x.disabled]; });
      t.ok(/Koop · 450/.test(b[0]) && /Nog 330 🪙 nodig/.test(b[0]) && b[1], 'grey Koop with Nog 330 nodig', b);
    },
  },
];
