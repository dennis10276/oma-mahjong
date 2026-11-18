/* Oma's Mahjong — the leaderboard: real family players, the weekly challenge,
   the profile with avatar frames, and climbing past others (hearts are in hearts.js). */
'use strict';

// ---------- ranking (real family players) ----------
const LB_CACHE = 'omamj.lb';
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

const myPoints = () => sum(S.lvlPts) + sum(S.dayPts) + S.bonusPts;
const myWeekPts = () => ensureWeek().pts;
// v = my weekly points (week) or my level (all-time); undefined = my current value
function myEntry(v, mode = 'all') {
  const all = mode !== 'week';
  return { id: S.pid, name: S.name || tx('you'), avatar: S.avatar || '😊', frame: S.frame || 'none', points: all ? myPoints() : (v ?? myWeekPts()), level: all ? (v ?? S.level) : S.level, me: true };
}
function onlineEntries(mode = 'all', weekId) {
  let list = [];
  try { list = (JSON.parse(localStorage.getItem(LB_CACHE) || '[]') || []).filter(e => e.id !== S.pid && !hiddenFromRanking(e.id, e.name)); } catch (e) { }
  if (mode === 'week') { const id = weekId || weekInfo().id; list = list.map(e => ({ ...e, points: e.wk === id ? (e.wkPts || 0) : 0 })); }
  return list;
}
/* week = points this week; all-time ("All-time") = highest level, points only break a tie */
function ranking(v, mode = 'all') {
  const list = [...onlineEntries(mode), myEntry(v, mode)];
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
const playerIsOnline = e => !e.me && e.online > 0 && Date.now() - e.online >= 0 && Date.now() - e.online < 90000;
function famHTML(mode, list, title = tx('family'), withHearts = false, activity = false) {
  list = list || ranking(undefined, mode);
  const fam = list.map((e, i) => ({ e, r: i + 1 })).filter(x => !x.e.bot);
  if (fam.length < 2) return '';
  const mine = fam.findIndex(x => x.e.me);
  const limit = innerHeight < 740 ? 3 : 6;
  const visible = activity && fam.length > limit ? fam.slice(Math.max(0, Math.min(mine - 1, fam.length - limit)), Math.max(0, Math.min(mine - 1, fam.length - limit)) + limit) : fam;
  return `<div class="fam-box${activity ? ' win-family' : ''}"><div class="fam-title">${title}</div>${visible.map(({ e, r }) => {
    const online = activity && playerIsOnline(e), heart = withHearts && !e.me ? heartBtn(e) : '';
    const avatar = avatarHTML(e).replace('</span>', `${online ? '<span class="presence-dot" aria-hidden="true"></span>' : ''}</span>`);
    return `<div class="fam-row${e.me ? ' me' : ''}"><span class="fr-rank">${medal(r)}</span>${avatar}<span class="fr-name">${esc(e.name)}${e.me ? ` <i>${tx('youTag')}</i>` : ''}<small class="fr-sub">${mode === 'week' ? `🧩 ${tx('levelWord', e.level)}` : tx('points', fmtN(e.points))}${online ? ` · <span class="presence-text">${tx('playerOnline')}</span>` : ''}</small>${!e.me && !activity ? heartState(e.id) : ''}</span><span class="fr-val">${activity ? `${heart}<span class="points">${rowVal(e, mode)}</span>` : `${rowVal(e, mode)}${heart}`}</span></div>`;
  }).join('')}</div>`;
}
/* Passed by family: who was below you in the all-time ranking (highest level, then points) the
   last time you had the app open, and is above you now. You hear it the next time you open the
   app (or come back to it after a while), with where they are now. S.famBelow: the players below
   you then; your own wins only add to it (so being passed during a session is still told later). */
const famOrder = () => ranking(undefined, 'all').filter(e => !e.bot);
function famBelowIds() { const l = famOrder(), me = l.findIndex(e => e.me); return me < 0 ? [] : l.slice(me + 1).map(e => e.id); }
function notePassedBaseline(reset) { const now = famBelowIds(); S.famBelow = reset || !Array.isArray(S.famBelow) ? now : [...new Set([...S.famBelow, ...now])]; save(); }
function checkPassed() {
  if (!S.name) return;
  const l = famOrder(), me = l.findIndex(e => e.me);
  if (me < 0) return;
  if (!Array.isArray(S.famBelow)) { notePassedBaseline(true); return; }
  const by = l.slice(0, me).filter(e => S.famBelow.includes(e.id));
  notePassedBaseline(true);
  if (!by.length) return;
  S.passedNews = { t: Date.now(), rank: me + 1, mine: S.level, by: by.map(e => ({ id: e.id, name: e.name, avatar: e.avatar, frame: e.frame, level: e.level })) };
  save();
  logEvt('passed', { by: by.map(e => e.name).join(', ').slice(0, 40), lv: S.level, rk: me + 1 });
  showPassed();
}
// the news waits for the home screen with no other pop-up open (hearts first)
function showPassed() {
  const n = S.passedNews;
  if (!n) return;
  if (curScreen !== 'home' || !modalFree()) { clearTimeout(showPassed.t); showPassed.t = setTimeout(showPassed, 1500); return; }
  S.passedNews = null; save();
  Sound.blocked(); buzz([30, 60, 30]);
  const rows = n.by.map(e => `<div class="fam-row passed-row">${avatarHTML(e)}<span class="fr-name">${esc(e.name)}<small class="fr-sub">${tx('passedNow', e.level)}</small></span><span class="fr-val">${tx('levelWord', e.level)}</span></div>`).join('');
  openModal(`<div class="nt-ico">🏃</div><h2>${tx(n.by.length > 1 ? 'passedTitleMany' : 'passedTitle')}</h2>
    <p>${tx('passedText', n.by.length > 1 ? n.by.map(e => esc(e.name)).join(' & ') : esc(n.by[0].name), n.by.length)}</p>
    <div class="fam-box">${rows}</div>
    <p class="note">${tx('passedYou', n.mine, n.rank)}</p>
    <button class="big-btn play" id="psOk"><span class="bb-text"><b>${tx('passedGo')}</b></span></button>`, false);
  $('#psOk').onclick = () => { closeModal(); renderHome(); };
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
    const list = Object.entries(data).filter(([id, v]) => v && typeof v.points === 'number' && !id.startsWith('test-') && !String(v.name || '').startsWith('test-') && !hiddenFromRanking(id, v.name))
      .map(([id, v]) => ({ id, name: String(v.name || '?').slice(0, 24), avatar: String(v.avatar || '🙂').slice(0, 8), frame: String(v.frame || 'none').slice(0, 12), points: v.points, level: v.level || 1, wk: v.wk || '', wkPts: v.wkPts || 0, online: Number(v.online) || 0 }));
    localStorage.setItem(LB_CACHE, JSON.stringify(list));
    S.lbOnlineAt = Date.now(); save();
    return true;
  } catch (e) { return false; }
}
async function pushScore() {
  if (!DB_URL || !S.name) return;
  ensureId();
  const base = { name: S.name.slice(0, 24), avatar: (S.avatar || '😊').slice(0, 8), points: myPoints(), level: S.level, t: Date.now() };
  const full = { ...base, frame: (S.frame || 'none').slice(0, 12), wk: ensureWeek().id, wkPts: S.wk.pts, online: document.hidden ? 0 : Date.now() };
  try {
    const r = await dbSend(`scores/${S.pid}`, full);
    // older database rules only know the basic fields: fall back to those
    if (!r.ok) {
      const { online, ...legacy } = full;
      const old = await dbSend(`scores/${S.pid}`, legacy);
      if (!old.ok) await dbSend(`scores/${S.pid}`, base);
    }
  } catch (e) { }
}

// A foreground heartbeat is distinct from the last score update; older apps remain unknown.
let presenceQueue = Promise.resolve();
function updatePresence(active = !document.hidden) {
  if (!DB_URL || !S.name || !S.pid || !navigator.onLine) return Promise.resolve();
  const value = active ? Date.now() : 0;
  presenceQueue = presenceQueue.then(async () => {
    const ctl = new AbortController(), timeout = setTimeout(() => ctl.abort(), 6000);
    try { await fetch(dbUrl(`scores/${S.pid}/online`), { method: 'PUT', body: JSON.stringify(value), headers: { 'Content-Type': 'application/json' }, keepalive: true, signal: ctl.signal }); }
    catch (e) { } finally { clearTimeout(timeout); }
  });
  return presenceQueue;
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
    <p>${fx('nameWhy')}</p>
    <input id="nmIn" class="name-in" maxlength="20" value="${cur.replace(/"/g, '')}" placeholder="${tx('namePh')}" autocomplete="off">
    <div class="quick-names fit-row">${tx('quickNames').map(n => `<button class="qn">${n}</button>`).join('')}</div>
    <div class="avatars">${AVATARS.map(a => `<button class="av${av === a ? ' on' : ''}">${a}</button>`).join('')}</div>
    <h3 class="fr-title">${fx('frameTitle')}</h3>
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
  return `<span class="rk">${medal(rank)}</span>${avatarHTML(e).replace('</span>', `${playerIsOnline(e) ? '<span class="presence-dot" aria-hidden="true"></span>' : ''}</span>`)}<span class="rn">${esc(e.name)}${e.me ? ` <i>${tx('youTag')}</i>` : ''}${e.me ? '' : ' <i class="fam-tag">👪</i>'}<small>${sub}</small>${withHeart && !e.me ? heartState(e.id) : ''}</span><span class="rp">${rowVal(e, mode)}${heart}</span>`;
}
let rankMode = 'week';
function renderRanking() {
  ensureId(); ensureWeek();
  const list = ranking(undefined, rankMode);
  const me = list.findIndex(e => e.me);
  $('#rkMine').textContent = tx('rankYourPlace', me + 1, list.length);
  $('#rkWeek').classList.toggle('on', rankMode === 'week');
  $('#rkAll').classList.toggle('on', rankMode === 'all');
  $('#wkInfo').innerHTML = rankMode === 'week'
    ? tx('weekEnds', weekLeftText())
    : tx('allInfo');

  $('#rankList').innerHTML = list.map((e, i) => `<div class="rrow${e.me ? ' me' : ''}${isFam(e) ? ' fam' : ''}">${rowHTML(e, i + 1, true, rankMode)}</div>`).join('');
  document.querySelectorAll('.heart-btn').forEach(b => b.onclick = ev => { ev.stopPropagation(); if (!b.classList.contains('sent')) sendHeart(b.dataset.pid, b.dataset.name, b); else toast(tx('heartAlreadyShort')); });
  const online = !!DB_URL;
  $('#rankNote').innerHTML = tx(S.lbOnlineAt && Date.now() - S.lbOnlineAt < 60000 ? 'rankNoteOnline' : 'rankNoteCached');
  $('#rankName').innerHTML = avatarHTML(myEntry(0), 'ra small');
  $('#rankName').setAttribute('aria-label', tx('rankProfile'));
  $('#rankName').title = S.name || tx('pickName');

  if (online && (!S.lbOnlineAt || Date.now() - S.lbOnlineAt > 20000)) fetchOnline().then(ok => { if (ok && curScreen === 'ranking') renderRanking(); });
  if (online && Date.now() - (sentCheckAt || 0) > 8000) { sentCheckAt = Date.now(); checkSentHearts().then(ch => { if (ch && curScreen === 'ranking') renderRanking(); }); }
}

// result of last week, shown once on the home screen
function checkLastWeek() {
  if (!S.lastWeek || !modalFree()) return;
  const lw = S.lastWeek; S.lastWeek = null;
  // Scores are overwritten each week; without a complete historical table, only
  // the player's recorded points are known. Never infer a winner from missing scores.
  bumpStat('weeks');
  save();
  Sound.unlock();
  openModal(`<div class="sun-big">📅</div><h2>${tx('lastWeekSummary')}</h2>
    <p>${tx('lastWeekPoints', fmtN(lw.pts))}</p>
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
