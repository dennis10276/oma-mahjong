/* Oma's Mahjong — play log for the family dashboard (dash/). */
'use strict';

// ---------- play log for the family dashboard ----------
/* Every start, finish, retry, hint and shuffle is sent to the database (plays/<player>),
   so the family can follow along on the dashboard. Without internet the events wait in a
   queue on the phone and are sent later. */
const LOGQ = 'omamj.logq';
const DEV = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : location.protocol === 'file:' ? 'android' : 'web';
const SES = Date.now().toString(36);
const readQ = () => { try { return JSON.parse(localStorage.getItem(LOGQ) || '[]') || []; } catch (e) { return []; } };
function logEvt(k, data = {}) {
  try {
    const q = readQ();
    const e = { k, t: Date.now(), v: String(window.__mjCode || APP_VERSION), dev: DEV, ses: SES };
    for (const [key, val] of Object.entries(data)) if (val !== undefined && val !== null && val !== '') e[key] = typeof val === 'string' ? val.slice(0, 40) : val;
    q.push(e);
    while (q.length > 500) q.shift();
    localStorage.setItem(LOGQ, JSON.stringify(q));
  } catch (e) { }
  flushLog();
}
let flushing = false;
async function flushLog() {
  if (flushing || !DB_URL || !S.name) return;   // only players with a name: no anonymous visitors in the dashboard
  ensureId(); flushing = true;
  try {
    for (let n = 0; n < 60; n++) {
      const q = readQ(); if (!q.length) break;
      const e = q[0];
      const r = await fetch(`${DB_URL}/plays/${S.pid}.json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) });
      if (!r.ok) break;                         // try again later (no internet, or not allowed yet)
      const q2 = readQ();                       // new events may have been added meanwhile
      if (q2.length && q2[0].t === e.t && q2[0].k === e.k) { q2.shift(); localStorage.setItem(LOGQ, JSON.stringify(q2)); }
    }
  } catch (e) { } finally { flushing = false; }
}
const lvInfo = () => G ? (G.mode === 'level' ? { lv: G.level } : { m: 'd', d: G.date, lv: S.level }) : { lv: S.level };
function endLevel(r, extra = {}) {
  if (!G || G.logged) return;
  G.logged = true; syncClock();
  adaptNote(r);
  const st = G.st || {};
  logEvt('end', { ...lvInfo(), r, at: G.attempt || 1, dur: Math.round(G.elapsed), sc: G.score, n: G.tiles.length, left: aliveCount(), h: !!G.usedHint, sh: !!G.usedShuffle, rb: G.rescued ? 1 : undefined, ez: G.ez || undefined, mc: st.mc || 0, tm: st.tm || 0, bt: st.bt || 0, fl: st.fl || 0, tp: st.tp || 0, ...extra });
}
/* Errors in the game also go to the dashboard (at most 5 per session), so a problem on
   someone's phone shows up there instead of going unnoticed. */
let errCount = 0;
function logErr(e, where = '') {
  if (errCount++ >= 5) return;
  try { logEvt('err', { msg: String((e && e.message) || e), w: where, lv: G ? (G.level || S.level) : S.level, scr: typeof curScreen !== 'undefined' ? curScreen : '' }); } catch (x) { }
}
window.addEventListener('error', e => { if (e.error || e.message) logErr(e.error || e.message, (String(e.filename || '').split('/').pop().split('?')[0]) + ':' + (e.lineno || 0)); });
