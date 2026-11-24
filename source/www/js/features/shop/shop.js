/* Oma's Mahjong — save migration, shop actions and coin rewards. */
'use strict';

(function (globalScope) {
  const CAT = typeof require === 'function' ? require('./catalog') : globalScope;
  const RULES = CAT.SHOP_RULES;
  const pendingGiftSpends = new WeakSet();

  const SLOT_BY_CAT = Object.freeze({
    tiles: 'theme',
    bg: 'bg',
    finish: 'finish',
    tray: 'tray',
    fx: 'winFx',
    music: 'musicTrack',
    sfx: 'sfxPack',
    frame: 'frame',
    title: 'title',
  });

  function clampInt(val, min, max) {
    const n = Math.floor(Number(val) || 0);
    return Math.max(min, Math.min(max, n));
  }

  function localDateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function weekIdOf(d = new Date()) {
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    return localDateKey(mon);
  }

  function sumObj(obj) {
    let total = 0;
    if (!obj || typeof obj !== 'object') return 0;
    for (const k of Object.keys(obj)) total += Number(obj[k]) || 0;
    return total;
  }

  /** Pure main-level Stars only (`sum(S.stars)`, never `daily` or `bonusStars`). */
  function totalStarsV2(S) {
    return sumObj(S && S.stars);
  }

  function newWeekObj(now = new Date()) {
    return {
      id: weekIdOf(now),
      v: RULES.week.epoch,
      pts: 0,
      day: localDateKey(now),
      dayWins: 0,
      dailyDone: '',
      cups: [],
      postDiamond: 0,
      prPaid: false,
      freeUndo: false,
      boughtUndo: 0,
      freePeek: false,
      boughtPeek: 0,
    };
  }

  function cloneStarterOwned() {
    const out = {};
    for (const cat of Object.keys(CAT.STARTER_OWNED)) {
      out[cat] = CAT.STARTER_OWNED[cat].slice();
    }
    return out;
  }

  function mergeOwned(rawOwned) {
    const out = cloneStarterOwned();
    if (!rawOwned || typeof rawOwned !== 'object') return out;
    for (const cat of Object.keys(out)) {
      if (Array.isArray(rawOwned[cat])) {
        const set = new Set(out[cat]);
        for (const id of rawOwned[cat]) if (typeof id === 'string' && id) set.add(id);
        out[cat] = Array.from(set);
      }
    }
    return out;
  }

  function econDefaults(now = new Date()) {
    return {
      level: 1,
      stars: {},
      daily: {},
      theme: 'classic',
      bg: 'jade',
      finish: 'fin_ivory',
      tray: 'tray_honey',
      winFx: 'fx_sun',
      musicTrack: 'mus_piano',
      sfxPack: 'sfx_ivory',
      frame: 'none',
      title: '',
      musicShuffle: false,
      sfx: true,
      music: true,
      vibrate: true,
      highlight: true,
      nums: true,
      seenIntro: false,
      sunSeen: false,
      seenSp: {},
      matches: 0,
      bestCombo: 0,
      bestStreak: 0,
      winStreak: 0,
      bonusStars: 0,
      bonusPts: 0,
      weekWins: 0,
      bestWeekPts: 0,
      lastWeek: null,
      prevWk: null,
      lastWeekAwarded: '',
      econV: 2,
      coins: 0,
      coinWeek: null,
      undoStock: 0,
      peekStock: 0,
      owned: cloneStarterOwned(),
      grit: { petals: 0, lastDay: '' },
      wk: newWeekObj(now),
      giftsSeen: {},
      pendingGifts: [],
      stats: {},
      trophies: {},
      att: {},
      fails: {},
      czLoss: {},
      proSeen: {},
      lvlPts: {},
      dayPts: {},
      heartsSent: {},
      heartsSeen: {},
      heartsOut: {},
      pendingHearts: [],
    };
  }

  /**
   * Load and migrate `omamj.v1` JSON cleanly (`save.js`).
   * IMPORTANT: Inspects `parsed.econV` BEFORE merging `econDefaults()` so existing v1.77 saves
   * without `econV` do NOT inherit `econV: 2` and silently skip migration.
   */
  function loadAndMigrateSave(rawJsonOrObj, now = new Date()) {
    const today = localDateKey(now);
    let parsed = null;
    if (typeof rawJsonOrObj === 'string') {
      if (rawJsonOrObj.trim()) {
        try { parsed = JSON.parse(rawJsonOrObj); } catch (e) { parsed = null; }
      }
    } else if (rawJsonOrObj && typeof rawJsonOrObj === 'object') {
      parsed = JSON.parse(JSON.stringify(rawJsonOrObj));
    }

    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
      return { S: econDefaults(now), migrated: false, freshInstall: true };
    }

    const rawEconV = Number(parsed.econV) || 0;
    const needsMigrate = rawEconV < 2;
    const S = Object.assign(econDefaults(now), parsed);
    delete S.contrast;

    S.owned = mergeOwned(parsed.owned);
    S.trophies = Object.assign({}, S.trophies || {});
    S.stats = Object.assign({}, S.stats || {});
    S.giftsSeen = Object.assign({}, S.giftsSeen || {});
    S.pendingGifts = Array.isArray(S.pendingGifts) ? S.pendingGifts.slice() : [];
    S.grit = S.grit && typeof S.grit === 'object'
      ? { petals: clampInt(S.grit.petals, 0, RULES.grit.petals - 1), lastDay: String(S.grit.lastDay || '') }
      : { petals: 0, lastDay: '' };

    if (!needsMigrate) {
      S.econV = 2;
      S.coins = Math.max(0, Math.floor(Number(S.coins) || 0));
      S.undoStock = clampInt(S.undoStock, 0, RULES.undo.maxStock);
      S.peekStock = clampInt(S.peekStock, 0, RULES.peek.maxStock);
      if (!S.wk || typeof S.wk !== 'object') S.wk = newWeekObj(now);
      return { S, migrated: false, freshInstall: false };
    }

    // 1. Read-only legacy snapshot before cleanup
    const oldLevel = Math.max(1, Math.floor(Number(parsed.level) || 1));
    const oldBonusStars = Math.max(0, Math.floor(Number(parsed.bonusStars) || 0));
    const oldTotalStars = sumObj(parsed.stars) + sumObj(parsed.daily) + oldBonusStars;
    const hadSun = (oldLevel > 20) || Boolean(parsed.sunSeen) || parsed.theme === 'sunflower' || parsed.bg === 'sunfield';

    // 2. Preserve every unlocked legacy tile theme and star background
    const tileSet = new Set(S.owned.tiles);
    for (const id of ['classic', 'fruit', 'animals', 'happy']) tileSet.add(id);
    if (hadSun) tileSet.add('sunflower');
    if (parsed.theme && CAT.findCatalogItem('tiles', parsed.theme)) tileSet.add(parsed.theme);
    S.owned.tiles = Array.from(tileSet);

    const bgSet = new Set(S.owned.bg);
    bgSet.add('jade');
    for (const [id, need] of Object.entries(CAT.LEGACY_BG_NEEDS)) {
      if (oldTotalStars >= need) bgSet.add(id);
    }
    if (hadSun) bgSet.add('sunfield');
    if (parsed.bg && CAT.findCatalogItem('bg', parsed.bg)) bgSet.add(parsed.bg);
    S.owned.bg = Array.from(bgSet);

    const earnedFrames = new Set(S.owned.frame);
    const oldTrophyCount = Object.keys(S.trophies).length;
    if (oldTrophyCount >= 4) earnedFrames.add('bronze');
    if (oldTrophyCount >= 8) earnedFrames.add('silver');
    if (oldTrophyCount >= 12) earnedFrames.add('gold');
    if (hadSun) earnedFrames.add('sun');
    if (S.stats.hearts >= 3) earnedFrames.add('heart');
    if (S.trophies.c5) earnedFrames.add('rainbow');
    if (S.weekWins >= 1) earnedFrames.add('crown');
    if (CAT.EARNED_FRAMES.includes(parsed.frame)) earnedFrames.add(parsed.frame);
    S.owned.frame = Array.from(earnedFrames);

    // 3. Preserve active equipped choices with zero Day-1 shift (fall back if unknown/unowned)
    S.theme = tileSet.has(S.theme) ? S.theme : 'classic';
    S.bg = bgSet.has(S.bg) ? S.bg : 'jade';
    S.musicTrack = (hadSun && S.theme === 'sunflower') ? 'mus_sunflower' : 'mus_piano';
    S.finish = parsed.finish || 'fin_ivory';
    S.tray = parsed.tray || 'tray_honey';
    S.winFx = parsed.winFx || 'fx_sun';
    S.sfxPack = parsed.sfxPack || 'sfx_ivory';
    S.title = parsed.title || '';
    S.musicShuffle = Boolean(parsed.musicShuffle);

    // 4. Capped starting Coins + 1 starter token for each Shop helper
    S.coins = Math.min(RULES.startCap, Math.max(0, (oldLevel - 1) * 2 + oldBonusStars * 2));
    S.undoStock = parsed.undoStock !== undefined ? clampInt(parsed.undoStock, 0, RULES.undo.maxStock) : 1;
    S.peekStock = parsed.peekStock !== undefined ? clampInt(parsed.peekStock, 0, RULES.peek.maxStock) : 1;

    // 5. Silently pre-stamp already-passed Chapter 2 level trophies (100..350)
    const completed = oldLevel - 1;
    for (const milestone of [100, 150, 200, 250, 300, 350]) {
      const tid = 'l' + milestone;
      if (completed >= milestone && !S.trophies[tid]) S.trophies[tid] = today;
    }

    S.coinWeek = null;
    S.grit = { petals: 0, lastDay: '' };
    S.econV = 2;

    return { S, migrated: true, freshInstall: false, hadSun, oldTotalStars };
  }

  /** Erase progress (`settings.js` `confirmReset`) without re-triggering migration. */
  function resetProgressState(S, now = new Date()) {
    const keepLang = S.lang;
    const keepPid = S.pid;
    const keepName = S.name;
    const keepAvatar = S.avatar;
    const fresh = econDefaults(now);
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, fresh);
    if (keepLang !== undefined) S.lang = keepLang;
    if (keepPid !== undefined) S.pid = keepPid;
    if (keepName !== undefined) S.name = keepName;
    if (keepAvatar !== undefined) S.avatar = keepAvatar;
    return S;
  }

  function addCoins(S, amount, hooks = {}) {
    const n = Math.floor(Number(amount) || 0);
    if (!Number.isSafeInteger(n) || n <= 0) return S.coins;
    S.coins = Math.max(0, Math.floor(Number(S.coins) || 0)) + n;
    if (!S.stats) S.stats = {};
    S.stats.coinsEarned = (Number(S.stats.coinsEarned) || 0) + n;
    if (typeof hooks.save === 'function') hooks.save();
    if (typeof hooks.renderCoins === 'function') hooks.renderCoins(S.coins);
    return S.coins;
  }

  function spendCoins(S, amount, hooks = {}) {
    const n = Math.floor(Number(amount) || 0);
    const bal = Math.max(0, Math.floor(Number(S.coins) || 0));
    if (!Number.isSafeInteger(n) || n <= 0 || bal < n || pendingGiftSpends.has(S)) return false;
    S.coins = bal - n;
    if (!S.stats) S.stats = {};
    S.stats.coinsSpent = (Number(S.stats.coinsSpent) || 0) + n;
    if (typeof hooks.save === 'function') hooks.save();
    if (typeof hooks.renderCoins === 'function') hooks.renderCoins(S.coins);
    return true;
  }

  function ownsItem(S, cat, id) {
    if (CAT.isStarterItem(cat, id)) return true;
    const arr = S && S.owned && S.owned[cat];
    return Array.isArray(arr) && arr.includes(id);
  }

  /** Return active equipped ID for `cat`, falling back cleanly to the starter item if unowned/corrupted. */
  function resolveEquippedItem(S, cat) {
    const slot = SLOT_BY_CAT[cat];
    if (!slot) return '';
    const cur = S && S[slot];
    if (cat === 'title') {
      return cur && CAT.findCatalogItem('title', cur) && ownsItem(S, 'title', cur) ? cur : '';
    }
    if (cur && CAT.findCatalogItem(cat, cur) && ownsItem(S, cat, cur)) return cur;
    const starters = CAT.STARTER_OWNED[cat];
    return Array.isArray(starters) && starters.length ? starters[0] : '';
  }

  function equipItem(S, cat, id, hooks = {}) {
    if (cat === 'title' && id === '') {
      S.title = '';
      if (typeof hooks.save === 'function') hooks.save();
      if (typeof hooks.pushScore === 'function') hooks.pushScore();
      return { ok: true, cat, id: '' };
    }
    if (!CAT.findCatalogItem(cat, id)) return { ok: false, reason: 'unknown_item' };
    if (!ownsItem(S, cat, id)) return { ok: false, reason: 'not_owned' };
    const slot = SLOT_BY_CAT[cat];
    if (!slot) return { ok: false, reason: 'not_equippable' };
    S[slot] = id;
    if (typeof hooks.apply === 'function') hooks.apply(cat, id);
    if (typeof hooks.save === 'function') hooks.save();
    if (typeof hooks.log === 'function') hooks.log('shop_equip', { cat, id });
    if ((cat === 'frame' || cat === 'title') && typeof hooks.pushScore === 'function') hooks.pushScore();
    return { ok: true, cat, id, slot };
  }

  function buyItem(S, cat, id, hooks = {}) {
    if (pendingGiftSpends.has(S)) return { ok: false, reason: 'gift_pending' };
    const item = CAT.findCatalogItem(cat, id);
    if (!item || !SLOT_BY_CAT[cat]) return { ok: false, reason: 'unknown_item' };
    if (ownsItem(S, cat, id)) return { ok: false, reason: 'already_owned' };
    const coins = Math.max(0, Math.floor(Number(S.coins) || 0));
    if (coins < item.price) return { ok: false, reason: 'not_enough_coins', need: item.price - coins };
    if (!spendCoins(S, item.price)) return { ok: false, reason: 'not_enough_coins', need: item.price };

    if (!S.owned) S.owned = cloneStarterOwned();
    if (!Array.isArray(S.owned[cat])) S.owned[cat] = [];
    if (!S.owned[cat].includes(id)) S.owned[cat].push(id);

    const slot = SLOT_BY_CAT[cat];
    S[slot] = id;
    if (typeof hooks.apply === 'function') hooks.apply(cat, id);
    if (typeof hooks.save === 'function') hooks.save();
    if (typeof hooks.renderCoins === 'function') hooks.renderCoins(S.coins);
    if (typeof hooks.log === 'function') hooks.log('shop_buy', { cat, id, p: item.price });
    if ((cat === 'frame' || cat === 'title') && typeof hooks.pushScore === 'function') hooks.pushScore();

    return { ok: true, cat, id, spent: item.price, coinsLeft: S.coins };
  }

  /** Validate & build Firebase gift payload WITHOUT deducting Coins yet (wait for network OK). */
  function prepareGiftPayload(S, cat, id, toPid, nowMs = Date.now()) {
    if (cat === 'helper' || id === 'undo' || id === 'peek') return { ok: false, reason: 'not_giftable' };
    const item = CAT.findCatalogItem(cat, id);
    if (!item || !SLOT_BY_CAT[cat] || item.price <= 0) return { ok: false, reason: 'not_giftable' };
    if (!toPid) return { ok: false, reason: 'missing_recipient' };
    const coins = Math.max(0, Math.floor(Number(S.coins) || 0));
    if (coins < item.price) return { ok: false, reason: 'not_enough_coins', need: item.price - coins };
    return {
      ok: true,
      path: 'plays/' + CAT.giftKey(toPid),
      price: item.price,
      payload: { k: 'shop_gift', t: nowMs, from: String(S.pid || ''), name: String(S.name || '').slice(0, 20), cat, item: id },
    };
  }

  function finalizeGiftSpend(S, cat, id, toPid, price, hooks = {}) {
    if (!spendCoins(S, price, hooks)) return { ok: false, reason: 'not_enough_coins' };
    if (typeof hooks.log === 'function') hooks.log('shop_gift_out', { to: toPid, cat, id, p: price });
    return { ok: true, spent: price, coinsLeft: S.coins };
  }

  /** Keep spending serialized until a gift's write is acknowledged. */
  async function sendShopGift(S, cat, id, toPid, hooks = {}) {
    if (pendingGiftSpends.has(S)) return { ok: false, reason: 'gift_pending' };
    const gift = prepareGiftPayload(S, cat, id, toPid);
    if (!gift.ok) return gift;
    pendingGiftSpends.add(S);
    try {
      const result = await hooks.send(gift.path, gift.payload);
      if (!result?.ok) return { ok: false, reason: 'gift_failed' };
    } catch {
      return { ok: false, reason: 'gift_failed' };
    } finally {
      pendingGiftSpends.delete(S);
    }
    return finalizeGiftSpend(S, cat, id, toPid, gift.price, hooks);
  }

  /** Receive a wrapped gift on Home: deduplicated; awards 100% Coins if recipient already owns it. */
  function receiveShopGift(S, msg, hooks = {}) {
    if (!msg || msg.k !== 'shop_gift') return { ok: false, reason: 'invalid_gift' };
    const key = `${msg.from || ''}:${msg.t || ''}:${msg.cat || ''}:${msg.item || ''}`;
    if (!S.giftsSeen) S.giftsSeen = {};
    if (S.giftsSeen[key]) return { ok: false, reason: 'duplicate_event' };
    const item = CAT.findCatalogItem(msg.cat, msg.item);
    if (!item || !SLOT_BY_CAT[msg.cat]) return { ok: false, reason: 'unknown_item' };
    if (item.price <= 0) return { ok: false, reason: 'not_giftable' };

    S.giftsSeen[key] = Date.now();
    const alreadyOwned = ownsItem(S, msg.cat, msg.item);
    let refundCoins = 0;
    if (alreadyOwned) {
      refundCoins = item.price;
      addCoins(S, refundCoins);
    } else {
      if (!S.owned) S.owned = cloneStarterOwned();
      if (!Array.isArray(S.owned[msg.cat])) S.owned[msg.cat] = [];
      S.owned[msg.cat].push(msg.item);
    }
    if (typeof hooks.save === 'function') hooks.save();
    if (refundCoins > 0 && typeof hooks.renderCoins === 'function') hooks.renderCoins(S.coins);
    if (typeof hooks.log === 'function') hooks.log('shop_gift_in', { from: msg.from, cat: msg.cat, id: msg.item });
    return { ok: true, alreadyOwned, refundCoins, item, fromName: msg.name || '' };
  }

  /** Award `+2 🪙` into `G.boardCoins` once when Auto-Finish fires on a fresh Lv 50+ board. */
  function applyAutoFinishCoin(G, effectiveLevel, fresh) {
    if (!G || !fresh || effectiveLevel < 50 || G.autoFinPaid) return 0;
    G.autoFinPaid = true;
    G.boardCoins = (Number(G.boardCoins) || 0) + RULES.coins.autoFinish;
    return RULES.coins.autoFinish;
  }

  /** Speed-neutral 5-pip Flow Spark (`board.js`): pays `+1 🪙` max once per fresh level & resets `0`. */
  function stepFlowSpark(G, trayLenAfterMatch, fresh) {
    if (!G) return { flow: 0, charged: false, coinsAdded: 0 };
    if (trayLenAfterMatch >= 3) {
      G.flow = 0;
      return { flow: 0, charged: false, coinsAdded: 0 };
    }
    if (trayLenAfterMatch > 1) {
      return { flow: Number(G.flow) || 0, charged: false, coinsAdded: 0 };
    }
    const next = (Number(G.flow) || 0) + 1;
    if (next < 5) {
      G.flow = next;
      return { flow: next, charged: false, coinsAdded: 0 };
    }
    let coinsAdded = 0;
    if (fresh && !G.flowPaid) {
      G.flowPaid = true;
      coinsAdded = RULES.coins.flow;
      G.boardCoins = (Number(G.boardCoins) || 0) + coinsAdded;
    }
    G.flow = 0;
    return { flow: 0, charged: true, coinsAdded };
  }

  /** Compute exact Coins earned on level win (`features/win.js`). Past dailies & replays pay 0. */
  function computeWinCoins({ mode, level = 0, date = '', today = '', fresh = false, stars = 0, prevStars = 0, boardCoins = 0, fullMainWin = true }) {
    const receipt = { base: 0, perfect: 0, big: 0, board: 0, upgrade: 0, total: 0 };
    const cleanBoard = Math.max(0, Math.floor(Number(boardCoins) || 0));

    if (mode === 'level') {
      if (fresh) {
        receipt.base = RULES.coins.freshBase;
        if (fullMainWin) {
          receipt.perfect = stars >= 3 ? RULES.coins.perfect : 0;
          receipt.big = (level > 0 && level % RULES.coins.bigEvery === 0) ? RULES.coins.bigBoard : 0;
          receipt.board = cleanBoard;
        }
      } else if ((Number(prevStars) || 0) < 3 && stars >= 3) {
        receipt.upgrade = RULES.coins.upgrade3Star;
      }
    } else if (mode === 'daily') {
      if (fresh && date && date === today) {
        receipt.base = RULES.coins.dailyBase;
        receipt.perfect = stars >= 3 ? RULES.coins.perfect : 0;
        receipt.board = cleanBoard;
      }
    }

    receipt.total = receipt.base + receipt.perfect + receipt.big + receipt.board + receipt.upgrade;
    return receipt;
  }

  /** Credit a completed win alongside progress at the caller's save point. */
  function rewardWin(S, win, now = new Date()) {
    let fullMainWin = true;
    if (win.mode === 'level' && win.fresh) {
      const id = weekIdOf(now);
      const previous = S.coinWeek?.id === id ? clampInt(S.coinWeek.wins, 0, RULES.coins.fullMainWinsPerWeek) : 0;
      fullMainWin = previous < RULES.coins.fullMainWinsPerWeek;
      S.coinWeek = { id, wins: fullMainWin ? previous + 1 : previous };
    }
    const receipt = computeWinCoins({ ...win, fullMainWin });
    addCoins(S, receipt.total);
    return receipt;
  }

  const exportsObj = {
    SLOT_BY_CAT,
    localDateKey,
    weekIdOf,
    sumObj,
    totalStarsV2,
    newWeekObj,
    econDefaults,
    loadAndMigrateSave,
    resetProgressState,
    addCoins,
    spendCoins,
    ownsItem,
    resolveEquippedItem,
    equipItem,
    buyItem,
    prepareGiftPayload,
    finalizeGiftSpend,
    sendShopGift,
    receiveShopGift,
    applyAutoFinishCoin,
    stepFlowSpark,
    computeWinCoins,
    rewardWin,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  } else {
    globalScope.ShopEconomy = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
