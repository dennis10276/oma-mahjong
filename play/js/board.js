/* Oma's Mahjong — one level: the pile, the 4 tray slots, tapping, matching, hint and shuffle. */
'use strict';

// ---------- the game ----------
const SLOTS = Layouts.SLOTS;
let G = null;
const loadCur = () => { try { const c = JSON.parse(localStorage.getItem(CUR) || 'null'); return c && c.v === 7 ? c : null; } catch (e) { return null; } };
const clearCur = () => { try { localStorage.removeItem(CUR); } catch (e) { } };
function saveCur() {
  if (!G || G.done) return;
  syncClock();
  try {
    localStorage.setItem(CUR, JSON.stringify({ v: 7, aspect: G.o.aspect, key: G.key, n: G.tiles.length, faces: G.tiles.map(t => t.face), alive: Array.from(G.alive), tray: G.tray, down: Array.from(G.down), peek: G.peek, gold: [...G.gold], score: G.score, elapsed: G.elapsed, usedHint: G.usedHint, usedShuffle: G.usedShuffle, rescued: G.rescued, ez: G.ez, ob: obState() }));
  } catch (e) { }
}
function syncClock() { if (G && G.tStart) { const n = performance.now(); G.elapsed += (n - G.tStart) / 1000; G.tStart = n; } }
function pauseClock() { syncClock(); if (G) G.tStart = 0; saveCur(); }
function resumeClock() { if (G && !G.done && curScreen === 'game') G.tStart = performance.now(); }

function startLevel(level) { begin({ mode: 'level', level, key: 'L' + level, title: 'Level ' + level, makeSpec: a => Layouts.forLevel(level, a, S.bigTiles ? 0.7 : 1) }); }
function startDaily(k) {
  const d = parseKey(k);
  begin({ mode: 'daily', date: k, key: 'D' + k, title: `Dagpuzzel ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`, makeSpec: a => Layouts.forDate(dnum(k), a, S.bigTiles ? 0.7 : 1) });
}

function begin(o, restart = false) {
  $('#modal').classList.add('hidden'); modalOnClose = null;
  $('#comboTag').classList.remove('on'); clearGameMsg(); FX.clear();
  // shape the pile after the free space on this curScreen
  show('game');
  const wrap = $('#boardWrap');
  const aspect = Math.max(0.4, Math.min(2.4, Math.round(wrap.clientHeight / Math.max(1, wrap.clientWidth) * 10) / 10)) || 1.5;
  const cur = restart ? null : loadCur();
  // grandma: after failing a level twice the same pile comes with more matching pictures
  const ez = cur && cur.key === o.key ? (cur.ez || 0) : easeFor(o.key);
  if (!o.spec || (o.ez || 0) !== ez) {
    if (!o.spec) o.aspect = aspect;
    o.spec = Layouts.ease(o.makeSpec(o.aspect), ez);
    o.ez = ez; o.faces = null; o.down = null; o.gold = null; o.specials = false; o.obstDone = false;   // a new deal
  }
  const spec = o.spec;
  const tiles = spec.tiles.map(t => ({ x: t.x, y: t.y, z: t.z, face: 0, el: null }));
  const nb = Layouts.neighbors(tiles);
  const n = tiles.length;
  G = { o, ...o, tiles, nb, gold: new Set(), lucky: null, luckyDone: false, alive: new Uint8Array(n).fill(1), down: new Uint8Array(n), peek: -1, tray: [], arriving: new Set(), flights: 0, score: 0, combo: 0, lastMatch: 0, usedHint: false, usedShuffle: false, rescued: false, ez, elapsed: 0, tStart: 0, done: false, busy: false, half: false };
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
    if (!o.faces) { const d = Layouts.makeDeal(spec); o.faces = d.faces; o.down = d.down; } // same deal again on "Opnieuw"
    addSpecials(o, spec);
    o.faces.forEach((f, i) => tiles[i].face = f);
    G.gold = new Set(o.gold || []);
    (o.down || []).forEach(i => G.down[i] = 1);
    addObstacles(o, spec); setObstacles(o.obst);
    clearCur();
  }
  // the clock and the play log come first, so they are right even if drawing the board goes wrong
  // (in 1.10 a level could be played without them: logged as won in 0 seconds with 0 taps)
  G.tStart = performance.now(); G.lastMove = performance.now(); G.nudge = null; if (G.mile === undefined) G.mile = 0;
  G.st = { tp: 0, bt: 0, fl: 0, mc: 0, tm: 0 };
  S.att = S.att || {};
  if (!resumed || !S.att[o.key]) { S.att[o.key] = (S.att[o.key] || 0) + 1; save(); }
  G.attempt = S.att[o.key];
  logEvt('start', { ...lvInfo(), at: G.attempt, n, res: resumed || undefined, rs: restart || undefined, ez: ez || undefined, ad: careMode() && o.mode === 'level' ? adaptState().step : undefined });
  $('#gameTitle').textContent = o.title;
  try {
    show('game');
    renderBoard(!restart);
    renderTray(); updateTools();
    updateScore(false); updateProgress();
  } catch (e) { logErr(e, 'begin'); }
  setTimeout(() => praise(restart ? 'Nog een keer! 💪' : o.mode === 'daily' ? '📅 Dagpuzzel' : o.title), 150);
  if (!S.seenTray) setTimeout(() => showIntro(), 700);
  else if (!S.seenDown && G.down.some(x => x)) setTimeout(showDownTip, 900);
  else { setTimeout(checkStuck, 500); setTimeout(jokerLeftover, 700); setTimeout(specialTip, 1200); }
}
// explain a new kind of special tile the first time it shows up
function specialTip() {
  if (!G || G.done) return;
  if (newTileIntro()) return;          // joker, ice, lock: a short explanation the first time
  S.seenSp = S.seenSp || {};
  if (G.gold.size > 0 && !S.seenSp.gold) { S.seenSp.gold = true; save(); toast('✨ Nieuw: een gouden paar geeft dubbele punten!', 4200); }
}
const restart = () => { if (G) { if (!G.done && !G.logged) { noteFail(); endLevel('restart'); } begin(G.o, true); } };
// failed tries per level (cleared when it is won): grandma's retries get easier after three
function noteFail() { if (!G) return; S.fails = S.fails || {}; S.fails[G.key] = (S.fails[G.key] || 0) + 1; S.winStreak = 0; save(); }
function easeFor(key) {
  if (!careMode()) return 0;
  // grandma's gentle deal (1), moved by half steps by her own results on recent levels
  const base = key[0] === 'L' ? 1 + adaptFor(key) * 0.5 : 1;
  const f = (S.fails || {})[key] || 0;
  return f >= 3 ? Math.min(3, base + 1) : base;    // and one step easier after 3 failed tries on the same level
}
/* Grandma's difficulty follows her own results: her last 10 tries on levels are kept (a win 1,
   a win after putting tiles back 0.5, stuck 0). When a NEW level starts (never during a level or
   its retries) and at least 5 tries were played since the last change:
   won less than 60% -> half a step easier, more than 85% -> half a step back towards normal.
   Steps run from -2 (the normal level, like the family) to +2 (the gentle deal of a 4th try). */
const ADAPT = { n: 10, min: 5, low: 0.6, high: 0.85, minStep: -2, maxStep: 2 };
const adaptState = () => (S.adapt = S.adapt || { step: 0, hist: [], since: 0, key: '' });
const adaptRate = a => a.hist.length ? a.hist.reduce((x, y) => x + y, 0) / a.hist.length : null;
function adaptFor(key) {
  const a = adaptState();
  if (a.key !== key) {
    if (a.hist.length >= ADAPT.min && a.since >= ADAPT.min) {
      const rate = adaptRate(a);
      const to = rate < ADAPT.low ? Math.min(ADAPT.maxStep, a.step + 1) : rate > ADAPT.high ? Math.max(ADAPT.minStep, a.step - 1) : a.step;
      if (to !== a.step) { logEvt('adapt', { from: a.step, to, rate: Math.round(rate * 100), n: a.hist.length, lv: +key.slice(1) || undefined }); a.step = to; a.since = 0; }
    }
    a.key = key; save();
  }
  return a.step;
}
// a try on a level ended: remember how it went (grandma only)
function adaptNote(r) {
  if (!careMode() || !G || G.o.mode !== 'level') return;
  if (r === 'restart' && G.elapsed < 30) return;          // starting over right away is not a failed try
  const v = r === 'win' ? (G.rescued ? 0.5 : 1) : r === 'stuck' || r === 'restart' ? 0 : null;
  if (v === null) return;
  const a = adaptState();
  a.hist = a.hist.concat(v).slice(-ADAPT.n); a.since++; save();
}

const aliveCount = () => G.alive.reduce((a, b) => a + b, 0);
function decorate(i) {
  const t = G.tiles[i], el = t.el; if (!el) return;
  el.classList.toggle('gold', G.gold.has(i));
  el.classList.toggle('sp-gift', t.face === GIFT);
  el.classList.toggle('sp-joker', t.face === JOKER);
  // ice, lock or key: an overlay on the tile
  const k = obKind(i);
  let ov = el.querySelector('.ob');
  if (!k) { if (ov) ov.remove(); }
  else { if (!ov) { ov = document.createElement('div'); ov.className = 'ob'; el.appendChild(ov); } ov.dataset.k = k; }
}
const free = i => Layouts.isFree(i, G.alive, G.nb);

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
    t.el = el; board.appendChild(el);
  });
  layoutBoard(); updateBlocked();
}

function layoutBoard() {
  if (!G) return;
  const wrap = $('#boardWrap');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, maxZ = 0;
  for (const t of G.tiles) { minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x); minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y); maxZ = Math.max(maxZ, t.z); }
  const cols = (maxX - minX) / 2 + 1, rows = (maxY - minY) / 2 + 1;
  const ratio = 1.24, dF = 0.14;   // each layer shifts this much, so more of the tiles below shows
  let tw = Math.min((W - 8) / (cols + maxZ * dF + 0.12), (H - 8) / (rows * ratio + maxZ * dF + 0.15));
  tw = Math.min(tw, 150);
  const th = tw * ratio, dz = tw * dF, d = Math.max(3, tw * 0.085);
  const bw = cols * tw + maxZ * dz + d, bh = rows * th + maxZ * dz + d * 1.4;
  const ox = (W - bw) / 2 + maxZ * dz, oy = (H - bh) / 2 + maxZ * dz;
  const board = $('#board');
  board.style.setProperty('--d', d.toFixed(1) + 'px');
  board.style.setProperty('--fs', (tw * 0.66).toFixed(1) + 'px');
  G.tw = tw;
  for (const t of G.tiles) {
    const s = t.el.style;
    s.left = (ox + (t.x - minX) / 2 * tw - t.z * dz).toFixed(1) + 'px';
    s.top = (oy + (t.y - minY) / 2 * th - t.z * dz).toFixed(1) + 'px';
    s.width = (tw - 1.5).toFixed(1) + 'px';
    s.height = (th - 1.5).toFixed(1) + 'px';
    s.zIndex = t.z * 10000 + t.y * 100 + t.x;
    t.r = { l: parseFloat(s.left), t: parseFloat(s.top), w: tw - 1.5, h: th - 1.5, zi: t.z * 10000 + t.y * 100 + t.x };
  }
  // tray slots scale with the curScreen but stay big
  const slot = $('#tray .slot');
  if (slot) $('#tray').style.setProperty('--sfs', (slot.clientWidth * 0.62).toFixed(1) + 'px');
}

function updateBlocked() {
  G.tiles.forEach((t, i) => { if (G.alive[i]) t.el.classList.toggle('blocked', !free(i)); });
}
function updateProgress() {
  const n = G.tiles.length;
  $('#progressBar').style.width = ((n - aliveCount() - G.tray.length) / n * 100) + '%';
}
function updateScore(bump = true) {
  const el = $('#score'); el.textContent = G.score;
  if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}
// Hint and Schudden unlock at level 15 (daily puzzles: once you have reached level 15)
const TOOLS_LEVEL = 15;
const toolsOpen = () => !!G && (G.mode === 'level' ? G.level >= TOOLS_LEVEL : S.level >= TOOLS_LEVEL);
function updateTools() {
  const open = toolsOpen();
  $('#btnHint').classList.toggle('used', open && G.usedHint);
  $('#btnShuffle').classList.toggle('used', open && G.usedShuffle);
  $('#btnHint').classList.toggle('locked', !open);
  $('#btnShuffle').classList.toggle('locked', !open);
  $('#btnHint .badge').textContent = !open ? '🔒' : G.usedHint ? '0' : '1';
  $('#btnShuffle .badge').textContent = !open ? '🔒' : G.usedShuffle ? '0' : '1';
}
function toolsLockedMsg() { toast(`Hint en Schudden komen vrij vanaf level ${TOOLS_LEVEL} 🔒`); Sound.blocked(); }
function renderTray() {
  const slots = $('#tray').children;
  for (let k = 0; k < SLOTS; k++) {
    const t = G.tray[k];
    slots[k].innerHTML = t === undefined ? '' : `<div class="tmini${G.arriving.has(t) ? ' arriving' : ''}">${Tiles.faceHTML(S.theme, G.tiles[t].face)}</div>`;
  }
  const tr = $('#tray');
  tr.classList.toggle('warn', G.tray.length === SLOTS - 2);   // 2 waiting: careful
  tr.classList.toggle('full', G.tray.length >= SLOTS - 1);    // 3 waiting: the next miss ends the level
  $('#tray').style.setProperty('--sfs', (slots[0].clientWidth * 0.62).toFixed(1) + 'px');
}
function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
function clearHint() { G.tiles.forEach(t => t.el.classList.remove('hint')); }

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

let blockedTaps = 0, comboTimer;
const PRAISE = ['Mooi!', 'Goed zo!', 'Prima!', 'Geweldig!', 'Fantastisch!', 'Super!', 'Knap hoor!', 'Prachtig!'];
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
  const seen = new Set();
  // see through the tiles lying on top of it, so you can see what is underneath
  for (const { j, side } of blockersOf(i)) if (side === 'up') { const be = G.tiles[j].el; be.classList.add('xray'); clearTimeout(be._xr); be._xr = setTimeout(() => be.classList.remove('xray'), 1800); }
  for (const { j } of blockersOf(i)) {
    const b = G.tiles[j].r; if (!b) continue;
    const bc = { x: b.l + b.w / 2, y: b.t + b.h / 2 };
    let dx = bc.x - ac.x, dy = bc.y - ac.y;
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
    const be = G.tiles[j].el;
    be.classList.remove('blocker'); void be.offsetWidth; be.classList.add('blocker');
    setTimeout(() => be.classList.remove('blocker'), 1300);
    setTimeout(() => ar.remove(), 1300);
  }
}

/* Taps never wait for animations: the game state changes instantly,
   the flying tiles just catch up visually. */
function onTap(i) {
  if (!G || G.done || G.busy || !G.alive[i]) return;
  Sound.init();
  const el = G.tiles[i].el;
  if (G.st) G.st.tp++;
  if (!free(i)) {
    if (G.st) G.st.bt++;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    showBlockers(i);
    Sound.blocked(); buzz(30);
    if (++blockedTaps === 3) toast('Die zit nog vast: kies een steen met een open zijkant', 3000);
    return;
  }
  if (frozen(i) || lockedT(i)) { if (G.st) G.st.bt++; obBlocked(i); return; }
  blockedTaps = 0;
  G.lastMove = performance.now();   // the board moved: grandma's helper waits again
  if (G.down[i] && G.peek !== i) {
    const pk0 = G.peek;
    const twin = pk0 >= 0 && G.alive[pk0] && free(pk0) && G.tiles[pk0].face === G.tiles[i].face;
    const inTray = G.tray.some(t => G.tiles[t].face === G.tiles[i].face);
    if (!twin && !inTray) {
      // face-down tile: first tap turns it over (only one at a time), second tap takes it
      if (pk0 >= 0 && G.alive[pk0]) turn(pk0, true);
      G.peek = i; turn(i, false);
      Sound.flip(); buzz(8); clearHint(); saveCur();
      taskProgress('flips'); bumpStat('flips'); if (G.st) G.st.fl++;
      return;
    }
    // its twin is already in the tray, or is the open tile (which counts as picked): it matches
    // right away; the tile flips open while it flies, so you see what it was
    G.down[i] = 0; G.reveal = i; Sound.flip();
  }
  if (G.peek === i) { G.down[i] = 0; G.peek = -1; }
  const wasDown = G.reveal === i; G.reveal = -1;
  const face = G.tiles[i].face;
  const mi = G.tray.findIndex(t => G.tiles[t].face === face);
  const pk = G.peek;
  const peekPair = mi < 0 && pk >= 0 && pk !== i && G.alive[pk] && G.tiles[pk].face === face && free(pk);
  // the joker fits every picture (see jokerPlay); as the very last tile it ends the level with a bonus
  if (face === JOKER && !G.tray.length && !G.tiles.some((t, k) => k !== i && G.alive[k])) { jokerFinale(i); return; }
  if (mi < 0 && !peekPair) {
    if (face === JOKER) { const x = jokerTarget(); if (x !== null) { jokerPlay(i, x); return; } }
    else { const jt = G.tray.find(t => G.tiles[t].face === JOKER && !G.arriving.has(t)); if (jt !== undefined) { jokerPlay(jt, i); return; } }
  }
  if (mi < 0 && !peekPair && G.tray.length >= SLOTS) {
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    Sound.blocked(); toast('Alle vakjes zijn vol. Kies een steen die past!');
    return;
  }
  clearHint();
  luckyTaken(i);
  const from = el.getBoundingClientRect();
  G.alive[i] = 0;
  el.classList.add('hidden');
  Sound.select(); buzz(8);
  const MS = 230;
  G.flights++;
  const land = (fn) => setTimeout(() => { G.flights--; fn(); }, MS);

  if (peekPair) {
    // the open face-down tile and this one match straight away, no slot needed
    const pel = G.tiles[pk].el, pfrom = pel.getBoundingClientRect();
    G.alive[pk] = 0; G.down[pk] = 0; G.peek = -1;
    pel.classList.add('hidden');
    const goldP = G.gold.has(i) || G.gold.has(pk);
    const mid = { left: (from.left + pfrom.left) / 2, top: (from.top + pfrom.top) / 2 - from.height * 0.3, width: from.width, height: from.height };
    const f1 = flyTile(face, from, mid, MS), f2 = flyTile(face, pfrom, mid, MS);
    if (wasDown) f1.classList.add('reveal');
    afterLogic();
    land(() => { f1.classList.add('popout'); f2.classList.add('popout'); onMatch({ x: mid.left + mid.width / 2, y: mid.top + mid.height / 2 }, face, goldP); setTimeout(() => { f1.remove(); f2.remove(); }, 230); afterLand(); });
    return;
  }
  if (mi >= 0) {
    const partner = G.tray[mi];
    const slotEl = $('#tray').children[mi];
    const to = slotEl.getBoundingClientRect();
    // keep a copy of the partner where it sat, then close the gap in the tray right away
    const ghost = slotEl.firstElementChild && !G.arriving.has(partner) ? slotEl.firstElementChild.cloneNode(true) : null;
    if (ghost) { ghost.classList.add('ghost'); Object.assign(ghost.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' }); ghost.style.setProperty('--sfs', $('#tray').style.getPropertyValue('--sfs')); document.body.appendChild(ghost); }
    G.tray.splice(mi, 1);
    G.arriving.delete(partner);
    const goldT = G.gold.has(i) || G.gold.has(partner);
    renderTray();
    const fly = flyTile(face, from, to, MS);
    if (wasDown) fly.classList.add('reveal');
    afterLogic();
    land(() => {
      fly.classList.add('popout'); if (ghost) ghost.classList.add('popout');
      onMatch({ x: to.left + to.width / 2, y: to.top + to.height / 2 }, face, goldT);
      setTimeout(() => { fly.remove(); if (ghost) ghost.remove(); }, 230);
      afterLand();
    });
    return;
  }
  const slotIdx = G.tray.length;
  G.tray.push(i);
  if (G.st) G.st.tm = Math.max(G.st.tm, G.tray.length);
  G.arriving.add(i);
  if (G.tray.length >= SLOTS) G.busy = true;   // 4th tile without a match: level over, no more taps
  renderTray();
  const to = $('#tray').children[slotIdx].getBoundingClientRect();
  const fly = flyTile(face, from, to, MS);
  afterLogic();
  land(() => {
    fly.remove();
    G.arriving.delete(i);
    if (G.tray.includes(i)) {
      renderTray();
      const k = G.tray.indexOf(i), m = $('#tray').children[k].firstElementChild;
      if (m) m.classList.add('land');
      if (G.tray.length === SLOTS - 1) Sound.warn(); else Sound.land();
    }
    afterLand();
  });
}
function afterLogic() {
  updateBlocked(); updateObstacles(); updateProgress(); updateNudge();
  if (aliveCount() === 0 && G.tray.length === 0) { G.done = true; clearCur(); return; }
  saveCur();
}
function afterLand() {
  if (G.done) { if (G.flights === 0 && !G.winShown) { G.winShown = true; setTimeout(win, 450); } return; }
  if (G.flights === 0) { checkStuck(); obRelief(); jokerLeftover(); maybeLucky(); }
}

function turn(i, faceDown) {
  const el = G.tiles[i].el;
  el.classList.remove('turning'); void el.offsetWidth; el.classList.add('turning');
  setTimeout(() => el.classList.toggle('back', faceDown), 140);
  setTimeout(() => el.classList.remove('turning'), 300);
}
function showDownTip() {
  openModal(`<h2>Omgedraaide stenen</h2>
    <div class="how-tray" style="grid-template-columns:repeat(2,52px)"><div class="hm backmini"></div><div class="hm glow">${Tiles.faceHTML('classic', 32)}</div></div>
    <p>Sommige stenen liggen <b>omgedraaid</b>. Tik er één keer op om te kijken wat het is, en nog een keer om hem te pakken.</p>
    <p>Er kan maar <b>één steen tegelijk</b> open liggen. Een open steen telt alsof hij al gepakt is: draai je daarna <b>dezelfde</b> om, of tik je er een aan, dan verdwijnen ze meteen. Staat de tweeling al in een vakje? Dan verdwijnen ze ook meteen bij het omdraaien. Is het een andere, dan gaat de vorige weer dicht. Goed onthouden dus! 🧠</p>
    <button class="big-btn play" id="mGo"><span class="bb-text"><b>Begrepen!</b></span></button>`, true);
  $('#mGo').onclick = closeModal;
  S.seenDown = true; save();
}

function onMatch(c, face, gold) {
  const now = performance.now();
  const comboWin = careMode() ? 10000 : 6000;   // grandma has more time to keep a combo going
  G.combo = now - G.lastMatch < comboWin ? G.combo + 1 : 1;
  G.lastMatch = now;
  const mult = specialMatch(face, gold, c);
  const pts = 10 * Math.min(G.combo, 5) * mult;
  G.score += pts;
  S.matches++;
  taskProgress('pairs'); taskProgress('combo', G.combo, true);
  if (G.combo > (S.bestCombo || 0)) S.bestCombo = G.combo;
  if (G.st) G.st.mc = Math.max(G.st.mc, G.combo);
  const sunny = S.theme === 'sunflower';
  FX.burst(c.x, c.y - 10, sunny ? 12 : G.combo >= 3 ? 30 : 20, G.combo >= 3);
  if (sunny) { FX.emoji(c.x, c.y - 10, G.combo >= 3 ? ['🌻', '🌼', '🐝', '✨'] : ['🌻', '🌼', '✨'], G.combo >= 3 ? 8 : 5); if (G.combo >= 3 && G.combo % 2 === 1) bee(); }
  if (G.combo > 0 && G.combo % 5 === 0) {
    setTimeout(() => { Sound.supercombo(); flash(); praise('Supercombo! 🌈'); FX.burst(innerWidth / 2, innerHeight / 2.4, 46, true); if (sunny) bee(); buzz([20, 40, 20, 40, 40]); }, 120);
  }
  floatScore('+' + pts);
  Sound.match(G.combo); buzz(G.combo >= 3 ? [15, 40, 25] : 18);
  updateScore();
  const tag = $('#comboTag');
  if (G.combo >= 2) { tag.textContent = `Combo x${Math.min(G.combo, 5)} 🔥`; tag.classList.add('on'); }
  clearTimeout(comboTimer); comboTimer = setTimeout(() => tag.classList.remove('on'), comboWin);
  const left = aliveCount();
  if (G.combo % 5 === 0 || gold || face === GIFT || face === JOKER) { /* already celebrated */ }
  else if (left === 0 && G.tray.length === 0) { praise('Laatste paar! 🎉'); FX.burst(c.x, c.y, 40, true); }
  else if (left > 0 && mileOf() > (G.mile || 0)) milestone(mileOf());
  else if (G.combo >= 3 && G.combo % 2 === 1) praise(PRAISE[Math.min(PRAISE.length - 1, Math.floor(Math.random() * 3) + (G.combo - 3))]);
  else if (left === 4) praise('Bijna klaar!');
}
/* a quarter, half and three quarters of the pile cleared: a little party on the progress bar */
function mileOf() { const n = G.tiles.length, gone = n - aliveCount() - G.tray.length; return Math.min(3, Math.floor(gone / n * 4)); }
function milestone(m) {
  G.mile = m;
  praise(['', 'Al een kwart! 🌟', 'Halverwege! 💪', 'Nog maar een kwart! 🚀'][m]);
  Sound.star(m - 1); buzz(15);
  const bar = $('#progressBar'); bar.classList.remove('shine'); void bar.offsetWidth; bar.classList.add('shine');
  const r = bar.getBoundingClientRect(); FX.burst(r.right, r.top + r.height / 2, 18, true);
}

function checkStuck() {
  if (!G || G.done || G.overShown || G.tray.length < SLOTS) return;
  G.busy = true; G.overShown = true;
  syncClock();
  if (careMode() && !G.rescued) { setTimeout(offerRescue, 450); return; }
  gameOver();
}
function gameOver() {
  bumpStat('losses'); noteFail(); save();
  endLevel('stuck');
  setTimeout(() => {
    Sound.stuck(); buzz([40, 80, 40]);
    openModal(`<h2>Oei, alle vakjes zijn vol!</h2>
      <p>Alle 4 vakjes zitten vol zonder paar. Geen nood, probeer het gewoon nog eens!</p>
      <button class="big-btn play" id="sRetry"><span class="bb-text"><b>↻ Opnieuw proberen</b></span></button>
      <button class="link-btn" id="sMenu">Menu</button>`, false);
    $('#sRetry').onclick = () => { closeModal(); restart(); };
    $('#sMenu').onclick = () => { closeModal(); clearCur(); G.done = true; show('home'); };
  }, 450);
}
/* Grandma only: a full tray is not the end yet. Once per level she may put the tiles from the
   tray back on the board and play on (it costs one star, like hint and shuffle). */
function offerRescue() {
  if (!G || G.done) return;
  Sound.stuck(); buzz([40, 80, 40]);
  openModal(`<h2>Oei, alle vakjes zijn vol!</h2>
    <p>Geen nood! Je mag de stenen <b>één keer</b> terugleggen en gewoon verder spelen.</p>
    <button class="big-btn play" id="rsBack"><span class="bb-text"><b>↩ Stenen terugleggen</b></span></button>
    <p class="note small">Dit kost één ⭐</p>
    <button class="link-btn" id="rsRetry">Opnieuw beginnen</button>`, false);
  $('#rsBack').onclick = rescueTray;
  $('#rsRetry').onclick = () => { closeModal(); bumpStat('losses'); noteFail(); endLevel('stuck'); restart(); };
}
function rescueTray() {
  if (!G || G.done) return;
  closeModal();
  G.rescued = true; G.overShown = false; G.combo = 0; clearNudge();
  syncClock();
  logEvt('rescue', { ...lvInfo(), at: G.attempt, s: Math.round(G.elapsed), left: aliveCount(), ez: G.ez || undefined });
  bumpStat('rescues');
  const back = G.tray.slice(), slots = $('#tray').children, MS = 420;
  const from = back.map((t, k) => slots[k].getBoundingClientRect());
  G.tray = [];
  back.forEach((t, k) => {
    G.alive[t] = 1;
    const el = G.tiles[t].el;
    el.classList.remove('hidden'); el.classList.add('returning');
    const f = flyTile(G.tiles[t].face, from[k], el.getBoundingClientRect(), MS);
    setTimeout(() => { f.remove(); el.classList.remove('returning'); }, MS + 40);
  });
  renderTray(); updateBlocked(); updateProgress(); saveCur();
  Sound.shuffle(); buzz([10, 30, 10]);
  setTimeout(() => { if (G) G.busy = false; toast('De stenen liggen weer op het bord 💪', 2600); }, MS);
}

function hint() {
  if (!G || G.done || G.busy) return;
  Sound.init();
  if (!toolsOpen()) return toolsLockedMsg();
  if (G.usedHint) { toast('Je hint voor dit level is al gebruikt'); Sound.blocked(); return; }
  const faces = G.tiles.map(t => t.face);
  const path = solveNow(30000);
  if (!path || !path.length) { toast('Zo gaat het niet meer lukken… probeer 🔀 Schudden'); Sound.blocked(); return; }
  G.usedHint = true; updateTools(); saveCur();
  syncClock(); logEvt('hint', { ...lvInfo(), at: G.attempt, s: Math.round(G.elapsed), left: aliveCount() });
  // show the next one or two safe taps
  const show2 = [path[0]];
  if (path[1] !== undefined && G.tiles[path[1]].face === G.tiles[path[0]].face) show2.push(path[1]);
  show2.forEach(i => G.tiles[i].el.classList.add('hint'));
  Sound.hint(); buzz(15);
}

function shuffle() {
  if (!G || G.done || G.busy) return;
  Sound.init();
  if (!toolsOpen()) return toolsLockedMsg();
  if (G.usedShuffle) { toast('Je hebt in dit level al geschud'); Sound.blocked(); return; }
  // grandma: shuffling before playing throws away a good deal and costs a star; keep it for later
  if (careMode() && G.tiles.length - aliveCount() < 8 && G.tray.length < 2) {
    toast('Bewaar schudden voor als je vastzit 😉', 2600); Sound.blocked();
    logEvt('shufno', { ...lvInfo(), at: G.attempt, left: aliveCount() });
    return;
  }
  G.usedShuffle = true; updateTools(); clearNudge();
  syncClock(); logEvt('shuf', { ...lvInfo(), at: G.attempt, s: Math.round(G.elapsed), left: aliveCount(), tray: G.tray.length });
  G.busy = true;
  if (G.peek >= 0) { if (G.alive[G.peek]) turn(G.peek, true); G.peek = -1; }
  const trayFaces = G.tray.map(t => G.tiles[t].face);
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
  // the two key tiles must keep the same picture
  if (G.ob && !G.ob.unlocked && G.ob.keys.length) {
    const [a, b] = G.ob.keys;
    if (G.alive[a] || G.alive[b]) {
      const ref = G.alive[a] && G.alive[b] ? a : (G.alive[a] ? b : a), adj = ref === a ? b : a;
      const fRef = G.alive[ref] ? faces[ref] : G.tiles[ref].face;
      if (faces[adj] !== fRef) { const w = G.tiles.findIndex((t, k) => k !== adj && k !== ref && G.alive[k] && faces[k] === fRef); if (w >= 0) { faces[w] = faces[adj]; faces[adj] = fRef; } }
    }
  }
  clearHint();
  Sound.shuffle(); buzz([10, 30, 10]);
  let k = 0;
  G.tiles.forEach((t, i) => {
    if (!G.alive[i]) return;
    t.face = faces[i];
    const el = t.el, kk = k++;
    el.classList.remove('flip'); void el.offsetWidth;
    el.style.animationDelay = (kk % 12) * 15 + 'ms';
    el.classList.add('flip');
    setTimeout(() => { el.querySelector('.face').innerHTML = Tiles.faceHTML(S.theme, t.face); decorate(i); }, 200 + (kk % 12) * 15);
    setTimeout(() => { el.classList.remove('flip'); el.style.animationDelay = ''; }, 700);
  });
  setTimeout(() => { G.busy = false; updateBlocked(); saveCur(); checkStuck(); }, 520);
}

/* ---------- grandma's helper (careMode only) ----------
   When nothing has moved for a while and a pair can be matched, the pair starts to glow and keeps
   glowing until it is matched. A face-down tile in such a pair is turned face up for her
   (after 6 seconds); a pair she can already see glows after 14 seconds. Free, no star lost. */
const NUDGE_DOWN_S = 6, NUDGE_UP_S = 14;
function findNudge(downOnly) {
  const fr = [];
  for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && canTake(i)) fr.push(i);
  const hidden = i => G.down[i] && G.peek !== i;
  const cands = [];
  // a free tile whose twin waits in the tray, then two free twins on the board
  const inTray = new Set(G.tray.map(t => G.tiles[t].face));
  for (const i of fr) if (inTray.has(G.tiles[i].face)) cands.push([i]);
  const byFace = new Map();
  for (const i of fr) { const f = G.tiles[i].face; if (!byFace.has(f)) byFace.set(f, []); byFace.get(f).push(i); }
  for (const l of byFace.values()) if (l.length >= 2) cands.push(l.some(hidden) ? [l.find(hidden), l.find(i => i !== l.find(hidden))] : [l[0], l[1]]);
  return cands.find(c => c.some(hidden)) || (downOnly ? null : cands[0]) || null;
}
function nudgeTick() {
  if (!G || G.done || G.busy || G.flights || !careMode() || !inPlay() || document.hidden || !G.tStart) return;
  if (G.nudge && G.nudge.length) return;                 // already glowing: until it is matched
  const idle = (performance.now() - (G.lastMove || 0)) / 1000;
  if (idle < NUDGE_DOWN_S) return;
  const pair = findNudge(idle < NUDGE_UP_S);
  if (pair) startNudge(pair);
}
function startNudge(pair) {
  G.nudge = pair.slice();
  let turned = 0;
  for (const i of pair) {
    if (G.down[i]) { G.down[i] = 0; if (G.peek === i) G.peek = -1; else turn(i, false); turned++; }
    G.tiles[i].el.classList.add('nudge');
  }
  markTrayNudge();
  Sound.hint(); buzz(12);
  saveCur();
  logEvt('nudge', { ...lvInfo(), at: G.attempt, down: turned || undefined, left: aliveCount() });
}
function updateNudge() {
  if (!G || !G.nudge) return;
  const all = G.nudge;
  G.nudge = G.nudge.filter(i => G.alive[i]);
  all.filter(i => !G.alive[i]).forEach(i => G.tiles[i].el.classList.remove('nudge'));
  const face = G.nudge.length ? G.tiles[G.nudge[0]].face : null;
  // done when the pair is matched (nothing left, or nothing left to match it with)
  if (!G.nudge.length || !(G.tray.some(t => G.tiles[t].face === face) || G.nudge.length > 1)) clearNudge();
  else markTrayNudge();
}
function markTrayNudge() {
  const face = G.nudge && G.nudge.length ? G.tiles[G.nudge[0]].face : null;
  [...$('#tray').children].forEach((s, k) => s.classList.toggle('nudge', face !== null && G.tray[k] !== undefined && G.tiles[G.tray[k]].face === face));
}
function clearNudge() {
  if (!G) return;
  (G.nudge || []).forEach(i => G.tiles[i].el && G.tiles[i].el.classList.remove('nudge'));
  G.nudge = null; G.lastMove = performance.now();
  [...$('#tray').children].forEach(s => s.classList.remove('nudge'));
}
setInterval(nudgeTick, 1000);

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
