/* Oma's Mahjong — one level: the pile, the 4 tray slots, tapping, matching, hint and shuffle.
   Extra help (grandma) is in help.js, special tiles and ice/locks in specials.js. */
'use strict';

const SLOTS = Layouts.SLOTS;
const FLY_MS = 230;                  // a tile gliding into the tray
let G = null;                        // the level being played

// ---------- saving a level half-way (continues after closing the app) ----------
const CUR_V = 7;
const loadCur = () => { try { const c = JSON.parse(localStorage.getItem(CUR) || 'null'); return c && c.v === CUR_V ? c : null; } catch (e) { return null; } };
const clearCur = () => { try { localStorage.removeItem(CUR); } catch (e) { } };
function saveCur() {
  if (!G || G.done) return;
  syncClock();
  try {
    localStorage.setItem(CUR, JSON.stringify({ v: CUR_V, aspect: G.o.aspect, key: G.key, n: G.tiles.length, faces: G.tiles.map(t => t.face), alive: Array.from(G.alive), tray: G.tray, down: Array.from(G.down), peek: G.peek, gold: [...G.gold], score: G.score, elapsed: G.elapsed, usedHint: G.usedHint, usedShuffle: G.usedShuffle, rescued: G.rescued, ez: G.ez, ob: obState() }));
  } catch (e) { }
}
function syncClock() { if (G && G.tStart) { const n = performance.now(); G.elapsed += (n - G.tStart) / 1000; G.tStart = n; } }
function pauseClock() { syncClock(); if (G) G.tStart = 0; saveCur(); }
function resumeClock() { if (G && !G.done && curScreen === 'game') G.tStart = performance.now(); }

// ---------- starting a level ----------
const tileScale = () => S.bigTiles ? 0.7 : 1;
function startLevel(level) { begin({ mode: 'level', level, key: 'L' + level, title: tx('levelN', level), makeSpec: a => Layouts.forLevel(level, a, tileScale()) }); }
function startDaily(k) {
  const d = parseKey(k);
  begin({ mode: 'daily', date: k, key: 'D' + k, title: tx('dailyTitle', d.getDate(), monthName(d.getMonth()).slice(0, 3)), makeSpec: a => Layouts.forDate(dnum(k), a, tileScale()) });
}

/* o = the level (kept between tries, so "Opnieuw" gives the same deal); restart = a new try */
function begin(o, restart = false) {
  $('#modal').classList.add('hidden'); modalOnClose = null;
  $('#comboTag').classList.remove('on'); clearGameMsg(); FX.clear();
  show('game');
  // shape the pile after the free space on this screen
  const wrap = $('#boardWrap');
  const aspect = Math.max(0.4, Math.min(2.4, Math.round(wrap.clientHeight / Math.max(1, wrap.clientWidth) * 10) / 10)) || 1.5;
  const cur = restart ? null : loadCur();
  const ez = cur && cur.key === o.key ? (cur.ez || 0) : easeFor(o.key);
  if (!o.spec || (o.ez || 0) !== ez) {
    if (!o.spec) o.aspect = aspect;
    o.spec = Layouts.ease(o.makeSpec(o.aspect), ez);
    o.ez = ez; o.faces = null; o.down = null; o.gold = null; o.specials = false; o.obstDone = false;   // a new deal
  }
  const spec = o.spec;
  const tiles = spec.tiles.map(t => ({ x: t.x, y: t.y, z: t.z, face: 0, el: null }));
  const n = tiles.length;
  G = { o, ...o, tiles, nb: Layouts.neighbors(tiles), gold: new Set(), lucky: null, alive: new Uint8Array(n).fill(1), down: new Uint8Array(n), peek: -1, tray: [], arriving: new Set(), flights: 0, score: 0, combo: 0, lastMatch: 0, usedHint: false, usedShuffle: false, rescued: false, ez, elapsed: 0, tStart: 0, mile: 0, done: false, busy: false };
  const resumed = !!(cur && cur.key === o.key && cur.n === n && cur.aspect === o.aspect);
  if (resumed) {
    cur.faces.forEach((f, i) => tiles[i].face = f);
    cur.alive.forEach((a, i) => G.alive[i] = a);
    (cur.down || []).forEach((a, i) => G.down[i] = a);
    G.peek = cur.peek ?? -1;
    G.gold = new Set(cur.gold || []);
    Object.assign(G, { tray: cur.tray || [], score: cur.score, elapsed: cur.elapsed, usedHint: !!cur.usedHint, usedShuffle: !!cur.usedShuffle, rescued: !!cur.rescued });
    setObstacles(cur.ob);
    G.mile = mileOf();
  } else {
    if (!o.faces) { const d = Layouts.makeDeal(spec); o.faces = d.faces; o.down = d.down; }
    addSpecials(o, spec);
    o.faces.forEach((f, i) => tiles[i].face = f);
    G.gold = new Set(o.gold || []);
    (o.down || []).forEach(i => G.down[i] = 1);
    addObstacles(o, spec); setObstacles(o.obst);
    clearCur();
  }
  // the clock and the play log come first, so they are right even if drawing the board goes wrong
  // (in 1.10 a level could be played without them: logged as won in 0 seconds with 0 taps)
  G.tStart = performance.now(); G.lastMove = performance.now(); G.nudge = null;
  G.st = { tp: 0, bt: 0, fl: 0, mc: 0, tm: 0 };    // taps, blocked taps, flips, best combo, most in tray
  if (!resumed || !S.att[o.key]) { S.att[o.key] = (S.att[o.key] || 0) + 1; save(); }
  G.attempt = S.att[o.key];
  logEvt('start', { ...lvInfo(), at: G.attempt, n, res: resumed || undefined, rs: restart || undefined, ez: ez || undefined, ad: adaptStepFor(o) });
  $('#gameTitle').textContent = o.title;
  try {
    show('game');
    renderBoard(!restart);
    renderTray(); updateTools();
    updateScore(false); updateProgress();
  } catch (e) { logErr(e, 'begin'); }
  setTimeout(() => praise(restart ? tx('againPraise') : o.mode === 'daily' ? tx('dailyPraise') : o.title), 150);
  if (!S.seenTray) setTimeout(() => showIntro(), 700);
  else if (!S.seenDown && G.down.some(x => x)) setTimeout(showDownTip, 900);
  else { setTimeout(checkStuck, 500); setTimeout(jokerLeftover, 700); setTimeout(specialTip, 1200); }
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
function takeOff(i) { G.alive[i] = 0; G.down[i] = 0; if (G.peek === i) G.peek = -1; G.tiles[i].el.classList.add('hidden'); }
/* After a tile left the board, it flies for ms; then fn runs and the level carries on.
   Taps never wait for this: the game state has changed already, the animation just catches up. */
function afterFlight(ms, fn) { G.flights++; afterLogic(); setTimeout(() => { G.flights--; fn(); afterLand(); }, ms); }
function afterLogic() {
  updateBlocked(); updateObstacles(); updateProgress(); updateNudge();
  if (aliveCount() === 0 && G.tray.length === 0) { G.done = true; clearCur(); return; }
  saveCur();
}
function afterLand() {
  if (G.done) { if (G.flights === 0 && !G.winShown) { G.winShown = true; setTimeout(win, 450); } return; }
  if (G.flights === 0) { checkStuck(); obRelief(); jokerLeftover(); maybeLucky(); }
}

// ---------- drawing ----------
function decorate(i) {
  const t = G.tiles[i], el = t.el; if (!el) return;
  el.classList.toggle('gold', G.gold.has(i));
  el.classList.toggle('sp-joker', t.face === JOKER);
  // ice, lock or key: an overlay on the tile
  const k = obKind(i);
  let ov = el.querySelector('.ob');
  if (!k) { if (ov) ov.remove(); }
  else { if (!ov) { ov = document.createElement('div'); ov.className = 'ob'; el.appendChild(ov); } ov.dataset.k = k; }
}
const setFace = i => { G.tiles[i].el.querySelector('.face').innerHTML = Tiles.faceHTML(S.theme, faceOf(i)); decorate(i); };
function renderBoard(enter) {
  const board = $('#board');
  board.innerHTML = '';
  board.classList.toggle('hl', S.highlight);
  const order = G.tiles.map((t, i) => i).sort((a, b) => G.tiles[a].z - G.tiles[b].z || G.tiles[a].y - G.tiles[b].y || G.tiles[a].x - G.tiles[b].x);
  order.forEach((i, k) => {
    const t = G.tiles[i];
    const el = document.createElement('div');
    el.className = 'tile' + (G.alive[i] ? '' : ' hidden') + (G.down[i] && G.peek !== i ? ' back' : '');
    el.dataset.i = i;
    el.innerHTML = `<div class="face">${Tiles.faceHTML(S.theme, t.face)}</div>`;
    t.el = el; decorate(i);
    if (enter && G.alive[i]) { el.classList.add('enter'); el.style.animationDelay = Math.min(900, k * 8 + t.z * 70) + 'ms'; setTimeout(() => el.classList.remove('enter'), 1700); }
    board.appendChild(el);
  });
  layoutBoard(); updateBlocked();
}
function layoutBoard() {
  if (!G) return;
  const wrap = $('#boardWrap');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return;
  const ratio = 1.24, dF = 0.14;   // tile height / width; each layer shifts up-left this much, so more of the tiles below shows
  // where the tiles really land, in tile widths (an upper layer only reaches the edge if its tiles do)
  let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9;
  for (const t of G.tiles) {
    const x = t.x / 2 - t.z * dF, y = t.y / 2 * ratio - t.z * dF;
    l = Math.min(l, x); r = Math.max(r, x + 1); t0 = Math.min(t0, y); b = Math.max(b, y + ratio);
  }
  const depthF = 0.085;            // the tile's side, drawn right and below it
  const tw = Math.min(150, (W - 8) / (r - l + depthF + 0.04), (H - 8) / (b - t0 + depthF * 1.4 + 0.04));
  const th = tw * ratio, dz = tw * dF, d = Math.max(3, tw * depthF);
  // centred on what is really there: even space left and right, and between the tray and the buttons below
  const ox = (W - (r - l) * tw - d) / 2 - l * tw, oy = (H - (b - t0) * tw - d * 1.4) / 2 - t0 * tw;
  const board = $('#board');
  board.style.setProperty('--d', d.toFixed(1) + 'px');
  board.style.setProperty('--fs', (tw * 0.66).toFixed(1) + 'px');
  G.tw = tw;
  for (const t of G.tiles) {
    const s = t.el.style, zi = t.z * 10000 + t.y * 100 + t.x;
    const lf = ox + t.x / 2 * tw - t.z * dz, tp = oy + t.y / 2 * th - t.z * dz;
    s.left = lf.toFixed(1) + 'px'; s.top = tp.toFixed(1) + 'px';
    s.width = (tw - 1.5).toFixed(1) + 'px'; s.height = (th - 1.5).toFixed(1) + 'px';
    s.zIndex = zi;
    t.r = { l: +lf.toFixed(1), t: +tp.toFixed(1), w: tw - 1.5, h: th - 1.5, zi };
  }
  sizeTray();
}
// tray slots scale with the screen but stay big
function sizeTray() { const slot = $('#tray .slot'); if (slot) $('#tray').style.setProperty('--sfs', (slot.clientWidth * 0.62).toFixed(1) + 'px'); }
function updateBlocked() { G.tiles.forEach((t, i) => { if (G.alive[i]) t.el.classList.toggle('blocked', !free(i)); }); }
function updateProgress() { const n = G.tiles.length; $('#progressBar').style.width = ((n - aliveCount() - G.tray.length) / n * 100) + '%'; }
function updateScore(bump = true) { const el = $('#score'); el.textContent = G.score; if (bump) replay(el, 'bump'); }
function addScore(pts) { G.score += pts; updateScore(); floatScore('+' + pts); }
// Hint and Schudden unlock at a level (daily puzzles: once you have reached that level)
const toolsOpen = () => !!G && (G.mode === 'level' ? G.level : S.level) >= RULES.tools.fromLevel;
function updateTools() {
  const open = toolsOpen();
  for (const [id, used] of [['#btnHint', G.usedHint], ['#btnShuffle', G.usedShuffle]]) {
    $(id).classList.toggle('used', open && used);
    $(id).classList.toggle('locked', !open);
    $(id + ' .badge').textContent = !open ? '🔒' : used ? '0' : '1';
  }
}
function toolsLockedMsg() { toast(tx('toolsLocked', RULES.tools.fromLevel)); Sound.blocked(); }
function renderTray() {
  const slots = $('#tray').children;
  for (let k = 0; k < SLOTS; k++) {
    const t = G.tray[k];
    slots[k].innerHTML = t === undefined ? '' : `<div class="tmini${G.arriving.has(t) ? ' arriving' : ''}">${Tiles.faceHTML(S.theme, faceOf(t))}</div>`;
  }
  const tr = $('#tray');
  tr.classList.toggle('warn', G.tray.length === SLOTS - 2);   // 2 waiting: careful
  tr.classList.toggle('full', G.tray.length >= SLOTS - 1);    // 3 waiting: the next miss ends the level
  sizeTray();
}

// a copy of the tile that glides from the board into its tray slot
function flyTile(face, from, to, ms) {
  const f = document.createElement('div');
  f.className = 'tile flying';
  f.innerHTML = `<div class="face">${Tiles.faceHTML(S.theme, face)}</div>`;
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
function onTap(i) {
  if (!G || G.done || G.busy || !G.alive[i]) return;
  Sound.init();
  const el = G.tiles[i].el;
  G.st.tp++;
  if (!free(i)) {
    G.st.bt++;
    replay(el, 'shake'); showBlockers(i);
    Sound.blocked(); buzz(30);
    if (++blockedTaps === 3) toast(tx('stillStuck'), 3000);
    return;
  }
  if (frozen(i) || lockedT(i)) { G.st.bt++; obBlocked(i); return; }
  blockedTaps = 0;
  G.lastMove = performance.now();   // the board moved: the helper waits again
  let reveal = false;
  if (G.down[i] && G.peek !== i) {
    const pk = G.peek;
    const twinOpen = pk >= 0 && G.alive[pk] && free(pk) && faceOf(pk) === faceOf(i);
    if (!twinOpen && !trayHas(faceOf(i))) {
      // face-down tile: first tap turns it over (only one at a time), second tap takes it
      if (pk >= 0 && G.alive[pk]) turn(pk, true);
      G.peek = i; turn(i, false);
      Sound.flip(); buzz(8); clearHint(); saveCur();
      taskProgress('flips'); bumpStat('flips'); G.st.fl++;
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
function turn(i, faceDown) {
  const el = G.tiles[i].el;
  replay(el, 'turning', 300);
  setTimeout(() => el.classList.toggle('back', faceDown), 140);
}
function showDownTip() {
  openModal(`<h2>${tx('downTitle')}</h2>
    <div class="how-tray" style="grid-template-columns:repeat(2,52px)"><div class="hm backmini"></div><div class="hm glow">${Tiles.faceHTML('classic', 32)}</div></div>
    <p>${tx('down1')}</p>
    <p>${tx('down2')}</p>
    <button class="big-btn play" id="mGo"><span class="bb-text"><b>${tx('gotIt')}</b></span></button>`, true);
  $('#mGo').onclick = closeModal;
  S.seenDown = true; save();
}

// ---------- a pair is made ----------
function onMatch(c, face, gold) {
  const now = performance.now(), comboMs = help().comboMs, sc = RULES.score;
  G.combo = now - G.lastMatch < comboMs ? G.combo + 1 : 1;
  G.lastMatch = now;
  const mult = specialMatch(face, gold, c);
  const pts = sc.pair * Math.min(G.combo, sc.maxCombo) * mult;
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

// ---------- a full tray ----------
function checkStuck() {
  if (!G || G.done || G.overShown || G.tray.length < SLOTS) return;
  G.busy = true; G.overShown = true;
  syncClock();
  if (help().rescue && !G.rescued) { setTimeout(offerRescue, 450); return; }
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

// ---------- 💡 hint and 🔀 shuffle (once per level each) ----------
function toolUsable(used, usedMsg) {
  if (!G || G.done || G.busy) return false;
  Sound.init();
  if (!toolsOpen()) { toolsLockedMsg(); return false; }
  if (used) { toast(usedMsg); Sound.blocked(); return false; }
  return true;
}
function hint() {
  if (!toolUsable(G && G.usedHint, tx('hintUsed'))) return;
  const path = solveNow(30000);
  if (!path || !path.length) { toast(tx('noWay')); Sound.blocked(); return; }
  G.usedHint = true; updateTools(); saveCur();
  logLvl('hint');
  // show the next one or two safe taps
  const show2 = [path[0]];
  if (path[1] !== undefined && faceOf(path[1]) === faceOf(path[0])) show2.push(path[1]);
  show2.forEach(i => G.tiles[i].el.classList.add('hint'));
  Sound.hint(); buzz(15);
}
function shuffle() {
  if (!toolUsable(G && G.usedShuffle, tx('shuffleUsed'))) return;
  if (shuffleTooEarly()) return;
  G.usedShuffle = true; updateTools(); clearNudge();
  logLvl('shuf', { tray: G.tray.length });
  G.busy = true;
  if (G.peek >= 0) { if (G.alive[G.peek]) turn(G.peek, true); G.peek = -1; }
  const trayFaces = G.tray.map(faceOf);
  const count = {};
  G.tiles.forEach((t, i) => { if (G.alive[i]) count[t.face] = (count[t.face] || 0) + 1; });
  trayFaces.forEach(f => count[f]--);
  const pf = [];
  for (const f in count) for (let k = 0; k < count[f] / 2; k++) pf.push(+f);
  // a generous re-deal: the tray pictures come free quickly. Several are tried and the one the
  // computer player clears most often is kept, so shuffling never makes it harder.
  let faces = null, bestW = -1;
  for (let k = 0; k < 8 && bestW < 0.99; k++) {
    const r = Layouts.rng((Math.random() * 1e9) | 0);
    const f = Layouts.deal(G.tiles, G.nb, pf, r, { alive: G.alive, openFaces: trayFaces, cap: Math.max(2, trayFaces.length), open: 0.2 });
    const w = Layouts.botWinRate(G.tiles, G.nb, f, 16, k + 1, { alive: G.alive, tray: trayFaces });
    if (w > bestW) { bestW = w; faces = f; }
  }
  keepKeysPaired(faces);
  clearHint();
  Sound.shuffle(); buzz([10, 30, 10]);
  let k = 0;
  G.tiles.forEach((t, i) => {
    if (!G.alive[i]) return;
    t.face = faces[i];
    const el = t.el, delay = (k++ % 12) * 15;
    el.style.animationDelay = delay + 'ms';
    replay(el, 'flip');
    setTimeout(() => setFace(i), 200 + delay);
    setTimeout(() => { el.classList.remove('flip'); el.style.animationDelay = ''; }, 700);
  });
  setTimeout(() => { G.busy = false; updateBlocked(); saveCur(); checkStuck(); }, 520);
}

/* The solver with the current ice and locks (hint, tests). A single joker left over (its partner was
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
  return Layouts.solve(G.tiles, G.nb, faces, G.alive, tray, limit, obRules());
}
