/* Oma's Mahjong — family/week: the week (Monday to Sunday), my points and the result of last week. */
'use strict';

// ---- the week (Monday 00:00 to Sunday 23:59) ----
function weekInfo(d = new Date()) {
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const next = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
  return { id: dkey(mon), frac: Math.min(1, Math.max(0, (d - mon) / (next - mon))), msLeft: next - d };
}
function ensureWeek() {
  const w = weekInfo();
  if (!S.wk || S.wk.id !== w.id) {
    if (S.wk && S.wk.pts > 0) S.lastWeek = { id: S.wk.id, pts: S.wk.pts };
    S.wk = { id: w.id, pts: 0 };
    save();
  }
  return S.wk;
}
function weekLeftText() {
  const ms = weekInfo().msLeft, d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5);
  return tx('weekLeft', d, h);
}

const myPoints = () => sum(S.lvlPts) + sum(S.dayPts) + S.bonusPts;
const myWeekPts = () => ensureWeek().pts;

// result of last week, shown once on the home screen
function checkLastWeek() {
  if (!S.lastWeek || !modalFree()) return;
  const lw = S.lastWeek; S.lastWeek = null;
  // Scores are overwritten each week; without a complete historical table, only
  // the player's recorded points are known. Never infer a winner from missing scores.
  bumpStat('weeks');
  save();
  Sound.unlock();
  openModal(`<div class="sun-big">📅</div><h2>${tx('lastWeekSummary')}</h2>
    <p>${tx('lastWeekPoints', fmtN(lw.pts))}</p>
    <p class="note">${tx('newWeekNote')}</p>
    <button class="big-btn play" id="lwOk"><span class="bb-text"><b>${tx('newWeek')}</b></span></button>`, false);
  $('#lwOk').onclick = () => { closeModal(); renderHome(); };
}
