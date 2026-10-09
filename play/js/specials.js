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
  if (o.mode === 'level' && lvl >= sp.jokerFrom && r() < sp.jokerChance) {
    const cnt = {};
    o.faces.forEach(f => cnt[f] = (cnt[f] || 0) + 1);
    const twos = Object.keys(cnt).filter(f => cnt[f] === 2 && +f < 100).map(Number);
    if (twos.length) { const f = twos[Math.floor(r() * twos.length)]; o.faces = o.faces.map(x => x === f ? JOKER : x); }
  }
  o.specials = true;
}
// the points multiplier for a pair, with its little celebration
function specialMatch(face, gold, c) {
  if (gold) { praise('✨ Gouden paar! x2'); Sound.perfect(); FX.emoji(c.x, c.y, ['✨', '🌟', '💛'], 10); bumpStat('gold'); }
  if (face === JOKER) { praise('🃏 Twee jokers!'); FX.emoji(c.x, c.y, ['🃏', '✨'], 8); bumpStat('jokers'); }
  return gold ? RULES.score.goldMult : 1;
}
// the first time a special tile shows up: a short explanation
function specialTip() {
  if (!G || G.done || newTileIntro()) return;
  if (G.gold.size > 0 && !S.seenSp.gold) { S.seenSp.gold = true; save(); toast('✨ Nieuw: een gouden paar geeft dubbele punten!', 4200); }
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
    praise('🃏 Joker!'); Sound.supercombo(); FX.emoji(c.x, c.y, ['🃏', '✨'], 8); bumpStat('jokers');
  });
}
// the joker as the very last tile (or left alone in the tray): it finishes the level with a bonus
function jokerBonus(c) {
  const pts = RULES.score.jokerFinale;
  addScore(pts);
  praise(`🃏 Joker-finale! +${pts}`); Sound.supercombo(); flash(); buzz([20, 40, 20, 40, 40]);
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
  if (o.mode !== 'level' || o.level < Layouts.MECH.ice) return;
  const avoid = new Set([...(o.down || []), ...(o.gold || [])]);
  o.obst = Layouts.obstacles(spec.tiles, o.faces, { level: o.level, seed: spec.seed, avoid, ez: o.ez || 0 });
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
  praise('🔓 Sloten open!'); Sound.unlock(); bumpStat('unlocks');
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
      if (!left) praise('🧊 Ijs gesmolten!'); else toast('🧊 Krak! Nog één keer', 1600);
    }
  }
  if (!ob.unlocked && ob.keys.length && ob.keys.every(k => !G.alive[k])) unlockAll();
}
// a tap on a frozen or locked tile: say what to do, and show it
function obBlocked(i) {
  replay(G.tiles[i].el, 'shake');
  Sound.blocked(); buzz(30);
  const ice = frozen(i);
  toast(ice ? (G.ob.left[i] > 1 ? '🧊 Dik ijs: haal 2 stenen ernaast weg' : '🧊 Bevroren: haal eerst een steen ernaast weg') : '🔒 Op slot: speel eerst het 🔑-paar weg', 2600);
  const show = ice ? G.inb[i].filter(j => G.alive[j] && canTake(j)) : G.ob.keys.filter(k => G.alive[k]);
  show.forEach(j => replay(G.tiles[j].el, 'obhint', 1300));
}
// never stuck because of ice or locks alone: if nothing at all can be taken, they give way
function obRelief() {
  if (!G || !G.ob || G.done || G.overShown || G.flights || G.tray.length >= SLOTS) return;
  let anyFree = false;
  for (let i = 0; i < G.tiles.length; i++) if (free(i)) { anyFree = true; if (canTake(i)) return; }
  if (!anyFree) return;
  if (Object.keys(G.ob.left).some(k => G.ob.left[k] > 0)) {
    Object.keys(G.ob.left).forEach(k => { if (G.ob.left[k] > 0) { G.ob.left[k] = 0; decorate(+k); crackFx(+k); } });
    praise('☀️ Het ijs smelt vanzelf'); Sound.unlock();
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
const NEW_TILES = {
  lock: { has: () => !!(G.ob && G.ob.keys.length), ico: '🔒', title: 'Slot en sleutel', text: 'Stenen met een <b>slotje</b> kun je pas pakken als je het paar met de <b>🔑 sleutel</b> hebt weggespeeld. Zoek dus eerst de sleutels!' },
  ice: { has: () => !!(G.ob && Object.keys(G.ob.need).length), ico: '🧊', title: 'Bevroren stenen', text: 'Sommige stenen zitten vast in het <b>ijs</b>. Haal een steen weg die ernaast, erop of eronder ligt: dan smelt het ijs. Bij dik ijs ❄️❄️ moet dat twee keer.' },
  joker2: { has: () => G.tiles.some(t => t.face === JOKER), ico: '🃏', title: 'De joker', text: 'De joker past bij <b>elke</b> steen! Zitten er stenen in je vakjes? Tik de joker aan: hij haalt er een weg, <b>samen met zijn tweeling</b>, waar die ook ligt. Zijn je vakjes leeg? Dan wacht de joker en neemt hij de volgende steen mee.' },
};
function newTileIntro() {
  if (!G || G.done) return false;
  const k = Object.keys(NEW_TILES).find(k => !S.seenSp[k] && NEW_TILES[k].has());
  if (!k) return false;
  S.seenSp[k] = true; save();
  const t = NEW_TILES[k];
  openModal(`<div class="nt-ico">${t.ico}</div><h2>Nieuw: ${t.title}</h2><p>${t.text}</p>
    <button class="big-btn play" id="ntGo"><span class="bb-text"><b>Begrepen!</b></span></button>`, true);
  $('#ntGo').onclick = closeModal;
  return true;
}
