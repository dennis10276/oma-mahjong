// uses: core/*, rules, lang, features/shop/shop, family/presence, grandma/grandma
/* Oma's Mahjong — restore/restore: take over an existing player on a new phone (or after iOS wiped
   the save) with a code from the family dashboard (Dennis, 2026-11-27, Rashmi lost her progress).

   The dashboard writes { k: 'cfg', t, restore: '<CODE>' } into plays/cfg-<pid> (valid 24 hours).
   Here the player types the code; the app finds the player whose newest restore code it is, rebuilds
   the save from scores/<pid> (name, avatar, level, points) and plays/<pid> (every won level with
   its stars, points and tries), runs it through the normal migration of an old save (coins, themes,
   frames) and takes over the pid. Then the code is cleared (restore: ''). */
'use strict';

// (RESTORE, restoreClean and restoreCodeIn live in rules.js: the dashboard uses them too)

/* The save, rebuilt from the database. Pure: score = scores/<pid>, events = Object.values(plays/<pid>),
   cfg = this player's dashboard settings, keep = this phone's own choices (sound, language). */
function buildRestoredSave(pid, score, events, cfg = {}, keep = {}, now = new Date()) {
  const stars = {}, lvlPts = {}, daily = {}, dayPts = {}, att = {};
  let bonusStars = 0, maxWon = 0;
  for (const e of events || []) {
    if (!e || typeof e !== 'object') continue;
    if (e.k === 'gift') bonusStars += Math.max(0, Number(e.stars) || 0);
    if (e.k === 'start' && e.m !== 'd' && e.lv) att['L' + e.lv] = Math.max(att['L' + e.lv] || 0, Number(e.at) || 1);
    if (e.k !== 'end' || e.r !== 'win') continue;
    const st = Math.max(0, Math.min(3, Number(e.st) || 0)), sc = Math.max(0, Number(e.sc) || 0);
    if (e.m === 'd' && e.d) {
      daily[e.d] = Math.max(daily[e.d] || 0, st); dayPts[e.d] = Math.max(dayPts[e.d] || 0, sc);
    } else if (e.lv) {
      stars[e.lv] = Math.max(stars[e.lv] || 0, st); lvlPts[e.lv] = Math.max(lvlPts[e.lv] || 0, sc);
      maxWon = Math.max(maxWon, e.lv);
    }
  }
  const s = score || {};
  const level = Math.max(1, Number(s.level) || 1, maxWon + 1);
  const known = sum(lvlPts) + sum(dayPts);
  const raw = {
    ...keep,
    pid, name: String(s.name || '').slice(0, 24), avatar: String(s.avatar || '😊').slice(0, 8), frame: String(s.frame || 'none').slice(0, 16),
    title: String(s.title || '').slice(0, 16),
    level, stars, lvlPts, daily, dayPts, att, bonusStars,
    bonusPts: Math.max(0, (Number(s.points) || 0) - known),   // gifts, chests and tasks: the rest of the points on the leaderboard
    seenIntro: true, sunSeen: level > RULES.sunflower.level,
    seenSp: { ...(keep.seenSp || {}), ...(level > 35 ? { ice: true } : {}), ...(level > 45 ? { lock: true } : {}), ...(level > 50 ? { trayPair: true } : {}), ...(level > RULES.hard.clockFrom ? { clock: true, clockMoves: true } : {}) },
    redoDone: cfg.redoId || undefined,   // an old "redo from level n" on the dashboard is not applied again
  };
  // weekly points only from the new week system (1.80+, wkV = the epoch); a player from an older version starts
  // the week at 0 like everyone else did. The all-time points (lvlPts + bonusPts) stay, as they did for the others.
  if (s.wk && s.wkV === SHOP_RULES.week.epoch) {
    raw.wk = { id: s.wk, v: s.wkV, pts: Math.max(0, Number(s.wkPts) || 0) };
    if (s.prevWk) raw.prevWk = { id: s.prevWk, v: s.wkV, pts: Math.max(0, Number(s.prevWkPts) || 0) };
  }
  // no econV: it goes through the same migration an old save of hers would have (coins, themes, frames)
  return ShopEconomy.loadAndMigrateSave(JSON.stringify(raw), now).S;
}

// find the player whose code this is (null when nobody's)
async function findRestoreCode(code) {
  const scores = await dbGet('scores') || {};
  const pids = Object.keys(scores).filter(id => !id.startsWith('test-') || id === 'test-restore');
  const found = await Promise.all(pids.map(async pid => {
    try { const ev = Object.values(await dbGet(`plays/${cfgKey(pid)}`) || {}); return restoreCodeIn(ev) === code ? { pid, score: scores[pid], ev } : null; } catch (e) { return null; }
  }));
  return found.find(Boolean) || null;
}

/* back: what to show when the player closes these screens (the name screen asks again) */
function askRestore(back = null) {
  openModal(`<h2>${tx('rcTitle')}</h2>
    <p>${tx('rcText')}</p>
    <input id="rcIn" class="name-in" maxlength="8" placeholder="ABC123" autocomplete="off" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase;letter-spacing:4px;text-align:center">
    <p id="rcMsg" class="rc-msg" style="min-height:1.4em;color:#a33"></p>
    <button class="big-btn play" id="rcGo"><span class="bb-text"><b>${tx('rcGo')}</b></span></button>
    <button class="link-btn" id="rcBack">${tx('close')}</button>`, true, back);
  $('#rcBack').onclick = closeModal;
  $('#rcGo').onclick = async () => {
    const code = restoreClean($('#rcIn').value), msg = $('#rcMsg'), btn = $('#rcGo');
    if (code.length !== RESTORE.len) { msg.textContent = tx('rcShort'); $('#rcIn').focus(); return; }
    btn.disabled = true; msg.style.color = ''; msg.textContent = tx('rcBusy');
    try {
      const hit = await findRestoreCode(code);
      if (!hit) { btn.disabled = false; msg.style.color = '#a33'; msg.textContent = tx('rcNone'); return; }
      const events = Object.values(await dbGet(`plays/${hit.pid}`) || {});
      const keep = { sfx: S.sfx, music: S.music, musicShuffle: !!S.musicShuffle, vibrate: S.vibrate, highlight: S.highlight, nums: S.nums, lang: S.lang, seenSp: S.seenSp, seenTray: S.seenTray, seenDown: S.seenDown };
      const next = buildRestoredSave(hit.pid, hit.score, events, playerCfg(hit.ev), keep);
      confirmRestore(next, code, back);
    } catch (e) { btn.disabled = false; msg.style.color = '#a33'; msg.textContent = tx('rcFail'); }
  };
}

function confirmRestore(next, code, back = null) {
  const mine = S.level > 1;
  openModal(`<h2>${tx('rcFound', esc(next.name))}</h2>
    <p style="font-size:40px;margin:6px 0">${esc(next.avatar)}</p>
    <p>${tx('rcWhat', next.level, totalStarsOf(next))}</p>
    ${mine ? `<p style="color:#a33">${tx('rcReplace', S.level)}</p>` : ''}
    <button class="big-btn play" id="rcYes"><span class="bb-text"><b>${tx('rcYes')}</b></span></button>
    <button class="link-btn" id="rcNo">${tx('close')}</button>`, true, back);
  $('#rcNo').onclick = closeModal;
  $('#rcYes').onclick = async () => {
    $('#rcYes').disabled = true; modalOnClose = null;   // (the page reloads: no way back to the name screen)
    Object.keys(S).forEach(k => delete S[k]);
    Object.assign(S, next);
    clearCur(); G = null;
    if (!save()) { toast(tx('rcFail')); return; }
    try { await dbSend(`plays/${cfgKey(S.pid)}`, { k: 'cfg', t: Date.now(), restore: '' }, 'POST'); } catch (e) { }   // the code is used up
    try { logEvt('restore', { lv: S.level }); } catch (e) { }
    try { await pushScore(); } catch (e) { }
    location.reload();
  };
}
const totalStarsOf = s => sum(s.stars) + sum(s.daily) + (s.bonusStars || 0);
