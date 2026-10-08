/* Test helpers for Oma's Mahjong: a small web server for www/, a fake database (so tests never
   touch the real one), and shortcuts for setting up a player and playing a level. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');
const CHROME = process.env.CHROME || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => fs.existsSync(f));
const TODAY = '2026-10-07';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const realToday = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BLANK = path.join(require('os').tmpdir(), 'omamj-blank.html');
fs.writeFileSync(BLANK, '<!doctype html><title>blank</title>');

// ---------- a static web server ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
function serve(dir) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(dir, p);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() }));
  });
}

// ---------- a fake Firebase Realtime Database (REST + a one-shot event stream) ----------
class FakeDB {
  constructor(data = {}) { this.data = JSON.parse(JSON.stringify(data)); this.log = []; this.n = 0; }
  parts(p) { return p.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean); }
  get(p) { let v = this.data; for (const k of this.parts(p)) { if (v == null || typeof v !== 'object') return null; v = v[k]; } return v === undefined ? null : v; }
  set(p, val) {
    const ks = this.parts(p); if (!ks.length) { this.data = val || {}; return; }
    let o = this.data; for (const k of ks.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }
    if (val === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = val;
  }
  async handle(route) {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    const p = u.pathname.replace(/\.json$/, '');
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,PATCH,DELETE' };
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch (e) { }
    this.log.push({ m, p, body });
    if ((req.headers()['accept'] || '').includes('text/event-stream')) {
      return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'text/event-stream' }, body: `event: put\ndata: ${JSON.stringify({ path: '/', data: this.get(p) })}\n\n` });
    }
    let out = null;
    if (m === 'GET') {
      out = this.get(p);
      if (u.searchParams.get('shallow') && out && typeof out === 'object') out = Object.fromEntries(Object.keys(out).map(k => [k, true]));
    } else if (m === 'PUT') { this.set(p, body); out = body; }
    else if (m === 'PATCH') { this.set(p, Object.assign({}, this.get(p) || {}, body)); out = body; }
    else if (m === 'POST') { const id = '-t' + String(++this.n).padStart(6, '0'); this.set(p + '/' + id, body); out = { name: id }; }
    else if (m === 'DELETE') { this.set(p, null); }
    return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(out) });
  }
  plays(pid) { return Object.values(this.get('plays/' + pid) || {}).sort((a, b) => a.t - b.t); }
}

// ---------- browser + pages ----------
let browser = null, server = null;
async function setup() {
  browser = await chromium.launch({ executablePath: CHROME });
  server = await serve(WWW);
  return { browser, server };
}
async function teardown() { if (browser) await browser.close(); if (server) server.close(); }

/* A phone-sized page with a fresh player.
   state: saved progress (merged over sensible test defaults), db: FakeDB (a new one if omitted),
   lb: cached leaderboard entries, size: [w, h], ios: iPhone user agent, url: other start page,
   realDb: talk to the real database (online tests only, test- players only) */
async function phone(opts = {}) {
  const [w, h] = opts.size || [390, 820];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, ...(opts.ios ? { userAgent: IPHONE_UA } : {}) });
  const db = opts.db || new FakeDB({ scores: {} });
  if (!opts.realDb) await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
  if (opts.routes) for (const [pat, fn] of opts.routes) await ctx.route(pat, fn);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  if (opts.clock !== false) await page.clock.setFixedTime(new Date(TODAY + 'T15:00:00'));
  const url = opts.url || server.url;
  if (opts.state !== null) {
    // write the saved progress from an empty page of the same site first: if the game itself
    // were open, it could save its own state over ours while reloading
    await page.goto(url.startsWith('file:') ? 'file://' + BLANK : new URL('__blank__', url).href);
    const st = Object.assign({ seenIntro: true, seenTray: true, seenDown: true, toolsSeen: true, sfx: false, music: false, vibrate: false, level: 5, since: TODAY, iosTip: true, giftDay: opts.clock === false ? realToday() : TODAY, seenSp: { gold: 1, gift: 1, joker: 1 } }, opts.state || {});
    await page.evaluate(([st, lb, today]) => {
      localStorage.clear(); localStorage.setItem('omamj.reset', today);
      localStorage.setItem('omamj.v1', JSON.stringify(st));
      if (lb) localStorage.setItem('omamj.lb', JSON.stringify(lb));
    }, [st, opts.lb || null, TODAY]);
  }
  await page.goto(url);
  await page.waitForFunction(() => window.__mjReady === true, null, { timeout: 8000 });
  await sleep(300);
  page.db = db; page.ctx = ctx;
  return page;
}

// ---------- playing ----------
const G = (page, fn, arg) => page.evaluate(fn, arg);
async function startLevel(page, L, fresh = true) {
  await page.evaluate(([L, fresh]) => { if (fresh) localStorage.removeItem('omamj.cur'); __mj.startLevel(L); }, [L, fresh]);
  await sleep(700);
  await closeModal(page);
}
async function closeModal(page) { await page.evaluate(() => { const m = document.querySelector('#modal'); if (m && !m.classList.contains('hidden') && document.querySelector('#mGo')) document.querySelector('#mGo').click(); }); }
/* Solve the current level with the built-in solver, tapping as fast as possible. */
async function solve(page, waitAfter = 3500) {
  const p = await page.evaluate(() => { const G = __mj.G; return __mj.Layouts.solve(G.tiles, G.nb, G.tiles.map(t => t.face), G.alive, G.tray.slice(), 80000); });
  if (!p) return false;
  await page.evaluate(p => { for (const m of p) { const G = __mj.G; if (!G.alive[m]) continue; __mj.onTap(m); if (G.alive[m]) __mj.onTap(m); } }, p);
  await sleep(waitAfter);
  return true;
}
/* Tap free tiles whose picture is not in the tray and has no free twin, until the tray is full. */
async function fillTray(page) {
  for (let k = 0; k < 8; k++) {
    const r = await page.evaluate(() => {
      const G = __mj.G, L = __mj.Layouts;
      if (G.tray.length >= 4 || G.busy) return 'full';
      const tf = new Set(G.tray.map(t => G.tiles[t].face));
      const fr = G.tiles.map((t, i) => i).filter(i => G.alive[i] && !G.down[i] && L.isFree(i, G.alive, G.nb));
      const twin = i => fr.some(j => j !== i && G.tiles[j].face === G.tiles[i].face);
      const i = fr.find(i => !tf.has(G.tiles[i].face) && !twin(i)) ?? fr.find(i => !tf.has(G.tiles[i].face));
      if (i === undefined) return 'none';
      __mj.onTap(i); return G.tray.length;
    });
    await sleep(320);
    if (r === 'full' || r === 'none') break;
  }
  await sleep(900);
  return page.evaluate(() => __mj.G.tray.length);
}
const modal = page => page.evaluate(() => {
  const m = document.querySelector('#modal');
  if (!m || m.classList.contains('hidden')) return null;
  const h = document.querySelector('#modalBox h2');
  return { title: h ? h.textContent : '', buttons: [...document.querySelectorAll('#modalBox button')].map(b => b.id).filter(Boolean), text: document.querySelector('#modalBox').innerText };
});
const click = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('no element ' + sel); e.click(); }, sel);

/* The update bundle exactly as release.py builds it (body, css, scripts in load order). */
function buildBundle(v) {
  const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
  const files = [...html.match(/FILES = \[([^\]]*)\]/)[1].matchAll(/'([^'?]+)'/g)].map(m => m[1]);
  const body = html.split('<body>')[1].split('<script id="boot">')[0];
  const js = files.map(f => fs.readFileSync(path.join(WWW, f), 'utf8').replace(/const APP_VERSION = '[^']*'/, `const APP_VERSION = '${v}'`));
  return { v, css: fs.readFileSync(path.join(WWW, 'style.css'), 'utf8'), body, js };
}

module.exports = { ROOT, WWW, CHROME, TODAY, IPHONE_UA, sleep, serve, FakeDB, setup, teardown, phone, startLevel, closeModal, solve, fillTray, modal, click, buildBundle, get browser() { return browser; }, get server() { return server; } };
