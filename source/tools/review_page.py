#!/usr/bin/env python3
"""Builds the review page (an artifact) where Dennis rates news items for grandma: Top / Fine / No.
It shows the current news, by the same rules as the game: at most 7 days old, event not over.
The ratings are stored in the page's database (collection `ratings`, one doc per item id), where
Claude reads them to tune tools/interest.json.

  python3 tools/review_page.py candidates.json thumbs.json out.html
"""
import html, json, sys, time
from datetime import datetime, timedelta, timezone

cand, thumbs, out = sys.argv[1:4]
items = json.load(open(cand, encoding='utf-8'))['items']
th = json.load(open(thumbs, encoding='utf-8'))
now = time.time() * 1000
data = [{'id': it['id'], 't': it['t'], 'title': it['title'], 'text': it.get('text', ''), 'src': it['src'],
         'until': it.get('until'), 'img': th.get(it['id'], '')} for it in items
        if th.get(it['id']) and it['t'] > now - 7 * 864e5 and it.get('until', now + 1) > now]
stamp = datetime.now(timezone(timedelta(hours=2))).strftime('%a %d %b, %H:%M')
data.sort(key=lambda x: -x['t'])

PAGE = r'''<title>Oma's News Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;800;900&family=Literata:opsz,wght@7..72,500;7..72,700&display=swap">
<style>
/* Layout: one column of news cards like the game's pop-up, a sticky tally bar on top. */
:root {
  --bg: #f2efe6; --card: #fffdf7; --fg: #2b2416; --muted: #7b7262; --line: #e4dccb;
  --top: #2f9a57; --top-bg: #e2f4e7; --ok: #9a6b00; --ok-bg: #fbf0cf; --no: #b4473b; --no-bg: #f8e2de;
  --display: 'Literata', Georgia, serif; --ui: 'Nunito', 'Segoe UI', Arial, sans-serif;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #1b1913; --card: #26231b; --fg: #f1ead8; --muted: #a79e88; --line: #3a3528;
  --top: #63cf8c; --top-bg: #1f3a28; --ok: #f0c35a; --ok-bg: #3d3214; --no: #f08a7d; --no-bg: #43231e; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #1b1913; --card: #26231b; --fg: #f1ead8; --muted: #a79e88; --line: #3a3528;
  --top: #63cf8c; --top-bg: #1f3a28; --ok: #f0c35a; --ok-bg: #3d3214; --no: #f08a7d; --no-bg: #43231e; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font-family: var(--ui); font-size: 16px; }
.wrap { max-width: 720px; margin: 0 auto; padding-inline: 16px; padding-block: 0 48px; }
header { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); padding-block: 14px 10px; border-bottom: 1px solid var(--line); }
h1 { font-family: var(--display); font-weight: 700; font-size: 26px; margin: 0 0 4px; text-wrap: balance; }
.intro { color: var(--muted); margin: 0 0 10px; font-size: 15px; line-height: 1.45; max-width: 62ch; }
.bar { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; font-weight: 800; font-variant-numeric: tabular-nums; }
.meter { flex: 1 1 160px; height: 10px; border-radius: 99px; background: var(--line); overflow: hidden; display: flex; }
.meter i { display: block; height: 100%; }
.meter .m-top { background: var(--top); } .meter .m-ok { background: var(--ok); } .meter .m-no { background: var(--no); }
.tally span { margin-right: 10px; } .t-top { color: var(--top); } .t-ok { color: var(--ok); } .t-no { color: var(--no); }
.filters { display: flex; gap: 6px; }
.filters button { font: inherit; font-size: 14px; border: 1px solid var(--line); background: var(--card); color: var(--fg); border-radius: 99px; padding: 4px 12px; cursor: pointer; }
.filters button[aria-pressed="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.status { font-size: 14px; color: var(--muted); font-weight: 600; min-height: 1.2em; margin-top: 6px; }
.list { display: grid; gap: 14px; margin-top: 16px; }
.card { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 14px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px; }
.card img { width: 150px; height: 112px; object-fit: cover; border-radius: 10px; background: var(--line); display: block; }
.meta { font-size: 13px; color: var(--muted); font-weight: 800; letter-spacing: .02em; }
.card h2 { font-family: var(--display); font-weight: 700; font-size: 19px; line-height: 1.25; margin: 2px 0 6px; text-wrap: balance; }
.card p { margin: 0 0 10px; line-height: 1.45; font-size: 15px; }
.rate { display: flex; flex-wrap: wrap; gap: 8px; }
.rate button { font: inherit; font-weight: 900; font-size: 15px; border-radius: 10px; padding: 7px 14px; cursor: pointer; border: 2px solid var(--line); background: transparent; color: var(--fg); }
.rate button:focus-visible, .filters button:focus-visible { outline: 3px solid var(--top); outline-offset: 2px; }
.rate .b-top[aria-pressed="true"] { background: var(--top-bg); border-color: var(--top); color: var(--top); }
.rate .b-ok[aria-pressed="true"] { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
.rate .b-no[aria-pressed="true"] { background: var(--no-bg); border-color: var(--no); color: var(--no); }
.card.rated { opacity: .62; } .card.rated:hover, .card.rated:focus-within { opacity: 1; }
.empty { text-align: center; color: var(--muted); padding: 40px 0; font-weight: 700; }
@media (max-width: 520px) { .card { grid-template-columns: 1fr; } .card img { width: 100%; height: auto; aspect-ratio: 4 / 3; max-width: 100%; } }
@media (prefers-reduced-motion: no-preference) { .card { transition: opacity .2s; } }
</style>
<div class="wrap">
<header>
  <h1>Oma's News Review</h1>
  <p class="intro">Current Apeldoorn news, as grandma's app gets it: the past 7 days, no events that are over (as of __STAMP__). Would grandma enjoy this after a level? <b>Top</b> = exactly her thing, <b>Fine</b> = okay now and then, <b>No</b> = skip. Keys 1, 2, 3 rate the first unrated item.</p>
  <div class="bar">
    <div class="meter" aria-hidden="true"><i class="m-top"></i><i class="m-ok"></i><i class="m-no"></i></div>
    <div class="tally"><span id="nDone">0 of 0 rated</span><span class="t-top" id="nTop">0 top</span><span class="t-ok" id="nOk">0 fine</span><span class="t-no" id="nNo">0 no</span></div>
    <div class="filters" role="group" aria-label="Show">
      <button id="fOpen" aria-pressed="true">To rate</button><button id="fAll" aria-pressed="false">All</button>
    </div>
  </div>
  <div class="status" id="status">Connecting to the ratings store…</div>
</header>
<main class="list" id="list"></main>
</div>
<script>
const ITEMS = __DATA__;
const R = {};                 // id -> 2 top, 1 fine, 0 no
let db = null, show = 'open';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const day = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
function render() {
  const n = ITEMS.length, vals = ITEMS.map(it => R[it.id]).filter(v => v !== undefined);
  const c = k => vals.filter(v => v === k).length;
  $('#nDone').textContent = `${vals.length} of ${n} rated`;
  $('#nTop').textContent = `${c(2)} top`; $('#nOk').textContent = `${c(1)} fine`; $('#nNo').textContent = `${c(0)} no`;
  [['.m-top', 2], ['.m-ok', 1], ['.m-no', 0]].forEach(([s, k]) => $(s).style.width = (c(k) / Math.max(1, n) * 100) + '%');
  const list = ITEMS.filter(it => show === 'all' || R[it.id] === undefined);
  $('#list').innerHTML = list.length ? list.map(it => {
    const r = R[it.id];
    const b = (k, cls, lbl) => `<button class="${cls}" data-id="${esc(it.id)}" data-r="${k}" aria-pressed="${r === k}">${lbl}</button>`;
    return `<article class="card${r !== undefined ? ' rated' : ''}" id="c-${esc(it.id)}">
      <img src="${it.img}" alt="" loading="lazy">
      <div><div class="meta">${esc(it.src)} · ${day(it.t)}${it.until ? ` · event until ${day(it.until)}` : ''}</div><h2>${esc(it.title)}</h2>${it.text ? `<p>${esc(it.text)}</p>` : ''}
      <div class="rate">${b(2, 'b-top', 'Top')}${b(1, 'b-ok', 'Fine')}${b(0, 'b-no', 'No')}</div></div></article>`;
  }).join('') : `<p class="empty">${show === 'open' ? 'Everything is rated. Thank you! Claude can take it from here.' : 'No items.'}</p>`;
}
async function rate(id, k) {
  if (!db) return;
  const prev = R[id];
  R[id] = k; render();
  try { await db.doc('ratings/' + id).set({ r: k, t: Date.now() }); $('#status').textContent = 'Saved.'; }
  catch (e) {
    if (prev === undefined) delete R[id]; else R[id] = prev; render();
    $('#status').textContent = e && e.code === 'invalid_argument' ? 'This view can only read the ratings.' : 'Could not save that rating. Try again in a moment.';
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('.rate button');
  if (b) rate(b.dataset.id, +b.dataset.r);
  if (e.target.id === 'fOpen' || e.target.id === 'fAll') {
    show = e.target.id === 'fAll' ? 'all' : 'open';
    $('#fOpen').setAttribute('aria-pressed', show === 'open'); $('#fAll').setAttribute('aria-pressed', show === 'all'); render();
  }
});
document.addEventListener('keydown', e => {
  if (!['1', '2', '3'].includes(e.key) || e.target.closest('input,textarea')) return;
  const it = ITEMS.find(x => R[x.id] === undefined);
  if (it) rate(it.id, { '1': 2, '2': 1, '3': 0 }[e.key]);
});
render();
(async () => {
  db = window.claude && await window.claude.use('db');
  if (!db) { $('#status').textContent = 'Ratings cannot be saved in this view. Open the page from your artifacts while signed in.'; return; }
  $('#status').textContent = '';
  db.collection('ratings').onSnapshot(snap => {
    for (const d of snap.docs) { const v = d.data(); if (v && typeof v.r === 'number') R[d.id] = v.r; }
    render();
  }, () => { $('#status').textContent = 'Lost the connection to the ratings store. Reload the page.'; });
})();
</script>
'''
open(out, 'w', encoding='utf-8').write(PAGE.replace('__STAMP__', stamp).replace('__DATA__', json.dumps(data, ensure_ascii=False).replace('</', '<\\/')))
print(f'{len(data)} items, {sum(len(d["img"]) for d in data) // 1024} KB of photos')
