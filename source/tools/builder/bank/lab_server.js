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
const SEND = `<script>(function(){var last='';function snap(){var dom={};try{document.querySelectorAll('.lab-card').forEach(function(c){var n=c.querySelector('.lab-note'),v=c.querySelector('.lab-v.on');dom[c.dataset.id]={note:n?n.value:'',stars:c.querySelectorAll('.lab-stars button.on').length,verdict:v?v.dataset.v:null}})}catch(e){}var ls='{}';try{ls=localStorage.getItem('omamj.lab.ratings')||'{}'}catch(e){}return JSON.stringify({ls:JSON.parse(ls),dom:dom})}function badge(t,ok){var b=document.getElementById('labPcSave');if(!b){b=document.createElement('div');b.id='labPcSave';b.style.cssText='position:fixed;right:8px;bottom:8px;z-index:99999;font:600 12px sans-serif;padding:4px 8px;border-radius:8px;color:#fff';document.body.appendChild(b)}b.style.background=ok?'#2e7d32':'#c62828';b.textContent=t}function send(){try{var v=snap();if(v===last)return;var x=new XMLHttpRequest();x.open('POST','/findings');x.setRequestHeader('Content-Type','application/json');x.onload=function(){if(x.status===200){last=v;badge('Findings saved on this PC '+new Date().toLocaleTimeString(),true)}else badge('NOT saved',false)};x.onerror=function(){badge('NOT saved (server off)',false)};x.send(v)}catch(e){badge('NOT saved',false)}}function moves(){try{var o={},n=0;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k.indexOf('omamj.replayq')===0||k==='omamj.cur'){o[k]=localStorage.getItem(k);n++}}if(!n)return;var x=new XMLHttpRequest();x.open('POST','/replays');x.setRequestHeader('Content-Type','application/json');x.send(JSON.stringify(o))}catch(e){}}function way(){try{var G=window.__mj&&__mj.G;if(!G||!G.o||G.o.mode!=='lab'){alert('Open a level first, then press this button.');return}var it=(window.LAB_IDEAS||LAB_IDEAS).ideas.filter(function(x){return x.id===G.o.lab})[0];if(!it||!it.board||!it.board.solution||!it.board.clock){alert('No stored route for this level.');return}if(G.mv>0){alert('Restart the level first (the route is shown from the first move), then press the button again.');return}var sol=it.board.solution,ci=sol.indexOf(it.board.clock.i),k=0;var st=document.getElementById('labWaySt');if(!st){st=document.createElement('style');st.id='labWaySt';st.textContent='.labway{outline:4px solid #ff9800!important;outline-offset:-2px;filter:brightness(1.25)}';document.head.appendChild(st)}function step(){var G2=__mj.G;if(G2!==G||G.done||k>ci)return;var i=sol[k],el=G.tiles[i]&&G.tiles[i].el;if(el)el.classList.add('labway');setTimeout(function(){if(el)el.classList.remove('labway');if(__mj.G!==G)return;__mj.onTap(i);if(G.alive[i]){if(G.down[i]&&G.tray.length>=3&&sol[k+1]!==undefined){__mj.onTap(sol[k+1]);k++}else __mj.onTap(i)}k++;setTimeout(step,500)},1100)}step()}catch(e){alert('Could not show the route: '+e.message)}}function wayBtn(){if(document.getElementById('labWay'))return;var b=document.createElement('button');b.id='labWay';b.textContent='Show the way to the clock';b.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99999;font:600 12px sans-serif;padding:6px 10px;border-radius:8px;border:0;background:#ff9800;color:#000;cursor:pointer';b.onclick=way;document.body.appendChild(b)}window.addEventListener('load',wayBtn);function nm(){try{var v=JSON.parse(localStorage.getItem('omamj.v1')||'{}');if(!v.name){v.name='Lab';localStorage.setItem('omamj.v1',JSON.stringify(v))}if(window.__mj&&__mj.S&&!__mj.S.name)__mj.S.name='Lab'}catch(e){}}nm();window.addEventListener('load',nm);setTimeout(nm,2000);window.addEventListener('load',moves);setInterval(moves,20000);window.addEventListener('pagehide',moves);window.addEventListener('load',send);document.addEventListener('input',function(){setTimeout(send,300)},true);document.addEventListener('click',function(){setTimeout(send,300)},true);setInterval(send,3000);window.addEventListener('pagehide',send)})();</script>`;
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
  // the game records every tap for its replay viewer, but only for a player with a name: the page gives the lab player the name "Lab"
  // (before 2026-11-14 it had none, so nothing was recorded). The upload is switched off in the lab, so the recording stays in the browser.
  // The page posts it here: <dir>-replays.json (key -> stored text), so the lead can see the exact moves of a try.
  if (q.method === 'POST' && p === '/replays') {
    let b = ''; q.on('data', d => { b += d; if (b.length > 2e7) q.destroy(); });
    q.on('end', () => { try { const j = JSON.parse(b), rf = dir + '-replays.json', cur = fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, 'utf8')) : {};
      for (const [k, v] of Object.entries(j)) if (k === 'omamj.cur') cur[k] = v; else cur[k] = v;
      fs.writeFileSync(rf, JSON.stringify(cur)); r.writeHead(200); r.end('ok'); } catch (e) { r.writeHead(400); r.end(); } });
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
