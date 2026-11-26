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
    name: 'shop: a real finger swipe (touch events) moves Bord to Muziek and back, and a vertical drag does not switch tabs',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop2t', level: 12 } });
      await click(p, '#btnShop'); await sleep(300);
      const on = () => p.evaluate(() => document.querySelector('#shop .shop-tabs button.on').textContent);
      const cdp = await p.ctx.newCDPSession(p);
      const finger = async (x0, y0, x1, y1, steps = 10) => {
        const pt = (x, y) => [{ x, y, id: 1 }];
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) });
        for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps) }); await sleep(16); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(500);
      };
      const r = await p.evaluate(() => { const b = document.querySelector('#shop .shop-view').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + 150 }; });
      await finger(r.x, r.y, r.x, r.y + 120);
      t.eq(await on(), 'Bord', 'a downward drag stays on Bord');
      await finger(r.x + 120, r.y, r.x - 120, r.y);
      t.eq(await on(), 'Muziek', 'a finger swipe left goes to Muziek');
      await finger(r.x - 120, r.y, r.x + 120, r.y);
      t.eq(await on(), 'Bord', 'a finger swipe right goes back to Bord');
      // as easy as the ranking (Dennis 2026-11-27): a short flick of about 30 px switches, a tiny wobble does not
      await finger(r.x + 15, r.y, r.x - 15, r.y + 3, 5);
      t.eq(await on(), 'Muziek', 'a short 30 px flick left goes to Muziek');
      await finger(r.x - 15, r.y, r.x + 15, r.y + 3, 5);
      t.eq(await on(), 'Bord', 'a short 30 px flick right goes back to Bord');
      await finger(r.x + 8, r.y, r.x - 12, r.y, 4);
      t.eq(await on(), 'Bord', 'a 20 px wobble stays on Bord');
      const card = await p.evaluate(() => { const b = [...document.querySelectorAll('#shop .scroll[data-tab="bord"] .th')].find(x => x.querySelector('.price')).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
      await finger(card.x + 15, card.y, card.x - 15, card.y, 5);
      t.eq([await on(), await p.evaluate(() => document.querySelector('#modal').classList.contains('hidden'))], ['Muziek', true], 'a flick that starts on a card switches the tab and opens no buy popup');
      t.eq(p.errors, [], 'no page error');
    },
  },
  {
    name: 'shop: a refused buy or claim always says why (toast), and the popup button works again',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop14', level: 12, sunSeen: true, econV: 2, coins: 600, peekStock: 1 } });
      await click(p, '#btnShop'); await sleep(300);
      const toastText = () => p.evaluate(() => document.querySelector('#toast').textContent);
      // the wallet is emptied between opening the popup and tapping Kopen
      await p.evaluate(() => buyPopup('tiles', 'tiles_dutch')); await sleep(150);
      await p.evaluate(() => { __mj.S.coins = 0; });
      await click(p, '#buyOk'); await sleep(150);
      t.eq([await toastText(), await p.evaluate(() => [document.querySelector('#buyOk').disabled, !document.querySelector('#modal').classList.contains('hidden'), ShopEconomy.ownsItem(__mj.S, 'tiles', 'tiles_dutch')])], ['Te weinig munten', [false, true, false]], 'not_enough_coins: toast, popup stays, nothing bought');
      // a gift still being sent
      await p.evaluate(() => { closeModal(); __mj.S.coins = 900; __mj.S.pendingGiftOut = { gid: 'g_x', toPid: 'nobody', cat: 'tiles', item: 'tiles_kitchen', price: 480, path: 'plays/nobody/g_x', payload: { k: 'shop_gift', gid: 'g_x' } }; buyPopup('tiles', 'tiles_dutch'); }); await sleep(150);
      await click(p, '#buyOk'); await sleep(150);
      t.eq([await toastText(), await p.evaluate(() => __mj.S.coins)], ['Je cadeau wordt nog verstuurd', 900], 'gift_pending: toast, nothing spent');
      await p.evaluate(() => { closeModal(); helpAct('peek', 'claim'); document.querySelectorAll('#shop .shop-tabs button')[3].click(); }); await sleep(500);   // (the free one first, so the buy button shows)
      t.eq(await p.evaluate(() => { const b = document.querySelector('#shop .help-card[data-help="peek"] .big-btn'); return [b.disabled, /Je cadeau wordt nog verstuurd/.test(b.textContent)]; }), [true, true], 'the helper card says why it waits');
      // week limit and a full stock, through the real buy call
      await p.evaluate(() => { __mj.S.pendingGiftOut = null; __mj.S.coins = 900; helpAct('peek', 'claim'); }); await sleep(50);
      t.eq(await toastText(), 'Je gratis hulp van deze week heb je al', 'a second free claim: already_claimed toast');
      await p.evaluate(() => { __mj.S.peekStock = 3; helpAct('peek', 'buy'); }); await sleep(150);
      await click(p, '#buyOk'); await sleep(150);
      t.eq(await toastText(), 'Je voorraad is vol, gebruik er eerst één', 'a buy with a full stock: stock_full toast');
      await p.evaluate(() => { closeModal(); __mj.S.peekStock = 0; __mj.S.wk.boughtPeek = 2; helpAct('peek', 'buy'); }); await sleep(150);
      await click(p, '#buyOk'); await sleep(150);
      t.eq(await toastText(), 'Deze week kun je er geen meer kopen', 'a buy over the week limit: week_limit toast');
      t.eq(p.errors, [], 'no page error');
    },
  },
  {
    name: 'shop: opening the shop online finishes a gift left unsent; if the buy action throws the Kopen button works again',
    async run(t, { FakeDB, click, sleep }) {
      const rec = { k: 'shop_gift', t: 1700000000000, gid: 'g_test_2', from: 'test-shop15', name: 'Dennis', cat: 'tiles', item: 'tiles_dutch' };
      const db = new FakeDB({ scores: {}, plays: { pkees1: {} } });
      const pending = { gid: 'g_test_2', toPid: 'pkees1', cat: 'tiles', item: 'tiles_dutch', price: 480, path: 'plays/pkees1/g_test_2', payload: rec };
      const p = await t.phone({ db, size: [392, 785], state: { name: 'Dennis', pid: 'test-shop15', level: 12, sunSeen: true, econV: 2, coins: 600 } });
      await p.evaluate(pend => { __mj.S.pendingGiftOut = pend; }, pending);   // left over from a boot without a connection
      await click(p, '#btnShop'); await sleep(900);
      t.eq(await p.evaluate(() => [__mj.S.pendingGiftOut, __mj.S.coins]), [null, 120], 'the shop finished the gift, charged once');
      t.ok(!!db.get('plays/pkees1/g_test_2'), 'and it reached the receiver');
      await p.evaluate(() => { ShopEconomy.buyItem = () => { throw new Error('boom'); }; __mj.S.coins = 900; buyPopup('tiles', 'tiles_kitchen'); }); await sleep(150);
      await p.evaluate(() => document.querySelector('#buyOk').click()); await sleep(200);
      t.eq(await p.evaluate(() => [document.querySelector('#buyOk').disabled, !document.querySelector('#modal').classList.contains('hidden'), document.querySelector('#toast').textContent.length > 0]), [false, true, true], 'after a throw: button enabled again, popup open, a toast');
    },
  },
  {
    name: 'shop: the Familie tab has the Geen frame card, so a bought frame can be taken off',
    async run(t, { click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop16', level: 12, sunSeen: true, econV: 2, coins: 50, owned: { frame: ['none', 'frm_sky'] } } });
      await p.evaluate(() => ShopEconomy.equipItem(__mj.S, 'frame', 'frm_sky', {}));
      await click(p, '#btnShop'); await sleep(300);
      await p.evaluate(() => document.querySelectorAll('#shop .shop-tabs button')[2].click()); await sleep(500);
      t.eq(await p.evaluate(() => [...document.querySelectorAll('#shop .th[data-cat="frame"]')].map(b => b.dataset.id + (b.classList.contains('on') ? '*' : ''))), ['none', 'frm_sky*', 'frm_tulip', 'frm_delft', 'frm_velvet'], 'Geen first, the bought frame is in use');
      await click(p, '#shop .th[data-cat="frame"][data-id="none"]'); await sleep(200);
      t.eq(await p.evaluate(() => [ShopEconomy.resolveEquippedItem(__mj.S, 'frame'), document.querySelector('#shop .th[data-cat="frame"][data-id="none"]').classList.contains('on'), ShopEconomy.ownsItem(__mj.S, 'frame', 'frm_sky')]), ['none', true, true], 'taken off, still owned');
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
    name: 'shop: every music, sound and family title and detail fits on one line',
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
        return { cut: out, n: els.length, want: 2 * (SHOP_CATALOG.music.length + SHOP_CATALOG.title.length + paidPostcards().length + (SHOP_SFX_READY ? SHOP_CATALOG.sfx.length : 0)) };
      });
      t.ok(cut.n === cut.want, 'all rows measured', cut.n + ' of ' + cut.want);
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
    name: 'shop: sound packs play: equip changes the pack at once and after a reload, every pack renders, sound off is silent',
    async run(t, { click, sleep }) {
      const owned = { music: ['mus_piano', 'mus_sunflower'], sfx: ['sfx_ivory', 'sfx_jade', 'sfx_drops'] };
      const p = await t.phone({ size: [392, 785], state: { name: 'Dennis', pid: 'test-shop12', level: 12, sunSeen: true, econV: 2, coins: 50, owned } });
      t.eq(await p.evaluate(() => Sound.applyAudio().sfxPack), 'sfx_ivory', 'starter pack by default');
      await click(p, '#btnShop'); await sleep(300);
      await p.evaluate(() => document.querySelectorAll('#shop .shop-tabs button')[1].click()); await sleep(500);
      await click(p, '#shop .row-item[data-id="sfx_jade"] .tx'); await sleep(200);
      t.eq(await p.evaluate(() => [__mj.S.sfxPack, Sound.getMusicState().sfxPack]), ['sfx_jade', 'sfx_jade'], 'equip sets S.sfxPack and the playing pack');
      // preview: one at a time (the test harness boots with sound off)
      await p.evaluate(() => Sound.setSfx(true));
      await p.evaluate(() => { window.__st = 0; const oc = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function () { __st++; return oc.call(this); }; });
      await click(p, '#shop .pbtn[data-play="sfx_drops"]');
      t.eq(await p.evaluate(() => [document.querySelector('#shop .pbtn[data-play="sfx_drops"]').textContent, __st > 0]), ['■', true], 'preview shows ■ and makes sound');
      await click(p, '#shop .pbtn[data-play="sfx_jade"]');
      t.eq(await p.evaluate(() => [...document.querySelectorAll('#shop .pbtn')].filter(b => b.textContent === '■').map(b => b.dataset.play)), ['sfx_jade'], 'one preview at a time');
      await click(p, '#shop .pbtn[data-play="sfx_jade"]');
      t.eq(await p.evaluate(() => document.querySelector('#shop .pbtn[data-play="sfx_jade"]').textContent), '▶', 'second tap stops it');
      await click(p, '#shop .pbtn[data-play="sfx_jade"]');
      await p.evaluate(() => document.querySelectorAll('#shop .shop-tabs button')[2].click()); await sleep(400);
      t.eq(await p.evaluate(() => [...document.querySelectorAll('#shop .pbtn')].filter(b => b.textContent === '■').length), 0, 'leaving the tab stops the preview');
      // every pack renders tap, land and match without an error
      const bad = await p.evaluate(() => { const bad = []; for (const it of SHOP_CATALOG.sfx) { try { Sound.applyAudio({ sfxPack: it.id }); if (Sound.getMusicState().sfxPack !== it.id) bad.push(it.id + ' not applied'); Sound.select(); for (let s = 0; s < 4; s++) Sound.land(s); for (let c = 1; c <= 8; c++) Sound.match(c); if (!Sound.previewSfx(it.id)) bad.push(it.id + ' no preview'); Sound.stopSfxPreview(); } catch (e) { bad.push(it.id + ' ' + e.message); } } return bad; });
      t.eq(bad, [], 'all packs play');
      // sound off: no node starts
      const n = await p.evaluate(() => { Sound.setSfx(false); __st = 0; let b = 0; const bs = AudioContext.prototype.createBufferSource; AudioContext.prototype.createBufferSource = function () { b++; return bs.call(this); }; Sound.applyAudio({ sfxPack: 'sfx_drops' }); Sound.select(); Sound.land(1); Sound.match(3); const pv = Sound.previewSfx('sfx_jade'); Sound.setSfx(true); return [__st, b, pv]; });
      t.eq(n, [0, 0, false], 'sound off starts no node and no preview');
      // reload: the equipped pack is back
      await p.evaluate(() => { Sound.applyAudio({ sfxPack: 'sfx_ivory' }); });
      await p.reload(); await sleep(800);
      t.eq(await p.evaluate(() => [__mj.S.sfxPack, Sound.getMusicState().sfxPack]), ['sfx_jade', 'sfx_jade'], 'after a reload the equipped pack plays');
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
