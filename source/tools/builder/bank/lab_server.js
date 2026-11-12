#!/usr/bin/env node
'use strict';
// Local server for a level-lab build (tools/lab/build_lab.js output). Besides serving the files it collects
// Dennis's findings: the lab keeps ratings in the browser (localStorage "omamj.lab.ratings"); a small script added
// to every html page posts them to /findings, which writes <dir>-findings.json next to the lab folder.
// Local only (127.0.0.1); nothing goes to the family database.
//   node source/tools/builder/bank/lab_server.js <lab-dir> <port>
const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2]), port = +process.argv[3] || 8254, out = dir + '-findings.json';
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const SEND = `<script>(function(){var last='';function send(){try{var v=localStorage.getItem('omamj.lab.ratings')||'{}';if(v===last)return;var x=new XMLHttpRequest();x.open('POST','/findings');x.setRequestHeader('Content-Type','application/json');x.onload=function(){if(x.status===200)last=v};x.send(v)}catch(e){}}send();setInterval(send,4000);window.addEventListener('pagehide',send)})();</script>`;
http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (q.method === 'POST' && p === '/findings') {
    let b = ''; q.on('data', d => { b += d; if (b.length > 5e6) q.destroy(); });
    q.on('end', () => { try { const j = JSON.parse(b); fs.writeFileSync(out, JSON.stringify({ savedAt: new Date().toISOString(), ratings: j }, null, 1)); r.writeHead(200); r.end('ok'); } catch (e) { r.writeHead(400); r.end(); } });
    return;
  }
  if (p === '/') p = '/lab.html';
  const f = path.join(dir, path.normalize(p));
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const ext = path.extname(f);
  r.writeHead(200, { 'Content-Type': T[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (ext === '.html') { const h = fs.readFileSync(f, 'utf8'); return r.end(h.includes('</body>') ? h.replace('</body>', SEND + '</body>') : h + SEND); }
  fs.createReadStream(f).pipe(r);
}).listen(port, '127.0.0.1', () => console.log(`lab ${dir} on http://127.0.0.1:${port}/ , findings -> ${out}`));
