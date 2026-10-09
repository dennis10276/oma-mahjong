/* Oma's Mahjong — self-update: newer game files are fetched from the website (see the boot script in index.html). */
'use strict';

/* Updates come from the website: newer game files are downloaded in the background,
   kept on the phone, and used from the next start (or right away on the home screen). */
const UPDATE_URL = 'https://dennis10276.github.io/oma-mahjong/play/bundle.json';
const CODE_KEY = 'omamj.code';
const verNewer = (a, b) => { a = String(a).split('.'); b = String(b).split('.'); for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = +a[i] || 0, y = +b[i] || 0; if (x !== y) return x > y; } return false; };
let updateReady = false, lastUpdateCheck = 0, updating = false;
const VERSION_URL = UPDATE_URL.replace('bundle.json', 'version.json');
async function checkUpdate() {
  if (location.protocol === 'https:') return checkWebUpdate();          // the web / iPhone version
  if (location.protocol !== 'file:' || updateReady || updating) return;   // the Android app
  if (Date.now() - lastUpdateCheck < 30 * 1000) return;
  lastUpdateCheck = Date.now();
  updating = true;
  try {
    // first a tiny file with just the newest version number, the big download only when needed
    const rv = await fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (rv.ok) { const vv = await rv.json(); if (!vv || !verNewer(vv.v, window.__mjCode || APP_VERSION) || localStorage.getItem('omamj.badv') === vv.v) return; }
    const r = await fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const b = await r.json();
    if (!b || !b.v || !Array.isArray(b.js) || !b.body || !b.css) return;
    if (!verNewer(b.v, window.__mjCode || APP_VERSION)) return;
    if (localStorage.getItem('omamj.badv') === b.v) return;   // this one did not start before: skip it
    localStorage.setItem(CODE_KEY, JSON.stringify({ v: b.v, css: b.css, body: b.body, js: b.js, fail: 0 }));
    updateReady = true;
    applyUpdate();
  } catch (e) { } finally { updating = false; }
}
// web / iPhone: the newest files are on the website, a reload is enough
async function checkWebUpdate() {
  if (updateReady || updating || Date.now() - lastUpdateCheck < 30 * 1000) return;
  lastUpdateCheck = Date.now(); updating = true;
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    const vv = r.ok ? await r.json() : null;
    if (vv && verNewer(vv.v, APP_VERSION)) { updateReady = true; applyUpdate(); }
  } catch (e) { } finally { updating = false; }
}
// switch to the new version, but never in the middle of a level or a pop-up
function applyUpdate() {
  if (!updateReady || curScreen !== 'home' || !modalFree()) return false;
  updateReady = false;
  toast('✨ Nieuwe versie! Even geduld…', 1500);
  setTimeout(() => location.reload(), 1300);
  return true;
}
