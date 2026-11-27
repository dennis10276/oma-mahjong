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

// ---------- the gold coin ----------
// 🪙 is drawn by the phone's own emoji font: gold on Android, silver on an iPhone (Rashmi, 2026-11-27). Every 🪙 that
// reaches the screen is put in a <span class="coin">: the text stays 🪙 (tests, screen readers, the dashboard logs),
// but what shows is this one gold coin, the same on every phone. Code keeps writing plain 🪙; nothing else changes.
// The picture lives in the code (no file): a self-updated app gets it without a new APK.
const COIN_URL = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="g" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fff3a8"/><stop offset=".45" stop-color="#ffcf2e"/><stop offset="1" stop-color="#e8a10c"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="#b9780a"/><circle cx="32" cy="31" r="28" fill="url(#g)"/><circle cx="32" cy="31" r="21" fill="none" stroke="#d89512" stroke-width="2.5"/><path d="M32 17.5l4.1 8.6 9.4 1.2-6.9 6.5 1.8 9.3L32 38.6l-8.4 4.5 1.8-9.3-6.9-6.5 9.4-1.2z" fill="#ffd84a" stroke="#c4840a" stroke-width="2" stroke-linejoin="round"/><path d="M14 22a20 20 0 0 1 12-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>');
(() => {
  const st = document.createElement('style');
  // the emoji itself is pushed out of the box and clipped: only the picture shows
  st.textContent = `.coin{display:inline-block;width:1.05em;height:1.05em;vertical-align:-.17em;line-height:1;background:url("${COIN_URL}") center/contain no-repeat;overflow:hidden;text-indent:2em;white-space:nowrap;color:transparent}`;
  document.head.appendChild(st);
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|TITLE|OPTION)$/, HTML = 'http://www.w3.org/1999/xhtml';
  function wrap(node) {
    const p = node.parentNode;
    if (!p || p.nodeType !== 1 || p.namespaceURI !== HTML || SKIP.test(p.nodeName) || p.classList.contains('coin')) return;
    const parts = node.data.split('🪙'), frag = document.createDocumentFragment();
    if (parts.length < 2) return;
    parts.forEach((s, i) => {
      if (i) { const c = document.createElement('span'); c.className = 'coin'; c.textContent = '🪙'; frag.appendChild(c); }
      if (s) frag.appendChild(document.createTextNode(s));
    });
    p.replaceChild(frag, node);
  }
  function coinify(root) {
    if (root.nodeType === 3) { if (root.data.includes('🪙')) wrap(root); return; }
    if (root.nodeType !== 1 || !root.textContent.includes('🪙')) return;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), found = [];
    while (walk.nextNode()) if (walk.currentNode.data.includes('🪙')) found.push(walk.currentNode);
    found.forEach(wrap);
  }
  coinify(document.body);
  new MutationObserver(list => {
    for (const m of list) { if (m.type === 'characterData') coinify(m.target); else m.addedNodes.forEach(coinify); }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();

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
