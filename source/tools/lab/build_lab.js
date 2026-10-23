/* Builds the level lab: the real game (source/www) plus the lab (tools/lab/lab.js, lab-ideas.js), with
   the family database, self-update and the online news switched off, so playing in the lab never
   reaches the dashboard or anyone's progress. A fresh lab player starts at level 201 (hint and shuffle
   open, as for the players who will meet these levels).

     node source/tools/lab/build_lab.js <out-dir>                                                  */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), WWW = path.join(ROOT, 'www');
const out = path.resolve(process.argv[2] || path.join(ROOT, '..', 'lab-build'));
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const copy = rel => { const s = path.join(WWW, rel), d = path.join(out, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); };
const walk = dir => fs.readdirSync(path.join(WWW, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
for (const f of walk('.')) if (!/^(sw\.js|index\.html|manifest\.webmanifest)$/.test(f)) copy(f);
fs.copyFileSync(path.join(__dirname, 'lab.js'), path.join(out, 'lab.js'));
fs.copyFileSync(path.join(__dirname, 'lab-ideas.js'), path.join(out, 'lab-ideas.js'));

let html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
const guard = `<script>
/* level lab: no family database, no self-update, no online news (only the lab's own page data) */
(function () {
  var off = /firebasedatabase\\.app|github\\.io|githubusercontent\\.com/;
  var bad = function (u) { try { return off.test(String(u && u.url || u)); } catch (e) { return true; } };
  var f = window.fetch; window.fetch = function (u) { return bad(u) ? Promise.reject(new TypeError('lab: offline')) : f.apply(this, arguments); };
  var o = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { if (bad(u)) throw new Error('lab: offline'); return o.apply(this, arguments); };
  ['EventSource', 'WebSocket'].forEach(function (k) { var C = window[k]; if (!C) return; var W = function (u, x) { if (bad(u)) throw new Error('lab: offline'); return new C(u, x); }; W.prototype = C.prototype; window[k] = W; });   // (the hearts stream)
  if (navigator.sendBeacon) { var b = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = function (u) { return bad(u) ? false : b.apply(null, arguments); }; }
  try { if (!localStorage.getItem('omamj.v1')) localStorage.setItem('omamj.v1', JSON.stringify({ level: 201, seenIntro: true })); } catch (e) { }
})();
</script>`;
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + guard);
html = html.replace('<title>Oma\'s Mahjong</title>', '<title>Level Lab</title>');
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '');
// always the built-in files (no downloaded update), plus the lab
if (!html.includes("'js/main.js']")) throw Error('boot file list not found');
html = html.replace("'js/main.js']", "'js/main.js', 'lab-ideas.js', 'lab.js']");
html = html.replace("if (location.protocol === 'file:') c = JSON.parse(localStorage.getItem(KEY) || 'null');", 'c = null;');
fs.writeFileSync(path.join(out, 'index.html'), html);
// the same page for a claude.ai artifact (the publisher wraps it in its own document): only the inside
// of <head> and <body>, in order
const inner = html.replace(/^<!doctype html>\s*<html[^>]*>\s*<head>/i, '').replace(/<\/head>\s*<body>/i, '\n').replace(/<\/body>\s*<\/html>\s*$/i, '')
  .replace(/<meta name="viewport"[^>]*>\n?/, '').replace(/<meta charset="utf-8">\n?/, '');
fs.writeFileSync(path.join(out, 'lab.html'), '<title>Mahjong Level Lab</title>\n' + inner.replace('<title>Level Lab</title>', ''));
console.log('lab built in', out);
