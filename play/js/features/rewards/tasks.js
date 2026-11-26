// uses: core/*, layouts, rules, lang, family/week
/* Oma's Mahjong — rewards/tasks: the daily tasks: three a day, each +1 star; all three open the chest. */
'use strict';

// ---------- daily tasks: 3 a day, each +1 star; all 3 open the chest ----------
// (texts in lang.js: task_<id>)
const taskType = id => PrepBoard.TASK_TYPES_V2.find(t => t.id === id);
const taskArg = (id, goal) => id === 'points' ? fmtN(goal) : goal;
function ensureTasks() {
  const tk = todayKey();
  const r = Layouts.rng(dnum(tk) * 3 + (S.level % 7));
  if (S.tasks?.date === tk && Array.isArray(S.tasks.list)) {
    // Completed legacy tasks have already been paid and still count for today's chest.
    const completedLegacy = t => t?.done && !taskType(t.id);
    const active = S.tasks.list.filter(t => !completedLegacy(t));
    if (PrepBoard.sanitizeTasksForToday({ level: S.level, tasks: { ...S.tasks, list: active } }, tk, r)) {
      let i = 0;
      S.tasks.list = S.tasks.list.map(t => completedLegacy(t) ? t : active[i++]);
      save();
    }
    return S.tasks;
  }
  const pool = PrepBoard.TASK_TYPES_V2.filter(t => !t.minLevel || S.level >= t.minLevel);
  const list = Layouts.shuffleArr(r, pool.slice()).slice(0, 3).map(t => ({ id: t.id, goal: t.make(r), prog: 0, done: false }));
  S.tasks = { date: tk, list, chest: false };
  save();
  return S.tasks;
}
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
    ShopEconomy.addCoins(S, SHOP_RULES.coins.task);
    setTimeout(() => { toast(tx('taskDone', tx('task_' + t.id, taskArg(t.id, t.goal))), 2800); Sound.star(2); }, 600);
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
    <div class="task-list">${T.list.map(t => `<div class="task${t.done ? ' done' : ''}"><span class="t-ico">${t.done ? '✅' : taskType(t.id).ico}</span><div><b>${fx('task_' + t.id, taskArg(t.id, t.goal))}</b><span class="bar"><i style="width:${Math.round(t.prog / t.goal * 100)}%"></i></span><small>${t.done ? tx('taskDoneShort') : `${fmtN(t.prog)} / ${fmtN(t.goal)}`}</small></div></div>`).join('')}</div>
    <button class="chest-btn${ready ? ' ready' : ''}${T.chest ? ' opened' : ''}" id="chestBtn"><span class="chest-ico">${T.chest ? '📭' : '🎁'}</span><span>${T.chest ? fx('chestOpened') : ready ? fx('chestReady') : fx('chestNeed', n)}</span></button>
    <button class="link-btn" id="tkClose">${tx('close')}</button>`);
  $('#tkClose').onclick = closeModal;
  $('#chestBtn').onclick = () => { if (ready) openChest(); else if (!T.chest) { Sound.blocked(); toast(tx('tasksFirst')); } };
}
