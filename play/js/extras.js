/* Oma's Mahjong — statistics, daily tasks with the chest, special tiles (gold, gift, joker) and the lucky moment. */
'use strict';

// ---------- statistics ----------
function bumpStat(k, n = 1) { S.stats = S.stats || {}; S.stats[k] = (S.stats[k] || 0) + n; }
function fmtTime(sec) { const h = Math.floor(sec / 3600), m = Math.round(sec % 3600 / 60); return h ? `${h} u ${m} min` : `${m} min`; }
function statsHTML() {
  const st = S.stats || {};
  const items = [
    ['🧩', 'Levels uitgespeeld', S.level - 1], ['⭐', 'Sterren', totalStars()], ['🀄', 'Paren gemaakt', S.matches || 0],
    ['💰', 'Punten', myPoints().toLocaleString('nl-NL')], ['📅', 'Dagpuzzels', Object.keys(S.daily).length], ['🔥', 'Langste reeks', `${S.bestStreak || 0} ${S.bestStreak === 1 ? 'dag' : 'dagen'}`],
    ['🌈', 'Beste combo', S.bestCombo || 0], ['⏱️', 'Speeltijd', fmtTime(st.playSec || 0)], ['🎁', 'Schatkisten', st.chests || 0],
    ['💛', 'Hartjes gekregen', st.hearts || 0], ['🍀', 'Geluksmomenten', st.lucky || 0], ['🥇', 'Weken gewonnen', S.weekWins || 0],
  ];
  return `<div class="stats-card"><h3>📊 Mijn prestaties</h3><div class="stats-grid">${items.map(([i, l, v]) => `<div class="stat"><span>${i}</span><b>${v}</b><small>${l}</small></div>`).join('')}</div></div>`;
}

// ---------- daily tasks ----------
const TASK_TYPES = [
  { id: 'pairs', ico: '🀄', make: r => 20 + Math.floor(r() * 3) * 10, text: g => `Maak ${g} paren` },
  { id: 'levels', ico: '🧩', make: r => 2 + Math.floor(r() * 2), text: g => `Speel ${g} levels uit` },
  { id: 'daily', ico: '📅', make: () => 1, text: () => 'Speel de dagpuzzel' },
  { id: 'combo', ico: '🔥', make: r => 3 + Math.floor(r() * 2), text: g => `Maak ${g} paren vlak na elkaar` },
  { id: 'stars3', ico: '⭐', make: () => 1, text: () => 'Haal 3 sterren in een level' },
  { id: 'flips', ico: '🔄', make: r => 5 + Math.floor(r() * 2) * 5, text: g => `Draai ${g} stenen om`, minLevel: 6 },
  { id: 'points', ico: '💰', make: r => (10 + Math.floor(r() * 6)) * 100, text: g => `Verdien ${g.toLocaleString('nl-NL')} punten` },
  { id: 'nohelp', ico: '💪', make: () => 1, text: () => 'Speel een level uit zonder hint of schudden', minLevel: 16 },
];
function ensureTasks() {
  const tk = todayKey();
  if (S.tasks && S.tasks.date === tk) return S.tasks;
  const r = Layouts.rng(dnum(tk) * 3 + (S.level % 7));
  const pool = TASK_TYPES.filter(t => !t.minLevel || S.level >= t.minLevel);
  const list = Layouts.shuffleArr(r, pool.slice()).slice(0, 3).map(t => ({ id: t.id, goal: t.make(r), prog: 0, done: false }));
  S.tasks = { date: tk, list, chest: false };
  save();
  return S.tasks;
}
const taskType = id => TASK_TYPES.find(t => t.id === id);
const tasksDone = () => ensureTasks().list.filter(t => t.done).length;
// amount: add to progress; or with max=true keep the highest value (e.g. a combo)
function taskProgress(id, amount = 1, max = false) {
  const T = ensureTasks();
  T.list.forEach(t => {
    if (t.id !== id || t.done) return;
    t.prog = max ? Math.max(t.prog, amount) : t.prog + amount;
    if (t.prog >= t.goal) {
      t.prog = t.goal; t.done = true;
      S.bonusStars = (S.bonusStars || 0) + 1;
      bumpStat('tasks');
      setTimeout(() => { toast(`✅ Taak klaar: ${taskType(t.id).text(t.goal)} (+1 ⭐)`, 2800); Sound.star(2); }, 600);
      if (T.list.every(x => x.done)) setTimeout(() => { if (!ensureTasks().chest) toast('🎁 Alle taken klaar! Open je schatkist in het menu', 3200); }, 3600);
    }
  });
  save();
}
function renderTaskChip() {
  const T = ensureTasks(), n = tasksDone(), ready = n === 3 && !T.chest;
  $('#taskDots').textContent = T.chest ? '✅' : ready ? '🎁' : T.list.map(t => t.done ? '●' : '○').join('');
  $('#btnTasks').classList.toggle('ready', ready);
}
function openTasks() {
  const T = ensureTasks(), n = tasksDone(), ready = n === 3 && !T.chest;
  openModal(`<h2>📋 Taken van vandaag</h2>
    <div class="task-list">${T.list.map(t => { const ty = taskType(t.id); return `<div class="task${t.done ? ' done' : ''}"><span class="t-ico">${t.done ? '✅' : ty.ico}</span><div><b>${ty.text(t.goal)}</b><span class="bar"><i style="width:${Math.round(t.prog / t.goal * 100)}%"></i></span><small>${t.done ? 'Klaar! +1 ⭐' : `${t.prog.toLocaleString('nl-NL')} / ${t.goal.toLocaleString('nl-NL')}`}</small></div></div>`; }).join('')}</div>
    <button class="chest-btn${ready ? ' ready' : ''}${T.chest ? ' opened' : ''}" id="chestBtn"><span class="chest-ico">${T.chest ? '📭' : '🎁'}</span><span>${T.chest ? 'Schatkist van vandaag is open. Morgen nieuwe taken!' : ready ? 'Tik om je schatkist te openen!' : `Maak alle 3 taken af voor de schatkist (${n}/3)`}</span></button>
    <button class="link-btn" id="tkClose">Sluiten</button>`);
  $('#tkClose').onclick = closeModal;
  $('#chestBtn').onclick = () => { if (ready) openChest(); else if (!T.chest) { Sound.blocked(); toast('Eerst alle 3 taken afmaken 😊'); } };
}
function openChest() {
  const T = ensureTasks();
  if (T.chest) return;
  T.chest = true;
  const pts = 300 + Math.min(4, Math.floor((S.level - 1) / 10)) * 100;
  S.bonusPts = (S.bonusPts || 0) + pts; S.bonusStars = (S.bonusStars || 0) + 2; ensureWeek().pts += pts;
  bumpStat('chests'); save(); pushScore();
  logEvt('chest', { pts });
  Sound.trophy(); FX.confetti(); buzz([30, 60, 30, 60, 80]);
  openModal(`<div class="chest-open"><span class="lid">🎁</span></div><h2>Schatkist!</h2>
    <div class="chest-loot"><div>💰<b>+${pts}</b><small>punten</small></div><div>⭐<b>+2</b><small>sterren</small></div></div>
    <p class="note">Morgen staan er weer nieuwe taken klaar.</p>
    <button class="big-btn play" id="chOk"><span class="bb-text"><b>Hoera!</b></span></button>`, false);
  setTimeout(() => FX.emoji(innerWidth / 2, innerHeight * 0.35, ['⭐', '💰', '✨', '🎉'], 16), 250);
  $('#chOk').onclick = () => { closeModal(); renderHome(); };
}

// ---------- special tiles (higher levels) ----------
const GIFT = 100, JOKER = 101;
// turn one pair with a picture that appears exactly twice into a joker pair (keeps the level solvable).
// GIFT is no longer dealt (1.18); it stays known only for games saved before.
function addSpecials(o, spec) {
  if (o.specials) return;
  const lvl = o.mode === 'level' ? o.level : Math.max(20, S.level);
  const r = Layouts.rng(spec.seed + 555);
  const cnt = {};
  o.faces.forEach(f => cnt[f] = (cnt[f] || 0) + 1);
  const twos = Object.keys(cnt).filter(f => cnt[f] === 2 && +f < 100).map(Number);
  const relabel = (to) => { if (!twos.length) return; const f = twos.splice(Math.floor(r() * twos.length), 1)[0]; o.faces = o.faces.map(x => x === f ? to : x); };
  o.gold = [];
  if (lvl >= 20) {
    // a golden pair: double points
    const anyF = o.faces.filter(f => f < 100);
    const f = anyF[Math.floor(r() * anyF.length)];
    o.gold = o.faces.map((x, i) => x === f ? i : -1).filter(i => i >= 0).slice(0, 2);
  }
  if (o.mode === 'level' && lvl >= 30 && r() < 0.6) relabel(JOKER);
  o.specials = true;
}
function specialMatch(face, gold, c) {
  let mult = 1;
  if (gold) {
    mult = 2;
    praise('✨ Gouden paar! x2'); Sound.perfect(); FX.emoji(c.x, c.y, ['✨', '🌟', '💛'], 10); bumpStat('gold');
  }
  if (face === JOKER) { praise('🃏 Twee jokers!'); FX.emoji(c.x, c.y, ['🃏', '✨'], 8); bumpStat('jokers'); }
  if (face === GIFT) {
    const star = Math.random() < 0.5;
    if (star) { S.bonusStars = (S.bonusStars || 0) + 1; praise('🎁 Cadeautje: +1 ⭐'); }
    else { S.bonusPts = (S.bonusPts || 0) + 150; ensureWeek().pts += 150; praise('🎁 Cadeautje: +150'); }
    Sound.unlock(); FX.emoji(c.x, c.y, ['🎁', '⭐', '✨'], 10); bumpStat('gifts'); save();
  }
  return mult;
}
/* ---------- the joker (from level 30): it fits every picture ----------
   Tap a joker while tiles wait in the tray: it takes one of them (the one whose twin is hardest to
   reach) away together with that twin, wherever it lies. With an empty tray the joker waits in a
   slot and takes the next tile you tap, with its twin. Two jokers also match each other. */
function jokerTarget() {
  const cand = G.tray.filter(t => G.tiles[t].face !== JOKER && !G.arriving.has(t));
  if (!cand.length) return null;
  const easy = t => G.tiles.some((u, k) => k !== t && G.alive[k] && u.face === G.tiles[t].face && canTake(k));
  return cand.find(t => !easy(t)) ?? cand[0];
}
function jokerPlay(j, x) {
  clearHint();
  const inTray = t => G.tray.includes(t);
  const waiting = inTray(j) ? j : x, tapped = waiting === j ? x : j;
  luckyTaken(tapped);
  const face = G.tiles[x].face;
  // its twin: a free one if there is one, otherwise the top-most
  let y = -1, best = -1;
  for (let k = 0; k < G.tiles.length; k++) if (k !== x && G.alive[k] && G.tiles[k].face === face) { const sc = (free(k) ? 1000 : 0) + G.tiles[k].z; if (sc > best) { best = sc; y = k; } }
  const slotIdx = G.tray.indexOf(waiting), slotEl = $('#tray').children[slotIdx], to = slotEl.getBoundingClientRect();
  const ghost = slotEl.firstElementChild ? slotEl.firstElementChild.cloneNode(true) : null;
  if (ghost) { ghost.classList.add('ghost'); Object.assign(ghost.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' }); ghost.style.setProperty('--sfs', $('#tray').style.getPropertyValue('--sfs')); document.body.appendChild(ghost); }
  G.tray.splice(slotIdx, 1); G.arriving.delete(waiting);
  const gold = [j, x, y].some(k => k >= 0 && G.gold.has(k));
  const MS = 260;
  const flies = [tapped, y].filter(k => k >= 0).map(k => {
    const e = G.tiles[k].el, r = e.getBoundingClientRect();
    G.alive[k] = 0; G.down[k] = 0; if (G.peek === k) G.peek = -1;
    e.classList.add('hidden');
    return flyTile(G.tiles[k].face, r, to, MS);
  });
  renderTray(); Sound.select(); buzz(10);
  G.flights++;
  afterLogic();
  setTimeout(() => {
    G.flights--;
    flies.forEach(f => f.classList.add('popout')); if (ghost) ghost.classList.add('popout');
    const c = { x: to.left + to.width / 2, y: to.top + to.height / 2 };
    onMatch(c, face, gold);
    praise('🃏 Joker!'); Sound.supercombo(); FX.emoji(c.x, c.y, ['🃏', '✨'], 8); bumpStat('jokers');
    setTimeout(() => { flies.forEach(f => f.remove()); if (ghost) ghost.remove(); }, 230);
    afterLand();
  }, MS);
}

// the joker as the very last tile: nothing left for it to take, so it finishes the level with a bonus
const JOKER_FINALE = 200;
function jokerFinale(i) {
  clearHint(); luckyTaken(i);
  const el = G.tiles[i].el, c = centerOf(el);
  G.alive[i] = 0; G.down[i] = 0; if (G.peek === i) G.peek = -1;
  el.classList.add('popout'); setTimeout(() => el.classList.add('hidden'), 230);
  G.score += JOKER_FINALE; updateScore(); floatScore('+' + JOKER_FINALE);
  praise(`🃏 Joker-finale! +${JOKER_FINALE}`); Sound.supercombo(); flash(); buzz([20, 40, 20, 40, 40]);
  FX.burst(c.x, c.y, 46, true); FX.emoji(c.x, c.y, ['🃏', '✨', '🌟'], 14);
  bumpStat('jokers'); bumpStat('jokerFinale');
  G.flights++;
  afterLogic();
  setTimeout(() => { G.flights--; afterLand(); }, 350);
}

// a joker left waiting in the tray with nothing left on the board (could happen in 1.18): finish with the bonus
function jokerLeftover() {
  if (!G || G.done || G.flights || aliveCount() || !G.tray.length || !G.tray.every(t => G.tiles[t].face === JOKER)) return;
  const slot = $('#tray').children[0], c = centerOf(slot);
  G.tray = []; renderTray();
  G.score += JOKER_FINALE; updateScore(); floatScore('+' + JOKER_FINALE);
  praise(`🃏 Joker-finale! +${JOKER_FINALE}`); Sound.supercombo(); flash();
  FX.burst(c.x, c.y, 46, true); FX.emoji(c.x, c.y, ['🃏', '✨', '🌟'], 14); bumpStat('jokerFinale');
  G.flights++; afterLogic();
  setTimeout(() => { G.flights--; afterLand(); }, 350);
}

/* ---------- ice (from level 35) and lock & key (from level 45) ----------
   G.ob = { need: {tile: hits}, left: {tile: hits still needed}, locks: Set, keys: [a, b], unlocked }.
   Ice melts when tiles around it leave the board; locks open when both key tiles are gone. */
function addObstacles(o, spec) {
  if (o.obstDone) return;
  o.obstDone = true; o.obst = null;
  if (o.mode !== 'level' || o.level < 35) return;
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
  if (!ob.unlocked && ob.keys.length && ob.keys.every(k => !G.alive[k])) {
    ob.unlocked = true;
    ob.locks.forEach(i => { decorate(i); if (G.alive[i]) { const c = centerOf(G.tiles[i].el); FX.emoji(c.x, c.y, ['🔓', '✨'], 6); } });
    ob.keys.forEach(decorate);
    praise('🔓 Sloten open!'); Sound.unlock(); bumpStat('unlocks');
  }
}
function crackFx(i) {
  const el = G.tiles[i].el; if (!el) return;
  const f = document.createElement('div'); f.className = 'ob-crack'; el.appendChild(f);
  setTimeout(() => f.remove(), 600);
}
// a tap on a frozen or locked tile: say what to do, and show it
function obBlocked(i) {
  const el = G.tiles[i].el;
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  Sound.blocked(); buzz(30);
  if (frozen(i)) {
    toast(G.ob.left[i] > 1 ? '🧊 Dik ijs: haal 2 stenen ernaast weg' : '🧊 Bevroren: haal eerst een steen ernaast weg', 2600);
    G.inb[i].filter(j => G.alive[j] && canTake(j)).forEach(j => { const e = G.tiles[j].el; e.classList.remove('obhint'); void e.offsetWidth; e.classList.add('obhint'); setTimeout(() => e.classList.remove('obhint'), 1300); });
  } else {
    toast('🔒 Op slot: speel eerst het 🔑-paar weg', 2600);
    G.ob.keys.filter(k => G.alive[k]).forEach(k => { const e = G.tiles[k].el; e.classList.remove('obhint'); void e.offsetWidth; e.classList.add('obhint'); setTimeout(() => e.classList.remove('obhint'), 1300); });
  }
}
// never stuck because of ice or locks alone: if nothing at all can be taken, they give way
function obRelief() {
  if (!G || !G.ob || G.done || G.overShown || G.flights || G.tray.length >= SLOTS) return;
  let anyFree = false;
  for (let i = 0; i < G.tiles.length; i++) if (free(i)) { anyFree = true; if (canTake(i)) return; }
  if (!anyFree) return;
  if (Object.keys(G.ob.left).some(k => G.ob.left[k] > 0)) {
    Object.keys(G.ob.left).forEach(k => { if (G.ob.left[k] > 0) { G.ob.left[k] = 0; decorate(+k); crackFx(+k); } });
    praise('☀️ Het ijs smelt vanzelf');
  } else if (!G.ob.unlocked) { G.ob.unlocked = true; G.ob.locks.forEach(decorate); G.ob.keys.forEach(decorate); praise('🔓 Sloten open!'); }
  Sound.unlock(); saveCur();
}
// the first time a new kind of tile shows up: a short explanation before playing
const NEW_TILES = {
  joker2: { has: () => G.tiles.some(t => t.face === JOKER), ico: '🃏', title: 'De joker', text: 'De joker past bij <b>elke</b> steen! Zitten er stenen in je vakjes? Tik de joker aan: hij haalt er een weg, <b>samen met zijn tweeling</b>, waar die ook ligt. Zijn je vakjes leeg? Dan wacht de joker en neemt hij de volgende steen mee.' },
  ice: { has: () => !!(G.ob && Object.keys(G.ob.need).length), ico: '🧊', title: 'Bevroren stenen', text: 'Sommige stenen zitten vast in het <b>ijs</b>. Haal een steen weg die ernaast, erop of eronder ligt: dan smelt het ijs. Bij dik ijs ❄️❄️ moet dat twee keer.' },
  lock: { has: () => !!(G.ob && G.ob.keys.length), ico: '🔒', title: 'Slot en sleutel', text: 'Stenen met een <b>slotje</b> kun je pas pakken als je het paar met de <b>🔑 sleutel</b> hebt weggespeeld. Zoek dus eerst de sleutels!' },
};
function newTileIntro() {
  if (!G || G.done) return false;
  S.seenSp = S.seenSp || {};
  const k = ['lock', 'ice', 'joker2'].find(k => !S.seenSp[k] && NEW_TILES[k].has());
  if (!k) return false;
  S.seenSp[k] = true; save();
  const t = NEW_TILES[k];
  openModal(`<div class="nt-ico">${t.ico}</div><h2>Nieuw: ${t.title}</h2><p>${t.text}</p>
    <button class="big-btn play" id="ntGo"><span class="bb-text"><b>Begrepen!</b></span></button>`, true);
  $('#ntGo').onclick = closeModal;
  return true;
}

// ---------- lucky moment ----------
function maybeLucky() {
  // grandma: lucky moments from level 1 on, more often, and up to twice per level
  const care = careMode();
  if (!G || G.done || G.lucky || (G.luckyN || 0) >= (care ? 2 : 1)) return;
  const lvl = G.mode === 'level' ? G.level : S.level;
  if (lvl < (care ? 1 : 10)) return;
  const n = G.tiles.length, left = G.alive.reduce((a, b) => a + b, 0);
  if (left > n * 0.8 || left < 6 || Math.random() > (care ? 0.5 : 0.3)) return;
  const tf = new Set(G.tray.map(t => G.tiles[t].face));
  const freeUp = [];
  for (let i = 0; i < n; i++) if (G.alive[i] && !G.down[i] && canTake(i) && G.tiles[i].face < 100) freeUp.push(i);
  const cand = freeUp.filter(i => tf.has(G.tiles[i].face) || freeUp.some(j => j !== i && G.tiles[j].face === G.tiles[i].face));
  if (!cand.length) return;
  const i = cand[Math.floor(Math.random() * cand.length)];
  G.lucky = { i, until: Date.now() + 15000 }; G.luckyN = (G.luckyN || 0) + 1;
  G.tiles[i].el.classList.add('lucky');
  toast('🍀 Geluksmoment! Pak snel de glinsterende steen', 4000);
  Sound.hint();
  setTimeout(() => { if (G && G.lucky && G.lucky.i === i) { G.tiles[i].el.classList.remove('lucky'); G.lucky = null; G.luckyDone = true; } }, 15000);
}
function luckyTaken(i) {
  if (!G.lucky || G.lucky.i !== i) return;
  const ok = Date.now() <= G.lucky.until;
  G.tiles[i].el.classList.remove('lucky');
  G.lucky = null; G.luckyDone = true;
  if (!ok) return;
  G.score += 150; updateScore(); bumpStat('lucky');
  const c = centerOf(G.tiles[i].el);
  setTimeout(() => { praise('🍀 Geluk! +150'); Sound.perfect(); FX.emoji(c.x || innerWidth / 2, c.y || innerHeight / 2, ['🍀', '✨', '🌟'], 12); }, 300);
}

// ---------- the daily gift: the first visit of the day starts with a present ----------
function maybeDailyGift() {
  if (S.giftDay === todayKey() || !S.seenIntro || curScreen !== 'home' || !$('#modal').classList.contains('hidden')) return;
  if ($('#heartPop') && $('#heartPop').classList.contains('on')) return;
  S.giftDay = todayKey(); save();
  const stars = Math.random() < 0.25 ? 2 : 1;
  openModal(`<div class="gift-box" id="gBox">🎁</div>
    <h2 id="gTitle">Je dagcadeau!</h2>
    <p id="gText">Fijn dat je er weer bent${S.name ? ', ' + S.name : ''}! Tik op het cadeau.</p>
    <button class="big-btn play" id="gOpen"><span class="bb-text"><b>Openmaken! 🎉</b></span></button>`, false);
  let opened = false;
  const open = () => {
    if (opened) { closeModal(); renderHome(); return; }
    opened = true;
    S.bonusStars = (S.bonusStars || 0) + stars; bumpStat('gifts'); save();
    logEvt('gift', { stars });
    Sound.trophy(); FX.confetti(); buzz([20, 40, 20, 40, 60]);
    const b = $('#gBox'); b.textContent = '⭐'.repeat(stars); b.classList.add('open');
    $('#gTitle').textContent = `+${stars} ${stars > 1 ? 'sterren' : 'ster'}! 🎉`;
    $('#gText').textContent = 'Veel speelplezier vandaag! 😊';
    $('#gOpen').innerHTML = '<span class="bb-text"><b>Fijn! 😊</b></span>';
  };
  $('#gOpen').onclick = open; $('#gBox').onclick = () => { if (!opened) open(); };
}
