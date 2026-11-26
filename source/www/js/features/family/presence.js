// uses: rules, lang, core/util, core/save, family/week, family/ranking
/* Oma's Mahjong — family/presence: who is online, uploading my score, my id. */
'use strict';

const THREE_DAYS = 3 * 86400000;
function presenceOf(e, now = Date.now()) {
  if (!isFam(e)) return null;
  const heartbeatAge = now - e.online;
  if (e.online > 0 && heartbeatAge >= 0 && heartbeatAge < 90000) return { online: true, text: tx('playerOnline') };

  const sentHeart = S.heartsOut?.[e.id];
  // A receipt records when we checked it. Its send time is the earliest the other player could have seen it.
  const seenHeartAtLeast = sentHeart?.seen ? Number(sentHeart.t) || 0 : 0;
  const last = Math.max(Number(e.online) || 0, Number(e.t) || 0,
    Number(S.heartsSeen?.[e.id]) || 0, seenHeartAtLeast);
  const age = now - last;
  if (last <= 0 || age < 0 || age > THREE_DAYS) return null;

  const minutes = Math.floor(age / 60000), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
  const text = minutes < 5 ? tx('lastOnlineNow') : hours < 1 ? tx('lastOnlineMinutes', minutes)
    : days < 1 ? tx('lastOnlineHours', hours) : days === 1 ? tx('lastOnlineYesterday') : tx('lastOnlineDays', days);
  return { online: false, text };
}
function presenceSubHTML(presence, hasSubtitle = true) {
  if (!presence) return '';
  const { online, text } = presence;
  return `${hasSubtitle ? ' ' : ''}<span class="presence-sub">${hasSubtitle ? '· ' : ''}<span class="${online ? 'presence-text' : 'presence-last'}">${text}</span></span>`;
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
      .map(([id, v]) => ({ id, name: String(v.name || '?').slice(0, 24), avatar: String(v.avatar || '🙂').slice(0, 8), frame: String(v.frame || 'none').slice(0, 12), points: v.points, level: v.level || 1, wk: v.wk || '', wkPts: v.wkPts || 0, online: Number(v.online) || 0, t: Number(v.t) || 0, ...(v.title ? { title: String(v.title).slice(0, 16) } : {}), ...(v.perfect === true ? { perfect: true } : {}) }));
    localStorage.setItem(LB_CACHE, JSON.stringify(list));
    S.lbOnlineAt = Date.now(); save();
    return true;
  } catch (e) { return false; }
}
// Serialize score uploads and presence changes so a delayed win cannot undo a later hide.
let scoreQueue = Promise.resolve();
function queueScoreWrite(write) {
  scoreQueue = scoreQueue.then(write).catch(() => {});
  return scoreQueue;
}
async function pushScore() {
  if (!DB_URL || !S.name) return;
  ensureId();
  const path = `scores/${S.pid}`, t = Date.now();
  const base = { name: S.name.slice(0, 24), avatar: (S.avatar || '😊').slice(0, 8), points: myPoints(), level: S.level, t };
  const full = { ...base, frame: (S.frame || 'none').slice(0, 12), wk: ensureWeek().id, wkPts: S.wk.pts, online: document.hidden ? 0 : t };
  return queueScoreWrite(async () => {
    const r = await dbSend(path, full);
    // older database rules only know the basic fields: fall back to those
    if (!r.ok) {
      const { online, ...legacy } = full;
      const old = await dbSend(path, legacy);
      if (!old.ok) await dbSend(path, base);
    }
  });
}

function updatePresence(active = !document.hidden) {
  if (!DB_URL || !S.name || !S.pid || !navigator.onLine) return Promise.resolve();
  const path = `scores/${S.pid}`, t = Date.now(), online = active ? t : 0;
  // pushScore creates the record. A visit only edits activity on an existing score.
  return queueScoreWrite(async () => {
    const ctl = new AbortController(), timeout = setTimeout(() => ctl.abort(), 6000);
    try {
      await fetch(dbUrl(path), {
        method: 'PATCH', body: JSON.stringify({ online, t }),
        headers: { 'Content-Type': 'application/json' }, keepalive: true, signal: ctl.signal,
      });
    } finally { clearTimeout(timeout); }
  });
}
