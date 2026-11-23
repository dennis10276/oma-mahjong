// uses: core/*, rules, family/week
/* Oma's Mahjong — rewards/streak: days played in a row, and the levels won in a row (a bonus star now and then). */
'use strict';

function streak() {
  const d = new Date();
  if (!S.daily[dkey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (S.daily[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
// levels won in a row (a failed try breaks the streak): a bonus star now and then
function winStreakStep() {
  let streakBonus = false;
  if (G.mode === 'level') {
    const ws = RULES.winStreak;
    S.winStreak++;
    if (S.winStreak === ws.first || S.winStreak % ws.every === 0) { giveBonus(1); streakBonus = true; bumpStat('streakStars'); }
    if (S.winStreak > (S.bestWinStreak || 0)) S.bestWinStreak = S.winStreak;
  }
  return streakBonus;
}
