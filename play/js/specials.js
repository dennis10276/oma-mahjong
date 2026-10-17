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
  G.ob.locks.forEach(i => { decorate(i); if (G.alive[i]) { const c = centerOf(G.tiles[i].el); FX.emoji(c.x, c.y, ['🔓', '✨'], 6); } });
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
  const show = ice ? G.inb[i].filter(j => G.alive[j] && canTake(j)) : G.ob.keys.filter(k => G.alive[k]);
  show.forEach(j => replay(G.tiles[j].el, 'obhint', 1300));
}
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
// Small, local demonstrations: no download, sound or changes to the real board.
let lessonTimer = null;
function stopLessonDemo() { clearInterval(lessonTimer); lessonTimer = null; }
const lessonTile = (face, badge = '', cls = '') => `<span class="lesson-tile ${cls}"><span class="lesson-face">${Tiles.faceHTML('classic', face)}</span>${badge ? `<b class="lesson-badge">${badge}</b>` : ''}</span>`;
const lessonTray = faces => `<div class="lesson-tray">${[0, 1, 2, 3].map(i => `<span class="lesson-slot">${i < faces.length ? lessonTile(faces[i]) : ''}</span>`).join('')}</div>`;
function lessonFrame(kind, step) {
  const tile = lessonTile;
  const gone = (yes, leaving) => yes ? (leaving ? 'lesson-leaving' : 'lesson-gone') : '';
  if (kind === 'ice') return `<div class="lesson-board lesson-ice-board">${tile(4, '', gone(step > 0, step === 1))}${tile(31, step < 2 ? (step ? '❄️' : '❄️❄️') : '', step < 2 ? 'lesson-ice' : step === 3 ? 'lesson-focus' : '')}${tile(8, '', gone(step > 1, step === 2))}</div>`;
  if (kind === 'lock') return `<div class="lesson-board">${tile(4, '🔑', gone(step > 0, step === 1))}${tile(31, step < 2 ? '🔒' : '🔓', step === 3 ? 'lesson-focus' : '')}${tile(4, '🔑', gone(step > 1, step === 2))}${tile(8, step < 2 ? '🔒' : '🔓')}</div>${lessonTray(step === 1 ? [4] : [])}`;
  if (kind === 'clock') return `<div class="lesson-board"><strong class="lesson-counter">⏰ ${step === 0 ? '3' : step === 3 ? '✓' : '2'}</strong>${tile(31, '⏰', gone(step === 3, step === 3))}${tile(4, '', gone(step > 0, step === 1))}${tile(8, '', step < 2 ? 'lesson-back' : step === 2 ? 'lesson-focus' : '')}</div>${lessonTray(step === 3 ? [4, 31] : step ? [4] : [])}`;
  return `${lessonTray([4, 8, 12])}<div class="lesson-board">${tile(31, '', step === 0 ? 'lesson-back lesson-focus' : step === 3 ? 'lesson-leaving' : step === 1 ? 'lesson-focus' : '')}${tile(31, '', step === 3 ? 'lesson-leaving' : step === 2 ? 'lesson-focus' : '')}</div>`;
}
function lessonDemoHTML(kind) {
  return `<div class="lesson-demo" data-lesson="${kind}">
    <div class="lesson-scene" aria-hidden="true"></div>
    <div class="lesson-caption"></div>
    <div class="lesson-controls"><span>${tx('lessonExample')}</span><button type="button" class="lesson-toggle"></button><button type="button" class="lesson-replay">↺ ${tx('lessonReplay')}</button></div>
  </div>`;
}
function startLessonDemo() {
  stopLessonDemo();
  const demo = $('#modalBox .lesson-demo');
  if (!demo) return;
  const kind = demo.dataset.lesson, prefix = { ice: 'Ice', lock: 'Lock', clock: 'Clock', trayPair: 'Pair' }[kind];
  let step = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toggle = demo.querySelector('.lesson-toggle');
  const paint = () => {
    const changed = demo.dataset.step !== String(step);
    demo.dataset.step = step;
    demo.classList.toggle('lesson-paused', !playing);
    if (changed) demo.querySelector('.lesson-scene').innerHTML = lessonFrame(kind, step);
    demo.querySelector('.lesson-caption').textContent = tx('lesson' + prefix + step);
    toggle.textContent = tx(playing ? 'lessonPause' : 'lessonPlay');
    toggle.setAttribute('aria-pressed', String(playing));
  };
  const run = () => {
    stopLessonDemo();
    if (playing) lessonTimer = setInterval(() => {
      if (!demo.isConnected || modalFree()) { stopLessonDemo(); return; }
      if (document.hidden) return;
      step = (step + 1) % 4; paint();
    }, 2400);
    paint();
  };
  toggle.onclick = () => { playing = !playing; run(); };
  demo.querySelector('.lesson-replay').onclick = () => { step = 0; playing = true; run(); };
  run();
}
function showTileLesson(kind, after = null, reminder = false) {
  openModal(`${reminder ? `<p class="lesson-reminder">${tx('lessonReminder')}</p>` : ''}<h2>${tx('nt_' + kind)}</h2>
    ${lessonDemoHTML(kind)}<p>${tx('nt_' + kind + '_text')}</p>
    <button class="big-btn play" id="ntGo"><span class="bb-text"><b>${tx('gotIt')}</b></span></button>`, false, () => {
      S.seenSp[kind] = true; save();
      if (after) after();
    }, 'tile-help');
  startLessonDemo();
  $('#ntGo').onclick = closeModal;
}
// One relevant reminder per retry, from the third failure; rotate as failures accumulate.
// Resuming an unfinished try does not trigger it again.
function retryTileHelp(after = null, resumed = false) {
  if (!G || resumed || G.o.mode !== 'level' || (S.fails[G.key] || 0) < 3) return false;
  const kinds = ['ice', 'lock', 'trayPair'].filter(k => NEW_TILES[k].has());
  if (G.clock) kinds.push('clock');
  if (!kinds.length) return false;
  const kind = kinds[((S.fails[G.key] || 0) - 3) % kinds.length];
  if (kind === 'clock') showClockLesson(after, true);
  else showTileLesson(kind, after, true);
  return true;
}
function showLessonMenu() {
  openModal(`<h2>${tx('lessonMenu')}</h2>${['ice', 'lock', 'clock', 'trayPair'].map(k => `<button class="big-btn lesson-pick" data-kind="${k}"><span class="bb-text"><b>${tx('nt_' + k)}</b></span></button>`).join('')}
    <button class="link-btn" id="mClose">${tx('gotIt')}</button>`, true, null, 'tile-help');
  $('#modalBox').querySelectorAll('.lesson-pick').forEach(b => { b.onclick = () => b.dataset.kind === 'clock' ? showClockLesson(showLessonMenu) : showTileLesson(b.dataset.kind, showLessonMenu); });
  $('#mClose').onclick = closeModal;
}
// The same explanation before the first clock level and after every clock timeout.
const clockHelpText = () => ['nt_clock_text', 'clockMoves', 'clockFree', 'clockGoal'].map(k => `<p>${tx(k)}</p>`).join('');
function showClockLesson(after = null, reminder = false) {
  openModal(`${reminder ? `<p class="lesson-reminder">${tx('lessonReminder')}</p>` : ''}<h2>${tx('nt_clock')}</h2>${lessonDemoHTML('clock')}${clockHelpText()}
    <button class="big-btn play" id="ntGo"><span class="bb-text"><b>${tx('gotIt')}</b></span></button>`, false, () => {
      S.seenSp.clock = S.seenSp.clockMoves = true; save();
      replayMark('clock-help', 'acknowledged');
      if (after) after();
    }, 'clock-help');
  startLessonDemo();
  replayMark('clock-help', 'intro');
  $('#ntGo').onclick = closeModal;
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
