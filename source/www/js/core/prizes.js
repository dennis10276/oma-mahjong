// uses: core/*, rules, lang
/* Oma's Mahjong — core/prizes: backgrounds, themes unlocked with stars, and the trophies. */
'use strict';

// ---------- trophies ----------
const threeStars = () => Object.values(S.stars).filter(v => v >= 3).length;
const dailyCount = () => Object.keys(S.daily).length;
// (names and descriptions are in lang.js: tr_<id> and tr_<id>_d)
const TROPHIES = [
  { id: 'l1', ico: '🎉', prog: () => [S.level - 1, 1] },
  { id: 'l5', ico: '🥉', prog: () => [S.level - 1, 5] },
  { id: 'l10', ico: '🥈', prog: () => [S.level - 1, 10] },
  { id: 'l20', ico: '🌻', prog: () => [S.level - 1, RULES.sunflower.level] },
  { id: 'l30', ico: '🥇', prog: () => [S.level - 1, 30] },
  { id: 'l50', ico: '👑', prog: () => [S.level - 1, 50] },
  { id: 'p5', ico: '⭐', prog: () => [threeStars(), 5] },
  { id: 'p20', ico: '🌟', prog: () => [threeStars(), 20] },
  { id: 's50', ico: '💫', prog: () => [totalStars(), 50] },
  { id: 'd1', ico: '📅', prog: () => [dailyCount(), 1] },
  { id: 'd10', ico: '🗓️', prog: () => [dailyCount(), 10] },
  { id: 'r3', ico: '🔥', prog: () => [S.bestStreak, 3] },
  { id: 'r7', ico: '🏆', prog: () => [S.bestStreak, 7] },
  { id: 'm100', ico: '🀄', prog: () => [S.matches, 100] },
  { id: 'm500', ico: '💎', prog: () => [S.matches, 500] },
  { id: 'c5', ico: '🌈', prog: () => [S.bestCombo, 5] },
  { id: 'k5', ico: '🎁', prog: () => [S.stats.chests || 0, 5] },
  { id: 'h3', ico: '💛', prog: () => [S.stats.hearts || 0, 3] },
  { id: 'w1', ico: '👑', prog: () => [S.weekWins, 1] },
];
TROPHIES.forEach(t => Object.defineProperties(t, {
  name: { get: () => tx('tr_' + t.id) },
  desc: { get: () => tx('tr_' + t.id + '_d', RULES.sunflower.level) },
}));
function newTrophies() {
  const out = [];
  for (const t of TROPHIES) { const [v, n] = t.prog(); if (v >= n && !S.trophies[t.id]) { S.trophies[t.id] = todayKey(); out.push(t); } }
  if (out.length) save();
  return out;
}
const trophyCount = () => TROPHIES.filter(t => S.trophies[t.id]).length;
