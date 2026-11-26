// uses: core/*, lang
/* Oma's Mahjong — trophies/trophies: the trophies and when they are earned. */
'use strict';

// ---------- trophies ----------
const threeStars = () => Object.values(S.stars).filter(v => v >= 3).length;
const dailyCount = () => Object.keys(S.daily).length;
function mainStarTotal() {
  const keys = Object.keys(S.stars).filter(key => /^L?[1-9]\d*$/.test(key));
  const levels = new Set(keys.map(key => Number(key.replace(/^L/, ''))));
  let total = 0;
  for (const level of levels) total += mainLevelStars(level);
  return total;
}
// (names and descriptions are in lang.js: tr_<id> and tr_<id>_d)
const TROPHIES = [
  { id: 'l1', ico: '🎉', prog: () => [S.level - 1, 1] },
  { id: 'l5', ico: '🥉', prog: () => [S.level - 1, 5] },
  { id: 'l10', ico: '🥈', prog: () => [S.level - 1, 10] },
  { id: 'l20', ico: '🌻', prog: () => [S.level - 1, 20] },
  { id: 'l30', ico: '🥇', prog: () => [S.level - 1, 30] },
  { id: 'l50', ico: '👑', prog: () => [S.level - 1, 50] },
  { id: 'p5', ico: '⭐', prog: () => [threeStars(), 5] },
  { id: 'p20', ico: '🌟', prog: () => [threeStars(), 20] },
  { id: 's50', ico: '💫', prog: () => [mainStarTotal(), 50] },
  { id: 'd1', ico: '📅', prog: () => [dailyCount(), 1] },
  { id: 'd10', ico: '🗓️', prog: () => [dailyCount(), 10] },
  { id: 'r3', ico: '🔥', prog: () => [S.bestStreak, 3] },
  { id: 'r7', ico: '🏆', prog: () => [S.bestStreak, 7] },
  { id: 'm100', ico: '🀄', prog: () => [S.matches, 100] },
  { id: 'm500', ico: '💎', prog: () => [S.matches, 500] },
  { id: 'c5', ico: '⚡', prog: () => [S.stats.flows > 0 ? 5 : S.bestCombo, 5] },
  { id: 'k5', ico: '🎁', prog: () => [S.stats.chests || 0, 5] },
  { id: 'h3', ico: '💛', prog: () => [S.stats.hearts || 0, 3] },
  { id: 'w1', ico: '👑', prog: () => [S.weekWins, 1] },
  { id: 'l100', ico: '🏛️', prog: () => [S.level - 1, 100] },
  { id: 'l150', ico: '🌺', prog: () => [S.level - 1, 150] },
  { id: 'l200', ico: '🌟', prog: () => [S.level - 1, 200] },
  { id: 'l250', ico: '🎯', prog: () => [S.level - 1, 250] },
  { id: 'l300', ico: '🏆', prog: () => [S.level - 1, 300] },
  { id: 'l350', ico: '🌄', prog: () => [S.level - 1, 350] },
  { id: 'cup_d', ico: '💎', prog: () => [S.stats.diamonds || 0, 1] },
  { id: 'early', ico: '🐦', prog: () => [S.stats.earlyWins || 0, 1] },
  { id: 'night', ico: '🦉', prog: () => [S.stats.nightWins || 0, 1] },
];
TROPHIES.forEach(t => Object.defineProperties(t, {
  name: { get: () => tx('tr_' + t.id) },
  desc: { get: () => tx('tr_' + t.id + '_d') },
}));
function newTrophies() {
  const out = [];
  for (const t of TROPHIES) { const [v, n] = t.prog(); if (v >= n && !S.trophies[t.id]) { S.trophies[t.id] = todayKey(); out.push(t); } }
  if (out.length) save();
  return out;
}
const trophyCount = () => TROPHIES.filter(t => S.trophies[t.id]).length;
