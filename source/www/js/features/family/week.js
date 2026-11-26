// uses: core/*, rules, lang, shop/catalog, shop/shop
/* Oma's Mahjong — family/week: the week (Monday to Sunday), my points and the result of last week. */
'use strict';

// ---- the week (Monday 00:00 to Sunday 23:59) ----
function weekInfo(d = new Date()) {
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const next = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
  return { id: dkey(mon), frac: Math.min(1, Math.max(0, (d - mon) / (next - mon))), msLeft: next - d };
}
/* The one week of the game is the v2 week in S.wk (see WeekEconomy below): the tile, my row and the upload read it.
   A new Monday starts a new week; last week's total waits in S.lastWeek for the podium and is not shown as this week. */
function ensureWeek() {
  const before = S.wk;
  WeekEconomy.ensureWeek(S);
  if (S.wk !== before) save();
  return S.wk;
}
function weekLeftText() {
  const ms = weekInfo().msLeft, d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5);
  return tx('weekLeft', d, h);
}

const myPoints = () => sum(S.lvlPts) + sum(S.dayPts) + S.bonusPts;
const myWeekPts = () => ensureWeek().pts;

// A rollover is judged only against a fresh successful score read. Keep it available
// while another Home dialog is open, so dismissing that dialog can show the result.
let lastWeekRead = null;
function checkLastWeek() {
  const last = S.lastWeek;
  if (!last || curScreen !== 'home' || !modalFree()) return;
  if (lastWeekRead?.id !== last.id) {
    const read = lastWeekRead = { id: last.id, ready: false, rows: null };
    const online = S.name && navigator.onLine ? fetchOnline() : Promise.resolve(false);
    online.then(async ok => {
      if (lastWeekRead !== read || S.lastWeek?.id !== read.id) return;
      read.rows = ok ? onlineEntries('all') : null;
      if (ok) await pushScore();
      read.ready = true;
      checkLastWeek();
    });
    return;
  }
  if (!lastWeekRead.ready) return;
  const result = WeekEconomy.evaluateLastWeekPodium(S, navigator.onLine ? lastWeekRead.rows : null);
  lastWeekRead = null;
  save();
  if (!result) return;
  const tier = [...SHOP_RULES.cups.tiers].reverse().find(c => result.myPts >= c.pt);
  const family = result.activeCount > 1;
  const roster = family ? result.podium.map(e => ({ ...e, id: e.pid, points: e.pts })) : [];
  const rows = family ? famHTML('week', roster, tx('famLastWeek'), false, true) : '';
  const award = result.wonWeek ? newTrophies() : [];
  Sound.unlock();
  openModal(`<div class="podium-icon">${result.wonWeek ? '👑' : '📅'}</div>
    <h2>${tx(result.wonWeek ? 'lastWeekWinner' : 'lastWeekSummary')}</h2>
    <p>${family ? tx('lastWeekRank', result.myRank) : tx('lastWeekPoints', fmtN(result.myPts))}
    ${tier ? '<br>' + tx('lastWeekCup', tier.ico, cupName(tier)) : ''}</p>
    <div class="week-podium">${rows}</div>
    <button class="big-btn play" id="lwOk"><span class="bb-text"><b>${tx('newWeek')} ▶</b></span></button>`, false);
  document.querySelectorAll('.week-podium .fr-sub').forEach(label => label.remove());
  $('#lwOk').onclick = () => {
    closeModal();
    if (award.length) showTrophies(award, renderHome);
    else renderHome();
  };
}

/* Prep A calculates points and Cup rewards with the win's other save changes. */
const WeekEconomy = (() => {
  const weekRules = SHOP_RULES.week;
  const cupRules = SHOP_RULES.cups;
  const tiers = cupRules.tiers;
  const diamond = tiers[tiers.length - 1];

  function count(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : 0;
  }

  function ensureWeek(state, now = new Date()) {
    const weekId = ShopEconomy.weekIdOf(now);
    const today = ShopEconomy.localDateKey(now);
    const old = state.wk;
    if (!old || old.id !== weekId || old.v !== weekRules.epoch) {
      const pts = count(old?.pts);
      const completed = old?.id && old.v === weekRules.epoch && pts > 0
        ? { id: old.id, pts, v: old.v }
        : null;
      state.prevWk = completed;
      state.lastWeek = completed && { ...completed };
      if (completed) state.bestWeekPts = Math.max(count(state.bestWeekPts), pts);
      state.wk = ShopEconomy.newWeekObj(now);
    } else if (old.day !== today) {
      old.day = today;
      old.dayWins = 0;
    }
    return state.wk;
  }

  function repeatCups(pts) {
    return Math.max(0, Math.floor((pts - diamond.pt) / cupRules.repeatStep));
  }

  function repeatCup(index) {
    return { id: 'post_' + index, pt: diamond.pt + index * cupRules.repeatStep, coins: cupRules.repeatCoins, ico: '✨' };
  }

  function awardWin(state, { mode, fresh, date }, now = new Date()) {
    const wk = ensureWeek(state, now);
    const oldPts = count(wk.pts);
    let ptAdded = 0;
    if (fresh && mode === 'level') {
      wk.dayWins = count(wk.dayWins) + 1;
      ptAdded = weekRules.steps[wk.dayWins - 1] ?? weekRules.minStep;
    } else if (fresh && mode === 'daily' && date === wk.day && date !== wk.dailyDone) {
      wk.dailyDone = date;
      ptAdded = weekRules.dailyPt;
    }

    const unlockedCups = [];
    if (!ptAdded) return { ptAdded, weekPts: oldPts, cupCoins: 0, unlockedCups };
    wk.pts = oldPts + ptAdded;
    if (!Array.isArray(wk.cups)) wk.cups = [];
    if (!state.stats) state.stats = {};

    for (const tier of tiers) {
      if (oldPts < tier.pt && wk.pts >= tier.pt && !wk.cups.includes(tier.id)) {
        wk.cups.push(tier.id);
        unlockedCups.push(tier);
        if (tier.id === diamond.id) state.stats.diamonds = count(state.stats.diamonds) + 1;
      }
    }

    const lastClaim = Math.max(count(wk.postDiamond), repeatCups(oldPts));
    const crossed = repeatCups(wk.pts);
    for (let index = lastClaim + 1; index <= crossed; index++) unlockedCups.push(repeatCup(index));
    wk.postDiamond = Math.max(lastClaim, crossed);
    if (unlockedCups.length) state.stats.cups = count(state.stats.cups) + unlockedCups.length;

    const best = count(state.bestWeekPts);
    if (!wk.prPaid && best >= cupRules.prMin && oldPts <= best && wk.pts > best) {
      wk.prPaid = true;
      unlockedCups.push({ id: 'pr', pt: wk.pts, coins: cupRules.prCoins, ico: '🏁' });
    }

    const cupCoins = unlockedCups.reduce((total, cup) => total + cup.coins, 0);
    if (cupCoins) ShopEconomy.addCoins(state, cupCoins);
    return { ptAdded, weekPts: wk.pts, cupCoins, unlockedCups };
  }

  function getCupGoalState(state, now = new Date()) {
    const wk = state.wk;
    const pts = wk?.v === weekRules.epoch && wk.id === ShopEconomy.weekIdOf(now) ? count(wk.pts) : 0;
    const nextIndex = tiers.findIndex(tier => pts < tier.pt);
    const currentTier = nextIndex === -1 ? diamond : tiers[nextIndex - 1] || null;
    const nextTier = nextIndex === -1 ? repeatCup(repeatCups(pts) + 1) : tiers[nextIndex];
    const previousAt = nextIndex === -1 ? nextTier.pt - cupRules.repeatStep : currentTier?.pt ?? 0;
    const pct = Math.round((pts - previousAt) * 100 / (nextTier.pt - previousAt));
    const best = count(state.bestWeekPts);
    const prMarkPct = best >= cupRules.prMin ? Math.min(98, Math.max(4, Math.round(best * 100 / diamond.pt))) : null;
    return {
      pts, currentTier, nextTier, pct, prMarkPct,
      nextAt: nextTier.pt, nextCoins: nextTier.coins, ptsToNext: nextTier.pt - pts,
    };
  }

  // Pass null when the Firebase fetch failed. A cached or solo row cannot win a cup.
  function evaluateLastWeekPodium(state, entries) {
    const last = state.lastWeek;
    state.lastWeek = null;
    if (!last?.id || last.v !== weekRules.epoch || !count(last.pts)) return null;

    if (!state.stats) state.stats = {};
    state.stats.weeks = count(state.stats.weeks) + 1;
    const online = Array.isArray(entries);
    const byId = new Map();
    if (online) {
      for (const entry of entries) {
        const pid = entry?.pid || entry?.id;
        if (!pid || pid === state.pid) continue;
        const pts = entry.wk === last.id && entry.wkV === weekRules.epoch
          ? count(entry.wkPts)
          : entry.prevWk === last.id ? count(entry.prevWkPts) : 0;
        if (pts > (byId.get(pid)?.pts ?? 0)) {
          byId.set(pid, { pid, name: entry.name || '', avatar: entry.avatar || '😊', pts, me: false });
        }
      }
    }

    const myPts = count(last.pts);
    const me = { pid: state.pid || '', name: state.name || 'Jij', avatar: state.avatar || '😊', pts: myPts, me: true };
    const ranked = [me, ...byId.values()].sort((a, b) => b.pts - a.pts);
    const myRank = ranked.indexOf(me) + 1;
    const wonWeek = online && Boolean(state.pid) && ranked.length > 1 && myRank === 1 && state.lastWeekAwarded !== last.id;
    if (wonWeek) {
      state.lastWeekAwarded = last.id;
      state.weekWins = count(state.weekWins) + 1;
    }

    return { weekId: last.id, myPts, online, activeCount: ranked.length, myRank, wonWeek, podium: online ? ranked.slice(0, 3) : [] };
  }

  return { ensureWeek, awardWin, getCupGoalState, evaluateLastWeekPodium };
})();
