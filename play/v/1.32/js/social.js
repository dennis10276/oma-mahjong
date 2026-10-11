/* Oma's Mahjong — the leaderboard: family online, computer players, the weekly challenge,
   the profile with avatar frames, and climbing past others (hearts are in hearts.js). */
'use strict';

// ---------- ranking (family online + friendly computer players) ----------
const LB_CACHE = 'omamj.lb';
// the friendly computer players (name, avatar), from the slowest to the strongest
const BOTS = [
  ['Ria', '🧁'], ['Joke', '🚲'], ['Henk', '🧀'], ['Tante Riet', '🌷'], ['Opa Kees', '🎣'], ['Buurvrouw Ans', '🐈'],
  ['Mien', '🧶'], ['Gerrit', '🌳'], ['Truus', '☕'], ['Wim', '🎺'], ['Corrie', '🌸'],
  ['Bep', '🍰'], ['Jan', '⛵'], ['Greet', '🐦'], ['Klaas', '🚜'], ['Lies', '💐'], ['Juffrouw Bos', '📚'], ['Meester Dekker', '🎩'],
];
const BOT_FRAMES = ['none', 'none', 'bronze', 'none', 'bronze', 'none', 'silver', 'none', 'bronze', 'silver', 'none', 'gold', 'silver', 'none', 'gold', 'sun', 'gold', 'crown'];
// rough points for playing level l (pairs × average combo points + star bonus)
const levelPts = l => Math.round(Layouts.targetFor(Math.max(1, Math.round(Layouts.effLevel(l)))) / 2 * 24 + 120);
const cumPts = L => { let p = 0; for (let l = 1; l <= Math.floor(L); l++) p += levelPts(l); return Math.round(p + (L % 1) * levelPts(Math.floor(L) + 1)); };

// ---- the week (Monday 00:00 to Sunday 23:59) ----
function weekInfo(d = new Date()) {
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const next = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
  return { id: dkey(mon), frac: Math.min(1, Math.max(0, (d - mon) / (next - mon))), msLeft: next - d };
}
function ensureWeek() {
  const w = weekInfo();
  if (!S.wk || S.wk.id !== w.id) {
    if (S.wk && S.wk.pts > 0) S.lastWeek = { id: S.wk.id, pts: S.wk.pts };
    S.wk = { id: w.id, pts: 0 };
    save();
  }
  return S.wk;
}
function weekLeftText() {
  const ms = weekInfo().msLeft, d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5);
  return tx('weekLeft', d, h);
}

/* Believable computer players: they always play around YOUR level.
   Every morning they line up around the level you start the day with (some a bit behind,
   some a bit ahead) and during the day they play on at their own pace, which follows how
   fast you usually go. Play more than usual and you pass them; take a break and they pull
   ahead. Their points match their level, using what real players score per level. */
const BOT_OFF  = [-14, -11, -9, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 5, 7, 10, 14];
const BOT_PACE = [0.6, 1.3, 0.8, 1.1, 0.7, 1.25, 0.9, 1.0, 1.15, 0.75, 1.05, 0.95, 1.2, 0.85, 1.1, 0.8, 1.0, 0.9];
const BOT_SKILL = [0.92, 1.06, 0.97, 1.1, 0.9, 1.03, 0.95, 1.08, 0.99, 0.93, 1.04, 0.96, 1.07, 0.94, 1.02, 0.98, 1.09, 1.0];
function dayAnchor() {
  const tk = todayKey();
  if (!S.lvlHist[tk]) {
    S.lvlHist[tk] = S.level;
    Object.keys(S.lvlHist).filter(k => k < dkey(new Date(Date.now() - 14 * 864e5))).forEach(k => delete S.lvlHist[k]);
    save();
  }
  // how many levels a day you usually play (last week), 5 to start with
  const past = Object.keys(S.lvlHist).filter(k => k < tk).sort();
  let avg = 5;
  if (past.length) { const k0 = past[Math.max(0, past.length - 7)]; const days = Math.max(1, Math.round((parseKey(tk) - parseKey(k0)) / 864e5)); avg = (S.lvlHist[tk] - S.lvlHist[k0]) / days; }
  return { start: S.lvlHist[tk], avg: Math.max(2, Math.min(30, avg)) };
}
// part of today's playing time that has passed (8:00 to 22:00)
const dayFrac = () => { const d = new Date(); return Math.min(1, Math.max(0, (d.getHours() + d.getMinutes() / 60 - 8) / 14)); };
// what you score per level compared with the rough model (real players: combos, stars, chests)
const ptsCalib = () => S.level > 3 ? Math.max(0.6, Math.min(2.2, myPoints() / Math.max(1, cumPts(S.level - 1)))) : 1;
function botEntries(mode = 'all', weekId, frac) {
  const { start, avg } = dayAnchor(), df = dayFrac(), cal = ptsCalib();
  let changed = false;
  const list = BOTS.map(([name, avatar], k) => {
    let lv = Math.max(1, start + BOT_OFF[k] + Math.floor(avg * BOT_PACE[k] * df));
    if ((S.botLv[k] || 0) > lv) lv = S.botLv[k]; else if (S.botLv[k] !== lv) { S.botLv[k] = lv; changed = true; }   // never go back down
    let points;
    if (mode === 'week') {
      const w = weekInfo();
      const f = weekId && weekId !== w.id ? 1 : (frac ?? w.frac);
      const levelsThisWeek = Math.min(lv - 1, avg * BOT_PACE[k] * 7 * f);   // can't have played more levels than it has
      points = Math.round(levelsThisWeek * levelPts(lv) * cal * BOT_SKILL[k]);
    } else points = Math.round(cumPts(lv - 1) * cal * BOT_SKILL[k]);
    return { id: 'bot' + k, name, avatar, frame: BOT_FRAMES[k], points, level: lv, bot: true };
  });
  if (changed) save();
  return list;
}
const myPoints = () => sum(S.lvlPts) + sum(S.dayPts) + S.bonusPts;
const myWeekPts = () => ensureWeek().pts;
// v = my weekly points (week) or my level (all-time); undefined = my current value
function myEntry(v, mode = 'all') {
  const all = mode !== 'week';
  return { id: S.pid, name: S.name || tx('you'), avatar: S.avatar || '😊', frame: S.frame || 'none', points: all ? myPoints() : (v ?? myWeekPts()), level: all ? (v ?? S.level) : S.level, me: true };
}
function onlineEntries(mode = 'all', weekId) {
  let list = [];
  try { list = (JSON.parse(localStorage.getItem(LB_CACHE) || '[]') || []).filter(e => e.id !== S.pid); } catch (e) { }
  if (mode === 'week') { const id = weekId || weekInfo().id; list = list.map(e => ({ ...e, points: e.wk === id ? (e.wkPts || 0) : 0 })); }
  return list;
}
/* week = points this week; all-time ("Altijd") = highest level, points only break a tie */
function ranking(v, mode = 'all') {
  const list = [...botEntries(mode), ...onlineEntries(mode), myEntry(v, mode)];
  // on a tie you are placed above the other player
  if (mode === 'week') list.sort((a, b) => b.points - a.points || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  else list.sort((a, b) => b.level - a.level || b.points - a.points || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  return list;
}
const myRank = (v, mode = 'all') => ranking(v, mode).findIndex(e => e.me) + 1;
const isFam = e => !e.bot && !e.me;
// value shown on the right of a row
const rowVal = (e, mode) => mode === 'week' ? fmtN(e.points) : tx('levelWord', e.level);
/* the family (real players) at a glance: everyone with their place */
function famHTML(mode, list, title = tx('family'), withHearts = false) {
  list = list || ranking(undefined, mode);
  const fam = list.map((e, i) => ({ e, r: i + 1 })).filter(x => !x.e.bot);
  if (fam.length < 2) return '';
  return `<div class="fam-box"><div class="fam-title">${title}</div>${fam.map(({ e, r }) => `<div class="fam-row${e.me ? ' me' : ''}"><span class="fr-rank">${medal(r)}</span>${avatarHTML(e)}<span class="fr-name">${esc(e.name)}${e.me ? ` <i>${tx('youTag')}</i>` : ''}<small class="fr-sub">${mode === 'week' ? `🧩 ${tx('levelWord', e.level)}` : tx('points', fmtN(e.points))}</small>${!e.me ? heartState(e.id) : ''}</span><span class="fr-val">${rowVal(e, mode)}${withHearts && !e.me ? heartBtn(e) : ''}</span></div>`).join('')}</div>`;
}
function ensureId() { if (!S.pid) { S.pid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); save(); } }
async function fetchOnline() {
  if (!DB_URL) return false;
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(dbUrl('scores'), { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(to);
    if (!res.ok) return false;
    const data = await res.json() || {};
    const list = Object.entries(data).filter(([id, v]) => v && typeof v.points === 'number' && !id.startsWith('test-') && !String(v.name || '').startsWith('test-'))
      .map(([id, v]) => ({ id, name: String(v.name || '?').slice(0, 24), avatar: String(v.avatar || '🙂').slice(0, 8), frame: String(v.frame || 'none').slice(0, 12), points: v.points, level: v.level || 1, wk: v.wk || '', wkPts: v.wkPts || 0 }));
    localStorage.setItem(LB_CACHE, JSON.stringify(list));
    S.lbOnlineAt = Date.now(); save();
    return true;
  } catch (e) { return false; }
}
async function pushScore() {
  if (!DB_URL || !S.name) return;
  ensureId();
  const base = { name: S.name.slice(0, 24), avatar: (S.avatar || '😊').slice(0, 8), points: myPoints(), level: S.level, t: Date.now() };
  const full = { ...base, frame: (S.frame || 'none').slice(0, 12), wk: ensureWeek().id, wkPts: S.wk.pts };
  try {
    const r = await dbSend(`scores/${S.pid}`, full);
    // older database rules only know the basic fields: fall back to those
    if (!r.ok) await dbSend(`scores/${S.pid}`, base);
  } catch (e) { }
}

// ---- avatar frames, earned through prizes ----
// (names in lang.js: fr_<id>; how = how you earn it)
const FRAMES = [
  { id: 'none', ok: () => true, how: () => '' },
  { id: 'bronze', ok: () => trophyCount() >= 4, how: () => tx('how_prizes', 4) },
  { id: 'silver', ok: () => trophyCount() >= 8, how: () => tx('how_prizes', 8) },
  { id: 'gold', ok: () => trophyCount() >= 12, how: () => tx('how_prizes', 12) },
  { id: 'sun', ok: () => sunUnlocked(), how: () => tx('how_level', RULES.sunflower.level) },
  { id: 'heart', ok: () => (S.stats.hearts || 0) >= 3, how: () => tx('how_hearts') },
  { id: 'rainbow', ok: () => !!S.trophies.c5, how: () => tx('how_combo') },
  { id: 'crown', ok: () => S.weekWins >= 1, how: () => tx('how_week') },
];
FRAMES.forEach(f => Object.defineProperty(f, 'name', { get: () => tx('fr_' + f.id) }));
const frameOk = id => (FRAMES.find(f => f.id === id) || FRAMES[0]).ok();
const avatarHTML = (e, cls = 'ra') => `<span class="${cls} fr-${e.frame && e.frame !== 'none' ? e.frame : 'none'}">${e.avatar}</span>`;

const AVATARS = ['👵', '👴', '😊', '🌻', '🐱', '🐶', '🌷', '⭐', '🦋', '🍀', '🎩', '🚀'];
function askName(then) {
  const cur = S.name || '';
  let av = S.avatar || '👵', fr = frameOk(S.frame || 'none') ? (S.frame || 'none') : 'none';
  openModal(`<h2>${tx(cur ? 'profile' : 'whatName')}</h2>
    <p>${tx('nameWhy')}</p>
    <input id="nmIn" class="name-in" maxlength="20" value="${cur.replace(/"/g, '')}" placeholder="${tx('namePh')}" autocomplete="off">
    <div class="quick-names">${tx('quickNames').map(n => `<button class="qn">${n}</button>`).join('')}</div>
    <div class="avatars">${AVATARS.map(a => `<button class="av${av === a ? ' on' : ''}">${a}</button>`).join('')}</div>
    <h3 class="fr-title">${tx('frameTitle')}</h3>
    <div class="frames">${FRAMES.map(f => `<button class="frm${fr === f.id ? ' on' : ''}${f.ok() ? '' : ' locked'}" data-f="${f.id}"><span class="ra fr-${f.id}">${av}</span><small>${f.ok() ? f.name : '🔒 ' + f.how()}</small></button>`).join('')}</div>
    <button class="big-btn play" id="nmOk"><span class="bb-text"><b>${tx('save')}</b></span></button>`, false);
  document.querySelectorAll('.qn').forEach(b => b.onclick = () => { $('#nmIn').value = b.textContent; });
  document.querySelectorAll('.av').forEach(b => b.onclick = () => { av = b.textContent; document.querySelectorAll('.av').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.frm .ra').forEach(x => x.textContent = av); });
  document.querySelectorAll('.frm').forEach(b => b.onclick = () => {
    const f = FRAMES.find(x => x.id === b.dataset.f);
    if (!f.ok()) { toast(tx('frameHow', f.how())); Sound.blocked(); return; }
    fr = f.id; document.querySelectorAll('.frm').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#nmOk').onclick = () => {
    const v = $('#nmIn').value.trim().replace(/[<>]/g, '').slice(0, 20);
    if (!v) { $('#nmIn').focus(); toast(tx('nameFirst')); return; }
    S.name = v; S.avatar = av; S.frame = fr; ensureId(); save(); closeModal(); pushScore(); startHeartStream(); if (then) then();
  };
}

function rowHTML(e, rank, withHeart = false, mode = 'week') {
  const heart = withHeart && !e.me && !e.bot ? heartBtn(e) : '';
  const sub = mode === 'week' ? tx('levelWord', e.level) : tx('points', fmtN(e.points));
  return `<span class="rk">${medal(rank)}</span>${avatarHTML(e)}<span class="rn">${esc(e.name)}${e.me ? ` <i>${tx('youTag')}</i>` : ''}${e.bot ? ` <i class="bot" title="${tx('botTitle')}">🤖</i>` : e.me ? '' : ' <i class="fam-tag">👪</i>'}<small>${sub}</small></span><span class="rp">${rowVal(e, mode)}${heart}${chatBtn(e)}</span>`;
}
let rankMode = 'week';
function renderRanking() {
  ensureId(); ensureWeek();
  const list = ranking(undefined, rankMode);
  const me = list.findIndex(e => e.me);
  $('#rkMine').textContent = (rankMode === 'week' ? '📅 #' : '🏆 #') + (me + 1);
  $('#rkWeek').classList.toggle('on', rankMode === 'week');
  $('#rkAll').classList.toggle('on', rankMode === 'all');
  $('#wkInfo').innerHTML = rankMode === 'week'
    ? tx('weekInfo', weekLeftText())
    : tx('allInfo');
  $('#famBox').innerHTML = famHTML(rankMode, list, tx('family'), true);
  $('#rankList').innerHTML = list.map((e, i) => `<div class="rrow${e.me ? ' me' : ''}${isFam(e) ? ' fam' : ''}">${rowHTML(e, i + 1, true, rankMode)}</div>`).join('');
  document.querySelectorAll('.vg-chat').forEach(b => b.onclick = ev => { ev.stopPropagation(); openWho(b.dataset.who); });
  document.querySelectorAll('.heart-btn').forEach(b => b.onclick = ev => { ev.stopPropagation(); if (!b.classList.contains('sent')) sendHeart(b.dataset.pid, b.dataset.name, b); else toast(tx('heartAlreadyShort')); });
  const online = !!DB_URL;
  $('#rankNote').innerHTML = tx(online ? 'rankNoteOnline' : 'rankNoteBots');
  $('#rankName').innerHTML = `${avatarHTML(myEntry(0), 'ra small')} ${S.name ? esc(S.name) : tx('pickName')} ✏️`;
  setTimeout(() => { const m = document.querySelector('.rrow.me'); if (m) m.scrollIntoView({ block: 'center' }); }, 30);
  if (online && (!S.lbOnlineAt || Date.now() - S.lbOnlineAt > 20000)) fetchOnline().then(ok => { if (ok && curScreen === 'ranking') renderRanking(); });
  if (online && Date.now() - (sentCheckAt || 0) > 8000) { sentCheckAt = Date.now(); checkSentHearts().then(ch => { if (ch && curScreen === 'ranking') renderRanking(); }); }
}

// result of last week, shown once on the home screen
function checkLastWeek() {
  if (!S.lastWeek || !modalFree()) return;
  const lw = S.lastWeek; S.lastWeek = null;
  const list = [...botEntries('week', lw.id, 1), ...onlineEntries('week', lw.id), { ...myEntry(lw.pts, 'week'), points: lw.pts }]
    .sort((a, b) => b.points - a.points || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  const rank = list.findIndex(e => e.me) + 1;
  bumpStat('weeks');
  if (rank === 1) S.weekWins++;
  save();
  if (rank <= 3) { Sound.trophy(); FX.confetti(); } else Sound.unlock();
  openModal(`<div class="sun-big">${rank <= 3 ? medal(rank) : '🏅'}</div><h2>${tx('lastWeekTitle', rank)}</h2>
    <p>${tx('lastWeekText', fmtN(lw.pts), rank)}</p>
    <p class="note">${tx('newWeekNote')}</p>
    <button class="big-btn play" id="lwOk"><span class="bb-text"><b>${tx('newWeek')}</b></span></button>`, false);
  $('#lwOk').onclick = () => { closeModal(); renderHome(); };
}

/* The dopamine moment: your row climbs past the people you just overtook. */
function showClimb(oldPts, newPts, then, mode = 'all') {
  const before = ranking(oldPts, mode), after = ranking(newPts, mode);
  const oldRank = before.findIndex(e => e.me) + 1, newRank = after.findIndex(e => e.me) + 1;
  const passed = after.slice(newRank, oldRank);          // the people you overtook (closest last)
  const above = after[newRank - 2];                       // the next target
  const show = passed.slice(-3);                          // animate at most 3 overtakes (fits on the screen)
  const rows = [...(above ? [above] : []), ...show];
  const RH = 46;
  const startIdx = (above ? 1 : 0) + show.length;         // where your row starts (below the others)
  const offset = passed.length - show.length;             // overtakes too far up to animate
  // rank shown on a row: before being overtaken it is one place higher than at the end
  const rankOf = (k, done) => {
    if (above && k === 0) return newRank - 1;
    const j = k - (above ? 1 : 0);
    const finalRank = newRank + offset + j + 1;
    return done ? finalRank : finalRank - 1;
  };
  openModal(`<h2>${tx(mode === 'week' ? 'climbWeek' : 'climbAll')}</h2>
    <div class="climb" style="height:${(rows.length + 1) * RH}px">
      ${rows.map((e, k) => `<div class="rrow crow${isFam(e) ? ' fam' : ''}" data-k="${k}" style="transform:translateY(${k * RH}px)">${rowHTML(e, rankOf(k, false), false, mode)}</div>`).join('')}
      <div class="rrow me crow" id="meRow" style="transform:translateY(${startIdx * RH}px)">${rowHTML(myEntry(oldPts, mode), oldRank, false, mode)}</div>
    </div>
    <div class="climb-msg" id="climbMsg">&nbsp;</div>
    <button class="big-btn play" id="clOk"><span class="bb-text"><b>${tx('next')}</b></span></button>`, false, null, 'compact');
  let stopped = false;   // tapping "Verder" early stops the animation cleanly
  $('#clOk').onclick = () => { stopped = true; closeModal(); then(); };
  const me = $('#meRow');
  const rowsEls = [...document.querySelectorAll('.crow[data-k]')];
  let pos = startIdx, k = 0;
  const steps = show.length;
  const stepTime = Math.max(380, Math.min(650, 2400 / Math.max(1, steps)));
  function step() {
    if (stopped) return;
    if (k >= steps) return finish();
    const victimIdx = startIdx - 1 - k;                  // the row right above you
    const victim = rowsEls[victimIdx];
    pos--; k++;
    me.style.transform = `translateY(${pos * RH}px) scale(1.04)`;
    victim.style.transform = `translateY(${(victimIdx + 1) * RH}px)`;
    victim.querySelector('.rk').textContent = medal(rankOf(victimIdx, true));
    const rank = oldRank - (passed.length - show.length) - k;
    me.querySelector('.rk').textContent = medal(rank);
    const pts = Math.round(oldPts + (newPts - oldPts) * k / steps);
    me.querySelector('.rp').textContent = mode === 'week' ? fmtN(pts) : tx('levelWord', pts);
    Sound.pass(k); buzz(15);
    const r = me.getBoundingClientRect(); FX.burst(r.left + r.width * 0.15, r.top + r.height / 2, 10);
    setTimeout(step, stepTime);
  }
  function finish() {
    if (stopped || !$('#climbMsg')) return;
    me.style.transform = `translateY(${pos * RH}px)`;
    me.querySelector('.rp').textContent = mode === 'week' ? fmtN(newPts) : tx('levelWord', newPts);
    me.querySelector('.rk').textContent = medal(newRank);
    me.classList.add('glow');
    Sound.rankUp(); FX.confetti(); buzz([30, 50, 30, 50, 60]);
    const n = passed.length;
    const who = n === 1 ? tx('passedOne', esc(passed[0].name)) : tx('passedMany', n);
    const gap = mode === 'week' ? tx('points', fmtN(above ? above.points - newPts + 1 : 0)) : (above ? tx('levelsN', above.level - newPts + 1) : '');
    const nxt = above ? `<br><small>${tx('gapTo', gap, above.avatar + ' ' + esc(above.name))}</small>` : `<br><small>${tx('onTop')}</small>`;
    const wk = mode === 'week' ? `<br><small>${tx('weekEnds', weekLeftText())}</small>` : '';
    $('#climbMsg').innerHTML = `<span class="climb-up">#${oldRank} → #${newRank} ⬆</span><br>${who}${nxt}${wk}`;
  }
  setTimeout(() => { if (!stopped) step(); }, 650);
}
