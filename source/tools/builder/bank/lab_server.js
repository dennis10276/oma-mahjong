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
const SEND = `<script>(function(){var last='';function snap(){var dom={};try{document.querySelectorAll('.lab-card').forEach(function(c){var n=c.querySelector('.lab-note'),v=c.querySelector('.lab-v.on');dom[c.dataset.id]={note:n?n.value:'',stars:c.querySelectorAll('.lab-stars button.on').length,verdict:v?v.dataset.v:null}})}catch(e){}var ls='{}';try{ls=localStorage.getItem('omamj.lab.ratings')||'{}'}catch(e){}return JSON.stringify({ls:JSON.parse(ls),dom:dom})}function badge(t,ok){var b=document.getElementById('labPcSave');if(!b){b=document.createElement('div');b.id='labPcSave';b.style.cssText='position:fixed;right:8px;bottom:8px;z-index:99999;font:600 12px sans-serif;padding:4px 8px;border-radius:8px;color:#fff';document.body.appendChild(b)}b.style.background=ok?'#2e7d32':'#c62828';b.textContent=t}function send(){try{var v=snap();if(v===last)return;var x=new XMLHttpRequest();x.open('POST','/findings');x.setRequestHeader('Content-Type','application/json');x.onload=function(){if(x.status===200){last=v;badge('Findings saved on this PC '+new Date().toLocaleTimeString(),true)}else badge('NOT saved',false)};x.onerror=function(){badge('NOT saved (server off)',false)};x.send(v)}catch(e){badge('NOT saved',false)}}window.addEventListener('load',send);document.addEventListener('input',function(){setTimeout(send,300)},true);document.addEventListener('click',function(){setTimeout(send,300)},true);setInterval(send,3000);window.addEventListener('pagehide',send)})();</script>`;
http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (q.method === 'POST' && p === '/findings') {
    let b = ''; q.on('data', d => { b += d; if (b.length > 5e6) q.destroy(); });
    q.on('end', () => { try { const j = JSON.parse(b), at = new Date().toISOString();
      // every snapshot is appended (nothing typed is ever lost); the .json is the merged latest, and a non-empty note is never replaced by an empty one
      fs.appendFileSync(out + 'l', JSON.stringify({ at, ...j }) + '\n');
      const cur = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')).ratings || {} : {};
      for (const src of [j.ls || {}, j.dom || {}]) for (const [id, v] of Object.entries(src)) { const c = cur[id] = cur[id] || {};
        for (const [k, x] of Object.entries(v || {})) if (!(k === 'note' && !x && c.note) && !(k === 'stars' && !x && c.stars) && !(k === 'verdict' && !x && c.verdict)) c[k] = x; }
      fs.writeFileSync(out, JSON.stringify({ savedAt: at, ratings: cur }, null, 1)); r.writeHead(200); r.end('ok'); } catch (e) { r.writeHead(400); r.end(); } });
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
