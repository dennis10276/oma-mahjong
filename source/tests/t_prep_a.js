/* Unified Prep A release-critical checks through the browser save and wallet entry points. */
'use strict';
const fs = require('fs');
const fixtures = require('./saves_common');

const legacyBackgrounds = {
  jade: 0, sunrise: 8, lavender: 20, ocean: 40, blossom: 65, forest: 95, night: 130, gold: 180, rainbow: 250,
};
const sum = values => Object.values(values || {}).reduce((total, value) => total + (Number(value) || 0), 0);

module.exports = {
  name: 'Prep A preserves every legacy save and protects wallet spending',
  async run(t, lib) {
    const names = fs.readdirSync(fixtures.DIR).filter(name => name.endsWith('.json')).sort();
    for (const filename of names) {
      const fixture = fixtures.read(filename.slice(0, -5));
      const old = fixture.v1;
      const page = await fixtures.openWithSave(t, lib, fixture);
      const readProgress = () => page.evaluate(() => {
        const { econV, coins, undoStock, peekStock, level, theme, bg, frame, stars, daily, bonusStars, trophies, owned } = __mj.S;
        return { econV, coins, undoStock, peekStock, level, theme, bg, frame, stars, daily, bonusStars, trophies, owned };
      });
      const state = await readProgress();
      t.eq(state.econV, 2, filename + ' migrates');
      t.eq(state.level, old.level || 1, filename + ' level');
      t.eq(state.stars, old.stars || {}, filename + ' level stars');
      t.eq(state.daily, old.daily || {}, filename + ' daily stars');
      t.eq(state.bonusStars, old.bonusStars || 0, filename + ' earned bonus stars');
      t.eq(state.theme, old.theme || 'classic', filename + ' equipped tiles');
      t.eq(state.bg, old.bg || 'jade', filename + ' equipped table');
      t.eq(state.frame, old.frame || 'none', filename + ' equipped frame');
      const frame = await page.evaluate(() => ShopEconomy.resolveEquippedItem(__mj.S, 'frame'));
      t.eq(frame, state.frame, filename + ' equipped frame remains selectable');
      for (const [id, value] of Object.entries(old.trophies || {})) {
        t.eq(state.trophies?.[id], value, filename + ' keeps trophy ' + id);
      }
      const legacyStars = sum(old.stars) + sum(old.daily) + (Number(old.bonusStars) || 0);
      for (const [id, minStars] of Object.entries(legacyBackgrounds)) {
        if (legacyStars >= minStars) t.ok(state.owned?.bg.includes(id), filename + ' keeps unlocked ' + id);
      }
      if (old.level > 20 || old.sunSeen || old.theme === 'sunflower' || old.bg === 'sunfield') {
        t.ok(state.owned?.tiles.includes('sunflower'), filename + ' keeps Sunflower tiles');
        t.ok(state.owned?.bg.includes('sunfield'), filename + ' keeps Sunflower table');
      }
      if (state.econV === 2) {
        await page.evaluate(() => { ShopEconomy.addCoins(__mj.S, 311); save(); });
        const credited = await readProgress();
        await page.reload();
        await page.waitForFunction(() => window.__mjReady === true, null, { timeout: 8000 });
        t.eq(await readProgress(), credited, filename + ' reload does not repeat the grant');
      }
      await page.ctx.close();
    }

    const page = await t.phone();
    const result = await page.evaluate(async () => {
      const state = __mj.S;
      const item = SHOP_CATALOG.tiles.find(entry => entry.price > 0 && !ShopEconomy.ownsItem(state, 'tiles', entry.id));
      if (!item) throw new Error('No priced catalog item');
      state.coins = item.price * 2;
      const first = ShopEconomy.buyItem(state, 'tiles', item.id);
      const repeat = ShopEconomy.buyItem(state, 'tiles', item.id);
      let attempts = 0;
      let settle;
      const response = new Promise(resolve => { settle = resolve; });
      const send = () => { attempts++; return response; };
      const pending = ShopEconomy.sendShopGift(state, 'tiles', item.id, 'test-recipient', { send });
      const overlap = await ShopEconomy.sendShopGift(state, 'tiles', item.id, 'test-recipient', { send });
      settle({ ok: false });
      const failed = await pending;
      const beforeWeek = state.coins;
      const sunday = new Date(2026, 10, 29, 18);
      const monday = new Date(2026, 10, 30, 9);
      const win = { mode: 'level', level: 81, fresh: true, stars: 3, boardCoins: 2 };
      let lastFull;
      for (let i = 0; i < 60; i++) lastFull = ShopEconomy.rewardWin(state, win, sunday).total;
      const tapered = ShopEconomy.rewardWin(state, win, sunday).total;
      const replay = ShopEconomy.rewardWin(state, { ...win, fresh: false, prevStars: 3 }, sunday).total;
      const nextWeek = ShopEconomy.rewardWin(state, win, monday).total;
      return {
        first: first.ok, repeat: repeat.ok, attempts, overlap: overlap.ok, failed: failed.ok,
        remaining: beforeWeek, expected: item.price, lastFull, tapered, replay, nextWeek,
      };
    });
    t.eq(result, {
      first: true, repeat: false, attempts: 1, overlap: false, failed: false,
      remaining: result.expected, expected: result.expected, lastFull: 6, tapered: 2, replay: 0, nextWeek: 6,
    }, 'one purchase, gift failure preserves coins, and the new week restores full earnings');

    const helpers = await page.evaluate(() => {
      const state = __mj.S;
      const sunday = new Date(2026, 10, 29, 18);
      const monday = new Date(2026, 10, 30, 9);
      state.wk = ShopEconomy.newWeekObj(sunday);
      state.undoStock = 3;
      state.peekStock = 0;
      state.coins = 10 * (SHOP_RULES.undo.price + SHOP_RULES.peek.price);
      const startCoins = state.coins;

      const fullClaim = ShopEconomy.claimFreeUndo(state, {}, sunday);
      const openBoard = { mode: 'level', level: 55, tray: [2], alive: [1, 1, 0], down: [0, 0, 0], nb: { above: [[1], [], []] } };
      const returned = ShopEconomy.consumeUndoInLevel(state, openBoard);
      const freeUndo = ShopEconomy.claimFreeUndo(state, {}, sunday);
      const repeatUndo = ShopEconomy.claimFreeUndo(state, {}, sunday);

      const freePeek = ShopEconomy.claimFreePeek(state, {}, sunday);
      const coveredPeek = ShopEconomy.consumePeekInLevel(state, openBoard);
      const firstPurchase = ShopEconomy.buyPeekToken(state, {}, sunday);
      const secondPurchase = ShopEconomy.buyPeekToken(state, {}, sunday);
      openBoard.down[0] = 1;
      const reveal = ShopEconomy.consumePeekInLevel(state, openBoard);
      const repeatedReveal = ShopEconomy.consumePeekInLevel(state, openBoard);
      const extraPurchase = ShopEconomy.buyPeekToken(state, {}, sunday);
      const mondayClaim = ShopEconomy.claimFreePeek(state, {}, monday);

      return {
        full: fullClaim.reason, returned: returned.ok, freeUndo: freeUndo.ok, repeatUndo: repeatUndo.reason,
        freePeek: freePeek.ok, coveredPeek: coveredPeek.reason, purchases: firstPurchase.ok && secondPurchase.ok,
        reveal: reveal.ok, repeatedReveal: repeatedReveal.reason, extraPurchase: extraPurchase.reason,
        mondayClaim: mondayClaim.ok, stock: state.peekStock, spent: startCoins - state.coins,
        price: firstPurchase.spent, stillFaceDown: openBoard.down[0], perfectForfeited: openBoard.rescued,
      };
    });
    t.eq(helpers, {
      full: 'stock_full', returned: true, freeUndo: true, repeatUndo: 'already_claimed',
      freePeek: true, coveredPeek: 'nothing_hidden', purchases: true,
      reveal: true, repeatedReveal: 'level_limit', extraPurchase: 'week_limit',
      mondayClaim: true, stock: 3, spent: helpers.price * 2, price: helpers.price,
      stillFaceDown: 1, perfectForfeited: true,
    }, 'helper claims and spending enforce weekly, stock and board limits without charging an unusable peek');


    const before = await page.evaluate(() => {
      const state = __mj.S;
      state.coinWeek = { id: ShopEconomy.weekIdOf(), wins: SHOP_RULES.coins.fullMainWinsPerWeek };
      ensureTasks().list.forEach(task => { task.done = true; });
      save();
      return { coins: state.coins, level: state.level, week: state.coinWeek };
    });
    await lib.startLevel(page, before.level);
    t.ok(await lib.solve(page, 1800), 'the browser wins a fresh main level');
    await page.reload();
    await page.waitForFunction(() => window.__mjReady === true, null, { timeout: 8000 });
    const after = await page.evaluate(() => ({ coins: __mj.S.coins, level: __mj.S.level, week: __mj.S.coinWeek }));
    t.eq(after, { coins: before.coins + 2, level: before.level + 1, week: before.week }, 'the real win persists tapered coins and progress together');
    await page.ctx.close();

    // Gift retry safety, overload/overlap serialization, reload reconciliation, and recipient deduplication
    const db = new lib.FakeDB({ scores: {} });
    let putMode = 'normal';
    let failNextGets = 0;
    let delayedPut = null;
    let putStartedNotify = null;
    let giftPutCalls = 0;

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,PATCH,DELETE',
    };
    const giftRoute = async route => {
      const req = route.request();
      const u = new URL(req.url());
      const m = req.method();
      const p = u.pathname.replace(/\.json$/, '');
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

      const isGiftRecordPut = m === 'PUT' && /^\/plays\/(?:test-)?gift-[^/]+\/[^/]+$/.test(p);
      if (isGiftRecordPut) {
        giftPutCalls++;
        if (db.get(p) !== null) {
          return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'Permission denied' }) });
        }
        if (putMode === 'reject') {
          return route.fulfill({ status: 403, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'Permission denied' }) });
        }
        if (putMode === 'drop_before_accept') {
          return route.abort('failed');
        }
        if (putMode === 'drop_after_accept') {
          const body = req.postData() ? JSON.parse(req.postData()) : null;
          db.log.push({ m, p, body });
          db.set(p, body);
          return route.abort('failed');
        }
        if (putMode === 'delay') {
          if (putStartedNotify) { const n = putStartedNotify; putStartedNotify = null; n(); }
          await new Promise(resolve => { delayedPut = resolve; });
        }
      }
      if (m === 'GET' && /^\/plays\/(?:test-)?gift-[^/]+/.test(p) && failNextGets > 0) {
        failNextGets--;
        return route.abort('failed');
      }
      return db.handle(route);
    };

    const routes = [[/^https:\/\/[^/]*firebasedatabase\.app\//, giftRoute]];
    const sender = await t.phone({
      db,
      routes,
      state: { econV: 2, pid: 'test-sender', name: 'Sender', coins: 4000, undoStock: 0, peekStock: 0 },
    });
    const installGiftHooks = () => sender.evaluate(() => {
      window.__giftHooks = () => ({
        save: () => save(),
        renderCoins: () => { if (typeof renderHome === 'function') renderHome(); },
        log: (k, d) => { if (typeof logEvt === 'function') logEvt(k, d); },
        send: async (path, payload, method = 'PUT') => {
          try {
            const r = await dbSend(path, payload, method);
            return { ok: r.ok, status: r.status, ambiguous: r.status >= 500 };
          } catch {
            return { ok: false, ambiguous: true };
          }
        },
        read: async path => {
          try {
            const r = await fetch(dbUrl(path), { cache: 'no-store' });
            if (!r.ok) return { ok: false, status: r.status };
            return { ok: true, value: await r.json() };
          } catch {
            return { ok: false };
          }
        },
      });
      return SHOP_CATALOG.tiles.filter(entry => entry.price > 0 && !ShopEconomy.ownsItem(__mj.S, 'tiles', entry.id)).slice(0, 2);
    });
    const [giftItem, altItem] = await installGiftHooks();
    t.ok(giftItem && altItem, 'found two unowned priced items for gift tests');

    // 1. Delayed acknowledgement blocks overlapping buys, helper buys, and sends
    putMode = 'delay';
    const waitPutStart = new Promise(resolve => { putStartedNotify = resolve; });
    await sender.evaluate(([id]) => {
      window.__delayedGiftPromise = ShopEconomy.sendShopGift(__mj.S, 'tiles', id, 'test-rcpt', window.__giftHooks());
    }, [giftItem.id]);
    await waitPutStart;
    const whileDelayed = await sender.evaluate(async ([id, altId]) => ({
      pendingFlag: ShopEconomy.hasPendingGiftSpend(__mj.S),
      coinsWhilePending: __mj.S.coins,
      buyAttempt: ShopEconomy.buyItem(__mj.S, 'tiles', altId),
      undoAttempt: ShopEconomy.buyUndoToken(__mj.S, {}, new Date()),
      peekAttempt: ShopEconomy.buyPeekToken(__mj.S, {}, new Date()),
      spendAttempt: ShopEconomy.spendCoins(__mj.S, 10),
      overlapGift: await ShopEconomy.sendShopGift(__mj.S, 'tiles', id, 'test-rcpt', window.__giftHooks()),
      overlapResume: await ShopEconomy.resumePendingGift(__mj.S, window.__giftHooks()),
    }), [giftItem.id, altItem.id]);
    t.eq(whileDelayed.pendingFlag, true, 'pending gift lock is active while delayed');
    t.eq(whileDelayed.coinsWhilePending, 4000, 'coins are untouched before ack');
    t.eq(whileDelayed.buyAttempt.reason, 'gift_pending', 'overlapping item buy is blocked');
    t.eq(whileDelayed.undoAttempt.reason, 'gift_pending', 'overlapping undo buy is blocked');
    t.eq(whileDelayed.peekAttempt.reason, 'gift_pending', 'overlapping peek buy is blocked');
    t.eq(whileDelayed.spendAttempt, false, 'overlapping spendCoins is blocked');
    t.eq(whileDelayed.overlapGift.reason, 'gift_pending', 'overlapping sendShopGift is blocked');
    t.eq(whileDelayed.overlapResume.reason, 'gift_pending', 'overlapping resumePendingGift is blocked');
    t.eq(giftPutCalls, 1, 'only one PUT left the client while delayed');

    putMode = 'normal';
    delayedPut();
    const delayedDone = await sender.evaluate(async () => ({
      res: await window.__delayedGiftPromise,
      pendingAfter: __mj.S.pendingGiftOut,
      coinsAfter: __mj.S.coins,
    }));
    t.eq(delayedDone.res.ok, true, 'delayed gift settles on ack');
    t.eq(delayedDone.res.spent, giftItem.price, 'delayed gift charges exact price once');
    t.eq(delayedDone.pendingAfter, null, 'pendingGiftOut clears after ack');
    t.eq(delayedDone.coinsAfter, 4000 - giftItem.price, 'balance matches single charge');
    t.eq(Object.keys(db.get('plays/test-gift-rcpt') || {}).length, 1, 'FakeDB holds one gift record after delayed ack');

    // 2. Rejected write leaves 0 charge and clears lock
    putMode = 'reject';
    const rejected = await sender.evaluate(async ([id]) => ({
      res: await ShopEconomy.sendShopGift(__mj.S, 'tiles', id, 'test-rcpt', window.__giftHooks()),
      pendingAfter: __mj.S.pendingGiftOut,
      hasLock: ShopEconomy.hasPendingGiftSpend(__mj.S),
      coinsAfter: __mj.S.coins,
    }), [giftItem.id]);
    t.eq(rejected.res.ok, false, 'rejected write fails cleanly');
    t.eq(rejected.res.reason, 'gift_failed', 'rejected write reports gift_failed');
    t.eq(rejected.pendingAfter, null, 'rejected write clears pendingGiftOut');
    t.eq(rejected.hasLock, false, 'rejected write unlocks wallet');
    t.eq(rejected.coinsAfter, 4000 - giftItem.price, 'rejected write deducts 0 coins');
    t.eq(Object.keys(db.get('plays/test-gift-rcpt') || {}).length, 1, 'rejected write adds no FakeDB record');

    // 3. Server accepted write, client missed response -> retry without reload
    putMode = 'drop_after_accept';
    failNextGets = 1;
    const putsBeforeDrop = giftPutCalls;
    const missed = await sender.evaluate(async ([id, altId]) => {
      const res = await ShopEconomy.sendShopGift(__mj.S, 'tiles', id, 'test-rcpt', window.__giftHooks());
      return {
        res,
        coinsBeforeRetry: __mj.S.coins,
        pending: __mj.S.pendingGiftOut,
        blockedBuy: ShopEconomy.buyItem(__mj.S, 'tiles', altId),
        blockedDifferentGift: await ShopEconomy.sendShopGift(__mj.S, 'tiles', altId, 'test-rcpt', window.__giftHooks()),
      };
    }, [giftItem.id, altItem.id]);
    t.eq(missed.res.ok, false, 'unconfirmed write does not report false success');
    t.eq(missed.res.reason, 'gift_unconfirmed', 'missed ack + failed probe stays unconfirmed');
    t.eq(missed.coinsBeforeRetry, 4000 - giftItem.price, 'coins are not charged until confirmed');
    t.ok(missed.pending && missed.pending.gid === missed.res.gid, 'pendingGiftOut keeps the stable gid');
    t.eq(missed.blockedBuy.reason, 'gift_pending', 'unconfirmed send blocks item buy');
    t.eq(missed.blockedDifferentGift.reason, 'gift_pending', 'unconfirmed send blocks a different gift');
    t.ok(db.get('plays/test-gift-rcpt/' + missed.res.gid), 'server actually persisted the accepted gift');

    putMode = 'normal';
    failNextGets = 0;
    const retried = await sender.evaluate(async ([id]) => ({
      res: await ShopEconomy.sendShopGift(__mj.S, 'tiles', id, 'test-rcpt', window.__giftHooks()),
      pendingAfter: __mj.S.pendingGiftOut,
      coinsAfter: __mj.S.coins,
    }), [giftItem.id]);
    t.eq(retried.res.ok, true, 'retry of same gift reconciles from server');
    t.eq(retried.res.recovered, true, 'retry marks gift as recovered');
    t.eq(retried.res.gid, missed.res.gid, 'retry keeps original gid');
    t.eq(retried.pendingAfter, null, 'retry clears pendingGiftOut');
    t.eq(retried.coinsAfter, 4000 - giftItem.price * 2, 'retry charges once for the accepted server write');
    t.eq(giftPutCalls, putsBeforeDrop + 1, 'retry did not send a duplicate PUT');
    t.eq(Object.keys(db.get('plays/test-gift-rcpt') || {}).length, 2, 'FakeDB still has one record per accepted operation');

    // 4. Server accepted write, client missed response -> reload + resumePendingGift
    putMode = 'drop_after_accept';
    failNextGets = 1;
    const preReload = await sender.evaluate(async ([id]) => ({
      res: await ShopEconomy.sendShopGift(__mj.S, 'tiles', id, 'test-rcpt', window.__giftHooks()),
      coins: __mj.S.coins,
    }), [giftItem.id]);
    t.eq(preReload.res.reason, 'gift_unconfirmed', 'pre-reload missed ack is unconfirmed');

    await sender.reload();
    await sender.waitForFunction(() => window.__mjReady === true, null, { timeout: 8000 });
    await installGiftHooks();

    const afterReloadPending = await sender.evaluate(([altId]) => ({
      pending: __mj.S.pendingGiftOut,
      coins: __mj.S.coins,
      hasLock: ShopEconomy.hasPendingGiftSpend(__mj.S),
      buyBlocked: ShopEconomy.buyItem(__mj.S, 'tiles', altId),
    }), [altItem.id]);
    t.eq(afterReloadPending.pending && afterReloadPending.pending.gid, preReload.res.gid, 'pendingGiftOut survives reload');
    t.eq(afterReloadPending.coins, preReload.coins, 'coins remain uncharged across reload');
    t.eq(afterReloadPending.hasLock, true, 'wallet stays locked across reload while unconfirmed');
    t.eq(afterReloadPending.buyBlocked.reason, 'gift_pending', 'reload preserves buy lock');

    putMode = 'normal';
    failNextGets = 0;
    const putsBeforeResume = giftPutCalls;
    const resumed = await sender.evaluate(async () => ({
      res: await ShopEconomy.resumePendingGift(__mj.S, window.__giftHooks()),
      secondResume: await ShopEconomy.resumePendingGift(__mj.S, window.__giftHooks()),
      coinsAfter: __mj.S.coins,
      pendingAfter: __mj.S.pendingGiftOut,
    }));
    t.eq(resumed.res.ok, true, 'resumePendingGift settles accepted server gift after reload');
    t.eq(resumed.res.recovered, true, 'resumePendingGift marks recovered');
    t.eq(resumed.res.gid, preReload.res.gid, 'resumePendingGift keeps original gid');
    t.eq(resumed.secondResume, { ok: true, idle: true }, 'second resumePendingGift is a no-op');
    t.eq(resumed.coinsAfter, preReload.coins - giftItem.price, 'resumePendingGift charges exactly once');
    t.eq(resumed.pendingAfter, null, 'resumePendingGift clears pendingGiftOut');
    t.eq(giftPutCalls, putsBeforeResume, 'resumePendingGift needed zero duplicate PUTs');

    // Dropped before reaching server across reload -> clears cleanly without charging
    putMode = 'drop_before_accept';
    failNextGets = 1;
    const droppedPreReload = await sender.evaluate(async ([id]) => ({
      res: await ShopEconomy.sendShopGift(__mj.S, 'tiles', id, 'test-rcpt', window.__giftHooks()),
      coins: __mj.S.coins,
    }), [giftItem.id]);
    t.eq(droppedPreReload.res.reason, 'gift_unconfirmed', 'pre-server drop stays unconfirmed before probe');
    await sender.reload();
    await sender.waitForFunction(() => window.__mjReady === true, null, { timeout: 8000 });
    await installGiftHooks();
    putMode = 'normal';
    failNextGets = 0;
    const clearedAfterReload = await sender.evaluate(async () => ({
      res: await ShopEconomy.resumePendingGift(__mj.S, window.__giftHooks()),
      coins: __mj.S.coins,
      pendingAfter: __mj.S.pendingGiftOut,
      hasLock: ShopEconomy.hasPendingGiftSpend(__mj.S),
    }));
    t.eq(clearedAfterReload.res.ok, false, 'absent server record does not charge');
    t.eq(clearedAfterReload.res.reason, 'gift_failed', 'absent server record reports gift_failed');
    t.eq(clearedAfterReload.res.cleared, true, 'absent server record clears pending state');
    t.eq(clearedAfterReload.coins, droppedPreReload.coins, 'absent server record deducts 0 coins');
    t.eq(clearedAfterReload.pendingAfter, null, 'pendingGiftOut is cleared');
    t.eq(clearedAfterReload.hasLock, false, 'wallet unlocks after absent gift clears');
    await sender.ctx.close();

    // 5. Recipient deduplication, distinct gift of already-owned item, and legacy record shape
    const inbox = db.get('plays/test-gift-rcpt') || {};
    const inboxEntries = Object.entries(inbox).sort((a, b) => a[0].localeCompare(b[0]));
    t.eq(inboxEntries.length, 3, 'recipient inbox contains the three distinct confirmed gifts');

    const rcpt = await t.phone({ db, routes, state: { econV: 2, pid: 'test-rcpt', name: 'Rcpt', coins: 100 } });
    const firstDelivery = await rcpt.evaluate(([id1, msg1]) => {
      const r1 = ShopEconomy.receiveShopGift(__mj.S, msg1, { recordId: id1, save });
      const rDup = ShopEconomy.receiveShopGift(__mj.S, msg1, { recordId: id1, save });
      return { r1, rDup, coins: __mj.S.coins, owns: ShopEconomy.ownsItem(__mj.S, 'tiles', msg1.item) };
    }, inboxEntries[0]);
    t.eq(firstDelivery.r1.ok, true, 'recipient receives first gift');
    t.eq(firstDelivery.r1.alreadyOwned, false, 'first gift grants ownership instead of refund');
    t.eq(firstDelivery.rDup.reason, 'duplicate_event', 'immediate redelivery is rejected');
    t.eq(firstDelivery.coins, 100, 'first gift grants item without coin refund');
    t.eq(firstDelivery.owns, true, 'recipient now owns the gifted item');

    await rcpt.reload();
    await rcpt.waitForFunction(() => window.__mjReady === true, null, { timeout: 8000 });
    const afterRcptReload = await rcpt.evaluate(([entry0, entry1]) => {
      const [id1, msg1] = entry0;
      const [id2, msg2] = entry1;
      const dupAfterReload = ShopEconomy.receiveShopGift(__mj.S, msg1, { recordId: id1, save });
      const secondGiftOwned = ShopEconomy.receiveShopGift(__mj.S, msg2, { recordId: id2, save });
      const secondDup = ShopEconomy.receiveShopGift(__mj.S, msg2, { recordId: id2, save });
      const legacy1 = ShopEconomy.receiveShopGift(__mj.S, {
        k: 'shop_gift', t: 1700000000000, from: 'test-sender', name: 'Sender', cat: 'tiles', item: 'tiles_dutch',
      }, { save });
      const legacyDup = ShopEconomy.receiveShopGift(__mj.S, {
        k: 'shop_gift', t: 1700000000000, from: 'test-sender', name: 'Sender', cat: 'tiles', item: 'tiles_dutch',
      }, { save });
      return {
        dupAfterReload,
        secondGiftOwned,
        secondDup,
        legacy1,
        legacyDup,
        coins: __mj.S.coins,
        ownsLegacy: ShopEconomy.ownsItem(__mj.S, 'tiles', 'tiles_dutch'),
      };
    }, [inboxEntries[0], inboxEntries[1]]);
    t.eq(afterRcptReload.dupAfterReload.reason, 'duplicate_event', 'reload preserves giftsSeen deduplication');
    t.eq(afterRcptReload.secondGiftOwned.ok, true, 'second distinct gift of owned item is accepted');
    t.eq(afterRcptReload.secondGiftOwned.alreadyOwned, true, 'second gift detects item already owned');
    t.eq(afterRcptReload.secondGiftOwned.refundCoins, giftItem.price, 'second gift awards full coin refund');
    t.eq(afterRcptReload.secondDup.reason, 'duplicate_event', 'second gift cannot refund twice');
    t.eq(afterRcptReload.legacy1.ok, true, 'legacy gift record without gid remains readable');
    t.eq(afterRcptReload.legacyDup.reason, 'duplicate_event', 'legacy gift record deduplicates');
    t.eq(afterRcptReload.coins, 100 + giftItem.price, 'recipient balance reflects exactly one refund');
    t.eq(afterRcptReload.ownsLegacy, true, 'legacy gift grants ownership');
  },
};
