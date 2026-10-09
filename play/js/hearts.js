/* Oma's Mahjong — hearts between family members, with an optional short message.
   hearts/<to>/<from> = { name, t }: t < 0 means "seen" (the receiver turns it negative).
   The message goes to plays/msg-<to> (see MSG in rules.js). Timings are in RULES.hearts. */
'use strict';

const sentToday = pid => S.heartsSent[pid] === todayKey();
const heartBtn = e => `<button class="heart-btn${sentToday(e.id) ? ' sent' : ''}" data-pid="${e.id}" data-name="${esc(e.name)}" aria-label="Stuur een hartje">${sentToday(e.id) ? '💛✓' : '💛'}</button>`;
const recent = t => Date.now() - Math.abs(t) <= RULES.hearts.showDays * 864e5;

// ---------- sending ----------
async function sendHeart(pid, name, btn) {
  if (!S.name) return askName(() => sendHeart(pid, name, btn));
  if (sentToday(pid)) { toast(`Je hebt ${name} vandaag al een hartje gestuurd 💛`); return; }
  // pick a short message to go with it (or none): just tapping, no typing needed
  const quick = RULES.hearts.quick(S.level);
  openModal(`<div class="heart-big sm">💛</div><h2>Hartje voor ${esc(name)}</h2><p class="note small">Wil je er een berichtje bij doen?</p>
    <div class="msg-pick">${quick.map((m, i) => `<button class="mp" data-i="${i}">${esc(m)}</button>`).join('')}</div>
    <button class="big-btn play" id="hmNone"><span class="bb-text"><b>Alleen een hartje 💛</b></span></button>`, true);
  document.querySelectorAll('.msg-pick .mp').forEach(b => b.onclick = () => { closeModal(); doSendHeart(pid, name, btn, quick[+b.dataset.i]); });
  $('#hmNone').onclick = () => { closeModal(); doSendHeart(pid, name, btn, ''); };
}
async function doSendHeart(pid, name, btn, msg) {
  ensureId();
  try {
    const t = Date.now(), me = S.name.slice(0, 24);
    const r = await dbSend(`hearts/${pid}/${S.pid}`, { name: me, t });
    if (!r.ok) throw 0;
    if (msg) dbSend(`plays/${msgKey(pid)}`, { k: 'msg', t, from: S.pid, name: me, ...msgParts(msg) }, 'POST').catch(() => { });
    S.heartsSent[pid] = todayKey(); bumpStat('heartsSent');
    S.heartsOut[pid] = { t, seen: 0, name }; save();
    logEvt('heart_out', { to: name, msg: msg ? 1 : undefined });
    Sound.unlock(); buzz(20);
    if (btn) { btn.classList.add('sent'); btn.textContent = '💛✓'; }
    showHeartSent(name);
  } catch (e) { toast('Hartje versturen lukte niet. Is er internet?'); }
}
// a big, clear "it is on its way" moment for the sender
function showHeartSent(name) {
  Sound.trophy(); buzz([20, 40, 20, 40, 60]); heartRain();
  openModal(`<div class="heart-big">💛</div><h2>Hartje verstuurd!</h2>
    <p><b>${esc(name)}</b> krijgt je hartje te zien zodra ze de app opent.</p>
    <p class="note small">Op de ranglijst zie je daarna "gezien 👀" staan.</p>
    <button class="big-btn play" id="hsOk"><span class="bb-text"><b>Fijn! 😊</b></span></button>`, false);
  setTimeout(heartRain, 700);
  $('#hsOk').onclick = () => { closeModal(); if (curScreen === 'ranking') renderRanking(); };
}
// small status next to a family member: did they see my heart?
function heartState(pid) {
  const o = S.heartsOut[pid];
  if (!o || !recent(o.t)) return '';
  return o.seen ? '<small class="hs seen">💛 hartje gezien 👀</small>' : '<small class="hs">💛 hartje onderweg…</small>';
}
// did the people I sent a heart to see it?
let sentCheckAt = 0;
async function checkSentHearts() {
  let changed = false;
  for (const [pid, o] of Object.entries(S.heartsOut)) {
    if (o.seen || !recent(o.t)) continue;
    try {
      const v = await dbGet(`hearts/${pid}/${S.pid}`);
      if (v && v.t < 0) { o.seen = Date.now(); changed = true; toast(`💛 ${o.name || 'Ze'} heeft je hartje gezien!`, 3200); }
    } catch (e) { }
  }
  if (changed) save();
  return changed;
}

// ---------- receiving ----------
// tell the sender we saw it: the heart is stored again with a negative time
function markHeartsSeen(list) {
  ensureId();
  list.forEach(h => dbSend(`hearts/${S.pid}/${h.from}`, { name: h.name.slice(0, 24), t: -Math.abs(h.t) }).catch(() => { }));
}
// new hearts since last time (one request at a time, so a heart is never shown twice)
let heartsBusy = false;
async function fetchHearts() {
  if (!DB_URL || !S.pid || heartsBusy) return [];
  heartsBusy = true;
  try {
    const data = await dbGet(`hearts/${S.pid}`) || {};
    const fresh = Object.entries(data).filter(([from, v]) => v && v.t > (S.heartsSeen[from] || 0) && (S.pid.startsWith('test-') || !from.startsWith('test-')))
      .map(([from, v]) => ({ from, name: String(v.name || 'Iemand').slice(0, 24), t: v.t }));
    fresh.forEach(h => { S.heartsSeen[h.from] = h.t; });
    if (fresh.length) { await attachMsgs(fresh); bumpStat('hearts', fresh.length); save(); }
    return fresh;
  } catch (e) { return []; } finally { heartsBusy = false; }
}
// the message that came with a heart: same sender, sent at the same moment
async function attachMsgs(list) {
  try {
    const ms = Object.values(await dbGet(`plays/${msgKey(S.pid)}`) || {});
    list.forEach(h => { const m = ms.filter(m => m && m.from === h.from && Math.abs(m.t - h.t) < 120000).pop(); if (m && msgText(m)) h.msg = msgText(m).slice(0, MSG.max); });
  } catch (e) { }
}
const heartNames = list => [...new Set(list.map(h => h.name))];
const msgHTML = list => list.filter(h => h.msg).map(h => `<p class="heart-msg">“${esc(h.msg)}”<small>${esc(h.name)}</small></p>`).join('');
const logHeartIn = (list, where) => logEvt('heart_in', { from: heartNames(list).join(', '), where, msg: list.some(h => h.msg) ? 1 : undefined });
// at home: a big pop-up
function showHearts(list, then) {
  Sound.trophy(); buzz([20, 40, 20, 40, 40]);
  heartRain();
  const names = heartNames(list).map(esc);
  const who = names.length === 1 ? `<b>${names[0]}</b> stuurde je een hartje!` : `<b>${names.slice(0, -1).join(', ')}</b> en <b>${names.slice(-1)}</b> stuurden je een hartje!`;
  openModal(`<div class="heart-big">💛</div><h2 class="heart-h">Een hartje voor jou!</h2><p class="heart-who">${who}</p>${msgHTML(list)}
    <button class="big-btn play" id="hOk"><span class="bb-text"><b>Wat lief! 😊</b></span></button>`, false);
  setTimeout(heartRain, 900); setTimeout(heartRain, 1900);
  markHeartsSeen(list); logHeartIn(list, 'popup');
  $('#hOk').onclick = () => { closeModal(); if (then) then(); };
}
// during a level: a short heart moment that closes by itself
function heartPop(list) {
  const names = heartNames(list).map(esc);
  let el = $('#heartPop');
  if (!el) { el = document.createElement('div'); el.id = 'heartPop'; document.body.appendChild(el); }
  el.innerHTML = `<div class="hp-card"><div class="hp-heart">💛</div><b>${names.join(' en ')}</b><span>${names.length > 1 ? 'sturen' : 'stuurt'} je een hartje!</span>${msgHTML(list)}<small>Tik om verder te spelen</small></div>`;
  el.className = 'on';
  Sound.trophy(); buzz([20, 40, 20, 40, 60]); heartRain(); setTimeout(heartRain, 900);
  markHeartsSeen(list); logHeartIn(list, 'level');
  const close = () => { el.className = ''; clearTimeout(el._t); };
  el.onclick = close; clearTimeout(el._t);
  el._t = setTimeout(close, list.some(h => h.msg) ? RULES.hearts.popupWithMsgMs : RULES.hearts.popupMs);
}
// hearts fountain up from the bottom of the screen, so the words stay readable
function heartRain() { [0.08, 0.3, 0.7, 0.92].forEach((f, i) => setTimeout(() => FX.emoji(innerWidth * f, innerHeight - 20, ['💛', '💖', '💛', '✨'], 12), i * 120)); }
async function checkHearts() {
  const fresh = await fetchHearts();
  if (fresh.length) deliverHearts(fresh);
}
// show new hearts right away: a big pop-up at home, a short heart moment during a level, later otherwise
function deliverHearts(fresh) {
  const free = modalFree();
  if (free && curScreen === 'home') showHearts(fresh, () => renderHome());
  else if (free) heartPop(fresh);
  else { S.pendingHearts = S.pendingHearts.concat(fresh); save(); }
}
// live: the database tells us the moment someone sends a heart
let heartStream = null;
function startHeartStream() {
  if (heartStream || !DB_URL || !S.pid || typeof EventSource === 'undefined') return;
  try {
    heartStream = new EventSource(dbUrl(`hearts/${S.pid}`));
    let t = 0;
    const ping = () => { clearTimeout(t); t = setTimeout(checkHearts, 400); };
    heartStream.addEventListener('put', ping);
    heartStream.addEventListener('patch', ping);
  } catch (e) { heartStream = null; }
}
