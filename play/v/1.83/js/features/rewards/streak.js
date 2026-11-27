// uses: core/*, rules, family/week
/* Oma's Mahjong — rewards/streak: consecutive daily puzzles. */
'use strict';

function streak() {
  const d = new Date();
  if (!S.daily[dkey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (S.daily[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
