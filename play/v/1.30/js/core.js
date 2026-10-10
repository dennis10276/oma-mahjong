/* Oma's Mahjong — core: saved progress, dates, small helpers, backgrounds and prizes.
   All game scripts share one global scope and are loaded in the order of index.html
   (the tunable numbers are in js/rules.js). */
'use strict';

const $ = s => document.querySelector(s);
const STORE = 'omamj.v1', CUR = 'omamj.cur';
const APP_VERSION = '1.30';
// one-time clean start for every device (all progress from the test period is wiped once)
const RESET_MARK = 'omamj.reset', RESET_ID = '2026-10-07';
try {
  if (localStorage.getItem(RESET_MARK) !== RESET_ID) {
    Object.keys(localStorage).filter(k => k.startsWith('omamj.')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem(RESET_MARK, RESET_ID);
  }
} catch (e) { }

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

// the saved progress; every list and counter exists from the start, so code never has to check
const defaults = () => ({
  level: 1, stars: {}, daily: {}, theme: 'classic', bg: 'jade', frame: 'none',
  sfx: true, music: true, vibrate: true, highlight: true, nums: true, bigTiles: false, contrast: false,
  seenIntro: false, sunSeen: false, seenSp: {},
  matches: 0, bestCombo: 0, bestStreak: 0, winStreak: 0, bonusStars: 0, bonusPts: 0, weekWins: 0,
  stats: {}, trophies: {}, att: {}, fails: {}, lvlPts: {}, dayPts: {}, lvlHist: {}, botLv: {},
  heartsSent: {}, heartsSeen: {}, heartsOut: {}, pendingHearts: [],
});
let S;
try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { S = defaults(); }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { } };
// grandma (see CARE in rules.js, or switched on the dashboard) gets the "care" help, everyone else the "normal" help
const careMode = () => isCarePlayer(S.pid, S.name, S.cfg || {});
// this player's settings from the family dashboard (grandma mode, news); kept on the phone for offline starts
async function loadCfg() {
  if (!DB_URL || !S.pid) return;
  try {
    const c = playerCfg(Object.values(await dbGet(`plays/${cfgKey(cfgPid(S.pid))}`) || {}));
    if (JSON.stringify(c) === JSON.stringify(S.cfg || {})) return;
    S.cfg = c; save();
    if (typeof curScreen !== 'undefined' && curScreen === 'home') renderHome();
  } catch (e) { }
}
const help = () => careMode() ? HELP.care : HELP.normal;

// ---------- dates ----------
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dnum = k => +k.replace(/-/g, '');
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const monthName = i => tx('months')[i];
const todayKey = () => dkey(new Date());

const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const totalStars = () => sum(S.stars) + sum(S.daily) + S.bonusStars;
function streak() {
  const d = new Date();
  if (!S.daily[dkey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (S.daily[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- helpers ----------
const modalFree = () => $('#modal').classList.contains('hidden');   // no pop-up open
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function bumpStat(k, n = 1) { S.stats[k] = (S.stats[k] || 0) + n; }
// extra stars and points outside a level (tasks, chest, gift, streak); points also count for the week
function giveBonus(stars = 0, pts = 0) { S.bonusStars += stars; S.bonusPts += pts; if (pts) ensureWeek().pts += pts; }
// play a CSS animation again from the start (optionally remove the class after ms)
function replay(el, cls, ms = 0) {
  if (!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  if (ms) { clearTimeout(el['_' + cls]); el['_' + cls] = setTimeout(() => el.classList.remove(cls), ms); }
}
function buzz(ms) {
  if (!S.vibrate) return;
  try {
    if (window.Android && Android.vibrate) Android.vibrate(Array.isArray(ms) ? ms.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) : ms);
    else if (navigator.vibrate) navigator.vibrate(ms);
  } catch (e) { }
}
let toastT;
function toast(msg, ms = 2400) {
  if (inPlay()) return gameMsg(msg, ms);   // while playing: in the top bar, never over the tiles
  const t = $('#toast'); t.textContent = msg;
  t.classList.toggle('top', !modalFree());   // above a pop-up, so it never hides its buttons
  t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}
/* While playing, every message goes to the title spot in the top bar (#gameMsg; the title and the
   progress bar step aside meanwhile): nothing ever covers the tiles. A new message waits until the
   current one was readable. */
const inPlay = () => typeof curScreen !== 'undefined' && curScreen === 'game' && modalFree();
let msgT, msgPend, msgShown = 0, msgBig = false;
function gameMsg(text, ms = 2400, big = false) {
  const m = $('#gameMsg'); if (!m) return;
  const wait = msgShown && !msgBig ? msgShown + 1100 - performance.now() : 0;   // a normal message stays at least 1.1 s
  clearTimeout(msgPend);
  if (wait > 0) { msgPend = setTimeout(() => gameMsg(text, ms, big), wait); return; }
  const s = document.createElement('span');
  s.className = big ? 'big' : 'msg'; s.textContent = text;
  m.replaceChildren(s); msgShown = performance.now(); msgBig = big;
  m.parentNode.classList.add('msg-on');
  clearTimeout(msgT); msgT = setTimeout(() => {
    s.classList.add('out'); msgShown = 0;
    setTimeout(() => { if (m.firstChild === s) m.parentNode.classList.remove('msg-on'); }, 300);
  }, ms);
}
function clearGameMsg() { clearTimeout(msgT); clearTimeout(msgPend); msgShown = 0; const m = $('#gameMsg'); if (m) { m.replaceChildren(); m.parentNode.classList.remove('msg-on'); } }
function praise(text) { gameMsg(text, 1500, true); }
// points float out of the score counter (top right), not over the pile
function floatScore(text) {
  const sc = $('#score'); if (!sc) return;
  const r = sc.getBoundingClientRect();
  const f = document.createElement('div'); f.className = 'float sc'; f.textContent = text;
  f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.bottom + 4) + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 950);
}
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
const flash = () => replay($('#flash'), 'on');
function bee() {
  const b = document.createElement('div'); b.className = 'bee'; b.textContent = '🐝';
  b.style.top = (18 + Math.random() * 45) + '%';
  document.body.appendChild(b); setTimeout(() => b.remove(), 2700);
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
