/* Oma's Mahjong — "replay from Dennisisdebeste" (from 1.65; decisions Dennis 2026-11-06).
   Switched on per player on the dashboard (part 'pro', off by default). A player who has not passed a
   level after RULES.pro.after lost tries (restarts count, S.fails) sees, once per level, how it was won:
   Dennisisdebeste's winning try, or for a level he has none of, the win of the player who needed the
   fewest tries. Tap by tap, at double speed, in the watching player's own tiles, background and
   language. It covers the screen; only a small × at the top closes it.
   The films are in www/pro/L<n>.json (tools/pro/build_pro.js, run at every release) and are downloaded
   from the website only when needed. A film is only shown when its board is exactly the board being
   played (proSig), so never on another deal, grandma's own levels or a changed level. */
'use strict';

// the board's fingerprint: positions, pictures, face-down tiles, ice/locks and the clock at the start
function proSig(init) {
  const st = init.state, txt = JSON.stringify([init.tiles, st.f, Array.from(st.d), st.ob || null, st.ck ? [st.ck.i, st.ck.n] : null]);
  let h = 0x811c9dc5;
  for (let k = 0; k < txt.length; k++) { h ^= txt.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36) + '-' + txt.length.toString(36);
}
if (typeof module !== 'undefined') module.exports = { proSig };

function proDue() {
  const P = RULES.pro;
  return !!(P && G && !G.done && G.mode === 'level' && !G.o.track && G.sig && part('pro') &&
    G.level >= S.level && (S.fails[G.key] || 0) >= P.after && !(S.proSeen || {})[G.key]);
}
// called when a try begins: fetch the film (if due) and show it over the fresh board
async function proCheck() {
  if (!proDue()) return;
  const g = G, P = RULES.pro;
  let film = null;
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), P.waitMs);
    const r = await fetch(P.url + g.key + '.json', { cache: 'no-cache', signal: ctl.signal });
    clearTimeout(timer);
    if (r.ok) film = await r.json();
  } catch (e) { film = null; }
  // not there, another board, or the player already moved on: nothing now (it can come at a later try)
  if (!film || film.v !== 1 || film.sig !== g.sig || film.pid === S.pid || G !== g || g.done || curScreen !== 'game' || !proDue()) return;
  proShow(film);
}
function proShow(film) {
  const P = RULES.pro;
  (S.proSeen || (S.proSeen = {}))[G.key] = Date.now(); save();
  pauseClock();
  const title = `${tx('proTitle', film.who)} · ${tx('levelN', film.lv)}`;
  const view = document.createElement('div');
  view.id = 'proView';
  view.innerHTML = `<div class="pro-top"><h2>${tx('proTitle', film.who)}</h2><span class="pro-sub">${tx('levelN', film.lv)} · <b>${tx('proSpeed')}</b></span><button type="button" class="pro-x" aria-label="${tx('proClose')}">×</button></div>
    ${coachDemoHTML(false)}<div class="pro-end"></div>`;
  document.body.appendChild(view);
  const t0 = Date.now(), meta = { mid: SES + '-pro' + Date.now().toString(36), topic: 'pro', why: 'fails', lang: isEn() ? 'en' : 'nl', title, scr: 'game',
    ...lvInfo(), aid: G.rp && G.rp.id, at: G.attempt, fails: S.fails[G.key] || 0 };
  logEvt('help_msg', { ...meta, action: 'shown', m0: title });
  let closed = false;
  const close = how => {
    if (closed) return; closed = true;
    stopCoach();
    logEvt('help_msg', { ...meta, action: how, s: Math.round((Date.now() - t0) / 1000) });
    view.classList.add('pro-out');
    setTimeout(() => view.remove(), 250);
    resumeClock();
  };
  // the × only shows after a few seconds, small and at the top (no button at the bottom)
  const x = view.querySelector('.pro-x');
  setTimeout(() => x.classList.add('on'), P.closeAfterMs);
  x.onclick = () => { if (x.classList.contains('on')) close('skip'); };
  const all = film.tiles.map((t, i) => i);
  const clip = { tiles: film.tiles, faces: film.faces, ob: film.ob, focus: all,
    pace: { speed: P.speed, maxGap: P.maxGapMs, lead: 1200, onDone: () => {
      view.querySelector('.pro-end').innerHTML = `<b>${tx('proYourTurn')}</b>`;
      view.classList.add('pro-done');
      setTimeout(() => close('done'), 2600);
    } },
    segs: [{ start: { a: film.tiles.map(() => 1), d: [...film.d].map(Number), p: -1, tray: [], ck: film.ck },
      acts: film.acts.concat([['end', 'ok']]), caps: ['', ''], marks: [] }] };
  coachPlay(view.querySelector('.coach-demo'), clip);
}
