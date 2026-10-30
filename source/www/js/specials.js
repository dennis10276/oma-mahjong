/* Oma's Mahjong — special tiles and obstacles (levels and chances in rules.js / Layouts.MECH):
   the gold pair (double points), the joker (fits every picture), ice and lock & key. */
'use strict';

const JOKER = 101;                   // special tiles have numbers from 100 (pictures are 0..35)

// a golden pair, and one pair whose picture appears exactly twice becomes a joker pair (stays solvable)
function addSpecials(o, spec) {
  if (o.specials) return;
  const sp = RULES.specials, lvl = o.mode === 'level' ? o.level : Math.max(sp.goldFrom, S.level);
  const r = Layouts.rng(spec.seed + 555);
  o.gold = [];
  if (lvl >= sp.goldFrom) {
    const anyF = o.faces.filter(f => f < 100);
    const f = anyF[Math.floor(r() * anyF.length)];
    o.gold = o.faces.map((x, i) => x === f ? i : -1).filter(i => i >= 0).slice(0, 2);
  }
  const jg = help().jokersGoneFrom;           // no jokers in the deal from there on (not in grandma mode)
  if (o.mode === 'level' && lvl >= sp.jokerFrom && !(jg && lvl >= jg) && r() < sp.jokerChance) {
    const cnt = {};
    o.faces.forEach(f => cnt[f] = (cnt[f] || 0) + 1);
    const twos = Object.keys(cnt).filter(f => cnt[f] === 2 && +f < 100).map(Number);
    if (twos.length) { const f = twos[Math.floor(r() * twos.length)]; o.faces = o.faces.map(x => x === f ? JOKER : x); }
  }
  o.specials = true;
}
// the points multiplier for a pair, with its little celebration
function specialMatch(face, gold, c) {
  if (gold) { praise(tx('goldPair')); Sound.perfect(); FX.emoji(c.x, c.y, ['✨', '🌟', '💛'], 10); bumpStat('gold'); }
  if (face === JOKER) { praise(tx('twoJokers')); FX.emoji(c.x, c.y, ['🃏', '✨'], 8); bumpStat('jokers'); }
  return gold ? RULES.score.goldMult : 1;
}
// the first time a special tile shows up: a short explanation
function specialTip() {
  if (!G || G.done || !modalFree()) return;
  if (G.gold.size > 0 && !S.seenSp.gold) { S.seenSp.gold = true; save(); toast(tx('goldNew'), 4200); }
}

/* ---------- the joker: it fits every picture ----------
   Tap a joker while tiles wait in the tray: it takes one of them (the one whose twin is hardest to
   reach) away together with that twin, wherever it lies. With an empty tray the joker waits in a
   slot and takes the next tile you tap, with its twin. Two jokers also match each other. */
function jokerTarget() {
  const cand = G.tray.filter(t => faceOf(t) !== JOKER && !G.arriving.has(t));
  if (!cand.length) return null;
  const easy = t => G.tiles.some((u, k) => k !== t && G.alive[k] && u.face === faceOf(t) && canTake(k));
  return cand.find(t => !easy(t)) ?? cand[0];
}
// j = the joker, x = the tile it takes (one of them waits in the tray, the other was tapped)
function jokerPlay(j, x) {
  coachForget();
  clearHint();
  const waiting = G.tray.includes(j) ? j : x, tapped = waiting === j ? x : j;
  luckyTaken(tapped);
  const face = faceOf(x);
  // its twin: a free one if there is one, otherwise the top-most
  let y = -1, best = -1;
  for (let k = 0; k < G.tiles.length; k++) if (k !== x && G.alive[k] && faceOf(k) === face) { const sc = (free(k) ? 1000 : 0) + G.tiles[k].z; if (sc > best) { best = sc; y = k; } }
  const slotIdx = G.tray.indexOf(waiting), slotEl = $('#tray').children[slotIdx], to = slotEl.getBoundingClientRect();
  const ghost = ghostOf(slotEl);
  G.tray.splice(slotIdx, 1); G.arriving.delete(waiting);
  const gold = [j, x, y].some(k => k >= 0 && G.gold.has(k));
  const MS = 260;
  const flies = [tapped, y].filter(k => k >= 0).map(k => { const r = G.tiles[k].el.getBoundingClientRect(); takeOff(k); return flyTile(faceOf(k), r, to, MS); });
  renderTray(); Sound.select(); buzz(10);
  afterFlight(MS, () => {
    popAway([...flies, ghost]);
    const c = centerOf(slotEl);
    onMatch(c, face, gold);
    praise(tx('joker')); Sound.supercombo(); FX.emoji(c.x, c.y, ['🃏', '✨'], 8); bumpStat('jokers');
  });
}
// the joker as the very last tile (or left alone in the tray): it finishes the level with a bonus
function jokerBonus(c) {
  const pts = RULES.score.jokerFinale;
  addScore(pts);
  praise(tx('jokerFinale', pts)); Sound.supercombo(); flash(); buzz([20, 40, 20, 40, 40]);
  FX.burst(c.x, c.y, 46, true); FX.emoji(c.x, c.y, ['🃏', '✨', '🌟'], 14);
  bumpStat('jokerFinale');
  afterFlight(350, () => { });
}
function jokerFinale(i) {
  clearHint(); luckyTaken(i);
  const el = G.tiles[i].el, c = centerOf(el);
  G.alive[i] = 0; G.down[i] = 0; if (G.peek === i) G.peek = -1;
  el.classList.add('popout'); setTimeout(() => el.classList.add('hidden'), 230);
  bumpStat('jokers');
  jokerBonus(c);
}
// a joker left waiting in the tray with nothing left on the board (could happen in 1.18, and when reopened)
function jokerLeftover() {
  if (!G || G.done || G.flights || aliveCount() || !G.tray.length || !G.tray.every(t => faceOf(t) === JOKER)) return;
  const c = centerOf($('#tray').children[0]);
  G.tray = []; renderTray();
  jokerBonus(c);
}

/* ---------- ice and lock & key ----------
   G.ob = { need: {tile: hits}, left: {tile: hits still needed}, locks: Set, keys: [a, b], unlocked }.
   Ice melts when tiles around it leave the board; locks open when both key tiles are gone. */
function addObstacles(o, spec) {
  if (o.obstDone) return;
  o.obstDone = true; o.obst = null;
  const ml = spec.mechLevel || o.level;      // (a set of levels may give its own level for ice and locks)
  if (o.mode !== 'level' || ml < Layouts.MECH.ice) return;
  const avoid = new Set([...(o.down || []), ...(o.gold || [])]);
  o.obst = Layouts.obstacles(spec.tiles, o.faces, { level: ml, seed: spec.seed, avoid, ez: o.ez || 0 });
}
function setObstacles(ob) {
  G.ob = null; G.inb = null;
  const need = ob && (ob.need || ob.ice);
  if (!ob || (!Object.keys(need || {}).length && !(ob.keys || []).length)) return;
  G.ob = { need: { ...need }, left: { ...(ob.left || need) }, locks: new Set(ob.locks || []), keys: ob.keys || [], unlocked: !!ob.unlocked || !(ob.keys || []).length };
  G.inb = Layouts.iceNeighbors(G.tiles);
}
const obState = () => G.ob ? { need: G.ob.need, left: G.ob.left, locks: [...G.ob.locks], keys: G.ob.keys, unlocked: G.ob.unlocked } : null;
const frozen = i => !!(G.ob && G.ob.left[i] > 0);
const lockedT = i => !!(G.ob && !G.ob.unlocked && G.ob.locks.has(i));
const canTake = i => free(i) && !frozen(i) && !lockedT(i);
const obRules = () => G.ob ? { iceNb: G.inb, ice: G.ob.left, locks: G.ob.unlocked ? null : G.ob.locks, keys: G.ob.keys } : null;
function obKind(i) {
  if (!G.ob) return '';
  if (frozen(i)) return G.ob.left[i] > 1 ? 'ice2' : 'ice';
  if (lockedT(i)) return 'lock';
  if (!G.ob.unlocked && G.ob.keys.includes(i)) return 'key';
  return '';
}
function crackFx(i) {
  const el = G.tiles[i].el; if (!el) return;
  const f = document.createElement('div'); f.className = 'ob-crack'; el.appendChild(f);
  setTimeout(() => f.remove(), 600);
}
function unlockAll() {
  G.ob.unlocked = true;
  G.ob.locks.forEach(i => {
    decorate(i);
    if (!G.alive[i]) return;
    // the lock springs open on the tile itself (1.58), so it is clear which tiles are free now
    const el = G.tiles[i].el, o = document.createElement('div'); o.className = 'ob-open'; o.textContent = '🔓';
    el.appendChild(o); setTimeout(() => o.remove(), 1100);
    const c = centerOf(el); FX.emoji(c.x, c.y, ['🔓', '✨'], 6);
  });
  G.ob.keys.forEach(decorate);
  praise(tx('locksOpen')); Sound.unlock(); bumpStat('unlocks');
}
function updateObstacles() {
  if (!G || !G.ob) return;
  const ob = G.ob;
  for (const k of Object.keys(ob.need)) {
    const i = +k;
    if (!(ob.left[i] > 0)) continue;
    if (!G.alive[i]) { ob.left[i] = 0; continue; }                     // taken away by a joker
    let gone = 0; for (const j of G.inb[i]) if (!G.alive[j]) gone++;
    const left = Math.max(0, ob.need[i] - gone);
    if (left < ob.left[i]) {
      ob.left[i] = left; decorate(i);
      const c = centerOf(G.tiles[i].el);
      FX.emoji(c.x, c.y, left ? ['❄️'] : ['❄️', '💧', '✨'], left ? 4 : 8); Sound.flip();
      crackFx(i);
      if (!left) praise(tx('iceMelted')); else toast(tx('iceCrack'), 1600);
    }
  }
  if (!ob.unlocked && ob.keys.length && ob.keys.every(k => !G.alive[k])) unlockAll();
}
// a tap on a frozen or locked tile: say what to do, and show it
function obBlocked(i) {
  replay(G.tiles[i].el, 'shake');
  Sound.blocked(); buzz(30);
  const ice = frozen(i);
  toast(ice ? tx(G.ob.left[i] > 1 ? 'iceThick' : 'iceThin') : tx('lockedTap'), 2600);
  if (ice) G.inb[i].filter(j => G.alive[j] && canTake(j)).forEach(j => replay(G.tiles[j].el, 'obhint', 1300));
  else showKeys();
}
// the key tiles wiggle: they open the locks (also when the tapped locked tile is still covered;
// Dennis 2026-10-30: "when you click a locked tile even when buried I want the keys to shake")
function showKeys() { G.ob.keys.filter(k => G.alive[k]).forEach(j => replay(G.tiles[j].el, 'obhint', 1300)); }
// never stuck because of ice or locks alone: if nothing at all can be taken, they give way
function obRelief() {
  if (!G || !G.ob || G.done || G.overShown || G.flights || G.tray.length >= SLOTS) return;
  let anyFree = false;
  for (let i = 0; i < G.tiles.length; i++) if (free(i)) { anyFree = true; if (canTake(i)) return; }
  if (!anyFree) return;
  replayMark('relief');
  if (Object.keys(G.ob.left).some(k => G.ob.left[k] > 0)) {
    Object.keys(G.ob.left).forEach(k => { if (G.ob.left[k] > 0) { G.ob.left[k] = 0; decorate(+k); crackFx(+k); } });
    praise(tx('iceSun')); Sound.unlock();
  } else if (!G.ob.unlocked) unlockAll();
  saveCur();
}
// shuffling: the two key tiles must keep the same picture
function keepKeysPaired(faces) {
  if (!G.ob || G.ob.unlocked || !G.ob.keys.length) return;
  const [a, b] = G.ob.keys;
  if (!G.alive[a] && !G.alive[b]) return;
  const ref = G.alive[a] && G.alive[b] ? a : (G.alive[a] ? b : a), adj = ref === a ? b : a;
  const fRef = G.alive[ref] ? faces[ref] : faceOf(ref);
  if (faces[adj] !== fRef) { const w = G.tiles.findIndex((t, k) => k !== adj && k !== ref && G.alive[k] && faces[k] === fRef); if (w >= 0) { faces[w] = faces[adj]; faces[adj] = fRef; } }
}

// the first time a new kind of tile shows up: a short explanation before playing
// (title and text in lang.js: nt_<key>, nt_<key>_text)
const NEW_TILES = {
  lock: { has: () => !!(G.ob && G.ob.keys.length), ico: '🔒' },
  ice: { has: () => !!(G.ob && Object.keys(G.ob.need).length), ico: '🧊' },
  joker2: { has: () => G.tiles.some(t => t.face === JOKER), ico: '🃏' },
  trayPair: { has: () => G.down.some(Boolean), first: () => G.o.mode === 'level' && G.o.level === 50, ico: '🀄' },
};
/* ---------- the animated lessons (1.58) ----------
   Small, local demonstrations: no download, sound or changes to the real board. The little scene is
   built once and each step only moves what changes: a hand taps a tile, which glides into the tray
   as in the game; a key pair pops, the locks spring open; the clock's number counts down on its own
   tile. Locks, keys, ice and the clock look like they do on the board. (Before 1.58 the whole
   picture was drawn again every step, every tile popping in anew, and the clock's number stood
   apart from its tile: it looked jumpy and was hard to follow.) One step every 2.4 s, 4 steps. */
let lessonTimer = null, lessonJobs = [];
function stopLessonDemo() { clearInterval(lessonTimer); lessonTimer = null; lessonJobs.forEach(clearTimeout); lessonJobs = []; if (typeof stopCoach === 'function') stopCoach(); }
const LZ_STEP_MS = 2400;
const LESSON_SCENES = {
  // [id, face, kind of tile]
  ice: { tiles: [['a', 4], ['ice', 31, 'ice2'], ['b', 8]], board: 'lesson-ice-board' },
  lock: { tiles: [['k1', 4, 'key'], ['l1', 31, 'lock'], ['k2', 4, 'key'], ['l2', 8, 'lock']], tray: [] },
  clock: { tiles: [['ck', 31, 'clock'], ['a', 4], ['d', 8, 'down']], tray: [] },
  trayPair: { tiles: [['d', 31, 'down'], ['t', 31]], tray: [4, 8, 12], trayFirst: true },
};
// in the player's own tiles (the theme from the settings)
const lzTile = (id, face, kind = '') => `<span class="lesson-tile${kind === 'down' ? ' lesson-back' : kind ? ' lz-' + kind : ''}" data-id="${id}"><span class="lesson-face">${Tiles.faceHTML(S.theme, face)}</span>` +
  (kind === 'key' ? '<b class="lz-badge lz-keyb">🔑</b>' : kind === 'lock' ? '<b class="lz-badge lz-lockb">🔒</b>' : kind === 'ice2' ? '<b class="lz-badge lz-iceb">❄️❄️</b>' : kind === 'clock' ? '<b class="lz-ck">⏰<i>3</i></b>' : '') + '</span>';
const lzTray = faces => `<div class="lesson-tray">${[0, 1, 2, 3].map(i => `<span class="lesson-slot">${i < faces.length ? lzTile('s' + i, faces[i]) : ''}</span>`).join('')}</div>`;
function lessonSceneHTML(kind) {
  const sc = LESSON_SCENES[kind], tray = sc.tray ? lzTray(sc.tray) : '';
  const board = `<div class="lesson-board${sc.board ? ' ' + sc.board : ''}">${sc.tiles.map(t => lzTile(...t)).join('')}</div>`;
  return (sc.trayFirst ? tray + board : board + tray) + '<span class="lz-hand"><i>👆</i></span>';
}
function lessonDemoHTML(kind) {
  return `<div class="lesson-demo" data-lesson="${kind}">
    <div class="lesson-scene" aria-hidden="true"></div>
    <div class="lesson-caption"></div>
    <div class="lesson-controls"><span>${tx('lessonExample')}</span><button type="button" class="lesson-toggle"></button><button type="button" class="lesson-replay">↺ ${tx('lessonReplay')}</button></div>
  </div>`;
}
// what the hand and the tiles can do in a scene (positions from the layout, so a pop-up that is
// still growing open does not throw them off)
function lessonActor(scene) {
  const later = (ms, fn) => { const id = setTimeout(() => { lessonJobs = lessonJobs.filter(j => j !== id); if (scene.isConnected) fn(); }, ms); lessonJobs.push(id); };
  const el = id => scene.querySelector(`.lesson-tile[data-id="${id}"]`);
  const at = e => { let x = e.offsetWidth / 2, y = e.offsetHeight / 2; for (; e && e !== scene; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return { x, y }; };
  const hand = scene.querySelector('.lz-hand');
  const slot = k => scene.querySelectorAll('.lesson-slot')[k];
  const sparkle = (x, y, chars) => {
    for (let k = 0; k < 6; k++) {
      const s = document.createElement('span'); s.className = 'lz-spark'; s.textContent = chars[k % chars.length];
      s.style.left = x + 'px'; s.style.top = y + 'px'; scene.appendChild(s);
      const a = -Math.PI / 2 + (k - 2.5) * 0.55, d = 26 + (k % 2) * 10;
      const an = s.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${(Math.cos(a) * d).toFixed(1)}px), calc(-50% + ${(Math.sin(a) * d).toFixed(1)}px)) scale(1)`, opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.2,.7,.3,1)' });
      an.onfinish = () => s.remove();
    }
  };
  return {
    later, el, sparkle, at,
    // the hand glides to a tile and taps it (or only points at it)
    tap(id, then, press = true) {
      const t = el(id); if (!t) return;
      const c = at(t);
      hand.classList.add('lz-on'); hand.classList.remove('lz-press');
      hand.style.transform = `translate(${(c.x - 11).toFixed(1)}px, ${(c.y - 2).toFixed(1)}px)`;
      if (!press) return;
      later(470, () => {
        hand.classList.add('lz-press');
        const r = document.createElement('span'); r.className = 'lz-ripple'; r.style.left = c.x + 'px'; r.style.top = c.y + 'px';
        scene.appendChild(r); later(500, () => r.remove());
        later(150, () => { hand.classList.remove('lz-press'); if (then) then(t); });
        later(800, () => hand.classList.remove('lz-on'));          // the hand steps aside once the tile is taken
      });
    },
    hideHand() { hand.classList.remove('lz-on'); },
    // the tile glides into a slot of the tray, as in the game
    toTray(id, k) {
      const t = el(id), s = slot(k); if (!t || !s) return;
      const a = at(t), b = at(s), sc = Math.min(s.offsetWidth / t.offsetWidth, s.offsetHeight / t.offsetHeight) * 0.9;
      t.classList.add('lz-moving');
      t.dataset.to = `translate(${(b.x - a.x).toFixed(1)}px, ${(b.y - a.y).toFixed(1)}px) scale(${sc.toFixed(3)})`;
      t.style.transform = t.dataset.to;
    },
    // a pair is made: both tiles grow a little and vanish
    pop(ids, chars = ['✨']) {
      let c = null;
      for (const id of ids) {
        const t = el(id); if (!t) continue;
        t.classList.add('lz-moving'); t.style.transform = (t.dataset.to || '') + ' scale(1.3)'; t.style.opacity = '0';
        const p = at(t); c = c || p;
      }
      if (c) { const t = el(ids[0]), m = t.dataset.to && /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(t.dataset.to); sparkle(c.x + (m ? +m[1] : 0), c.y + (m ? +m[2] : 0), chars); }
    },
    // the tile is taken off the board (no tray in this lesson)
    leave(id) { const t = el(id); if (!t) return; t.classList.add('lz-moving'); t.style.transform = 'translateY(-16px) scale(.7)'; t.style.opacity = '0'; },
    // a face-down tile is turned over
    flip(id) {
      const t = el(id); if (!t) return;
      try { t.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(.08)', offset: .5 }, { transform: 'scaleX(1)' }], { duration: 320, easing: 'ease-in-out' }); } catch (e) { }
      later(160, () => t.classList.remove('lesson-back'));
    },
    // a little text rises from a tile (a move used)
    float(id, text) {
      const t = el(id); if (!t) return;
      const c = at(t), f = document.createElement('span'); f.className = 'lz-float'; f.textContent = text;
      f.style.left = (c.x + t.offsetWidth * 0.5 + 24) + 'px'; f.style.top = (c.y - t.offsetHeight * 0.25) + 'px'; scene.appendChild(f);
      later(900, () => f.remove());
    },
    // a badge changes (the number on the clock, ice getting thinner)
    badge(id, sel, html, cls = '') {
      const b = el(id) && el(id).querySelector(sel); if (!b) return;
      b.innerHTML = html; if (cls) b.classList.add(cls);
      b.classList.remove('lz-tick'); void b.offsetWidth; b.classList.add('lz-tick');
    },
  };
}
// the story of each lesson: what happens at the start of step 1, 2 and 3 (step 0 is the starting picture)
const LESSON_STEPS = {
  lock: [
    A => { A.el('k1').classList.add('lz-glow'); A.el('k2').classList.add('lz-glow'); },
    A => A.tap('k1', t => { t.classList.remove('lz-glow'); A.toTray('k1', 0);
      A.later(420, () => ['l1', 'l2'].forEach(id => A.el(id).classList.add('lz-shut'))); }),   // one key: the locks only rattle
    A => A.tap('k2', () => {
      A.toTray('k2', 0);
      A.later(380, () => {
        A.pop(['k1', 'k2'], ['🔑', '✨']);
        A.later(260, () => ['l1', 'l2'].forEach(id => { const t = A.el(id); t.classList.remove('lz-shut'); t.classList.add('lz-open'); t.querySelector('.lz-lockb').textContent = '🔓'; const c = A.at(t); A.sparkle(c.x, c.y, ['✨']); }));
      });
    }),
    A => A.tap('l1', () => A.toTray('l1', 0)),
  ],
  clock: [
    A => A.el('ck').classList.add('lz-glow'),
    A => A.tap('a', () => { A.toTray('a', 0); A.later(300, () => { A.badge('ck', '.lz-ck', '⏰<i>2</i>'); A.float('ck', '−1'); }); }),
    A => A.tap('d', () => { A.flip('d'); A.later(380, () => A.el('ck').querySelector('.lz-ck').classList.add('lz-same')); }),
    A => A.tap('ck', () => { A.badge('ck', '.lz-ck', '✓', 'lz-done'); A.toTray('ck', 1); const c = A.at(A.el('ck')); A.sparkle(c.x, c.y, ['⏰', '✨', '🎉']); }),
  ],
  ice: [
    A => A.el('ice').classList.add('lz-glow'),
    A => A.tap('a', () => { A.leave('a'); A.later(250, () => { const t = A.el('ice'); t.classList.remove('lz-ice2'); t.classList.add('lz-ice1'); A.badge('ice', '.lz-iceb', '❄️'); A.sparkle(A.at(t).x, A.at(t).y - 14, ['❄️', '✨']); }); }),
    A => A.tap('b', () => { A.leave('b'); A.later(250, () => { const t = A.el('ice'); t.classList.remove('lz-ice1', 'lz-glow'); t.classList.add('lz-melted'); A.sparkle(A.at(t).x, A.at(t).y, ['💧', '✨']); }); }),
    A => A.tap('ice', t => t.classList.add('lz-picked')),
  ],
  trayPair: [
    A => A.tap('d', null, false),
    A => A.tap('d', () => A.flip('d')),
    A => A.tap('t', null, false),
    A => A.tap('t', () => {
      // the two tiles meet above the board and go together: the tray keeps its three tiles
      const d = A.el('d'), t = A.el('t'), a = A.at(d), b = A.at(t), mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 10;
      for (const [e, p] of [[d, a], [t, b]]) { e.classList.add('lz-moving'); e.dataset.to = `translate(${(mx - p.x).toFixed(1)}px, ${(my - p.y).toFixed(1)}px)`; e.style.transform = e.dataset.to; }
      A.later(340, () => { A.pop(['d', 't']); A.hideHand(); A.el('s0').closest('.lesson-tray').classList.add('lz-ok'); });
    }),
  ],
};
function startLessonDemo() {
  stopLessonDemo();
  const demo = $('#modalBox .lesson-demo');
  if (!demo) return;
  const kind = demo.dataset.lesson, prefix = { ice: 'Ice', lock: 'Lock', clock: 'Clock', trayPair: 'Pair' }[kind];
  const scene = demo.querySelector('.lesson-scene');
  let step = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, actor = null;
  const toggle = demo.querySelector('.lesson-toggle');
  const controls = () => {
    demo.classList.toggle('lesson-paused', !playing);
    toggle.textContent = tx(playing ? 'lessonPause' : 'lessonPlay');
    toggle.setAttribute('aria-pressed', String(playing));
  };
  // the starting picture: built fresh (gently faded in when the lesson starts over)
  const fresh = fade => {
    lessonJobs.forEach(clearTimeout); lessonJobs = [];
    const build = () => {
      scene.innerHTML = lessonSceneHTML(kind);
      actor = lessonActor(scene);
      scene.classList.remove('lz-fade');
      LESSON_STEPS[kind][0](actor);
    };
    if (fade && scene.childElementCount) { scene.classList.add('lz-fade'); actor.later(180, build); } else build();
  };
  const paint = () => {
    demo.dataset.step = step;
    demo.querySelector('.lesson-caption').textContent = tx('lesson' + prefix + step);
  };
  const next = () => {
    step = (step + 1) % 4; paint();
    if (step === 0) fresh(true); else LESSON_STEPS[kind][step](actor);
  };
  const run = () => {
    clearInterval(lessonTimer); lessonTimer = null;
    if (playing) lessonTimer = setInterval(() => {
      if (!demo.isConnected || modalFree()) { stopLessonDemo(); return; }
      if (document.hidden) return;
      next();
    }, LZ_STEP_MS);
    controls();
  };
  toggle.onclick = () => { playing = !playing; run(); };
  demo.querySelector('.lesson-replay').onclick = () => { step = 0; playing = true; paint(); fresh(true); run(); };
  paint(); fresh(false); run();
}
function showTileLesson(kind, after = null, reminder = false, why = reminder ? 'retry' : 'intro') {
  // (from 1.60: a film of a real game in the player's own tiles, background and tray, js/coach.js;
  // the explanation folds open under it)
  openModal(`${reminder ? `<p class="lesson-reminder">${tx('lessonReminder')}</p>` : ''}<h2>${tx('nt_' + kind)}</h2>
    ${coachDemoHTML(false, kind)}<details class="cz-more"><summary>${tx('czMore')}</summary><p>${tx('nt_' + kind + '_text')}</p></details>
    <button class="big-btn play" id="ntGo"><span class="bb-text"><b>${tx('gotIt')}</b></span></button>`, false, () => {
      S.seenSp[kind] = true; save();
      if (after) after();
    }, 'tile-help coach-help');
  coachPlay($('#modalBox .coach-demo'), coachTileClip(kind));
  const message = recordHelpMessage(kind, why);
  $('#ntGo').onclick = () => { message('ack'); closeModal(); };
}
// One relevant reminder per retry, from the third failure; rotate as failures accumulate.
// Resuming an unfinished try does not trigger it again.
function retryTileHelp(after = null, resumed = false) {
  if (!G || resumed || G.o.mode !== 'level' || (S.fails[G.key] || 0) < 3) return false;
  if (coachLevelOn()) return false;        // from RULES.coach.fromLevel: no reminders, only the film of the own lost try
  const kinds = ['ice', 'lock', 'trayPair'].filter(k => NEW_TILES[k].has());
  if (G.clock) kinds.push('clock');
  if (!kinds.length) return false;
  const kind = kinds[((S.fails[G.key] || 0) - 3) % kinds.length];
  if (kind === 'clock') showClockLesson(after, true);
  else showTileLesson(kind, after, true);
  return true;
}
function showLessonMenu() {
  if (coachOn(S.level)) { showCoachMenu(); return; }      // from RULES.coach.fromLevel the game tips replace these
  openModal(`<h2>${tx('lessonMenu')}</h2>${['ice', 'lock', 'clock', 'trayPair'].map(k => `<button class="big-btn lesson-pick" data-kind="${k}"><span class="bb-text"><b>${tx('nt_' + k)}</b></span></button>`).join('')}
    <button class="link-btn" id="mClose">${tx('gotIt')}</button>`, true, null, 'tile-help');
  $('#modalBox').querySelectorAll('.lesson-pick').forEach(b => { b.onclick = () => b.dataset.kind === 'clock' ? showClockLesson(showLessonMenu, false, 'manual') : showTileLesson(b.dataset.kind, showLessonMenu, false, 'manual'); });
  $('#mClose').onclick = closeModal;
}
// The same explanation before the first clock level and after every clock timeout.
const clockHelpText = () => ['nt_clock_text', 'clockMoves', 'clockFree', 'clockGoal'].map(k => `<p>${tx(k)}</p>`).join('');
// (from 1.59, with the film: the first line shows, the rest folds open, so the film can be big)
const clockHelpShort = () => `<p>${tx('nt_clock_text')}</p><details class="cz-more"><summary>${tx('czMore')}</summary>${['clockMoves', 'clockFree', 'clockGoal'].map(k => `<p>${tx(k)}</p>`).join('')}</details>`;
function showClockLesson(after = null, reminder = false, why = reminder ? 'retry' : 'intro') {
  // (from 1.59: a film of a real game in the player's own tiles, js/coach.js)
  openModal(`${reminder ? `<p class="lesson-reminder">${tx('lessonReminder')}</p>` : ''}<h2>${tx('nt_clock')}</h2>${coachDemoHTML(false, 'clock')}${clockHelpShort()}
    <button class="big-btn play" id="ntGo"><span class="bb-text"><b>${tx('gotIt')}</b></span></button>`, false, () => {
      S.seenSp.clock = S.seenSp.clockMoves = true; save();
      replayMark('clock-help', 'acknowledged');
      if (after) after();
    }, 'clock-help coach-help');
  coachPlay($('#modalBox .coach-demo'), coachClockClip());
  replayMark('clock-help', 'intro');
  const message = recordHelpMessage('clock', why);
  $('#ntGo').onclick = () => { message('ack'); closeModal(); };
}
function clockIntro(after = null) {
  if (!clockOn() || S.seenSp.clockMoves) return false;
  showClockLesson(after);
  return true;
}
function newTileIntro(after = null) {
  if (!G || G.done) return false;
  const k = Object.keys(NEW_TILES).find(k => !S.seenSp[k] && NEW_TILES[k].has() && (!NEW_TILES[k].first || NEW_TILES[k].first()));
  if (!k) return false;
  if (k !== 'joker2') { showTileLesson(k, after); return true; }
  S.seenSp[k] = true; save();
  const t = NEW_TILES[k];
  openModal(`<div class="nt-ico">${t.ico}</div><h2>${tx('newTile', tx('nt_' + k))}</h2><p>${tx('nt_' + k + '_text')}</p>
    <button class="big-btn play" id="ntGo"><span class="bb-text"><b>${tx('gotIt')}</b></span></button>`, true, after);
  $('#ntGo').onclick = closeModal;
  return true;
}
