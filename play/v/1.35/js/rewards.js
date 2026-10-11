/* Oma's Mahjong — little rewards outside the win screen: statistics, daily tasks with the chest,
   the lucky moment in a level and the daily gift (amounts in rules.js). */
'use strict';

// ---------- statistics (prize cabinet) ----------
function fmtTime(sec) { return tx('hoursMin', Math.floor(sec / 3600), Math.round(sec % 3600 / 60)); }
const daysText = n => tx('days', n);
function statsHTML() {
  const st = S.stats;
  const items = [
    ['🧩', 'st_levels', S.level - 1], ['⭐', 'st_stars', totalStars()], ['🀄', 'st_pairs', S.matches],
    ['💰', 'st_points', fmtN(myPoints())], ['📅', 'st_daily', Object.keys(S.daily).length], ['🔥', 'st_streak', daysText(S.bestStreak)],
    ['🌈', 'st_combo', S.bestCombo], ['⏱️', 'st_time', fmtTime(st.playSec || 0)], ['🎁', 'st_chests', st.chests || 0],
    ['💛', 'st_hearts', st.hearts || 0], ['🍀', 'st_lucky', st.lucky || 0], ['🥇', 'st_weeks', S.weekWins],
  ].map(([i, k, v]) => [i, tx(k), v]);
  return `<div class="stats-card"><h3>${tx('myStats')}</h3><div class="stats-grid">${items.map(([i, l, v]) => `<div class="stat"><span>${i}</span><b>${v}</b><small>${l}</small></div>`).join('')}</div></div>`;
}

// ---------- daily tasks: 3 a day, each +1 star; all 3 open the chest ----------
// (texts in lang.js: task_<id>)
const TASK_TYPES = [
  { id: 'pairs', ico: '🀄', make: r => 20 + Math.floor(r() * 3) * 10 },
  { id: 'levels', ico: '🧩', make: r => 2 + Math.floor(r() * 2) },
  { id: 'daily', ico: '📅', make: () => 1 },
  { id: 'combo', ico: '🔥', make: r => 3 + Math.floor(r() * 2) },
  { id: 'stars3', ico: '⭐', make: () => 1 },
  { id: 'flips', ico: '🔄', make: r => 5 + Math.floor(r() * 2) * 5, minLevel: 6 },
  { id: 'points', ico: '💰', make: r => (10 + Math.floor(r() * 6)) * 100 },
  { id: 'nohelp', ico: '💪', make: () => 1, minLevel: RULES.tools.fromLevel + 1 },
];
TASK_TYPES.forEach(t => { t.text = g => tx('task_' + t.id, t.id === 'points' ? fmtN(g) : g); });
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
const chestReady = () => tasksDone() === 3 && !S.tasks.chest;
// amount: add to progress; or with max=true keep the highest value (e.g. a combo)
function taskProgress(id, amount = 1, max = false) {
  const T = ensureTasks();
  T.list.forEach(t => {
    if (t.id !== id || t.done) return;
    t.prog = max ? Math.max(t.prog, amount) : t.prog + amount;
    if (t.prog < t.goal) return;
    t.prog = t.goal; t.done = true;
    giveBonus(1); bumpStat('tasks');
    setTimeout(() => { toast(tx('taskDone', taskType(t.id).text(t.goal)), 2800); Sound.star(2); }, 600);
    if (T.list.every(x => x.done)) setTimeout(() => { if (!ensureTasks().chest) toast(tx('allTasksDone'), 3200); }, 3600);
  });
  save();
}
function renderTaskChip() {
  const T = ensureTasks(), ready = chestReady();
  $('#taskDots').textContent = T.chest ? '✅' : ready ? '🎁' : T.list.map(t => t.done ? '●' : '○').join('');
  $('#btnTasks').classList.toggle('ready', ready);
}
function openTasks() {
  const T = ensureTasks(), n = tasksDone(), ready = chestReady();
  openModal(`<h2>${tx('tasksTitle')}</h2>
    <div class="task-list">${T.list.map(t => { const ty = taskType(t.id); return `<div class="task${t.done ? ' done' : ''}"><span class="t-ico">${t.done ? '✅' : ty.ico}</span><div><b>${ty.text(t.goal)}</b><span class="bar"><i style="width:${Math.round(t.prog / t.goal * 100)}%"></i></span><small>${t.done ? tx('taskDoneShort') : `${fmtN(t.prog)} / ${fmtN(t.goal)}`}</small></div></div>`; }).join('')}</div>
    <button class="chest-btn${ready ? ' ready' : ''}${T.chest ? ' opened' : ''}" id="chestBtn"><span class="chest-ico">${T.chest ? '📭' : '🎁'}</span><span>${T.chest ? tx('chestOpened') : ready ? tx('chestReady') : tx('chestNeed', n)}</span></button>
    <button class="link-btn" id="tkClose">${tx('close')}</button>`);
  $('#tkClose').onclick = closeModal;
  $('#chestBtn').onclick = () => { if (ready) openChest(); else if (!T.chest) { Sound.blocked(); toast(tx('tasksFirst')); } };
}
const chestPts = () => { const c = RULES.chest; return c.pts + Math.min(c.maxSteps, Math.floor((S.level - 1) / 10)) * c.ptsPer10Levels; };
function openChest() {
  const T = ensureTasks();
  if (T.chest) return;
  T.chest = true;
  const pts = chestPts(), stars = RULES.chest.stars;
  giveBonus(stars, pts);
  bumpStat('chests'); save(); pushScore();
  logEvt('chest', { pts });
  Sound.trophy(); FX.confetti(); buzz([30, 60, 30, 60, 80]);
  openModal(`<div class="chest-open"><span class="lid">🎁</span></div><h2>${tx('chestTitle')}</h2>
    <div class="chest-loot"><div>💰<b>+${pts}</b><small>${tx('ptsWord')}</small></div><div>⭐<b>+${stars}</b><small>${tx('starsWord')}</small></div></div>
    <p class="note">${tx('newTasksTomorrow')}</p>
    <button class="big-btn play" id="chOk"><span class="bb-text"><b>${tx('hooray')}</b></span></button>`, false);
  setTimeout(() => FX.emoji(innerWidth / 2, innerHeight * 0.35, ['⭐', '💰', '✨', '🎉'], 16), 250);
  $('#chOk').onclick = () => { closeModal(); renderHome(); };
}

// ---------- the lucky moment: a glittering tile worth extra points if taken quickly ----------
const LUCKY_MS = 15000;
function maybeLucky() {
  const L = help().lucky;
  if (!G || G.done || G.lucky || (G.luckyN || 0) >= L.perLevel) return;
  if ((G.mode === 'level' ? G.level : S.level) < L.fromLevel) return;
  const n = G.tiles.length, left = aliveCount();
  if (left > n * 0.8 || left < 6 || Math.random() > L.chance) return;
  const tf = new Set(G.tray.map(faceOf));
  const freeUp = [];
  for (let i = 0; i < n; i++) if (G.alive[i] && !G.down[i] && canTake(i) && faceOf(i) < 100) freeUp.push(i);
  const cand = freeUp.filter(i => tf.has(faceOf(i)) || freeUp.some(j => j !== i && faceOf(j) === faceOf(i)));
  if (!cand.length) return;
  const i = cand[Math.floor(Math.random() * cand.length)];
  G.lucky = { i, until: Date.now() + LUCKY_MS }; G.luckyN = (G.luckyN || 0) + 1;
  G.tiles[i].el.classList.add('lucky');
  toast(tx('lucky'), 4000);
  Sound.hint();
  setTimeout(() => { if (G && G.lucky && G.lucky.i === i) { G.tiles[i].el.classList.remove('lucky'); G.lucky = null; } }, LUCKY_MS);
}
function luckyTaken(i) {
  if (!G.lucky || G.lucky.i !== i) return;
  const ok = Date.now() <= G.lucky.until;
  G.tiles[i].el.classList.remove('lucky');
  G.lucky = null;
  if (!ok) return;
  const pts = RULES.score.lucky, c = centerOf(G.tiles[i].el);
  G.score += pts; updateScore(); bumpStat('lucky');
  setTimeout(() => { praise(tx('luckyGot', pts)); Sound.perfect(); FX.emoji(c.x || innerWidth / 2, c.y || innerHeight / 2, ['🍀', '✨', '🌟'], 12); }, 300);
}

// ---------- the daily gift: the first visit of the day starts with a present ----------
function maybeDailyGift() {
  if (S.giftDay === todayKey() || !S.seenIntro || curScreen !== 'home' || !modalFree()) return;
  if ($('#heartPop') && $('#heartPop').classList.contains('on')) return;
  S.giftDay = todayKey(); save();
  const stars = Math.random() < RULES.dailyGift.twoStarChance ? 2 : 1;
  openModal(`<div class="gift-box" id="gBox">🎁</div>
    <h2 id="gTitle">${tx('giftTitle')}</h2>
    <p id="gText">${tx('giftText', S.name ? esc(S.name) : '')}</p>
    <button class="big-btn play" id="gOpen"><span class="bb-text"><b>${tx('giftOpen')}</b></span></button>`, false);
  let opened = false;
  const open = () => {
    if (opened) { closeModal(); renderHome(); return; }
    opened = true;
    giveBonus(stars); bumpStat('gifts'); save();
    logEvt('gift', { stars });
    Sound.trophy(); FX.confetti(); buzz([20, 40, 20, 40, 60]);
    const b = $('#gBox'); b.textContent = '⭐'.repeat(stars); b.classList.add('open');
    $('#gTitle').textContent = tx('giftStars', stars);
    $('#gText').textContent = tx('giftEnjoy');
    $('#gOpen').innerHTML = `<span class="bb-text"><b>${tx('nice')}</b></span>`;
  };
  $('#gOpen').onclick = open; $('#gBox').onclick = () => { if (!opened) open(); };
}
