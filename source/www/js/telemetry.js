/* Oma's Mahjong — play log for the family dashboard (dash/). */
'use strict';

// ---------- play log for the family dashboard ----------
/* Every start, finish, retry, hint and shuffle is sent to the database (plays/<player>),
   so the family can follow along on the dashboard. Without internet the events wait in a
   queue on the phone and are sent later. */
const LOGQ = 'omamj.logq';
const DEV = IS_IOS ? 'ios' : location.protocol === 'file:' ? 'android' : 'web';
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
      const r = await dbSend(`plays/${S.pid}`, e, 'POST');
      if (!r.ok) break;                         // try again later (no internet, or not allowed yet)
      const q2 = readQ();                       // new events may have been added meanwhile
      if (q2.length && q2[0].t === e.t && q2[0].k === e.k) { q2.shift(); localStorage.setItem(LOGQ, JSON.stringify(q2)); }
    }
  } catch (e) { } finally { flushing = false; }
}
const lvInfo = () => G ? (G.mode === 'level' ? { lv: G.level } : { m: 'd', d: G.date, lv: S.level }) : { lv: S.level };
// something happened in the level being played: which level, which try, after how long, tiles left
function logLvl(k, extra = {}) { syncClock(); logEvt(k, { ...lvInfo(), aid: G.rp && G.rp.id, at: G.attempt, s: Math.round(G.elapsed), left: aliveCount(), ...extra }); }
function endLevel(r, extra = {}) {
  if (!G || G.logged) return;
  G.logged = true; syncClock();
  replayCapture(); replayMark('end', { r, ...extra }); replayDrain(G);
  if (G.rp) G.rp.closed = true;
  adaptNote(r);
  const st = G.st || {};
  logEvt('end', { ...lvInfo(), aid: G.rp && G.rp.id, r, at: G.attempt || 1, dur: Math.round(G.elapsed), sc: G.score, n: G.tiles.length, left: aliveCount(), h: !!G.usedHint, sh: !!G.usedShuffle, rb: G.rescued ? 1 : undefined, ez: G.ez || undefined, mc: st.mc || 0, tm: st.tm || 0, bt: st.bt || 0, fl: st.fl || 0, tp: st.tp || 0, ...extra });
}

/* Compact attempt replays. No screenshots, solver, DOM scan or network request on a tap.
   Actions and state deltas are buffered; the existing saved game carries the pending tail.
   Replay traffic has its own bounded queue so it cannot evict dashboard summaries.
   Root replays/ is separate from plays/: the dashboard never downloads these bulk records. */
const REPLAY = { version: 1, retentionDays: 30, queue: 'omamj.replayq', queueChars: 512 * 1024, attemptChars: 64 * 1024, chunkChars: 16384, batch: 48, wait: 30000, pending: 1024 };
let replayTimer = null, replaySending = false;
const replayId = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + SES + '-' + Math.random().toString(36).slice(2);
const replayTime = () => Math.round(1000 * (G.elapsed + (G.tStart ? (performance.now() - G.tStart) / 1000 : 0)));
const replayState = () => ({
  a: Array.from(G.alive), d: Array.from(G.down), f: G.tiles.map(t => t.face), tr: G.tray.slice(),
  p: G.peek, m: G.mv, ob: JSON.parse(JSON.stringify(obState())), ck: G.clock ? { ...G.clock } : null,
});
function replayBegin(cur, resumed) {
  try {
    clearTimeout(replayTimer); replayTimer = null;
    if (!S.name) return;
    ensureId();
    // Older saves start an explicitly partial replay from their actual saved position.
    if (resumed && cur.rp && !cur.rp.closed && cur.rp.v === REPLAY.version && cur.rp.owner === S.pid &&
        Number.isFinite(cur.rp.born) && cur.rp.born > Date.now() - REPLAY.retentionDays * 86400000) G.rp = cur.rp;
    else {
      const id = replayId();
      G.rp = { v: REPLAY.version, id, owner: S.pid, born: Date.now(), seq: 0, chars: 0, cut: false, events: [], last: replayState(),
        init: { partial: resumed, key: G.key, at: G.attempt, track: G.o.track || '', ez: G.ez || 0,
          gen: Hard.GENV, tiles: G.tiles.map(t => [t.x, t.y, t.z]), gold: [...G.gold], state: replayState(),
          help: JSON.parse(JSON.stringify(help())), cfg: { ...S.cfg }, aspect: G.o.aspect,
          seenClock: !!S.seenSp.clockMoves } };
    }
    replayMark(resumed ? 'resume' : 'begin');
    replayCapture();
    replayDrain(G);      // initial state / restored tail only; subsequent batches wait
  } catch (e) { G.rp = null; }  // recording must never prevent playing
}
function replayMark(kind, data = null) {
  try {
    const rp = G && G.rp;
    if (!rp || rp.cut || rp.closed) return;
    const e = [replayTime(), kind, data], size = JSON.stringify(e).length;
    if (rp.chars + size > REPLAY.attemptChars || rp.events.length >= REPLAY.pending) {
      rp.cut = true; rp.events.push([replayTime(), 'truncated', null]);
    } else { rp.events.push(e); rp.chars += size; }
    if (rp.events.length >= REPLAY.batch) { clearTimeout(replayTimer); replayTimer = null; }
    if (!replayTimer) {
      const g = G;
      replayTimer = setTimeout(() => {
        replayTimer = null; replayDrain(g);
        if (G === g && !g.done) saveCur();
      }, rp.events.length >= REPLAY.batch ? 0 : REPLAY.wait);
    }
  } catch (e) { }
}
function replayCapture() {
  try {
    const rp = G && G.rp;
    if (!rp || rp.cut || rp.closed) return;
    const next = replayState(), old = rp.last, delta = {};
    for (const k of ['a', 'd', 'f']) {
      const edits = [];
      for (let i = 0; i < next[k].length; i++) if (next[k][i] !== old[k][i]) edits.push([i, next[k][i]]);
      if (edits.length) delta[k] = edits;
    }
    for (const k of ['tr', 'p', 'm', 'ob', 'ck']) if (JSON.stringify(next[k]) !== JSON.stringify(old[k])) delta[k] = next[k];
    rp.last = next;
    if (Object.keys(delta).length) replayMark('state', delta);
  } catch (e) { }
}
function replayView() {
  try {
    if (!G || !G.rp) return;
    const w = $('#boardWrap'), br = $('#board').getBoundingClientRect();
    const view = [innerWidth, innerHeight, w.clientWidth, w.clientHeight, Math.round((G.tw || 0) * 10) / 10,
      S.theme, !!S.nums, !!S.contrast, !!S.highlight, !!S.bigTiles, !toolsGone(), help(), [Math.round(br.left), Math.round(br.top)]];
    const key = JSON.stringify(view);
    if (key !== G.rp.view) { G.rp.view = key; replayMark('view', view); }
  } catch (e) { }
}
function replayDrain(g) {
  const created = []; let committed = false;
  try {
    const rp = g && g.rp;
    if (!rp || (!rp.init && !rp.events.length)) return;
    let q;
    try { q = JSON.parse(localStorage.getItem(REPLAY.queue) || '[]'); } catch (e) { q = []; }
    if (!Array.isArray(q)) q = [];
    // Separate small local records avoid re-writing a megabyte queue on an offline phone.
    // Stable queued chunk IDs make retries safe; sequence conflicts after a crash are detectable.
    let seq = rp.seq, count = 0, first = true;
    do {
      let events = rp.events.slice(count, count + REPLAY.batch);
      let data = JSON.stringify({ events, ...(first && rp.init ? { init: rp.init } : {}) });
      while (data.length > REPLAY.chunkChars && events.length > 1) {
        events = events.slice(0, Math.ceil(events.length / 2));
        data = JSON.stringify({ events, ...(first && rp.init ? { init: rp.init } : {}) });
      }
      if (data.length > REPLAY.chunkChars) { rp.cut = true; return; }
      const body = { v: REPLAY.version, t: Date.now(), code: String(window.__mjCode || APP_VERSION),
        aid: rp.id, seq: seq++, data };  // JSON string preserves empty trays/nulls in Firebase
      const cid = replayId(), raw = JSON.stringify(body);
      localStorage.setItem(REPLAY.queue + '.' + cid, raw);
      created.push(cid);
      q.push({ pid: rp.owner, aid: rp.id, born: rp.born, cid, seq: body.seq, chars: raw.length });
      count += events.length; first = false;
    } while (count < rp.events.length);
    let chars = q.reduce((n, e) => n + e.chars, 0);
    while (q.length && chars + JSON.stringify(q).length > REPLAY.queueChars) {
      const e = q.shift(); chars -= e.chars; localStorage.removeItem(REPLAY.queue + '.' + e.cid);
    }
    localStorage.setItem(REPLAY.queue, JSON.stringify(q));
    committed = true;
    rp.seq = seq; rp.events.splice(0, count); delete rp.init;
    setTimeout(flushReplay, 200);  // outside the input handler and the board animation's first frame
  } catch (e) { } finally {
    if (!committed) for (const cid of created) { try { localStorage.removeItem(REPLAY.queue + '.' + cid); } catch (e) { } }
  }  // quota / offline failures leave the bounded pending tail in the saved game
}
async function flushReplay() {
  if (replaySending || !DB_URL || !navigator.onLine) return;
  replaySending = true;
  try {
    for (let n = 0; n < 8; n++) {
      const q = JSON.parse(localStorage.getItem(REPLAY.queue) || '[]');
      const e = q[0]; if (!e) break;
      const raw = localStorage.getItem(REPLAY.queue + '.' + e.cid);
      // Interrupted cleanup may leave a stale index entry; it must not block later chunks.
      // Never re-upload expired history from a phone that has been offline for a month.
      if (!raw || !Number.isFinite(e.born) || e.born <= Date.now() - REPLAY.retentionDays * 86400000) {
        q.shift(); localStorage.setItem(REPLAY.queue, JSON.stringify(q));
        localStorage.removeItem(REPLAY.queue + '.' + e.cid); continue;
      }
      // createdAt is immutable. PATCH writes it with the chunk in one request, including retries.
      const r = await dbSend(`replays/${encodeURIComponent(e.pid)}/${e.aid}`, { createdAt: e.born, [e.cid]: JSON.parse(raw) }, 'PATCH');
      if (!r.ok) break;
      const next = JSON.parse(localStorage.getItem(REPLAY.queue) || '[]');
      if (next.length && next[0].cid === e.cid) {
        next.shift(); localStorage.setItem(REPLAY.queue, JSON.stringify(next));
        localStorage.removeItem(REPLAY.queue + '.' + e.cid);
      }
    }
  } catch (e) { } finally { replaySending = false; }
}
addEventListener('online', flushReplay);
addEventListener('pagehide', () => {
  if (!G || !G.rp) return;
  replayMark('pause', 'pagehide'); replayCapture(); replayDrain(G); saveCur();
});
setInterval(flushReplay, 60000);
setTimeout(() => {
  try {
    const q = JSON.parse(localStorage.getItem(REPLAY.queue) || '[]'), ids = new Set(q.map(e => REPLAY.queue + '.' + e.cid));
    for (const key of Object.keys(localStorage)) if (key.startsWith(REPLAY.queue + '.') && !ids.has(key)) localStorage.removeItem(key);
  } catch (e) { }
  flushReplay();
}, 1000);
/* Errors in the game also go to the dashboard (at most 5 per session), so a problem on
   someone's phone shows up there instead of going unnoticed. */
let errCount = 0;
function logErr(e, where = '') {
  if (errCount++ >= 5) return;
  try { logEvt('err', { msg: String((e && e.message) || e), w: where, lv: G ? (G.level || S.level) : S.level, scr: typeof curScreen !== 'undefined' ? curScreen : '' }); } catch (x) { }
}
window.addEventListener('error', e => { if (e.error || e.message) logErr(e.error || e.message, (String(e.filename || '').split('/').pop().split('?')[0]) + ':' + (e.lineno || 0)); });
