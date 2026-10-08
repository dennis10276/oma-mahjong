/* Oma's Mahjong — core: settings, saved progress, dates, small helpers, themes and prizes.
   All game scripts share one global scope and are loaded in the order of index.html. */
'use strict';

const $ = s => document.querySelector(s);
const STORE = 'omamj.v1', CUR = 'omamj.cur';
const APP_VERSION = '1.19';
// one-time clean start for every device (all progress from the test period is wiped once)
const RESET_MARK = 'omamj.reset', RESET_ID = '2026-10-07';
try {
  if (localStorage.getItem(RESET_MARK) !== RESET_ID) {
    Object.keys(localStorage).filter(k => k.startsWith('omamj.')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem(RESET_MARK, RESET_ID);
  }
} catch (e) { }

// ---------- backgrounds (unlocked with stars) ----------
const BGS = [
  { id: 'jade', name: 'Jade', need: 0, css: 'radial-gradient(circle at 50% 25%, #34b088 0%, #14795d 45%, #0a4a3a 100%)' },
  { id: 'sunrise', name: 'Zonsopgang', need: 8, css: 'linear-gradient(170deg, #ffc28f 0%, #ff8a7a 45%, #c4497e 100%)' },
  { id: 'lavender', name: 'Lavendel', need: 20, css: 'linear-gradient(165deg, #c9adff 0%, #8f6ce8 50%, #5a3fb5 100%)' },
  { id: 'ocean', name: 'Oceaan', need: 40, css: 'linear-gradient(170deg, #63e6dc 0%, #2b9fd8 50%, #1b56a3 100%)' },
  { id: 'blossom', name: 'Bloesem', need: 65, css: 'radial-gradient(circle at 25% 15%, #ffe4ef 0%, #ffaccb 45%, #d9638f 100%)' },
  { id: 'forest', name: 'Bos', need: 95, css: 'linear-gradient(170deg, #b3e36d 0%, #56ab2f 50%, #285f1a 100%)' },
  { id: 'night', name: 'Sterrennacht', need: 130, css: 'radial-gradient(1.5px 1.5px at 20% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 15%, #fff, transparent), radial-gradient(2px 2px at 85% 60%, #fff, transparent), radial-gradient(1.5px 1.5px at 35% 75%, #fff, transparent), radial-gradient(1px 1px at 55% 45%, #fff, transparent), radial-gradient(circle at 50% 0%, #3d4fa8 0%, #1d2260 55%, #0c0f30 100%)' },
  { id: 'gold', name: 'Goud', need: 180, css: 'linear-gradient(160deg, #fff1a8 0%, #f5c043 45%, #b87a0a 100%)' },
  { id: 'rainbow', name: 'Regenboog', need: 250, css: 'linear-gradient(165deg, #ff9a9e 0%, #fad0c4 20%, #fbc2eb 40%, #a6c1ee 60%, #84fab0 80%, #8fd3f4 100%)' },
  // comes with the Zonnebloem prize theme
  { id: 'sunfield', name: 'Zonnebloemveld', sun: true, css: 'radial-gradient(circle at 84% 9%, #fffbe0 0 5%, #ffe979 6% 9%, rgba(255,233,121,.35) 10% 16%, transparent 17%), linear-gradient(180deg, #74c3f2 0%, #b9e3fb 36%, #fff3b8 60%, #f7cd4f 78%, #d99320 100%)' },
];
const numBgs = BGS.filter(b => typeof b.need === 'number');

const defaults = () => ({ level: 1, stars: {}, daily: {}, theme: 'classic', bg: 'jade', sfx: true, music: true, vibrate: true, highlight: true, bestStreak: 0, seenIntro: false, matches: 0, nums: true, trophies: {}, bestCombo: 0, sunSeen: false, bonusStars: 0, bonusPts: 0, stats: {}, heartsSent: {}, heartsSeen: {}, frame: 'none', weekWins: 0, bigTiles: false, contrast: false });
let S;
try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { S = defaults(); }
// 1.1: the green Jade background is the standard again (the Zonnebloem field stays if chosen)
if (!S.bgJade) { if (S.bg !== 'sunfield') S.bg = 'jade'; S.bgJade = true; }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { } };
/* Grandma gets a little extra help that the rest of the family does not get: a second chance
   when the tray is full, and easier retries after failing the same level 3 times. She is recognised by
   her player id, or by a name starting with "Oma" (in case she ever reinstalls the app). */
const CARE_PIDS = ['pmuy4wmdp17hbws'];
const careMode = () => CARE_PIDS.includes(S.pid) || /^oma/i.test(S.name || '');

// ---------- dates ----------
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dnum = k => +k.replace(/-/g, '');
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const todayKey = () => dkey(new Date());

const totalStars = () => Object.values(S.stars).reduce((a, b) => a + b, 0) + Object.values(S.daily).reduce((a, b) => a + b, 0) + (S.bonusStars || 0);
function streak() {
  const d = new Date();
  if (!S.daily[dkey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (S.daily[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- helpers ----------
function buzz(ms) {
  if (!S.vibrate) return;
  try {
    if (window.Android && Android.vibrate) Android.vibrate(Array.isArray(ms) ? ms.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) : ms);
    else if (navigator.vibrate) navigator.vibrate(ms);
  } catch (e) { }
}
let toastT;
function toast(msg, ms = 2400) {
  if (inPlay()) return gameMsg(msg, ms);   // while playing: in the strip under the tray, never over the tiles
  const t = $('#toast'); t.textContent = msg;
  t.classList.toggle('top', !$('#modal').classList.contains('hidden'));   // above a pop-up, so it never hides its buttons
  t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}
/* While playing, every message goes to one strip between the tray and the pile (#gameMsg):
   nothing ever covers the tiles. A new message waits until the current one was readable. */
const inPlay = () => typeof curScreen !== 'undefined' && curScreen === 'game' && $('#modal').classList.contains('hidden');
let msgT, msgPend, msgShown = 0, msgBig = false;
function gameMsg(text, ms = 2400, big = false) {
  const m = $('#gameMsg'); if (!m) return;
  const wait = msgShown && !msgBig ? msgShown + 1100 - performance.now() : 0;   // a normal message stays at least 1.1 s
  clearTimeout(msgPend);
  if (wait > 0) { msgPend = setTimeout(() => gameMsg(text, ms, big), wait); return; }
  const s = document.createElement('span');
  s.className = big ? 'big' : 'msg'; s.textContent = text;
  m.replaceChildren(s); msgShown = performance.now(); msgBig = big;
  clearTimeout(msgT); msgT = setTimeout(() => { s.classList.add('out'); msgShown = 0; }, ms);
}
function clearGameMsg() { clearTimeout(msgT); clearTimeout(msgPend); msgShown = 0; const m = $('#gameMsg'); if (m) m.replaceChildren(); }
function praise(text) { gameMsg(text, 1500, true); }
// points float out of the score counter (top right), not over the pile
function floatScore(text) {
  const sc = $('#score'); if (!sc) return;
  const r = sc.getBoundingClientRect();
  const f = document.createElement('div'); f.className = 'float sc'; f.textContent = text;
  f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.bottom + 4) + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 950);
}
const sunUnlocked = () => S.level > 20;
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
function flash() { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
function bee() {
  const b = document.createElement('div'); b.className = 'bee'; b.textContent = '🐝';
  b.style.top = (18 + Math.random() * 45) + '%';
  document.body.appendChild(b); setTimeout(() => b.remove(), 2700);
}

// ---------- trophies ----------
const threeStars = () => Object.values(S.stars).filter(v => v >= 3).length;
const dailyCount = () => Object.keys(S.daily).length;
const TROPHIES = [
  { id: 'l1', ico: '🎉', name: 'Eerste level', desc: 'Speel level 1 uit', prog: () => [S.level - 1, 1] },
  { id: 'l5', ico: '🥉', name: 'Op weg', desc: 'Speel 5 levels uit', prog: () => [S.level - 1, 5] },
  { id: 'l10', ico: '🥈', name: 'Doorzetter', desc: 'Speel 10 levels uit', prog: () => [S.level - 1, 10] },
  { id: 'l20', ico: '🌻', name: 'Zonnebloem', desc: 'Speel 20 levels uit', prog: () => [S.level - 1, 20] },
  { id: 'l30', ico: '🥇', name: 'Kampioen', desc: 'Speel 30 levels uit', prog: () => [S.level - 1, 30] },
  { id: 'l50', ico: '👑', name: 'Mahjong-koningin', desc: 'Speel 50 levels uit', prog: () => [S.level - 1, 50] },
  { id: 'p5', ico: '⭐', name: 'Perfect', desc: '5 levels met 3 sterren', prog: () => [threeStars(), 5] },
  { id: 'p20', ico: '🌟', name: 'Sterrenregen', desc: '20 levels met 3 sterren', prog: () => [threeStars(), 20] },
  { id: 's50', ico: '💫', name: 'Sterrenverzamelaar', desc: 'Verdien 50 sterren', prog: () => [totalStars(), 50] },
  { id: 'd1', ico: '📅', name: 'Dagpuzzelaar', desc: 'Speel je eerste dagpuzzel', prog: () => [dailyCount(), 1] },
  { id: 'd10', ico: '🗓️', name: 'Trouwe puzzelaar', desc: 'Speel 10 dagpuzzels', prog: () => [dailyCount(), 10] },
  { id: 'r3', ico: '🔥', name: 'Op dreef', desc: '3 dagen op rij gepuzzeld', prog: () => [S.bestStreak, 3] },
  { id: 'r7', ico: '🏆', name: 'Hele week!', desc: '7 dagen op rij gepuzzeld', prog: () => [S.bestStreak, 7] },
  { id: 'm100', ico: '🀄', name: '100 paren', desc: 'Maak 100 paren', prog: () => [S.matches, 100] },
  { id: 'm500', ico: '💎', name: '500 paren', desc: 'Maak 500 paren', prog: () => [S.matches, 500] },
  { id: 'c5', ico: '🌈', name: 'Supercombo', desc: 'Maak 5 paren vlak na elkaar', prog: () => [S.bestCombo, 5] },
  { id: 'k5', ico: '🎁', name: 'Schatzoeker', desc: 'Open 5 schatkisten', prog: () => [(S.stats || {}).chests || 0, 5] },
  { id: 'h3', ico: '💛', name: 'Geliefd', desc: 'Krijg 3 hartjes van familie', prog: () => [(S.stats || {}).hearts || 0, 3] },
  { id: 'w1', ico: '👑', name: 'Weekwinnaar', desc: 'Word 1e in de weekstrijd', prog: () => [S.weekWins || 0, 1] },
];
function newTrophies() {
  const out = [];
  for (const t of TROPHIES) { const [v, n] = t.prog(); if (v >= n && !S.trophies[t.id]) { S.trophies[t.id] = todayKey(); out.push(t); } }
  if (out.length) save();
  return out;
}
const trophyCount = () => TROPHIES.filter(t => S.trophies[t.id]).length;
