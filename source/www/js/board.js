/* Oma's Mahjong — one level: the pile, the 4 tray slots, tapping, matching, hint and shuffle.
   Special tiles and ice/locks in specials.js. */
'use strict';

const SLOTS = Layouts.SLOTS;
const FLY_MS = 230;                  // a tile gliding into the tray
let G = null;                        // the level being played

// ---------- saving a level half-way (continues after closing the app) ----------
const CUR_V = 7;
const loadCur = () => { try { const c = JSON.parse(localStorage.getItem(CUR) || 'null'); return c && c.v === CUR_V && !c.rp?.closed ? c : null; } catch (e) { return null; } };
const clearCur = () => { try { localStorage.removeItem(CUR); } catch (e) { } };
function saveCur() {
  if (!G || G.done || G.logged || G.film) return;     // (G.film: the intro film's tiny level, js/intro.js)
  syncClock();
  try {
    replayCapture();
    localStorage.setItem(CUR, JSON.stringify({ v: CUR_V, aspect: G.o.aspect, key: G.key, n: G.tiles.length, faces: G.tiles.map(t => t.face), alive: Array.from(G.alive), tray: G.tray, down: Array.from(G.down), peek: G.peek, gold: [...G.gold], score: G.score, elapsed: G.elapsed, usedHint: G.usedHint, usedShuffle: G.usedShuffle, pu: G.peekUsed, uu: G.undoUsed, pk: G.tiles.map((t, i) => t.parked ? i : -1).filter(i => i >= 0), rescued: G.rescued, ez: G.ez, tr: G.o.track || '', ob: obState(), mv: G.mv, ck: G.clock, st: G.st, at: G.attempt, rp: G.rp, hv: boardVer(G.o) }));
  } catch (e) { }
}
function syncClock() { if (G && G.tStart) { const n = performance.now(); G.elapsed += (n - G.tStart) / 1000; G.tStart = n; } }
function pauseClock() { syncClock(); if (G) { G.tStart = 0; replayMark('pause'); replayCapture(); replayDrain(G); } saveCur(); }
function resumeClock() { if (G && !G.done && !G.introducing && curScreen === 'game') { G.tStart = performance.now(); replayMark('resume'); } }

// ---------- starting a level ----------
// the part "own, easier levels" (grandma mode) plays its own, gentler levels (Layouts track 'care')
const levelTrack = () => part('levels') ? 'care' : '';
// from RULES.hard.measureFrom the levels come ready-made (designed with the test player, hard.js and
// levels-hard.js); an easier try (help after losing) gets the usual level, made easier
// the screen shape a level is made for: the same for everyone (RULES.levels.aspect); only grandma's
// own levels follow her screen
const sameShape = tr => tr ? null : RULES.levels.aspect;
function startLevel(level) {
  const tr = levelTrack(), hard = Hard.applies(level, tr), early = !hard && Hard.appliesEarly(level, tr);
  begin({ mode: 'level', level, key: 'L' + level, track: tr, title: tx('levelN', level), fixedAspect: early ? sameShape(tr) : null,
    // (ready-made levels, the same for everyone on any screen: 51 and 53-69 in levels-early.js, from 70 the designed ones)
    makeSpec: a => hard ? Hard.spec(level) : early ? Hard.earlySpec(level) : Layouts.forLevel(level, a, 1, tr), makeEasy: a => Layouts.forLevel(level, a, 1, tr) });
}
function startDaily(k) {
  const d = parseKey(k);
  const tr = levelTrack();
  begin({ mode: 'daily', date: k, key: 'D' + k, track: tr, title: tx('dailyTitle', d.getDate(), monthName(d.getMonth()).slice(0, 3)), fixedAspect: sameShape(tr), makeSpec: a => Layouts.forDate(dnum(k), a, 1, tr) });
}
// which version of a ready-made level a saved board belongs to (designed: its design version, early: the table's)
const boardVer = o => o.mode !== 'level' ? null : Hard.applies(o.level, o.track) ? Hard.designVersion(o.level) : Hard.appliesEarly(o.level, o.track) ? 'e' + Hard.earlyV() : null;

/* o = the level (kept between tries, so "Opnieuw" gives the same deal); restart = a new try */
function begin(o, restart = false) {
  // closed levels (RULES.levels.blockedFrom): checked before a saved board is loaded, a deal is made or a try is counted
  if (o.mode === 'level' && levelBlocked(o.level)) {
    show('levels');
    toast(tx('levelsOnHold', RULES.levels.blockedFrom), 4500);
    return;
  }
  stopPeek();
  const previousReplay = G && G.rp;
  if (previousReplay) { replayCapture(); replayDrain(G); }
  $('#modal').classList.add('hidden'); modalOnClose = null;
  $('#comboTag').classList.remove('on'); clearGameMsg(); FX.clear(); if ($('#autoBanner')) autoBanner(false);
  show('game');
  // shape the pile after the free space on this screen
  const wrap = $('#boardWrap');
  disarmTool();
  $('#game').classList.remove('compact');   // the shape is measured on the ordinary screen (fitGeo may narrow the bars for the board before)
  // Levels made for this screen (1-50, 52, grandma's track) must stay the same now that hint and shuffle sit beside the tray:
  // their row under the pile was always 48 px high, so the shape is measured as if it were still there.
  // The same goes for the top bar: home and restart grew from 44 to 56 px (the helper cards sit under them), so the pile area is lower
  // than before. The shape is measured with the old buttons (class oldbar), so every level and puzzle keeps its shape; the tiles are
  // then fitted into the real, lower area.
  const toolRow = toolsGoneFor(o) ? 0 : OLD_TOOLBAR_H;
  $('#game').classList.add('oldbar'); const wrapH = wrap.clientHeight; $('#game').classList.remove('oldbar');
  const aspect = Math.max(0.4, Math.min(2.4, Math.round((wrapH - toolRow) / Math.max(1, wrap.clientWidth) * 10) / 10)) || 1.5;
  const cur = restart ? null : loadCur();
  // A same-page resume may follow a drained tail. Adopt its cursor only when the saved
  // position matches, without writing over saves replaced by an update/reset.
  if (cur && cur.rp && previousReplay && cur.rp.id === previousReplay.id &&
      JSON.stringify(cur.rp.last) === JSON.stringify(previousReplay.last)) cur.rp = previousReplay;
  const sameTrack = cur && (cur.tr || '') === (o.track || '') &&
    (o.mode !== 'level' || (Hard.applies(o.level, o.track) ? o.level < RULES.hard.rebuildFrom || cur.hv === Hard.designVersion(o.level) : !Hard.appliesEarly(o.level, o.track) || cur.hv == null || cur.hv === boardVer(o)));
  // (a save from before the table (no hv) resumes when its screen shape and tile count fit the level)
  // A new hard-level design starts fresh; earlier levels and grandma's saved boards still resume.
  const ez = cur && cur.key === o.key && sameTrack ? (cur.ez || 0) : 0;      // (only a level saved with an easier deal resumes easier; a new deal is never eased)
  if (!o.spec || (o.ez || 0) !== ez) {
    if (!o.spec) o.aspect = o.fixedAspect || aspect;
    let sp = o.makeSpec(o.aspect);
    if (ez && sp.made && o.makeEasy) sp = o.makeEasy(o.aspect);
    o.spec = Layouts.ease(sp, ez);
    o.ez = ez; o.faces = null; o.down = null; o.gold = null; o.specials = false; o.obstDone = false; o.clock = null;   // a new deal
  }
  const spec = o.spec;
  const tiles = spec.tiles.map(t => ({ x: t.x, y: t.y, z: t.z, face: 0, el: null }));
  const n = tiles.length;
  G = { o, ...o, ptsScale: spec.ptsScale || 1, tiles, nb: Layouts.neighbors(tiles), gold: new Set(), lucky: null, alive: new Uint8Array(n).fill(1), down: new Uint8Array(n), peek: -1, tray: [], arriving: new Set(), flights: 0, score: 0, combo: 0, lastMatch: 0, usedHint: false, usedShuffle: false, peekUsed: 0, undoUsed: 0, rescued: false, ez, elapsed: 0, tStart: 0, mile: 0, done: false, busy: false, mv: 0, clock: null };
  const resumed = !!(cur && sameTrack && cur.key === o.key && cur.n === n && cur.aspect === o.aspect);
  if (resumed) {
    cur.faces.forEach((f, i) => tiles[i].face = f);
    cur.alive.forEach((a, i) => G.alive[i] = a);
    (cur.down || []).forEach((a, i) => G.down[i] = a);
    G.peek = cur.peek ?? -1;
    G.gold = new Set(cur.gold || []);
    Object.assign(G, { tray: cur.tray || [], score: cur.score, elapsed: cur.elapsed, usedHint: !!cur.usedHint, usedShuffle: !!cur.usedShuffle, peekUsed: cur.pu | 0, undoUsed: cur.uu | 0, rescued: !!cur.rescued });
    for (const i of cur.pk || []) if (tiles[i]) { tiles[i].parked = true; PrepBoard.detachTileNeighbors(G.nb, i); }   // (a tile put back beside the pile)
    setObstacles(cur.ob);
    G.mv = cur.mv || 0; G.clock = cur.ck || null;
    G.mile = mileOf();
  } else {
    if (!o.faces) {
      const m = spec.made;      // a designed level (hard.js): the deal, gold, ice, locks and clock come with it
      if (m) { o.faces = m.faces.slice(); o.down = m.down.slice(); o.gold = (m.gold || []).slice(); o.specials = true; o.obst = m.obst; o.obstDone = true; o.clock = m.clock; }
      else { const d = Layouts.makeDeal(spec, 24, !o.track); o.faces = d.faces; o.down = d.down; }   // (no time limit: the same deal on every phone)
    }
    addSpecials(o, spec);
    o.faces.forEach((f, i) => tiles[i].face = f);
    G.gold = new Set(o.gold || []);
    (o.down || []).forEach(i => G.down[i] = 1);
    addObstacles(o, spec); setObstacles(o.obst);
    G.clock = o.clock ? { ...o.clock } : null;
    clearCur();
  }
  // the clock and the play log come first, so they are right even if drawing the board goes wrong
  // (in 1.10 a level could be played without them: logged as won in 0 seconds with 0 taps)
  G.tStart = performance.now();
  G.st = { tp: 0, bt: 0, fl: 0, mc: 0, tm: 0, ...(resumed && cur.st || {}) };    // counters continue across closing/reopening
  if (!resumed || !S.att[o.key]) { S.att[o.key] = (S.att[o.key] || 0) + 1; save(); }
  G.attempt = S.att[o.key];
  replayBegin(cur, resumed);
  const focused = !!spec.made && o.mode === 'level' && o.level >= RULES.hard.rebuildFrom;
  logEvt('start', { ...lvInfo(), aid: G.rp && G.rp.id, at: G.attempt, n, res: resumed || undefined, rs: restart || undefined, ez: ez || undefined, tk: o.track || undefined, pr: spec.made && spec.made.info ? (focused ? spec.made.info.strong : spec.made.info.rate) : undefined, pm: focused ? Hard.ratingModel(o.level) : undefined, ck: G.clock ? G.clock.n : undefined, tl: toolsEarnLevel(toolLevel(o)) ? (toolsGoneFor(o) ? 0 : 1) : undefined });
  $('#gameTitle').textContent = o.title;
  try {
    show('game');
    renderBoard(!restart); fitToolbar();
    renderTray(); updateTools();
    updateScore(false); updateProgress();
  } catch (e) { logErr(e, 'begin'); }
  saveCur();
  setTimeout(() => praise(restart ? tx('againPraise') : o.mode === 'daily' ? tx('dailyPraise') : o.title), 150);
  const ready = () => {
    if (!S.seenTray) setTimeout(() => showIntro(), 700);
    else { setTimeout(checkStuck, 500); setTimeout(jokerLeftover, 700); }
  };
  // Finish every new-tile introduction before starting play or any optional replay.
  const introductions = () => {
    if (clockIntro(introductions) || newTileIntro(introductions)) return;
    if (!S.seenDown && G.down.some(Boolean)) { showDownTip(introductions); return; }
    G.introducing = false; resumeClock();
    ready();
  };
  G.introducing = true; syncClock(); G.tStart = 0;
  introductions();
}
const restart = () => { if (G) { if (!G.done && !G.logged) { noteFail(); endLevel('restart'); } begin(G.o, true); } };
// failed tries per level (cleared when it is won); a failed try also ends a win streak
function noteFail() { if (!G) return; S.fails[G.key] = (S.fails[G.key] || 0) + 1; S.winStreak = 0; save(); }

// ---------- small helpers ----------
const aliveCount = () => G.alive.reduce((a, b) => a + b, 0);
const free = i => Layouts.isFree(i, G.alive, G.nb);
const faceOf = i => G.tiles[i].face;
const trayHas = face => G.tray.some(t => faceOf(t) === face);
const centerOf = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const clearHint = () => G.tiles.forEach(t => t.el.classList.remove('hint'));
// a tile leaves the board (the caller animates it)
function takeOff(i) { G.alive[i] = 0; G.down[i] = 0; if (G.peek === i) G.peek = -1; G.tiles[i].el.classList.add('hidden'); G.mv++; clockMove(i); }
/* After a tile left the board, it flies for ms; then fn runs and the level carries on.
   Taps never wait for this: the game state has changed already, the animation just catches up. */
function afterFlight(ms, fn) { G.flights++; afterLogic(); setTimeout(() => { G.flights--; fn(); afterLand(); }, ms); }
function afterLogic() {
  updateBlocked(); updateObstacles(); updateProgress(); checkClock();
  if (G.film) return;
  if (aliveCount() === 0 && G.tray.length === 0) { G.done = true; clearCur(); return; }
  saveCur();
}
function afterLand() {
  if (G.film) return;
  if (G.done) { if (G.flights === 0 && !G.winShown) { G.winShown = true; setTimeout(win, 450); } return; }
  if (G.flights === 0) { checkStuck(); obRelief(); jokerLeftover(); maybeLucky(); maybeAutoFinish(); }
}

// ---------- drawing ----------
function decorate(i) {
  const t = G.tiles[i], el = t.el; if (!el) return;
  el.classList.toggle('gold', G.gold.has(i));
  el.classList.toggle('sp-joker', t.face === JOKER);
  // Ice keeps its overlay, with the key/lock badge above it when both apply.
  paintOb(el, obKind(i), obMarker(i));
  if (G.clock && G.clock.i === i) clockBadge();
}
// the alarm clock: a badge with the moves left, above everything (so tiles on top never hide it)
function clockBadge() {
  let ck = $('#clockBadge');
  const on = clockOn(), el = on && G.tiles[G.clock.i].el;
  G.tiles.forEach((t, k) => t.el && t.el.classList.toggle('clocked', on && k === G.clock.i));
  if (!on || !el || !G.tiles[G.clock.i].r) { if (ck) ck.remove(); return; }
  if (!ck) { ck = document.createElement('div'); ck.id = 'clockBadge'; ck.className = 'ck'; $('#board').appendChild(ck); }
  const r = G.tiles[G.clock.i].r, left = clockLeft();
  ck.innerHTML = `<span>⏰</span><b>${left}</b>`;
  // one move used: the number gives a little hop, so you see every tile counts (1.58)
  if (+ck.dataset.n > left) try { ck.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.4)', offset: .35 }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' }); } catch (e) { }
  ck.dataset.n = left;
  ck.style.fontSize = (G.tw * 0.24).toFixed(1) + 'px';
  // the timer stays whole: a clock in the top row or at the right edge used to push it out of the board, where it was cut off
  const bd = $('#board'), bw = bd.clientWidth, bh = bd.clientHeight, cw = ck.offsetWidth, ch = ck.offsetHeight;
  let x = r.l + r.w * 0.55, y = r.t - r.h * 0.16;
  if (bw && cw) x = Math.max(2, Math.min(x, bw - cw - 2));
  if (bh && ch) y = Math.max(2, Math.min(y, bh - ch - 2));
  ck.style.left = x.toFixed(1) + 'px'; ck.style.top = y.toFixed(1) + 'px';
  ck.classList.toggle('urgent', left <= 5);
}
const setFace = i => { G.tiles[i].el.querySelector('.face').innerHTML = Tiles.boardFace(S.theme, faceOf(i)); decorate(i); };
/* Drawing the pile (1.58): positions are worked out before anything is put on the screen and the
   whole pile goes in at once, each tile already in its place with its overlays, so the phone styles
   and lays it out a single time. Before, every tile was added, then measured, then moved, then
   marked again, which made the phone redo the whole pile several times while the level opened.
   The tiles of each layer sit together in one group (.lyr): the pile comes in layer by layer, a
   handful of moving pictures instead of 96 (each moving tile cost a phone its own picture). */
function renderBoard(enter) {
  const board = $('#board'), wrap = $('#boardWrap');
  board.innerHTML = '';
  board.classList.toggle('hl', S.highlight);
  Tiles.useFaces(S.theme, G.tiles.map(t => t.face));
  const geo = fitGeo();
  if (!geo) return;
  sizeTray();                      // (measured now, while measuring is free: nothing changed since the read above)
  applyGeo(geo, false);
  const order = G.tiles.map((t, i) => i).sort((a, b) => G.tiles[a].z - G.tiles[b].z || G.tiles[a].y - G.tiles[b].y || G.tiles[a].x - G.tiles[b].x);
  const layers = new Map();
  for (const i of order) {
    const t = G.tiles[i], r = t.r, k = obKind(i);
    const cls = 'tile' + (G.alive[i] ? '' : ' hidden') + (G.down[i] && G.peek !== i ? ' back' : '') + (G.gold.has(i) ? ' gold' : '') + (t.face === JOKER ? ' sp-joker' : '') + (G.alive[i] && !free(i) ? ' blocked' : '');
    const html = `<div class="${cls}" data-i="${i}" style="left:${r.l}px;top:${r.t}px;width:${r.w.toFixed(1)}px;height:${r.h.toFixed(1)}px;z-index:${r.zi % 10000}"><div class="face">${Tiles.boardFace(S.theme, t.face)}</div>${obHTML(k, obMarker(i))}</div>`;
    if (!layers.has(t.z)) layers.set(t.z, []);
    layers.get(t.z).push([i, html]);
  }
  const zs = [...layers.keys()].sort((a, b) => a - b);
  board.innerHTML = zs.map(z => `<div class="lyr" style="z-index:${z + 1}">${layers.get(z).map(x => x[1]).join('')}</div>`).join('');
  [...board.children].forEach((ly, n) => {
    const list = layers.get(zs[n]);
    [...ly.children].forEach((el, k) => { G.tiles[list[k][0]].el = el; });
    // the pile drops in layer by layer (the moving groups are let go again when they have landed)
    if (enter) { ly.classList.add('enter'); ly.style.animationDelay = Math.min(700, n * 130) + 'ms'; }
  });
  if (enter) { const g = G; setTimeout(() => { if (G === g) board.querySelectorAll('.lyr.enter').forEach(ly => { ly.classList.remove('enter'); ly.style.animationDelay = ''; }); }, 1400); }
  clockBadge(); refreshParked();
  afterPaint(replayView);
}
/* A glowing tile (the lucky moment, the helper's pair) must show above the whole pile. It leaves
   its layer group for that time (a tile can only rise above the tiles of its own group). */
function glow(i, cls, on) {
  const el = G && G.tiles[i] && G.tiles[i].el; if (!el) return;
  el.classList.toggle(cls, on);
  const board = $('#board'), lifted = el.parentNode === board;
  if (el.classList.contains('lucky')) { if (!lifted) { el._lyr = el.parentNode; board.appendChild(el); } }
  else if (lifted && el._lyr && el._lyr.isConnected) { el._lyr.appendChild(el); el._lyr = null; }
}
/* Where the tiles go for a board of W x H pixels (nothing is read from or written to the page). */
function boardGeo(W, H, maxTw = 150) {
  if (!W || !H) return null;
  const ratio = 1.24, dF = 0.14;   // tile height / width; each layer shifts up-left this much, so more of the tiles below shows
  // where the tiles really land, in tile widths (an upper layer only reaches the edge if its tiles do)
  let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9;
  for (const t of G.tiles) {
    const x = t.x / 2 - t.z * dF, y = t.y / 2 * ratio - t.z * dF;
    l = Math.min(l, x); r = Math.max(r, x + 1); t0 = Math.min(t0, y); b = Math.max(b, y + ratio);
  }
  const depthF = 0.085;            // the tile's side, drawn right and below it
  // 2 px of room on each side (was 4 until 1.68): a pile seven tiles wide keeps 54 px tiles on a 392 px screen (the owner 2026-11-14)
  // At the top, 12 px between the tray and the pile: the tray's wooden edge and shadow hang 4-8 px below it, and with 2 px a
  // tall pile's top row sat under that edge (1.69, Gerda's phone, level 219; the owner 2026-11-15). 2 px at the bottom.
  const TOP = 12, BOT = 2;
  const twW = (W - 4) / (r - l + depthF + 0.04), twH = (H - TOP - BOT) / (b - t0 + depthF * 1.4 + 0.04), tw = Math.min(maxTw, twW, twH);
  const th = tw * ratio, dz = tw * dF, d = Math.max(3, tw * depthF);
  // centred on what is really there: even space left and right, and between the tray and the buttons below (below the tray's edge)
  const ox = (W - (r - l) * tw - d) / 2 - l * tw, oy = TOP + (H - TOP - BOT - (b - t0) * tw - d * 1.4) / 2 - t0 * tw;
  return { tw, th, dz, d, ox, oy, tall: twH < twW && twH < 150 };   // tall: the height of the pile area decides the tile size
}
// remember the positions (t.r, G.tw); move the tiles that are on the screen already when asked
function applyGeo(geo, move) {
  const { tw, th, dz, d, ox, oy } = geo, board = $('#board');
  board.style.setProperty('--d', d.toFixed(1) + 'px');
  board.style.setProperty('--fs', (tw * 0.66).toFixed(1) + 'px');
  G.tw = tw;
  for (const t of G.tiles) {
    const zi = t.z * 10000 + t.y * 100 + t.x;
    const lf = +(ox + t.x / 2 * tw - t.z * dz).toFixed(1), tp = +(oy + t.y / 2 * th - t.z * dz).toFixed(1);
    t.r = { l: lf, t: tp, w: tw - 1.5, h: th - 1.5, zi };
    if (move && t.el) { const s = t.el.style; s.left = lf + 'px'; s.top = tp + 'px'; s.width = (tw - 1.5).toFixed(1) + 'px'; s.height = (th - 1.5).toFixed(1) + 'px'; }
  }
}
// The pile area for this board. A pile that is limited by the height (nine rows, or a short screen) gets a little more room:
// the top bar and the tray lose some of their padding (#game.compact in style.css), nothing gets smaller (the owner 2026-11-14).
function fitGeo() {
  const game = $('#game'), wrap = $('#boardWrap');
  if (G.film) return boardGeo(wrap.clientWidth, wrap.clientHeight, G.film.maxTw);   // (the intro film's board, in its pop-up, tiles no bigger than the level's: the game screen stays as it is)
  game.classList.remove('compact');
  let geo = boardGeo(wrap.clientWidth, wrap.clientHeight);
  if (geo && geo.tall) { game.classList.add('compact'); geo = boardGeo(wrap.clientWidth, wrap.clientHeight); }
  return geo;
}
// after a change of screen size: the same tiles, moved
function layoutBoard() {
  if (!G) return;
  const geo = fitGeo();
  if (!geo) return;
  applyGeo(geo, true); refreshParked(); fitToolbar();
  sizeTray();
  clockBadge();
  replayView();
}
// tray slots scale with the screen but stay big
// (measured when the board is laid out, not on every tap: measuring makes the phone lay out the page)
function sizeTray() { const slot = $('#tray .slot'); if (slot && slot.clientWidth) $('#tray').style.setProperty('--sfs', (slot.clientWidth * 0.62).toFixed(1) + 'px'); }
function updateBlocked() { G.tiles.forEach((t, i) => { if (G.alive[i]) t.el.classList.toggle('blocked', !free(i)); }); }
function updateProgress() { const n = G.tiles.length; $('#progressBar').style.transform = `translateX(${((n - aliveCount() - G.tray.length) / n * 100 - 100).toFixed(2)}%)`; }
function updateScore(bump = true) { const el = $('#score'); el.textContent = G.score; if (bump) replay(el, 'bump'); }
function addScore(pts) { G.score += pts; updateScore(); floatScore('+' + pts); }
// Hint and Schudden unlock at a level (daily puzzles: once you have reached that level). From
// HELP.toolsGoneFrom on (not in grandma mode) they have to be earned: the levels go in blocks of
// RULES.tools.earn.every (50-54, 55-59, ...), and in a block you have them when every level before
// that block has 3 stars. So they are checked again every 5 levels, and come back as soon as the
// missing levels are played again for 3 stars. Without them the toolbar is not shown and the pile
// gets its space; with them the pile leaves room for the buttons, as before level 50.
const OLD_TOOLBAR_H = 48;   // height of the hint/shuffle row under the pile until 1.69 (same on every screen and language)
const toolLevel = o => o.mode === 'level' ? o.level : S.level;
const toolBlock = L => { const g = help().toolsGoneFrom, k = RULES.tools.earn.every; return g + Math.floor((L - g) / k) * k; };
function toolsMissing(L) { const m = []; for (let l = 1; l < toolBlock(L); l++) if ((S.stars[l] || 0) < RULES.tools.earn.stars) m.push(l); return m; }
const toolsEarnLevel = L => { const g = help().toolsGoneFrom; return !!g && L >= g; };     // a level where they have to be earned
const toolsEarned = L => toolsEarnLevel(L) && !toolsMissing(L).length;
const toolsGoneFor = o => toolsEarnLevel(toolLevel(o)) && !toolsEarned(toolLevel(o));
const toolsGone = () => !!G && toolsGoneFor(G);
const toolsOpen = () => !!G && toolLevel(G) >= RULES.tools.fromLevel && !toolsGone();
// the two helper buttons: the count is the stock (S.peekStock / S.undoStock), a try uses each once (G.peekUsed / G.undoUsed)
const HELPER_BTN = { peek: ['#btnPeek', 'peekStock', 'peekUsed'], undo: ['#btnUndo', 'undoStock', 'undoUsed'] };
function updateTools() {
  for (const [k, [id, stock, used]] of Object.entries(HELPER_BTN)) {
    const on = SHOP_RULES[k].enabled;
    $(id).classList.toggle('gone', !on);
    $(id).classList.toggle('used', !!(G && G[used]));
    $(id + ' .cnt').textContent = S[stock] | 0;
  }
  $('.toolbar').classList.toggle('gone', !SHOP_RULES.peek.enabled && !SHOP_RULES.undo.enabled);
}
function renderTray() {
  const slots = $('#tray').children;
  for (let k = 0; k < SLOTS; k++) {
    const t = G.tray[k];
    slots[k].innerHTML = t === undefined ? '' : `<div class="tmini${G.arriving.has(t) ? ' arriving' : undoWait ? ' pulse' : ''}">${Tiles.boardFace(S.theme, faceOf(t))}</div>`;
  }
  const tr = $('#tray');
  tr.classList.toggle('warn', G.tray.length === SLOTS - 2);   // 2 waiting: careful
  tr.classList.toggle('full', G.tray.length >= SLOTS - 1);    // 3 waiting: the next miss ends the level
}

// a copy of the tile that glides from the board into its tray slot
function flyTile(face, from, to, ms) {
  const f = document.createElement('div');
  f.className = 'tile flying';
  f.innerHTML = `<div class="face">${Tiles.boardFace(S.theme, face)}</div>`;
  Object.assign(f.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
  f.style.setProperty('--d', '3px');
  f.style.setProperty('--fs', (from.width * 0.66) + 'px');
  document.body.appendChild(f);
  const sx = to.width / from.width, sy = to.height / from.height;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    f.style.transition = `transform ${ms}ms cubic-bezier(.35,.1,.25,1)`;
    f.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${sx}, ${sy})`;
  }));
  return f;
}
// a copy of the tray tile that stays where it sat while its slot closes (it pops with the match)
function ghostOf(slotEl) {
  const m = slotEl.firstElementChild; if (!m) return null;
  const to = slotEl.getBoundingClientRect(), g = m.cloneNode(true);
  g.classList.add('ghost');
  Object.assign(g.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
  g.style.setProperty('--sfs', $('#tray').style.getPropertyValue('--sfs'));
  document.body.appendChild(g);
  return g;
}
// the flying copies pop, then disappear
function popAway(els) { els = els.filter(Boolean); els.forEach(e => e.classList.add('popout')); setTimeout(() => els.forEach(e => e.remove()), 230); }

/* A stuck tile: arrows point at the tiles that are in the way
   (the ones lying on top of it, or its neighbours on the left and the right). */
function blockersOf(i) {
  const nb = G.nb, alive = G.alive;
  const up = nb.above[i].filter(j => alive[j]);
  if (up.length) return up.map(j => ({ j, side: 'up' }));
  const t = G.tiles[i];
  // per side the neighbour that overlaps most in height
  const best = list => list.filter(j => alive[j]).sort((a, b) => Math.abs(G.tiles[a].y - t.y) - Math.abs(G.tiles[b].y - t.y))[0];
  return [best(nb.left[i]), best(nb.right[i])].filter(j => j !== undefined).map(j => ({ j, side: 'side' }));
}
function showBlockers(i) {
  if (!G) return;
  const board = $('#board');
  board.querySelectorAll('.blk-arrow').forEach(a => a.remove());
  const a = G.tiles[i].r;
  if (!a) return;
  const ac = { x: a.l + a.w / 2, y: a.t + a.h / 2 };
  const size = Math.max(26, Math.min(56, G.tw * 0.62));
  const seen = new Set(), blockers = blockersOf(i);
  // see through the tiles lying on top of it, so you can see what is underneath
  for (const { j, side } of blockers) if (side === 'up') replay(G.tiles[j].el, 'xray', 1800);
  for (const { j } of blockers) {
    const b = G.tiles[j].r; if (!b) continue;
    let dx = b.l + b.w / 2 - ac.x, dy = b.t + b.h / 2 - ac.y;
    if (Math.hypot(dx, dy) < a.w * 0.2) { dx = -1; dy = -1; }   // lying right on top: point up-left onto it
    const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const ang = Math.round(Math.atan2(uy, ux) * 180 / Math.PI);
    if (seen.has(ang)) continue; seen.add(ang);
    // the arrow starts on the stuck tile and its tip touches the tile in the way
    const reach = Math.min(len, a.w * 0.62);
    const px = ac.x + ux * reach * 0.55, py = ac.y + uy * reach * 0.55;
    const ar = document.createElement('div');
    ar.className = 'blk-arrow';
    ar.style.cssText = `left:${px.toFixed(1)}px;top:${py.toFixed(1)}px;width:${size.toFixed(0)}px;height:${(size * 0.62).toFixed(0)}px;--a:${ang}deg`;
    ar.innerHTML = '<svg viewBox="0 0 50 31"><path d="M3 11h26V3l18 12.5L29 28v-8H3z" fill="#ff8a00" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>';
    board.appendChild(ar);
    replay(G.tiles[j].el, 'blocker', 1300);
    setTimeout(() => ar.remove(), 1300);
  }
}

// ---------- tapping ----------
let blockedTaps = 0, comboTimer;
function onTap(i, auto = false, point = null) {
  if (!auto) disarmTool();
  if (!G || G.done || G.introducing) return;
  if (G.busy || !G.alive[i] || (G.autoFin && !auto)) {
    replayMark('ignored', [i, auto ? 1 : 0, point, G.busy ? 'busy' : !G.alive[i] ? 'gone' : 'auto']);
    return;   // (auto-finish: hands off)
  }
  replayMark('tap', [i, auto ? 1 : 0, !free(i) ? 'covered' : frozen(i) ? 'ice' : lockedT(i) ? 'lock' : '', point]);
  try { return tapTile(i); } finally { replayCapture(); }
}
function tapTile(i) {
  Sound.init();
  const el = G.tiles[i].el;
  G.st.tp++;
  if (!free(i)) {
    G.st.bt++;
    replay(el, 'shake');
    // a special tile that cannot be taken shows what it needs, not what lies on it (the owner 2026-11-14): the tiles that thaw it, or the keys
    if (frozen(i)) showThaw(i); else if (lockedT(i)) showKeys(); else showBlockers(i);
    Sound.blocked(); buzz(30);
    if (++blockedTaps === 3) toast(tx('stillStuck'), 3000);
    return;
  }
  if (frozen(i) || lockedT(i)) { G.st.bt++; obBlocked(i); return; }
  blockedTaps = 0;
  let reveal = false;
  if (G.down[i] && G.peek !== i) {
    const pk = G.peek;
    const twinOpen = pk >= 0 && G.alive[pk] && free(pk) && faceOf(pk) === faceOf(i);
    if (!twinOpen && !trayHas(faceOf(i))) {
      // face-down tile: first tap turns it over (only one at a time), second tap takes it
      if (pk >= 0 && G.alive[pk]) turn(pk, true);
      G.peek = i; turn(i, false);
      Sound.flip(); buzz(8); clearHint();
      bumpStat('flips'); G.st.fl++;
      afterPaint(() => { taskProgress('flips'); saveCur(); });
      return;
    }
    // its twin waits in the tray, or is the open tile (which counts as picked): it matches right
    // away; the tile flips open while it flies, so you see what it was
    reveal = true; Sound.flip();
  }
  if (G.peek === i) G.peek = -1;
  G.down[i] = 0;
  const face = faceOf(i);
  const mi = G.tray.findIndex(t => faceOf(t) === face);
  const pk = G.peek;
  const peekPair = mi < 0 && pk >= 0 && pk !== i && G.alive[pk] && faceOf(pk) === face && free(pk);
  // the joker fits every picture (see jokerPlay); as the very last tile it ends the level with a bonus
  if (face === JOKER && !G.tray.length && !G.tiles.some((t, k) => k !== i && G.alive[k])) { jokerFinale(i); return; }
  if (mi < 0 && !peekPair) {
    if (face === JOKER) { const x = jokerTarget(); if (x !== null) { jokerPlay(i, x); return; } }
    else { const jt = G.tray.find(t => faceOf(t) === JOKER && !G.arriving.has(t)); if (jt !== undefined) { jokerPlay(jt, i); return; } }
    if (G.tray.length >= SLOTS) { replay(el, 'shake'); Sound.blocked(); toast(tx('trayFull')); return; }
  }
  clearHint();
  luckyTaken(i);
  const from = el.getBoundingClientRect();
  takeOff(i);
  Sound.select(); buzz(8);
  const flyFrom = (f, to) => { const c = flyTile(face, f, to, FLY_MS); if (reveal && f === from) c.classList.add('reveal'); return c; };

  if (peekPair) {
    // the open face-down tile and this one match straight away, no slot needed
    const pfrom = G.tiles[pk].el.getBoundingClientRect();
    takeOff(pk);
    const gold = G.gold.has(i) || G.gold.has(pk);
    const mid = { left: (from.left + pfrom.left) / 2, top: (from.top + pfrom.top) / 2 - from.height * 0.3, width: from.width, height: from.height };
    const f1 = flyFrom(from, mid), f2 = flyFrom(pfrom, mid);
    afterFlight(FLY_MS, () => { popAway([f1, f2]); onMatch({ x: mid.left + mid.width / 2, y: mid.top + mid.height / 2 }, face, gold); });
    return;
  }
  if (mi >= 0) {
    // its twin waits in the tray: keep a copy of it where it sat, then close the gap right away
    const partner = G.tray[mi], slotEl = $('#tray').children[mi], to = slotEl.getBoundingClientRect();
    const ghost = G.arriving.has(partner) ? null : ghostOf(slotEl);
    G.tray.splice(mi, 1); G.arriving.delete(partner);
    const gold = G.gold.has(i) || G.gold.has(partner);
    renderTray();
    const fly = flyFrom(from, to);
    afterFlight(FLY_MS, () => { popAway([fly, ghost]); onMatch(centerOf(slotEl), face, gold); });
    return;
  }
  // no partner yet: into the next free slot
  const slotIdx = G.tray.length;
  G.tray.push(i);
  G.st.tm = Math.max(G.st.tm, G.tray.length);
  G.arriving.add(i);
  if (G.tray.length >= SLOTS) G.busy = true;   // 4th tile without a match: level over, no more taps
  renderTray();
  const fly = flyFrom(from, $('#tray').children[slotIdx].getBoundingClientRect());
  afterFlight(FLY_MS, () => {
    fly.remove();
    G.arriving.delete(i);
    if (!G.tray.includes(i)) return;
    renderTray();
    const m = $('#tray').children[G.tray.indexOf(i)].firstElementChild;
    if (m) m.classList.add('land');
    if (G.tray.length === SLOTS - 1) Sound.warn(); else Sound.land();
  });
}
/* Turning a face-down tile over (or back). The new side shows right away, with a short squeeze
   played by the graphics chip itself (Web Animations). Before 1.41 the face only showed after
   140 ms, and restarting a CSS animation made the phone lay out the whole pile again on every
   turn, which felt laggy on slower phones. */
function turn(i, faceDown) {
  const el = G.tiles[i].el;
  el.classList.toggle('back', faceDown && !el.classList.contains('peeked'));   // (Spieken shows it until the countdown ends)
  try { el.animate([{ transform: 'scaleX(.12)' }, { transform: 'scaleX(1)' }], { duration: faceDown ? 140 : 180, easing: 'cubic-bezier(.2,.9,.3,1)' }); } catch (e) { }
}
// work that can wait until the screen has shown the change (saving, task counting)
const afterPaint = fn => requestAnimationFrame(() => setTimeout(fn, 0));
function showDownTip(after = null) {
  openModal(`<h2>${tx('downTitle')}</h2>
    <div class="how-tray" style="grid-template-columns:repeat(2,52px)"><div class="hm backmini"></div><div class="hm glow">${Tiles.faceHTML('classic', 32)}</div></div>
    <p>${tx('down1')}</p>
    <p>${tx('down2')}</p>
    <button class="big-btn play" id="mGo"><span class="bb-text"><b>${tx('gotIt')}</b></span></button>`, false);
  $('#mGo').onclick = () => { S.seenDown = true; save(); closeModal(); if (after) after(); };
}

// ---------- a pair is made ----------
function onMatch(c, face, gold) {
  if (G.film) { FX.burst(c.x, c.y - 10, 20, false); Sound.match(1); return; }   // the intro film: the pair pops, nothing is counted
  const now = performance.now(), comboMs = help().comboMs, sc = RULES.score;
  G.combo = now - G.lastMatch < comboMs ? G.combo + 1 : 1;
  G.lastMatch = now;
  const mult = specialMatch(face, gold, c);
  const pts = Math.round(sc.pair * Math.min(G.combo, sc.maxCombo) * mult * (G.ptsScale || 1));   // (grandma's smaller piles: same points)
  G.score += pts;
  S.matches++;
  taskProgress('pairs'); taskProgress('combo', G.combo, true);
  if (G.combo > S.bestCombo) S.bestCombo = G.combo;
  G.st.mc = Math.max(G.st.mc, G.combo);
  const sunny = S.theme === 'sunflower', big = G.combo >= 3;
  FX.burst(c.x, c.y - 10, sunny ? 12 : big ? 30 : 20, big);
  if (sunny) { FX.emoji(c.x, c.y - 10, big ? ['🌻', '🌼', '🐝', '✨'] : ['🌻', '🌼', '✨'], big ? 8 : 5); if (big && G.combo % 2 === 1) bee(); }
  const superCombo = G.combo % sc.maxCombo === 0;
  if (superCombo) setTimeout(() => { Sound.supercombo(); flash(); praise(tx('superCombo')); FX.burst(innerWidth / 2, innerHeight / 2.4, 46, true); if (sunny) bee(); buzz([20, 40, 20, 40, 40]); }, 120);
  floatScore('+' + pts);
  Sound.match(G.combo); buzz(big ? [15, 40, 25] : 18);
  updateScore();
  const tag = $('#comboTag');
  if (G.combo >= 2) { tag.textContent = tx('combo', Math.min(G.combo, sc.maxCombo)); tag.classList.add('on'); }
  clearTimeout(comboTimer); comboTimer = setTimeout(() => tag.classList.remove('on'), comboMs);
  const left = aliveCount();
  if (superCombo || gold || face === JOKER) { /* already celebrated */ }
  else if (left === 0 && G.tray.length === 0) { praise(tx('lastPair')); FX.burst(c.x, c.y, 40, true); }
  else if (left > 0 && mileOf() > G.mile) milestone(mileOf());
  else if (big && G.combo % 2 === 1) { const P = tx('praiseList'); praise(P[Math.min(P.length - 1, Math.floor(Math.random() * 3) + (G.combo - 3))]); }
  else if (left === 4) praise(tx('almostDone'));
}
/* a quarter, half and three quarters of the pile cleared: a little party on the progress bar */
function mileOf() { const n = G.tiles.length, gone = n - aliveCount() - G.tray.length; return Math.min(3, Math.floor(gone / n * 4)); }
function milestone(m) {
  G.mile = m;
  praise(tx('miles')[m]);
  Sound.star(m - 1); buzz(15);
  const bar = $('#progressBar'); replay(bar, 'shine');
  const r = bar.getBoundingClientRect(); FX.burst(r.right, r.top + r.height / 2, 18, true);
}

// ---------- auto-finish (RULES.autoFinish) ----------
/* Can the rest still go wrong? Every order of taps is tried: taking any free tile (a face-down one
   too: peeking changes nothing), and taking a peeked face-down tile together with its free twin.
   Unsafe as soon as some order puts a 4th tile without a partner in the tray. The tray follows from
   which tiles are gone, so a position is just the set of tiles still on the board (memoised).
   p = { faces, nb, alive (Uint8Array), down, tray: [faces] }. Returns true (safe), false, or null
   (too big to be sure). */
function finishSafe(p, budget = RULES.autoFinish.budget) {
  const rem = []; for (let i = 0; i < p.alive.length; i++) if (p.alive[i]) rem.push(i);
  if (rem.length > 30) return null;
  const alive = new Uint8Array(p.alive.length), memo = new Map();
  let nodes = 0;
  function go(mask, tray) {
    if (mask === 0) return true;
    const known = memo.get(mask); if (known !== undefined) return known;
    if (++nodes > budget) throw 'budget';
    alive.fill(0); rem.forEach((t, k) => { if (mask & (1 << k)) alive[t] = 1; });
    const fr = []; rem.forEach((t, k) => { if ((mask & (1 << k)) && Layouts.isFree(t, alive, p.nb)) fr.push(k); });
    let safe = fr.length > 0;
    for (const k of fr) {
      if (!safe) break;
      const f = p.faces[rem[k]], m = mask & ~(1 << k), at = tray.indexOf(f);
      if (at >= 0) safe = go(m, tray.slice(0, at).concat(tray.slice(at + 1)));
      else if (tray.length + 1 >= SLOTS) safe = false;                 // a 4th tile without a partner
      else safe = go(m, tray.concat(f));
      // a peeked face-down tile and its free twin go together, without the tray
      if (safe && p.down[rem[k]] && at < 0) for (const j of fr) if (j !== k && p.faces[rem[j]] === f) { safe = go(m & ~(1 << j), tray); if (!safe) break; }
    }
    memo.set(mask, safe);
    return safe;
  }
  try { return go(rem.length === 32 ? -1 : (1 << rem.length) - 1, p.tray.slice()); } catch (e) { return null; }
}
function autoFinishOK() {
  const A = RULES.autoFinish;
  if (!A || !G || G.done || G.autoFin || G.busy || G.flights || G.overShown || toolLevel(G) < A.fromLevel) return false;
  if (aliveCount() > A.maxTiles || !aliveCount()) return false;
  if (clockOn()) return false;                                   // the alarm clock: she plays it herself
  // ice, locks and jokers have their own rules: only when none of them are left
  if (G.tiles.some((t, i) => G.alive[i] && (t.face === JOKER || obKind(i))) || G.tray.some(t => faceOf(t) === JOKER)) return false;
  return finishSafe({ faces: G.tiles.map(t => t.face), nb: G.nb, alive: G.alive, down: G.down, tray: G.tray.map(faceOf) }) === true;
}
function autoBanner(on) {
  let el = $('#autoBanner');
  if (!el) { el = document.createElement('div'); el.id = 'autoBanner'; $('#boardWrap').appendChild(el); }
  if (on) el.innerHTML = `<span class="ab-ico">🪄</span><b>${tx('autoFinish')}</b><span>${tx('autoFinish2')}</span>`;
  el.classList.toggle('on', on);
}
function maybeAutoFinish() {
  if (!autoFinishOK()) return;
  G.autoFin = true; clearHint();
  replayMark('auto');
  autoBanner(true);      // big over the pile (nobody needs to see it any more); combo texts stay in the top bar
  logLvl('auto');
  const step = () => {
    if (!G || G.done || !G.autoFin) return;
    // a tile whose twin waits in the tray first, then any free tile (every order is safe now)
    const fr = []; for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && free(i)) fr.push(i);
    const i = fr.find(i => trayHas(faceOf(i))) ?? fr.find(i => fr.some(j => j !== i && faceOf(j) === faceOf(i))) ?? fr[0];
    if (i === undefined) return;
    onTap(i, true); if (G.alive[i]) onTap(i, true);              // a face-down tile: turn it, then take it
    setTimeout(step, RULES.autoFinish.stepMs);
  };
  setTimeout(step, 700);
}

// ---------- a full tray ----------
function checkStuck() {
  if (!G || G.done || G.overShown || G.tray.length < SLOTS) return;
  G.busy = true; G.overShown = true;
  syncClock();
  gameOver();
}
function failTry() { bumpStat('losses'); noteFail(); endLevel('stuck'); }
function gameOver() {
  failTry();
  setTimeout(() => {
    Sound.stuck(); buzz([40, 80, 40]);
    openModal(`<h2>${tx('fullTitle')}</h2>
      <p>${tx('fullText')}</p>
      <button class="big-btn play" id="sRetry"><span class="bb-text"><b>${tx('tryAgain')}</b></span></button>
      <button class="link-btn" id="sMenu">${tx('menu')}</button>`, false);
    $('#sRetry').onclick = () => { closeModal(); restart(); };
    $('#sMenu').onclick = () => { closeModal(); clearCur(); G.done = true; show('home'); };
  }, 450);
}

// The helper cards never touch home above them (home's bottom edge + 1 px), also armed (3 px ring and 6 % growth): on a short tray row the
// card gets lower than 56 px (the width stays 58); when even that leaves under 44 px the armed growth is dropped and ring and glow stay.
function fitToolbar() {
  const tb = $('.toolbar'), home = $('#btnHome'); if (!tb || !home || tb.classList.contains('gone')) return;
  const room = tb.getBoundingClientRect().bottom - (home.getBoundingClientRect().bottom + 5);   // from home's edge down to the card's bottom
  if (!(room > 0)) return;
  let h = Math.floor((room - 4) / 1.03), grow = true;
  if (h < 44) { h = Math.floor(room - 4); grow = false; }
  tb.style.setProperty('--toolh', Math.max(36, Math.min(56, h)) + 'px');
  tb.classList.toggle('nogrow', !grow);
}
// ---------- 👁️ Spieken and ↩️ Steen terugleggen (tokens from the shop, once per try each) ----------
// A tap asks first (asking spends nothing). Spieken: for SHOP_RULES.peek.durationMs every face-down tile shows its picture
// (G.down never changes) and the button counts 4...1. Steen terugleggen: the tray tiles pulse and a tap on one puts it back on the
// board; a tap anywhere else cancels. The token is spent only when the tile really goes back. Either one forfeits Perfect (G.rescued).
let undoWait = false, peekTimer = 0, peekTick = 0, peekTiles = [];
function disarmTool() {   // (every tile tap and begin call it)
  if (!undoWait) return;
  undoWait = false; $('#btnUndo').classList.remove('armed');
  if (G) renderTray();
}
function helperRefused(kind, reason) {
  Sound.blocked();
  toast(tx(reason === 'level_limit' ? 'helperUsed_' + kind : reason === 'nothing_hidden' ? 'helperNoHidden' : reason === 'tray_empty' ? 'helperTrayEmpty' : 'helperBusy'));
}
function helperTap(kind) {
  if (!G || G.film) return;
  Sound.init();
  if (kind === 'undo' && undoWait) { disarmTool(); return; }
  disarmTool();
  const chk = kind === 'peek' ? ShopEconomy.canUsePeekInLevel(S, G) : ShopEconomy.canUseUndoInLevel(S, G);
  if (chk.ok) return askHelper(kind);
  if (chk.reason === 'no_stock') { saveCur(); logLvl('pause'); shopTab = 'hulpen'; show('shop'); return; }   // none left: the shop, on Hulpen
  helperRefused(kind, chk.reason);
}
function askHelper(kind) {
  openModal(`<div class="bigico">${kind === 'peek' ? '👁️' : '↩️'}</div><h2>${tx('helperQ_' + kind)}</h2><p>${tx('helperLine_' + kind)}</p>
    <p class="note">${tx('helperNote1')}<br>${tx('helperNote2')}</p>
    <button class="big-btn play" id="hYes"><span class="bb-text"><b>${tx('helperGo_' + kind)}</b></span></button>
    <button class="btn2" id="hNo">${tx('notNow')}</button>`);
  $('#hNo').onclick = closeModal;
  $('#hYes').onclick = () => { closeModal(); if (kind === 'peek') startPeek(); else startUndo(); };
}
function startPeek() {
  const r = ShopEconomy.consumePeekInLevel(S, G, helperHooks());
  if (!r.ok) return helperRefused('peek', r.reason);
  updateTools(); replayMark('peek'); clearHint();
  peekTiles = [];
  G.tiles.forEach((t, i) => { if (G.alive[i] && G.down[i]) { peekTiles.push(i); t.el.classList.remove('back'); t.el.classList.add('peeked'); } });
  const b = $('#btnPeek'), end = performance.now() + r.durationMs, left = () => Math.max(1, Math.ceil((end - performance.now()) / 1000));
  b.classList.add('count', 'armed'); b.firstElementChild.textContent = left();
  peekTick = setInterval(() => { b.firstElementChild.textContent = left(); }, 200);
  peekTimer = setTimeout(stopPeek, r.durationMs);
  Sound.flip(); buzz(10); saveCur();
}
function stopPeek() {   // (the countdown ends, or a new try / the end of the level comes first)
  clearTimeout(peekTimer); clearInterval(peekTick); peekTimer = peekTick = 0;
  const b = $('#btnPeek'); b.classList.remove('count', 'armed'); b.firstElementChild.textContent = '👁️';
  for (const i of peekTiles) {
    const el = G && G.tiles[i] && G.tiles[i].el; if (!el) continue;
    el.classList.remove('peeked');
    if (G.alive[i] && G.down[i] && G.peek !== i) el.classList.add('back');
  }
  peekTiles = [];
}
function startUndo() {
  const chk = ShopEconomy.canUseUndoInLevel(S, G);
  if (!chk.ok) return helperRefused('undo', chk.reason);
  undoWait = true; $('#btnUndo').classList.add('armed'); renderTray();
  toast(tx('helperPick'), 3000);
}
$('#tray').addEventListener('click', e => {
  if (!undoWait || !G) return;
  const slot = e.target.closest('.slot'), i = slot ? G.tray[[...$('#tray').children].indexOf(slot)] : undefined;
  if (i !== undefined && !G.arriving.has(i)) returnTile(i);
});
document.addEventListener('pointerdown', e => { if (undoWait && !e.target.closest('#tray, #btnUndo')) disarmTool(); }, true);
function returnTile(i) {
  const wrap = $('#boardWrap'), w = wrap.clientWidth, h = wrap.clientHeight;
  const chk = ShopEconomy.canUseUndoInLevel(S, G);
  if (!chk.ok) { disarmTool(); return helperRefused('undo', chk.reason); }
  const tray0 = G.tray.slice(), r = PrepBoard.applyTileReturn(G, i, w, h);   // the tile goes back first; the token is spent only when it really did
  if (!r.ok) { Sound.blocked(); if (r.reason === 'no_placement') toast(tx('helperNoSpot')); else logErr(new Error('undo ' + r.reason), 'undo'); return; }   // nothing is spent: pick another tile
  const back = G.tray; G.tray = tray0;   // (consume checks the tray as it was)
  const c = ShopEconomy.consumeUndoInLevel(S, G, helperHooks());
  G.tray = back;
  if (!c.ok) logErr(new Error('undo ' + c.reason), 'undo');
  disarmTool(); clearHint(); showReturned(i); renderTray(); updateTools();
  replayMark('undo', [i]); Sound.flip(); buzz(15);
  afterLogic();
}
// a returned tile shows on the board again, in its old place or (parked: true) in a free spot beside the pile, above everything
function showReturned(i) {
  const t = G.tiles[i], el = t.el, r = t.r, board = $('#board');
  if (!el || !r) return;
  el.classList.remove('hidden', 'back');
  Object.assign(el.style, { left: r.l + 'px', top: r.t + 'px', width: r.w.toFixed(1) + 'px', height: r.h.toFixed(1) + 'px', zIndex: r.zi % 10000 });
  if (t.parked) { if (el.parentNode !== board) { el._lyr = el.parentNode; board.appendChild(el); } }
  else if (el._lyr && el._lyr.isConnected) { el._lyr.appendChild(el); el._lyr = null; }
  try { el.animate([{ transform: 'scale(.6)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.2,.9,.3,1)' }); } catch (e) { }
}
// after drawing the pile again (resize, language): the parked tiles go back to a free spot
function refreshParked() {
  if (!G || !G.tiles.some(t => t.parked)) return;
  const wrap = $('#boardWrap');
  G.tiles.forEach((t, i) => {
    if (!t.parked || !G.alive[i]) return;
    const p = PrepBoard.findReturnPlacement(G, i, wrap.clientWidth, wrap.clientHeight);
    if (p) { t.r = { l: p.l, t: p.t, w: p.w, h: p.h, zi: p.zi }; showReturned(i); }
  });
}

/* The solver with the current ice and locks (tests). A single joker left over (its partner was
   used as a wildcard) can't be paired: for the solver it is a tile that clears itself (face -1),
   which is what it does as the last tile (the joker finale) and never worse earlier on. */
function solveNow(limit = 30000) {
  const faces = G.tiles.map(t => t.face);
  let tray = G.tray.slice();
  const jb = G.tiles.map((t, i) => i).filter(i => G.alive[i] && faces[i] === JOKER), jt = tray.filter(t => faces[t] === JOKER);
  if ((jb.length + jt.length) % 2) {
    if (jt.length) tray = tray.filter(t => t !== jt[0]);
    else faces[jb[jb.length - 1]] = -1;
  }
  return Layouts.solve(G.tiles, G.nb, faces, G.alive, tray, limit, obRules(), G.down);
}

// ---------- ⏰ the alarm clock (from RULES.hard.clockFrom, designed in hard.js) ----------
/* One tile carries a clock with a number: the moves left. Every tile you take off the board is a
   move. Take the clock tile off the board in time; when the number reaches 0 while it is still
   there, the level is over. */
const clockOn = () => !!(G && G.clock && G.alive[G.clock.i]);
const clockLeft = () => G && G.clock ? Math.max(0, G.clock.n - G.mv) : 0;
function clockMove(i) {
  if (!G.clock) return;
  if (i === G.clock.i) {
    const c = centerOf(G.tiles[i].el);
    FX.emoji(c.x, c.y, ['⏰', '✨', '🎉'], 10); Sound.star(2); buzz([20, 40, 20]);
    praise(tx('clockSaved'));
    logLvl('clock', { ml: clockLeft() });
    clockBadge();
  } else if (G.alive[G.clock.i]) { decorate(G.clock.i); if (clockLeft() === 5) toast(tx('clockHurry'), 2400); }
}
function checkClock() {
  if (!G || G.done || G.overShown || !clockOn() || clockLeft() > 0) return;
  const g = G; G.busy = true; G.overShown = true;
  if (!G.film) { syncClock(); bumpStat('losses'); noteFail(); endLevel('stuck', { ck: 1 }); }   // (the intro film: nothing is counted, saved or logged)
  setTimeout(() => {
    if (G !== g) return;
    Sound.stuck(); buzz([40, 80, 40]);
    replay(G.tiles[G.clock.i].el, 'shake');
    const over = `<div class="nt-ico">⏰</div><h2>${tx('clockTitle')}</h2><p>${tx('clockText', G.clock.n)}</p>`;
    // (in the intro film the same message shows on its board, without the buttons: the film's pop-up stays)
    if (G.film) { $('#board').insertAdjacentHTML('beforeend', `<div class="film-over clock-help">${over}</div>`); return; }
    openModal(`${over}
      <button class="big-btn play" id="sRetry"><span class="bb-text"><b>${tx('tryAgain')}</b></span></button>
      <button class="link-btn" id="sMenu">${tx('menu')}</button>`, false, null, 'clock-help');
    $('#sRetry').onclick = () => { closeModal(); restart(); };
    $('#sMenu').onclick = () => { closeModal(); clearCur(); G.done = true; show('home'); };
  }, 600);
}
