/* Oma's Mahjong — the leaderboard: family online, computer players, the weekly challenge, hearts and avatar frames. */
'use strict';

// ---------- ranking (family online + friendly computer players) ----------
// Firebase Realtime Database address; empty = only the computer players
const DB_URL = 'https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app';
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
  return d >= 1 ? `nog ${d} ${d === 1 ? 'dag' : 'dagen'}${h ? ` en ${h} uur` : ''}` : `nog ${Math.max(1, h)} uur`;
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
  S.lvlHist = S.lvlHist || {};
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
  S.botLv = S.botLv || {};
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
const myPoints = () => Object.values(S.lvlPts || {}).reduce((a, b) => a + b, 0) + Object.values(S.dayPts || {}).reduce((a, b) => a + b, 0) + (S.bonusPts || 0);
const myWeekPts = () => ensureWeek().pts;
// v = my weekly points (week) or my level (all-time); undefined = my current value
function myEntry(v, mode = 'all') {
  const all = mode !== 'week';
  return { id: S.pid, name: S.name || 'Jij', avatar: S.avatar || '😊', frame: S.frame || 'none', points: all ? myPoints() : (v ?? myWeekPts()), level: all ? (v ?? S.level) : S.level, me: true };
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
const rowVal = (e, mode) => mode === 'week' ? e.points.toLocaleString('nl-NL') : `level ${e.level}`;
/* the family (real players) at a glance: everyone with their place */
function famHTML(mode, list, title = '👪 Familie', withHearts = false) {
  list = list || ranking(undefined, mode);
  const fam = list.map((e, i) => ({ e, r: i + 1 })).filter(x => !x.e.bot);
  if (fam.length < 2) return '';
  const medal = r => r <= 3 ? ['🥇', '🥈', '🥉'][r - 1] : '#' + r;
  return `<div class="fam-box"><div class="fam-title">${title}</div>${fam.map(({ e, r }) => `<div class="fam-row${e.me ? ' me' : ''}"><span class="fr-rank">${medal(r)}</span>${avatarHTML(e)}<span class="fr-name">${e.name}${e.me ? ' <i>(jij)</i>' : ''}<small class="fr-sub">${mode === 'week' ? `🧩 level ${e.level}` : `${e.points.toLocaleString('nl-NL')} punten`}</small>${!e.me ? heartState(e.id) : ''}</span><span class="fr-val">${rowVal(e, mode)}${withHearts && !e.me ? heartBtn(e) : ''}</span></div>`).join('')}</div>`;
}
function ensureId() { if (!S.pid) { S.pid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); save(); } }
async function fetchOnline() {
  if (!DB_URL) return false;
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(DB_URL + '/scores.json', { signal: ctl.signal, cache: 'no-store' });
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
    const r = await fetch(`${DB_URL}/scores/${S.pid}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(full) });
    // older database rules only know the basic fields: fall back to those
    if (!r.ok) await fetch(`${DB_URL}/scores/${S.pid}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(base) });
  } catch (e) { }
}

// ---- hearts between family members ----
async function sendHeart(pid, name, btn) {
  if (!S.name) return askName(() => sendHeart(pid, name, btn));
  S.heartsSent = S.heartsSent || {};
  if (S.heartsSent[pid] === todayKey()) { toast(`Je hebt ${name} vandaag al een hartje gestuurd 💛`); return; }
  ensureId();
  try {
    const r = await fetch(`${DB_URL}/hearts/${pid}/${S.pid}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: S.name.slice(0, 24), t: Date.now() }) });
    if (!r.ok) throw 0;
    S.heartsSent[pid] = todayKey(); bumpStat('heartsSent'); save();
    logEvt('heart_out', { to: name });
    Sound.unlock(); buzz(20);
    if (btn) { btn.classList.add('sent'); btn.textContent = '💛✓'; }
    S.heartsOut = S.heartsOut || {}; S.heartsOut[pid] = { t: Date.now(), seen: 0, name }; save();
    showHeartSent(name);
  } catch (e) { toast('Hartje versturen lukte niet. Is er internet?'); }
}
// a big, clear "it is on its way" moment for the sender
function showHeartSent(name) {
  Sound.trophy(); buzz([20, 40, 20, 40, 60]); heartRain();
  openModal(`<div class="heart-big">💛</div><h2>Hartje verstuurd!</h2>
    <p><b>${name}</b> krijgt je hartje te zien zodra ze de app opent.</p>
    <p class="note small">Op de ranglijst zie je daarna "gezien 👀" staan.</p>
    <button class="big-btn play" id="hsOk"><span class="bb-text"><b>Fijn! 😊</b></span></button>`, false);
  setTimeout(heartRain, 700);
  $('#hsOk').onclick = () => { closeModal(); if (curScreen === 'ranking') renderRanking(); };
}
// small status next to a family member: did they see my heart?
function heartState(pid) {
  const o = (S.heartsOut || {})[pid];
  if (!o || Date.now() - o.t > 7 * 864e5) return '';
  return o.seen ? '<small class="hs seen">💛 hartje gezien 👀</small>' : '<small class="hs">💛 hartje onderweg…</small>';
}
// did the people I sent a heart to see it? (they mark it when they open it)
let sentCheckAt = 0;
async function checkSentHearts() {
  const out = S.heartsOut || {}; let changed = false;
  for (const [pid, o] of Object.entries(out)) {
    if (o.seen || Date.now() - o.t > 7 * 864e5) continue;
    try {
      const r = await fetch(`${DB_URL}/hearts/${pid}/${S.pid}.json`, { cache: 'no-store' });
      const v = r.ok ? await r.json() : null;
      if (v && v.t < 0) { o.seen = Date.now(); changed = true; toast(`💛 ${o.name || 'Ze'} heeft je hartje gezien!`, 3200); }
    } catch (e) { }
  }
  if (changed) save();
  return changed;
}
// tell the sender we saw it: the heart is stored again with a negative time
function markHeartsSeen(list) {
  ensureId();
  list.forEach(h => fetch(`${DB_URL}/hearts/${S.pid}/${h.from}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: h.name.slice(0, 24), t: -Math.abs(h.t) }) }).catch(() => { }));
}
// new hearts since last time (one request at a time, so a heart is never shown twice)
let heartsBusy = false;
async function fetchHearts() {
  if (!DB_URL || !S.pid || heartsBusy) return [];
  heartsBusy = true;
  try {
    const res = await fetch(`${DB_URL}/hearts/${S.pid}.json`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json() || {};
    S.heartsSeen = S.heartsSeen || {};
    const fresh = Object.entries(data).filter(([from, v]) => v && v.t > (S.heartsSeen[from] || 0) && (S.pid.startsWith('test-') || !from.startsWith('test-')))
      .map(([from, v]) => ({ from, name: String(v.name || 'Iemand').slice(0, 24), t: v.t }));
    fresh.forEach(h => { S.heartsSeen[h.from] = h.t; });
    if (fresh.length) { S.stats = S.stats || {}; S.stats.hearts = (S.stats.hearts || 0) + fresh.length; save(); }
    return fresh;
  } catch (e) { return []; } finally { heartsBusy = false; }
}
function showHearts(list, then) {
  Sound.trophy(); buzz([20, 40, 20, 40, 40]);
  heartRain();
  const names = [...new Set(list.map(h => h.name))];
  const who = names.length === 1 ? `<b>${names[0]}</b> stuurde je een hartje!` : `<b>${names.slice(0, -1).join(', ')}</b> en <b>${names.slice(-1)}</b> stuurden je een hartje!`;
  openModal(`<div class="heart-big">💛</div><h2 class="heart-h">Een hartje voor jou!</h2><p class="heart-who">${who}</p>
    <button class="big-btn play" id="hOk"><span class="bb-text"><b>Wat lief! 😊</b></span></button>`, false);
  setTimeout(heartRain, 900); setTimeout(heartRain, 1900);
  markHeartsSeen(list);
  logEvt('heart_in', { from: names.join(', '), where: 'popup' });
  $('#hOk').onclick = () => { closeModal(); if (then) then(); };
}
// hearts fountain up from the bottom of the curScreen, so the words stay readable
function heartRain() { [0.08, 0.3, 0.7, 0.92].forEach((f, i) => setTimeout(() => FX.emoji(innerWidth * f, innerHeight - 20, ['💛', '💖', '💛', '✨'], 12), i * 120)); }
async function checkHearts() {
  const fresh = await fetchHearts();
  if (fresh.length) deliverHearts(fresh);
}
// show new hearts right away: a big pop-up at home, a short heart moment during a level
function deliverHearts(fresh) {
  const free = $('#modal').classList.contains('hidden');
  if (free && curScreen === 'home') showHearts(fresh, () => renderHome());
  else if (free) heartPop(fresh);
  else { S.pendingHearts = (S.pendingHearts || []).concat(fresh); save(); }
}
function heartPop(list) {
  const names = [...new Set(list.map(h => h.name))];
  let el = $('#heartPop');
  if (!el) { el = document.createElement('div'); el.id = 'heartPop'; document.body.appendChild(el); }
  el.innerHTML = `<div class="hp-card"><div class="hp-heart">💛</div><b>${names.join(' en ')}</b><span>${names.length > 1 ? 'sturen' : 'stuurt'} je een hartje!</span><small>Tik om verder te spelen</small></div>`;
  el.className = 'on';
  Sound.trophy(); buzz([20, 40, 20, 40, 60]); heartRain(); setTimeout(heartRain, 900);
  markHeartsSeen(list);
  logEvt('heart_in', { from: names.join(', '), where: 'level' });
  const close = () => { el.className = ''; clearTimeout(el._t); };
  el.onclick = close; clearTimeout(el._t); el._t = setTimeout(close, 6500);
}
// live: the database tells us the moment someone sends a heart
let heartStream = null;
function startHeartStream() {
  if (heartStream || !DB_URL || !S.pid || typeof EventSource === 'undefined') return;
  try {
    heartStream = new EventSource(`${DB_URL}/hearts/${S.pid}.json`);
    let t = 0;
    const ping = () => { clearTimeout(t); t = setTimeout(checkHearts, 400); };
    heartStream.addEventListener('put', ping);
    heartStream.addEventListener('patch', ping);
  } catch (e) { heartStream = null; }
}

// ---- avatar frames, earned through prizes ----
const FRAMES = [
  { id: 'none', name: 'Geen', ok: () => true, how: '' },
  { id: 'bronze', name: 'Brons', ok: () => trophyCount() >= 4, how: '4 prijzen' },
  { id: 'silver', name: 'Zilver', ok: () => trophyCount() >= 8, how: '8 prijzen' },
  { id: 'gold', name: 'Goud', ok: () => trophyCount() >= 12, how: '12 prijzen' },
  { id: 'sun', name: 'Zonnebloem', ok: () => sunUnlocked(), how: 'level 20' },
  { id: 'heart', name: 'Hartjes', ok: () => (S.stats && S.stats.hearts || 0) >= 3, how: '3 hartjes krijgen' },
  { id: 'rainbow', name: 'Regenboog', ok: () => !!S.trophies.c5, how: 'Supercombo' },
  { id: 'crown', name: 'Kroon', ok: () => (S.weekWins || 0) >= 1, how: 'win een week' },
];
const frameOk = id => (FRAMES.find(f => f.id === id) || FRAMES[0]).ok();
const avatarHTML = (e, cls = 'ra') => `<span class="${cls} fr-${e.frame && e.frame !== 'none' ? e.frame : 'none'}">${e.avatar}</span>`;

const AVATARS = ['👵', '👴', '😊', '🌻', '🐱', '🐶', '🌷', '⭐', '🦋', '🍀', '🎩', '🚀'];
function askName(then) {
  const cur = S.name || '';
  let av = S.avatar || '👵', fr = frameOk(S.frame || 'none') ? (S.frame || 'none') : 'none';
  openModal(`<h2>${cur ? 'Mijn profiel' : 'Hoe heet je?'}</h2>
    <p>Zo zien de anderen je op de ranglijst.</p>
    <input id="nmIn" class="name-in" maxlength="20" value="${cur.replace(/"/g, '')}" placeholder="Bijvoorbeeld: Oma Riet" autocomplete="off">
    <div class="quick-names">${['Oma', 'Opa', 'Mama', 'Papa'].map(n => `<button class="qn">${n}</button>`).join('')}</div>
    <div class="avatars">${AVATARS.map(a => `<button class="av${av === a ? ' on' : ''}">${a}</button>`).join('')}</div>
    <h3 class="fr-title">Lijstje om je plaatje</h3>
    <div class="frames">${FRAMES.map(f => `<button class="frm${fr === f.id ? ' on' : ''}${f.ok() ? '' : ' locked'}" data-f="${f.id}"><span class="ra fr-${f.id}">${av}</span><small>${f.ok() ? f.name : '🔒 ' + f.how}</small></button>`).join('')}</div>
    <button class="big-btn play" id="nmOk"><span class="bb-text"><b>Opslaan</b></span></button>`, false);
  document.querySelectorAll('.qn').forEach(b => b.onclick = () => { $('#nmIn').value = b.textContent; });
  document.querySelectorAll('.av').forEach(b => b.onclick = () => { av = b.textContent; document.querySelectorAll('.av').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.frm .ra').forEach(x => x.textContent = av); });
  document.querySelectorAll('.frm').forEach(b => b.onclick = () => {
    const f = FRAMES.find(x => x.id === b.dataset.f);
    if (!f.ok()) { toast(`Dit lijstje krijg je met: ${f.how}`); Sound.blocked(); return; }
    fr = f.id; document.querySelectorAll('.frm').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#nmOk').onclick = () => {
    const v = $('#nmIn').value.trim().replace(/[<>]/g, '').slice(0, 20);
    if (!v) { $('#nmIn').focus(); toast('Vul eerst een naam in'); return; }
    S.name = v; S.avatar = av; S.frame = fr; ensureId(); save(); closeModal(); pushScore(); startHeartStream(); if (then) then();
  };
}

const heartBtn = e => `<button class="heart-btn${(S.heartsSent || {})[e.id] === todayKey() ? ' sent' : ''}" data-pid="${e.id}" data-name="${e.name.replace(/"/g, '')}" aria-label="Stuur een hartje">${(S.heartsSent || {})[e.id] === todayKey() ? '💛✓' : '💛'}</button>`;
function rowHTML(e, rank, withHeart = false, mode = 'week') {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
  const heart = withHeart && !e.me && !e.bot ? heartBtn(e) : '';
  const sub = mode === 'week' ? `level ${e.level}` : `${e.points.toLocaleString('nl-NL')} punten`;
  return `<span class="rk">${medal}</span>${avatarHTML(e)}<span class="rn">${e.name}${e.me ? ' <i>(jij)</i>' : ''}${e.bot ? ' <i class="bot" title="computerspeler">🤖</i>' : e.me ? '' : ' <i class="fam-tag">👪</i>'}<small>${sub}</small></span><span class="rp">${rowVal(e, mode)}${heart}</span>`;
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
    ? `⏳ De weekstrijd eindigt ${weekLeftText()}. Elke maandag begint iedereen weer bij 0!`
    : `Wie is het verst gekomen? Het hoogste level staat bovenaan.`;
  $('#famBox').innerHTML = famHTML(rankMode, list, '👪 Familie', true);
  $('#rankList').innerHTML = list.map((e, i) => `<div class="rrow${e.me ? ' me' : ''}${isFam(e) ? ' fam' : ''}">${rowHTML(e, i + 1, true, rankMode)}</div>`).join('');
  document.querySelectorAll('.heart-btn').forEach(b => b.onclick = ev => { ev.stopPropagation(); if (!b.classList.contains('sent')) sendHeart(b.dataset.pid, b.dataset.name, b); else toast('Vandaag al een hartje gestuurd 💛'); });
  const online = !!DB_URL;
  $('#rankNote').innerHTML = online ? `🌐 Familie online · 💛 = stuur een hartje · 🤖 = computerspeler` : `🤖 = computerspeler`;
  $('#rankName').innerHTML = `${avatarHTML(myEntry(0), 'ra small')} ${S.name || 'Naam kiezen'} ✏️`;
  setTimeout(() => { const m = document.querySelector('.rrow.me'); if (m) m.scrollIntoView({ block: 'center' }); }, 30);
  if (online && (!S.lbOnlineAt || Date.now() - S.lbOnlineAt > 20000)) fetchOnline().then(ok => { if (ok && curScreen === 'ranking') renderRanking(); });
  if (online && Date.now() - (sentCheckAt || 0) > 8000) { sentCheckAt = Date.now(); checkSentHearts().then(ch => { if (ch && curScreen === 'ranking') renderRanking(); }); }
}

// result of last week, shown once on the home curScreen
function checkLastWeek() {
  if (!S.lastWeek || $('#modal').classList.contains('hidden') === false) return;
  const lw = S.lastWeek; S.lastWeek = null;
  const list = [...botEntries('week', lw.id, 1), ...onlineEntries('week', lw.id), { ...myEntry(lw.pts, 'week'), points: lw.pts }]
    .sort((a, b) => b.points - a.points || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  const rank = list.findIndex(e => e.me) + 1;
  S.stats = S.stats || {}; S.stats.weeks = (S.stats.weeks || 0) + 1;
  if (rank === 1) S.weekWins = (S.weekWins || 0) + 1;
  save();
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';
  if (rank <= 3) { Sound.trophy(); FX.confetti(); } else Sound.unlock();
  openModal(`<div class="sun-big">${medal}</div><h2>Vorige week werd je #${rank}!</h2>
    <p>Je haalde <b>${lw.pts.toLocaleString('nl-NL')} punten</b> in de weekstrijd.${rank === 1 ? ' Je bent de <b>weekwinnaar</b>! 👑' : rank <= 3 ? ' Wat een mooie plek!' : ''}</p>
    <p class="note">Er is een nieuwe week begonnen: iedereen staat weer op 0. Zet hem op!</p>
    <button class="big-btn play" id="lwOk"><span class="bb-text"><b>Nieuwe week!</b></span></button>`, false);
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
  const medalOf = r => r <= 3 ? ['🥇', '🥈', '🥉'][r - 1] : '#' + r;
  openModal(`<h2>${mode === 'week' ? 'Je klimt in de weekstrijd! 📅' : 'Je klimt op de ranglijst! 🏆'}</h2>
    <div class="climb" style="height:${(rows.length + 1) * RH}px">
      ${rows.map((e, k) => `<div class="rrow crow${isFam(e) ? ' fam' : ''}" data-k="${k}" style="transform:translateY(${k * RH}px)">${rowHTML(e, rankOf(k, false), false, mode)}</div>`).join('')}
      <div class="rrow me crow" id="meRow" style="transform:translateY(${startIdx * RH}px)">${rowHTML(myEntry(oldPts, mode), oldRank, false, mode)}</div>
    </div>
    <div class="climb-msg" id="climbMsg">&nbsp;</div>
    <button class="big-btn play" id="clOk"><span class="bb-text"><b>Verder</b></span></button>`, false, null, 'compact');
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
    victim.querySelector('.rk').textContent = medalOf(rankOf(victimIdx, true));
    const rank = oldRank - (passed.length - show.length) - k;
    me.querySelector('.rk').textContent = medalOf(rank);
    const pts = Math.round(oldPts + (newPts - oldPts) * k / steps);
    me.querySelector('.rp').textContent = mode === 'week' ? pts.toLocaleString('nl-NL') : `level ${pts}`;
    Sound.pass(k); buzz(15);
    const r = me.getBoundingClientRect(); FX.burst(r.left + r.width * 0.15, r.top + r.height / 2, 10);
    setTimeout(step, stepTime);
  }
  function finish() {
    if (stopped || !$('#climbMsg')) return;
    me.style.transform = `translateY(${pos * RH}px)`;
    me.querySelector('.rp').textContent = mode === 'week' ? newPts.toLocaleString('nl-NL') : `level ${newPts}`;
    me.querySelector('.rk').textContent = medalOf(newRank);
    me.classList.add('glow');
    Sound.rankUp(); FX.confetti(); buzz([30, 50, 30, 50, 60]);
    const n = passed.length;
    const who = n === 1 ? `Je bent <b>${passed[0].name}</b> voorbij! 🎉` : `Je bent <b>${n} spelers</b> voorbij! 🎉`;
    const gap = mode === 'week' ? `${(above ? above.points - newPts + 1 : 0).toLocaleString('nl-NL')} punten` : (above ? `${above.level - newPts + 1} ${above.level - newPts + 1 === 1 ? 'level' : 'levels'}` : '');
    const nxt = above ? `<br><small>Nog ${gap} tot ${above.avatar} ${above.name}</small>` : `<br><small>Je staat bovenaan! 👑</small>`;
    const wk = mode === 'week' ? `<br><small>⏳ De week eindigt ${weekLeftText()}</small>` : '';
    $('#climbMsg').innerHTML = `<span class="climb-up">#${oldRank} → #${newRank} ⬆</span><br>${who}${nxt}${wk}`;
  }
  setTimeout(() => { if (!stopped) step(); }, 650);
}
