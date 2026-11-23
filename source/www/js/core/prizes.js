/* Oma's Mahjong — core/prizes: backgrounds, themes unlocked with stars, and the trophies.
   All game scripts share one global scope and are loaded in the order of index.html
   (the tunable numbers are in js/rules.js). */
'use strict';

// ---------- backgrounds (unlocked with stars) ----------
// (their names are in lang.js: bg_<id>)
const BGS = [
  { id: 'jade', need: 0, css: 'radial-gradient(circle at 50% 25%, #34b088 0%, #14795d 45%, #0a4a3a 100%)' },
  { id: 'sunrise', need: 8, css: 'linear-gradient(170deg, #ffc28f 0%, #ff8a7a 45%, #c4497e 100%)' },
  { id: 'lavender', need: 20, css: 'linear-gradient(165deg, #c9adff 0%, #8f6ce8 50%, #5a3fb5 100%)' },
  { id: 'ocean', need: 40, css: 'linear-gradient(170deg, #63e6dc 0%, #2b9fd8 50%, #1b56a3 100%)' },
  { id: 'blossom', need: 65, css: 'radial-gradient(circle at 25% 15%, #ffe4ef 0%, #ffaccb 45%, #d9638f 100%)' },
  { id: 'forest', need: 95, css: 'linear-gradient(170deg, #b3e36d 0%, #56ab2f 50%, #285f1a 100%)' },
  { id: 'night', need: 130, css: 'radial-gradient(1.5px 1.5px at 20% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 15%, #fff, transparent), radial-gradient(2px 2px at 85% 60%, #fff, transparent), radial-gradient(1.5px 1.5px at 35% 75%, #fff, transparent), radial-gradient(1px 1px at 55% 45%, #fff, transparent), radial-gradient(circle at 50% 0%, #3d4fa8 0%, #1d2260 55%, #0c0f30 100%)' },
  { id: 'gold', need: 180, css: 'linear-gradient(160deg, #fff1a8 0%, #f5c043 45%, #b87a0a 100%)' },
  { id: 'rainbow', need: 250, css: 'linear-gradient(165deg, #ff9a9e 0%, #fad0c4 20%, #fbc2eb 40%, #a6c1ee 60%, #84fab0 80%, #8fd3f4 100%)' },
  // comes with the Zonnebloem prize theme
  { id: 'sunfield', sun: true, css: 'radial-gradient(circle at 84% 9%, #fffbe0 0 5%, #ffe979 6% 9%, rgba(255,233,121,.35) 10% 16%, transparent 17%), linear-gradient(180deg, #74c3f2 0%, #b9e3fb 36%, #fff3b8 60%, #f7cd4f 78%, #d99320 100%)' },
];
BGS.forEach(b => Object.defineProperty(b, 'name', { get: () => tx('bg_' + b.id) }));
const numBgs = BGS.filter(b => typeof b.need === 'number');

const sunUnlocked = () => S.level > RULES.sunflower.level;
const bgLocked = b => b.sun ? !sunUnlocked() : totalStars() < b.need;
function applyBg() {
  let b = BGS.find(b => b.id === S.bg) || BGS[0];
  if (bgLocked(b)) b = BGS[0];
  $('#bg').style.background = b.css;
  $('#bg').className = b.id === 'sunfield' ? 'sunfield' : '';
}
function applyTheme() {
  if (S.theme === 'sunflower' && !sunUnlocked()) S.theme = 'classic';
  const sunny = S.theme === 'sunflower';
  document.body.classList.toggle('sunny', sunny);
  Sound.setMood(sunny ? 'sunny' : 'calm');
}

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
