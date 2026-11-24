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
  },
};
