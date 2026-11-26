// uses: lang, core/save, core/screens, board
/* Oma's Mahjong — core/util: the $ lookup, dates, small helpers, game messages, floating score, flash, bee.
   All game scripts share one global scope and are loaded in the order of index.html
   (the tunable numbers are in js/rules.js). */
'use strict';

// While the intro film plays (js/intro.js), the game's own board code draws into the film's pop-up: these parts of the
// game screen are looked up there (filmRoot), the player's own level stays as it is behind the pop-up.
// (add an id to FILM_PARTS only if the film's pop-up has an element with that id too: js/intro.js)
let filmRoot = null;
const FILM_PARTS = /^#(board|boardWrap|tray|clockBadge|progressBar|gameMsg|toast)\b/;
const $ = s => (filmRoot && FILM_PARTS.test(s) ? filmRoot : document).querySelector(s);

// ---------- dates ----------
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dnum = k => +k.replace(/-/g, '');
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const monthName = i => tx('months')[i];
const todayKey = () => dkey(new Date());

const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

// ---------- helpers ----------
const modalFree = () => $('#modal').classList.contains('hidden');   // no pop-up open
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
  if (inPlay() || (G && G.film)) return gameMsg(msg, ms);   // while playing (or in the intro film): in the top bar, never over the tiles
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
const flash = () => replay($('#flash'), 'on');
function bee() {
  const b = document.createElement('div'); b.className = 'bee'; b.textContent = '🐝';
  b.style.top = (18 + Math.random() * 45) + '%';
  document.body.appendChild(b); setTimeout(() => b.remove(), 2700);
}
