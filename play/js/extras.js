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
// turn one pair with a picture that appears exactly twice into a special pair (keeps the level solvable)
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
  if (o.mode === 'level' && lvl >= 25 && r() < 0.6) relabel(GIFT);
  if (o.mode === 'level' && lvl >= 30 && r() < 0.6) relabel(JOKER);
  o.specials = true;
}
function specialMatch(face, gold, c) {
  let mult = 1;
  if (gold) {
    mult = 2;
    praise('✨ Gouden paar! x2'); Sound.perfect(); FX.emoji(c.x, c.y, ['✨', '🌟', '💛'], 10); bumpStat('gold');
  }
  if (face === GIFT) {
    const star = Math.random() < 0.5;
    if (star) { S.bonusStars = (S.bonusStars || 0) + 1; praise('🎁 Cadeautje: +1 ⭐'); }
    else { S.bonusPts = (S.bonusPts || 0) + 150; ensureWeek().pts += 150; praise('🎁 Cadeautje: +150'); }
    Sound.unlock(); FX.emoji(c.x, c.y, ['🎁', '⭐', '✨'], 10); bumpStat('gifts'); save();
  }
  return mult;
}
// joker pair: also clears one picture from the tray together with its twin on the board
function jokerEffect() {
  const k = G.tray.findIndex(t => !G.arriving.has(t));
  if (k < 0) { G.score += 100; praise('🃏 Joker! +100'); return; }
  const t = G.tray[k], face = G.tiles[t].face;
  G.tray.splice(k, 1);
  let twin = -1;
  for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && G.tiles[i].face === face && (twin < 0 || free(i))) twin = i;
  if (twin >= 0) {
    G.alive[twin] = 0; G.down[twin] = 0; if (G.peek === twin) G.peek = -1;
    const el = G.tiles[twin].el, c = centerOf(el);
    el.classList.add('popout'); setTimeout(() => el.classList.add('hidden'), 230);
    FX.emoji(c.x, c.y, ['🃏', '✨'], 8);
  }
  renderTray();
  praise('🃏 Joker! Vakje vrij'); Sound.supercombo(); bumpStat('jokers');
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
  for (let i = 0; i < n; i++) if (G.alive[i] && !G.down[i] && free(i) && G.tiles[i].face < 100) freeUp.push(i);
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
