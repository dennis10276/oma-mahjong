// uses: core/*, layouts, rules, lang, family/week
/* Oma's Mahjong — rewards/tasks: the daily tasks: three a day, each +1 star; all three open the chest. */
'use strict';

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
  if (G && G.film) return;          // (the intro film counts nothing: js/intro.js)
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
  openModal(`<h2>${fx('tasksTitle')}</h2>
    <div class="task-list">${T.list.map(t => { const ty = taskType(t.id); return `<div class="task${t.done ? ' done' : ''}"><span class="t-ico">${t.done ? '✅' : ty.ico}</span><div><b>${fx('task_' + t.id, t.id === 'points' ? fmtN(t.goal) : t.goal)}</b><span class="bar"><i style="width:${Math.round(t.prog / t.goal * 100)}%"></i></span><small>${t.done ? tx('taskDoneShort') : `${fmtN(t.prog)} / ${fmtN(t.goal)}`}</small></div></div>`; }).join('')}</div>
    <button class="chest-btn${ready ? ' ready' : ''}${T.chest ? ' opened' : ''}" id="chestBtn"><span class="chest-ico">${T.chest ? '📭' : '🎁'}</span><span>${T.chest ? fx('chestOpened') : ready ? fx('chestReady') : fx('chestNeed', n)}</span></button>
    <button class="link-btn" id="tkClose">${tx('close')}</button>`);
  $('#tkClose').onclick = closeModal;
  $('#chestBtn').onclick = () => { if (ready) openChest(); else if (!T.chest) { Sound.blocked(); toast(tx('tasksFirst')); } };
}
