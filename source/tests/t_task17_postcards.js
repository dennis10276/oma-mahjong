'use strict';

const outbox = 'plays/msg-pCardReceiver/pc-pCardSender-2026-10-07';
const wallet = page => page.evaluate(() => __mj.S.coins);
const sender = { name: 'Sanne', pid: 'pCardSender', level: 10, econV: 2, coins: 68 };
const receiver = { name: 'Els', pid: 'pCardReceiver', level: 10, econV: 2, coins: 50 };
async function openPostcard(page, id = 'pc_sun') {
  await page.evaluate(() => __mj.sendHeart('pCardReceiver', 'Els'));
  await page.locator('[data-postcard="' + id + '"]').click({ timeout: 2500 });
}
const disconnect = route => route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' });

module.exports = [
  {
    name: 'postcards: a free heart and a paid card have separate limits, and a refused card costs nothing',
    async run(t, { FakeDB }) {
      const db = new FakeDB({ scores: {} });
      let reject = true;
      const p = await t.phone({
        db, state: sender,
        routes: [['**/' + outbox + '.json', r => r.request().method() === 'PUT' && reject
          ? r.fulfill({ status: 403, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }) : db.handle(r)]],
      });
      await p.evaluate(() => __mj.sendHeart('pCardReceiver', 'Els'));
      await p.locator('#hmNone').click();
      await p.locator('#hsOk').click();
      t.eq(await wallet(p), 68, 'the free heart costs nothing');

      await openPostcard(p);
      t.ok((await p.locator('#modalBox').innerText()).includes('43'), 'confirmation states the remaining balance');
      await p.locator('#pcSend').click();
      await p.waitForFunction(() => !$('#pcSend').disabled);
      t.eq(db.get(outbox), null, 'server refused the card');
      t.eq(await wallet(p), 68, 'a rejected card costs nothing');

      reject = false;
      await p.locator('#pcSend').evaluate(b => { b.click(); b.click(); });
      await p.locator('#pcDone').click();
      t.eq(await wallet(p), 43, 'the textless card costs exactly 25');
      t.eq(db.get(outbox).pc, 'pc_sun', 'the card is delivered without a note');
      t.eq(db.log.filter(x => x.p === '/' + outbox && x.m === 'PUT').length, 1, 'successful double-click creates one record');
      t.eq(db.get('hearts/pCardReceiver/pCardSender').name, 'Sanne', 'the free inbox slot still exists');
      await p.evaluate(() => __mj.sendHeart('pCardReceiver', 'Els'));
      t.eq(await p.locator('[data-postcard]').count(), 0, 'the recipient has already been sent a postcard today');
    },
  },
  {
    name: 'postcards: accepted write with a lost response settles once after reload and free delivery cannot erase the card',
    async run(t, { FakeDB }) {
      const db = new FakeDB({ scores: {} });
      let disconnectAfterCommit = true;
      const p = await t.phone({
        db, state: sender,
        routes: [['**/' + outbox + '.json', async r => {
          const req = r.request();
          if (!disconnectAfterCommit || req.method() === 'OPTIONS') return db.handle(r);
          if (req.method() === 'PUT') db.set(outbox, req.postDataJSON());
          return disconnect(r);
        }]],
      });
      await openPostcard(p);
      await p.locator('#pcSend').click();
      await p.waitForFunction(() => !$('#pcSend').disabled);
      t.eq(await wallet(p), 68, 'an unconfirmed response has not debited');
      t.ok(await p.evaluate(() => ShopEconomy.hasPendingGiftSpend(S)), 'the in-flight amount is reserved');
      t.eq(await p.evaluate(() => ShopEconomy.buyItem(S, 'bg', 'surf_linen').reason), 'gift_pending', 'another purchase cannot take reserved coins');

      disconnectAfterCommit = false;
      await p.reload();
      await p.waitForFunction(() => window.__mjReady === true);
      await p.evaluate(() => window.__mjBoot);
      t.eq(await wallet(p), 43, 'readback charges one time after reload');
      await p.evaluate(() => resumeShopGift());
      t.eq(await wallet(p), 43, 'a second reconciliation does not charge again');
      t.ok(await p.evaluate(() => doSendHeart('pCardReceiver', 'Els', null, 'Een los hartje', false)), 'a free heart may still be sent after a paid card');
      t.eq(db.get(outbox).pc, 'pc_sun', 'free delivery cannot erase the unread card');

      const r = await t.phone({ db, state: receiver });
      await r.waitForSelector('#modalBox .postcard-paper');
      t.ok((await r.locator('#modalBox').innerText()).includes('Een los hartje'), 'the separate free note is also delivered');
      t.eq(await r.locator('#modalBox .postcard-paper').count(), 1, 'the same timestamp does not attach the paid card to the free one');
      await r.locator('#hOk').click();
      await r.reload();
      await r.waitForFunction(() => window.__mjReady === true);
      await r.evaluate(() => window.__mjBoot);
      t.eq((await r.evaluate(() => fetchHearts())).filter(h => h.pc).length, 0, 'reload does not replay paid receipt');
    },
  },
];
