/* Oma's Mahjong — save migration, shop actions and coin rewards. */
'use strict';

(function (globalScope) {
  const CAT = typeof require === 'function' ? require('./catalog') : globalScope;
  const RULES = CAT.SHOP_RULES;
  const pendingGiftSpends = new WeakSet();
  let giftSeq = 0;

  function makeGiftId(nowMs = Date.now()) {
    const ts = Math.max(0, Math.floor(Number(nowMs) || Date.now()));
    giftSeq = (giftSeq + 1) % 46656;
    const seq = giftSeq.toString(36).padStart(3, '0');
    let rnd = '';
    const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const bytes = new Uint8Array(6);
      cryptoObj.getRandomValues(bytes);
      rnd = Array.from(bytes, b => (b % 36).toString(36)).join('');
    } else {
      rnd = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
    }
    return `g_${String(ts).padStart(13, '0')}_${seq}_${rnd}`.slice(0, 32);
  }

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
      wk: { id: weekIdOf(now), pts: 0 },
      giftsSeen: {},
      pendingGifts: [],
      pendingGiftOut: null,
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

  function stampChapterTwoMilestones(S, today) {
    const completed = Math.floor(Number(S.level) || 1) - 1;
    let changed = false;
    for (const milestone of [100, 150, 200, 250, 300, 350]) {
      const id = 'l' + milestone;
      if (completed < milestone || S.trophies[id]) continue;
      S.trophies[id] = today;
      changed = true;
    }
    return changed;
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
    S.pendingGiftOut = normalizePendingGiftOut(parsed.pendingGiftOut);
    S.grit = S.grit && typeof S.grit === 'object'
      ? { petals: clampInt(S.grit.petals, 0, RULES.grit.petals - 1), lastDay: String(S.grit.lastDay || '') }
      : { petals: 0, lastDay: '' };

    if (!needsMigrate) {
      S.econV = 2;
      S.coins = Math.max(0, Math.floor(Number(S.coins) || 0));
      S.undoStock = clampInt(S.undoStock, 0, RULES.undo.maxStock);
      S.peekStock = clampInt(S.peekStock, 0, RULES.peek.maxStock);
      if (!S.wk || typeof S.wk !== 'object') S.wk = { id: weekIdOf(now), pts: 0 };
      return { S, migrated: stampChapterTwoMilestones(S, today), freshInstall: false };
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
    stampChapterTwoMilestones(S, today);

    S.coinWeek = null;
    S.grit = { petals: 0, lastDay: '' };
    S.econV = 2;

    return { S, migrated: true, freshInstall: false, hadSun, oldTotalStars };
  }

  /** Erase progress (`settings.js` `confirmReset`) without re-triggering migration. */
  function resetProgressState(S, now = new Date()) {
    pendingGiftSpends.delete(S);
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

  function normalizePendingGiftOut(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const p = raw.payload;
    const price = Math.floor(Number(raw.price) || 0);
    if (
      typeof raw.gid !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(raw.gid) ||
      typeof raw.toPid !== 'string' || !raw.toPid ||
      typeof raw.cat !== 'string' || !raw.cat ||
      typeof raw.item !== 'string' || !raw.item ||
      typeof raw.path !== 'string' || !raw.path ||
      !Number.isSafeInteger(price) || price <= 0 ||
      !p || typeof p !== 'object' || (p.k !== 'shop_gift' && raw.cat !== 'postcard')
    ) {
      return null;
    }
    if (raw.cat === 'postcard') {
      if (p.k !== 'msg' || p.pc !== raw.item || !CAT.findCatalogItem('postcard', p.pc)?.price ||
          !validPostcardPid(p.from) || !validPostcardPid(raw.toPid) || !/^\d{4}-\d{2}-\d{2}$/.test(p.day) ||
          raw.path !== postcardPath(raw.toPid, p.from, p.day)) return null;
      return { gid: raw.gid, toPid: raw.toPid, cat: raw.cat, item: raw.item, price, path: raw.path,
        payload: { k: 'msg', t: Number(p.t), gid: raw.gid, from: p.from, name: String(p.name || '').slice(0, 24),
          pc: p.pc, day: p.day, ...postcardNoteParts(p) } };
    }
    return {
      gid: raw.gid,
      toPid: raw.toPid,
      cat: raw.cat,
      item: raw.item,
      price,
      path: raw.path,
      payload: {
        k: 'shop_gift',
        t: Math.max(0, Math.floor(Number(p.t) || 0)),
        gid: raw.gid,
        from: String(p.from || '').slice(0, 40),
        name: String(p.name || '').slice(0, 20),
        cat: raw.cat,
        item: raw.item,
      },
    };
  }

  function getPendingGiftOut(S) {
    if (!S || typeof S !== 'object') return null;
    const norm = normalizePendingGiftOut(S.pendingGiftOut);
    if (!norm && S.pendingGiftOut) S.pendingGiftOut = null;
    return norm;
  }

  function hasPendingGiftSpend(S) {
    return pendingGiftSpends.has(S) || Boolean(getPendingGiftOut(S));
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
    if (!Number.isSafeInteger(n) || n <= 0 || bal < n || hasPendingGiftSpend(S)) return false;
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
    if (cur && isEquippable(cat, cur) && ownsItem(S, cat, cur)) return cur;
    const starters = CAT.STARTER_OWNED[cat];
    return Array.isArray(starters) && starters.length ? starters[0] : '';
  }

  function isEquippable(cat, id) {
    return Boolean(CAT.findCatalogItem(cat, id) || (cat === 'frame' && CAT.EARNED_FRAMES.includes(id)));
  }

  function equipItem(S, cat, id, hooks = {}) {
    if (cat === 'title' && id === '') {
      S.title = '';
      if (typeof hooks.save === 'function') hooks.save();
      if (typeof hooks.pushScore === 'function') hooks.pushScore();
      return { ok: true, cat, id: '' };
    }
    if (!isEquippable(cat, id)) return { ok: false, reason: 'unknown_item' };
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
    if (hasPendingGiftSpend(S)) return { ok: false, reason: 'gift_pending' };
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
  function prepareGiftPayload(S, cat, id, toPid, nowMs = Date.now(), giftId = '') {
    if (!canGiftShopItem(cat, id)) return { ok: false, reason: 'not_giftable' };
    const item = CAT.findCatalogItem(cat, id);
    if (!item || !SLOT_BY_CAT[cat] || item.price <= 0) return { ok: false, reason: 'not_giftable' };
    const cleanTo = String(toPid || '').trim();
    if (!cleanTo || /[/.$#[\]]/.test(cleanTo)) return { ok: false, reason: 'missing_recipient' };
    const coins = Math.max(0, Math.floor(Number(S && S.coins) || 0));
    if (coins < item.price) return { ok: false, reason: 'not_enough_coins', need: item.price - coins };
    const cleanNow = Math.max(0, Math.floor(Number(nowMs) || Date.now()));
    const gid = (typeof giftId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(giftId.trim()))
      ? giftId.trim()
      : makeGiftId(cleanNow);
    const inboxPath = 'plays/' + CAT.giftKey(cleanTo);
    const path = inboxPath + '/' + gid;
    return {
      ok: true,
      gid,
      method: 'PUT',
      inboxPath,
      path,
      toPid: cleanTo,
      price: item.price,
      payload: {
        k: 'shop_gift',
        t: cleanNow,
        gid,
        from: String((S && S.pid) || '').slice(0, 40),
        name: String((S && S.name) || '').slice(0, 20),
        cat,
        item: id,
      },
    };
  }

  function finalizeGiftSpend(S, cat, id, toPid, price, hooks = {}) {
    if (!spendCoins(S, price, hooks)) return { ok: false, reason: 'not_enough_coins' };
    if (typeof hooks.log === 'function') hooks.log('shop_gift_out', { to: toPid, cat, id, p: price });
    return { ok: true, spent: price, coinsLeft: S.coins };
  }

  function isSamePendingGift(pending, cat, id, toPid) {
    return Boolean(pending && pending.cat === cat && pending.item === id && pending.toPid === String(toPid || '').trim());
  }

  function matchesPendingGift(record, pending) {
    if (!record || typeof record !== 'object' || !pending || !pending.payload) return false;
    const p = pending.payload;
    if (pending.cat === 'postcard') {
      return record.k === 'msg' && record.gid === pending.gid && record.from === p.from &&
        record.pc === p.pc && record.day === p.day && Number(record.t) === p.t;
    }
    if (record.k !== 'shop_gift') return false;
    if (record.gid !== undefined && record.gid !== pending.gid) return false;
    return String(record.from || '') === String(p.from || '') &&
      record.cat === p.cat &&
      record.item === p.item &&
      Number(record.t) === Number(p.t);
  }

  async function probeGiftRecord(path, hooks) {
    if (!hooks || typeof hooks.read !== 'function') {
      return { status: 'no_reader', record: null };
    }
    try {
      const res = await hooks.read(path);
      if (res && typeof res === 'object' && Object.prototype.hasOwnProperty.call(res, 'ok')) {
        if (!res.ok) return { status: 'unknown', record: null };
        return res.value ? { status: 'found', record: res.value } : { status: 'absent', record: null };
      }
      return res ? { status: 'found', record: res } : { status: 'absent', record: null };
    } catch {
      return { status: 'unknown', record: null };
    }
  }

  function callSave(hooks) {
    if (!hooks || typeof hooks.save !== 'function') return false;
    try {
      const res = hooks.save();
      return res === true || Boolean(res && typeof res === 'object' && res.ok === true);
    } catch {
      return false;
    }
  }

  function isDefiniteSendRejection(threw, result) {
    if (threw || !result || result.ok || result.ambiguous) return false;
    if (result.status !== undefined && result.status !== null) {
      const st = Number(result.status);
      return Number.isFinite(st) && st >= 400 && st < 500;
    }
    return true;
  }

  function settleConfirmedGift(S, pending, hooks = {}, recovered = false) {
    if (S) S.pendingGiftOut = null;
    pendingGiftSpends.delete(S);
    const bal = Math.max(0, Math.floor(Number(S && S.coins) || 0));
    const charge = Math.min(bal, pending.price);
    if (pending.cat === 'postcard') {
      rememberPostcard(S, pending.toPid, pending.payload.day);
      if (charge) spendCoins(S, charge, hooks);
      else callSave(hooks);
      if (typeof hooks.log === 'function') hooks.log('shop_postcard_out', { to: pending.toPid, id: pending.item, p: charge });
      return { ok: true, spent: charge, coinsLeft: S.coins, gid: pending.gid, recovered };
    }
    const res = charge > 0
      ? finalizeGiftSpend(S, pending.cat, pending.item, pending.toPid, charge, hooks)
      : (() => {
        callSave(hooks);
        if (typeof hooks.log === 'function') hooks.log('shop_gift_out', { to: pending.toPid, cat: pending.cat, id: pending.item, p: 0 });
        return { ok: true, spent: 0, coinsLeft: bal };
      })();
    return { ...res, gid: pending.gid, recovered };
  }

  function clearPendingGift(S, hooks = {}) {
    if (S) S.pendingGiftOut = null;
    pendingGiftSpends.delete(S);
    callSave(hooks);
  }

  function reconcileGiftRecord(S, pending, probe, hooks) {
    if (probe.status !== 'found') return null;
    if (matchesPendingGift(probe.record, pending)) return settleConfirmedGift(S, pending, hooks, true);
    if (pending.cat !== 'postcard') return null;
    // Another draft already occupies this sender, recipient and day. Its wallet owns the charge.
    rememberPostcard(S, pending.toPid, pending.payload.day);
    clearPendingGift(S, hooks);
    return { ok: false, reason: 'postcard_already_sent' };
  }

  async function executePendingGift(S, pending, hooks = {}, allowSend = true, isInitialAttempt = false) {
    pendingGiftSpends.add(S);
    try {
      if (!allowSend || !isInitialAttempt) {
        const pre = await probeGiftRecord(pending.path, hooks);
        const settled = reconcileGiftRecord(S, pending, pre, hooks);
        if (settled) return settled;
        if (pre.status === 'unknown') {
          return { ok: false, reason: 'gift_unconfirmed', pending: true, gid: pending.gid };
        }
        if (!allowSend) {
          return {
            ok: false,
            reason: 'gift_unconfirmed',
            pending: true,
            gid: pending.gid,
            observedAbsent: pre.status === 'absent',
          };
        }
      }

      if (typeof hooks.send !== 'function') {
        return { ok: false, reason: 'gift_unconfirmed', pending: true, gid: pending.gid };
      }

      if (!isInitialAttempt && !callSave(hooks)) {
        return { ok: false, reason: 'save_failed', pending: true, gid: pending.gid };
      }

      let result = null;
      let threw = false;
      try {
        result = await hooks.send(pending.path, pending.payload, 'PUT');
      } catch {
        threw = true;
      }

      if (!threw && result && result.ok) {
        return settleConfirmedGift(S, pending, hooks, false);
      }

      const definiteReject = isDefiniteSendRejection(threw, result);
      const post = await probeGiftRecord(pending.path, hooks);
      const settled = reconcileGiftRecord(S, pending, post, hooks);
      if (settled) return settled;
      if ((isInitialAttempt || pending.cat === 'postcard') && definiteReject && (post.status === 'absent' || post.status === 'no_reader')) {
        clearPendingGift(S, hooks);
        return { ok: false, reason: 'gift_failed', gid: pending.gid };
      }
      callSave(hooks);
      return {
        ok: false,
        reason: 'gift_unconfirmed',
        pending: true,
        gid: pending.gid,
        observedAbsent: post.status === 'absent',
      };
    } finally {
      pendingGiftSpends.delete(S);
    }
  }

  /** Keep spending serialized and idempotent via stable `gid` until the gift write is confirmed or ruled absent. */
  async function submitGiftSpend(S, cat, id, toPid, prepare, hooks) {
    if (pendingGiftSpends.has(S)) return { ok: false, reason: 'gift_pending' };
    const existing = getPendingGiftOut(S);
    if (existing) {
      if (!isSamePendingGift(existing, cat, id, toPid)) {
        return { ok: false, reason: 'gift_pending', gid: existing.gid };
      }
      return executePendingGift(S, existing, hooks, true, false);
    }
    const gift = prepare();
    if (!gift.ok) return gift;
    const pending = {
      gid: gift.gid,
      toPid: gift.toPid,
      cat,
      item: id,
      price: gift.price,
      path: gift.path,
      payload: gift.payload,
    };
    S.pendingGiftOut = pending;
    if (!callSave(hooks)) {
      S.pendingGiftOut = null;
      return { ok: false, reason: 'save_failed' };
    }
    return executePendingGift(S, pending, hooks, true, true);
  }

  function sendShopGift(S, cat, id, toPid, hooks = {}) {
    return submitGiftSpend(S, cat, id, toPid, () => prepareGiftPayload(S, cat, id, toPid), hooks);
  }

  const validPostcardPid = pid => typeof pid === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(pid);
  const postcardPath = (to, from, day) => `plays/${to.startsWith('test-') ? 'test-msg-' + to.slice(5) : 'msg-' + to}/pc-${from}-${day}`;
  function postcardNoteParts(note) {
    return Object.fromEntries(['m0', 'm1', 'm2'].filter(key => typeof note[key] === 'string')
      .map(key => [key, note[key].slice(0, 40)]));
  }

  function rememberPostcard(S, to, day) {
    if (!S.postcardsSent || typeof S.postcardsSent !== 'object') S.postcardsSent = {};
    S.postcardsSent[to] = day;
  }

  function sendPostcard(S, id, toPid, note, hooks = {}) {
    return submitGiftSpend(S, 'postcard', id, toPid, () => {
      const item = CAT.findCatalogItem('postcard', id);
      if (!item?.price) return { ok: false, reason: 'unknown_item' };
      if (!validPostcardPid(toPid) || !validPostcardPid(S.pid) || toPid === S.pid || !S.name) {
        return { ok: false, reason: 'missing_recipient' };
      }
      const now = new Date(), t = now.getTime(), day = localDateKey(now);
      if (S.postcardsSent?.[toPid] === day) return { ok: false, reason: 'postcard_already_sent' };
      if (S.coins < item.price) return { ok: false, reason: 'not_enough_coins', need: item.price - S.coins };
      const gid = makeGiftId(t);
      return { ok: true, gid, toPid, price: item.price, path: postcardPath(toPid, S.pid, day),
        payload: { k: 'msg', t, gid, from: S.pid, name: S.name.slice(0, 24), pc: id, day, ...postcardNoteParts(note) } };
    }, hooks);
  }

  /** Reconcile a persisted unconfirmed gift send after reload or reconnect without double-charging. */
  async function resumePendingGift(S, hooks = {}) {
    if (pendingGiftSpends.has(S)) return { ok: false, reason: 'gift_pending' };
    const pending = getPendingGiftOut(S);
    if (!pending) return { ok: true, idle: true };
    return executePendingGift(S, pending, hooks, Boolean(hooks.resend), false);
  }

  function legacyGiftReceiptKey(msg) {
    return `${(msg && msg.from) || ''}:${(msg && msg.t) || ''}:${(msg && msg.cat) || ''}:${(msg && msg.item) || ''}`;
  }

  function giftReceiptKey(msg, recordId = '') {
    if (msg && typeof msg.gid === 'string' && msg.gid.trim()) {
      return 'gid:' + msg.gid.trim().slice(0, 40);
    }
    if (typeof recordId === 'string' && recordId.trim()) {
      return 'id:' + recordId.trim().slice(0, 40);
    }
    return legacyGiftReceiptKey(msg);
  }

  /** Receive a wrapped gift on Home: deduplicated; awards 100% Coins if recipient already owns it. */
  function receiveShopGift(S, msg, hooks = {}) {
    if (!msg || msg.k !== 'shop_gift') return { ok: false, reason: 'invalid_gift' };
    const hasGid = Boolean(msg && typeof msg.gid === 'string' && msg.gid.trim());
    const key = giftReceiptKey(msg, hooks.recordId || '');
    const legacyKey = hasGid ? '' : legacyGiftReceiptKey(msg);
    if (!S.giftsSeen) S.giftsSeen = {};
    if (S.giftsSeen[key] || (legacyKey && S.giftsSeen[legacyKey])) {
      return { ok: false, reason: 'duplicate_event' };
    }
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
    return {
      ok: true,
      key,
      gid: (msg && typeof msg.gid === 'string' && msg.gid) || '',
      alreadyOwned,
      refundCoins,
      item,
      fromName: msg.name || '',
    };
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

  const UNDO_RULES = RULES.undo;
  const PEEK_RULES = RULES.peek;

  const UNDO_SPEC = Object.freeze({
    id: 'undo',
    rules: UNDO_RULES,
    stockKey: 'undoStock',
    freeKey: 'freeUndo',
    boughtKey: 'boughtUndo',
    freeLog: 'undo_free',
    buyId: 'undo',
    levelKey: 'undoUsed',
    useLog: 'undo_use',
  });

  const PEEK_SPEC = Object.freeze({
    id: 'peek',
    rules: PEEK_RULES,
    stockKey: 'peekStock',
    freeKey: 'freePeek',
    boughtKey: 'boughtPeek',
    freeLog: 'peek_free',
    buyId: 'peek',
    levelKey: 'peekUsed',
    useLog: 'peek_use',
  });

  // Exact `TEXT` shape used by `source/www/js/lang.js` (`key: [nl, en]`, zero trailing `.` on single sentences, no `💰`)

  function mergeRules(base, overrides) {
    return overrides ? Object.assign({}, base, overrides) : base;
  }

  /**
   * Normalize helper stocks/coins and ensure `S.wk` is on the current Monday–Sunday week.
   * Always delegates rollover to `hooks.ensureWeek()` when supplied so Monday snapshots (`S.prevWk`,
   * `S.lastWeek`, `S.bestWeekPts`, `save()`, `pushScore()`) are never clobbered.
   */
  function ensureHelperWeek(S, spec, now = new Date(), rulesOverrides, hooks = {}) {
    const r = mergeRules(spec.rules, rulesOverrides);
    const undoMaxBuy = spec.id === 'undo' ? r.maxBuyPerWeek : UNDO_RULES.maxBuyPerWeek;
    const peekMaxBuy = spec.id === 'peek' ? r.maxBuyPerWeek : PEEK_RULES.maxBuyPerWeek;
    const wkId = weekIdOf(now);
    const wasDifferent = !S.wk || S.wk.id !== wkId || (S.wk.v !== undefined && S.wk.v !== 2);

    S.undoStock = clampInt(S.undoStock, 0, spec.id === 'undo' ? r.maxStock : UNDO_RULES.maxStock);
    S.peekStock = clampInt(S.peekStock, 0, spec.id === 'peek' ? r.maxStock : PEEK_RULES.maxStock);
    S.coins = Math.max(0, Math.floor(Number(S.coins) || 0));

    if (typeof hooks.ensureWeek === 'function') {
      hooks.ensureWeek();
    } else if (wasDifferent) {
      S.wk = newWeekObj(now);
    }

    if (S.wk) {
      S.wk.freeUndo = Boolean(S.wk.freeUndo);
      S.wk.boughtUndo = clampInt(S.wk.boughtUndo, 0, undoMaxBuy);
      S.wk.freePeek = Boolean(S.wk.freePeek);
      S.wk.boughtPeek = clampInt(S.wk.boughtPeek, 0, peekMaxBuy);
    }

    return { wk: S.wk, rolledOver: wasDifferent };
  }

  /**
   * Strictly read-only view of whether a player can claim the weekly free token or buy an extra one.
   * Never mutates `S`, `S.wk`, stock fields, or `S.coins`.
   */
  function helperStatus(S, spec, now = new Date(), rulesOverrides) {
    const r = mergeRules(spec.rules, rulesOverrides);
    const wkId = weekIdOf(now);
    const wkObj = S && S.wk;
    const sameWeek = Boolean(wkObj && wkObj.id === wkId && (wkObj.v === undefined || wkObj.v === 2));

    const stock = clampInt(S && S[spec.stockKey], 0, r.maxStock);
    const coins = Math.max(0, Math.floor(Number(S && S.coins) || 0));
    const freeClaimed = sameWeek ? Boolean(wkObj[spec.freeKey]) : false;
    const boughtThisWeek = sameWeek ? clampInt(wkObj[spec.boughtKey], 0, r.maxBuyPerWeek) : 0;
    const buyRemaining = Math.max(0, r.maxBuyPerWeek - boughtThisWeek);

    let freeReason = null;
    if (!r.enabled) freeReason = 'disabled';
    else if (freeClaimed) freeReason = 'already_claimed';
    else if (stock >= r.maxStock) freeReason = 'stock_full';

    let buyReason = null;
    if (!r.enabled) buyReason = 'disabled';
    else if (boughtThisWeek >= r.maxBuyPerWeek) buyReason = 'week_limit';
    else if (stock >= r.maxStock) buyReason = 'stock_full';
    else if (hasPendingGiftSpend(S)) buyReason = 'gift_pending';
    else if (coins < r.price) buyReason = 'not_enough_coins';

    return {
      id: spec.id,
      enabled: Boolean(r.enabled),
      weekId: wkId,
      price: r.price,
      stock,
      maxStock: r.maxStock,
      freeClaimed,
      boughtThisWeek,
      maxBuyPerWeek: r.maxBuyPerWeek,
      buyRemaining,
      canClaimFree: freeReason === null,
      freeReason,
      canBuy: buyReason === null,
      buyReason,
      needCoins: Math.max(0, r.price - coins),
      giftable: false,
    };
  }

  function undoStatus(S, now = new Date(), rulesOverrides) {
    return helperStatus(S, UNDO_SPEC, now, rulesOverrides);
  }

  function peekStatus(S, now = new Date(), rulesOverrides) {
    return helperStatus(S, PEEK_SPEC, now, rulesOverrides);
  }

  /**
   * Claim the weekly free token for a helper (`undo` or `peek`).
   * Intentionally does NOT consume the weekly flag when stock is already `maxStock`,
   * so the player keeps their weekly claim for later that week once they use one.
   */
  function claimFreeHelper(S, spec, hooks = {}, now = new Date(), rulesOverrides) {
    const r = mergeRules(spec.rules, rulesOverrides);
    if (!r.enabled) {
      return { ok: false, reason: 'disabled', status: helperStatus(S, spec, now, r) };
    }

    ensureHelperWeek(S, spec, now, r, hooks);
    const st = helperStatus(S, spec, now, r);
    if (!st.canClaimFree) {
      return { ok: false, reason: st.freeReason, status: st };
    }

    S.wk[spec.freeKey] = true;
    S[spec.stockKey] += 1;
    if (typeof hooks.save === 'function') hooks.save();
    if (typeof hooks.log === 'function') hooks.log(spec.freeLog, { stock: S[spec.stockKey] });

    return { ok: true, stock: S[spec.stockKey], status: helperStatus(S, spec, now, r) };
  }

  function claimFreeUndo(S, hooks = {}, now = new Date(), rulesOverrides) {
    return claimFreeHelper(S, UNDO_SPEC, hooks, now, rulesOverrides);
  }

  function claimFreePeek(S, hooks = {}, now = new Date(), rulesOverrides) {
    return claimFreeHelper(S, PEEK_SPEC, hooks, now, rulesOverrides);
  }

  /** Buy 1 extra helper token (max 2 bought/week, max 3 in stock) after confirm dialog. */
  function buyHelperToken(S, spec, hooks = {}, now = new Date(), rulesOverrides) {
    const r = mergeRules(spec.rules, rulesOverrides);
    if (!r.enabled) {
      return { ok: false, reason: 'disabled', need: 0, status: helperStatus(S, spec, now, r) };
    }

    ensureHelperWeek(S, spec, now, r, hooks);
    const st = helperStatus(S, spec, now, r);
    if (!st.canBuy) {
      return {
        ok: false,
        reason: st.buyReason,
        need: st.buyReason === 'not_enough_coins' ? st.needCoins : 0,
        status: st,
      };
    }

    if (!spendCoins(S, r.price)) {
      return { ok: false, reason: 'not_enough_coins', need: st.needCoins, status: st };
    }
    S[spec.stockKey] += 1;
    S.wk[spec.boughtKey] += 1;

    if (typeof hooks.save === 'function') hooks.save();
    if (typeof hooks.log === 'function') {
      hooks.log('shop_buy', {
        cat: 'helper',
        id: spec.buyId,
        p: r.price,
        wkBought: S.wk[spec.boughtKey],
        stock: S[spec.stockKey],
      });
    }

    return {
      ok: true,
      spent: r.price,
      coinsLeft: S.coins,
      stock: S[spec.stockKey],
      boughtThisWeek: S.wk[spec.boughtKey],
      status: helperStatus(S, spec, now, r),
    };
  }

  function buyUndoToken(S, hooks = {}, now = new Date(), rulesOverrides) {
    return buyHelperToken(S, UNDO_SPEC, hooks, now, rulesOverrides);
  }

  function buyPeekToken(S, hooks = {}, now = new Date(), rulesOverrides) {
    return buyHelperToken(S, PEEK_SPEC, hooks, now, rulesOverrides);
  }

  /** Shared live `board.js` lifecycle checks before consuming any board helper token. */
  function boardBusyReason(G) {
    if (!G || G.film) return 'no_board';
    if (G.done || G.busy || G.overShown || G.autoFin || G.introducing) return 'board_busy';
    if ((Number(G.flights) || 0) > 0) return 'tiles_in_flight';
    if (G.clockOut) return 'clock_out';
    return null;
  }

  /** True when at least one alive board tile is face-down (for Spieken). */
  function hasHiddenTilesOnBoard(G) {
    if (!G || !G.alive) return false;
    const n = G.tiles ? G.tiles.length : G.alive.length;
    for (let i = 0; i < n; i++) {
      if (G.alive[i] && G.down && G.down[i]) return true;
    }
    return false;
  }

  /**
   * Check whether a "Steen terugleggen" token can be used on the current level board.
   * Matches live `board.js` lifecycle guards; Prep A `checkClock()` must set `G.clockOut = true`.
   */
  function canUseUndoInLevel(S, G, rulesOverrides) {
    const r = mergeRules(UNDO_RULES, rulesOverrides);
    if (!r.enabled) return { ok: false, reason: 'disabled' };
    const busy = boardBusyReason(G);
    if (busy) return { ok: false, reason: busy };
    if (!Array.isArray(G.tray) || G.tray.length === 0) return { ok: false, reason: 'tray_empty' };
    if (G.arriving && typeof G.arriving.has === 'function' && G.tray.every(t => G.arriving.has(t))) {
      return { ok: false, reason: 'tiles_in_flight' };
    }
    if ((Number(G.undoUsed) || 0) >= r.maxUsePerLevel) return { ok: false, reason: 'level_limit' };
    if (clampInt(S && S.undoStock, 0, r.maxStock) <= 0) return { ok: false, reason: 'no_stock' };
    return { ok: true, reason: null };
  }

  /**
   * Check whether a "Spieken" face-down peek token can be used on the current level board.
   * Requires at least one alive face-down tile so tokens are never wasted when none exist.
   */
  function canUsePeekInLevel(S, G, rulesOverrides) {
    const r = mergeRules(PEEK_RULES, rulesOverrides);
    if (!r.enabled) return { ok: false, reason: 'disabled' };
    const busy = boardBusyReason(G);
    if (busy) return { ok: false, reason: busy };
    if (!hasHiddenTilesOnBoard(G)) return { ok: false, reason: 'nothing_hidden' };
    if ((Number(G.peekUsed) || 0) >= r.maxUsePerLevel) return { ok: false, reason: 'level_limit' };
    if (clampInt(S && S.peekStock, 0, r.maxStock) <= 0) return { ok: false, reason: 'no_stock' };
    return { ok: true, reason: null };
  }

  function recordHelperConsume(S, G, spec, r, hooks) {
    S[spec.stockKey] = clampInt(S && S[spec.stockKey], 0, r.maxStock) - 1;
    G[spec.levelKey] = (Number(G[spec.levelKey]) || 0) + 1;
    G.rescued = true; // Forfeits 3-star Shining Eremedaille (Perfect) and `nohelp` task

    if (typeof hooks.save === 'function') hooks.save();
    if (typeof hooks.logLvl === 'function') {
      hooks.logLvl(spec.useLog, { stock: S[spec.stockKey] });
    } else if (typeof hooks.log === 'function') {
      const lv = G.mode === 'level' ? G.level : S.level;
      hooks.log(spec.useLog, { lv, stock: S[spec.stockKey] });
    }
  }

  /**
   * Consume 1 "Steen terugleggen" token (max 1/level) and forfeit 3-star Perfect (`G.rescued = true`).
   * Callers MUST persist `undoUsed` (alongside `rescued` & parked spot) in `omamj.cur`, keep `G.mv`
   * unchanged, and clear `G.clock = null` if returning a former clock tile so it returns plain.
   */
  function consumeUndoInLevel(S, G, hooks = {}, rulesOverrides) {
    const r = mergeRules(UNDO_RULES, rulesOverrides);
    const check = canUseUndoInLevel(S, G, r);
    if (!check.ok) return check;
    recordHelperConsume(S, G, UNDO_SPEC, r, hooks);
    return { ok: true, stock: S.undoStock, undoUsed: G.undoUsed, rescued: true, perfect: false };
  }

  /**
   * Consume 1 "Spieken" token (max 1/level), forfeit 3-star Perfect (`G.rescued = true`),
   * and return `{ durationMs: 4500 }` for temporary face-down reveal (no `G.down` or `G.mv` mutation).
   */
  function consumePeekInLevel(S, G, hooks = {}, rulesOverrides) {
    const r = mergeRules(PEEK_RULES, rulesOverrides);
    const check = canUsePeekInLevel(S, G, r);
    if (!check.ok) return check;
    recordHelperConsume(S, G, PEEK_SPEC, r, hooks);
    return { ok: true, stock: S.peekStock, peekUsed: G.peekUsed, durationMs: r.durationMs, rescued: true, perfect: false };
  }

  /** Helpers are strictly non-giftable across family accounts. */
  function canGiftShopItem(cat, id) {
    return cat !== 'helper' && id !== 'undo' && id !== 'peek';
  }

  const exportsObj = {
    undoStatus,
    peekStatus,
    claimFreeUndo,
    claimFreePeek,
    buyUndoToken,
    buyPeekToken,
    canUseUndoInLevel,
    canUsePeekInLevel,
    consumeUndoInLevel,
    consumePeekInLevel,
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
    canGiftShopItem,
    hasPendingGiftSpend,
    sendShopGift,
    sendPostcard,
    resumePendingGift,
    giftReceiptKey,
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
