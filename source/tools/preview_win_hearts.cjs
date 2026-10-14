/* Local interactive preview. All scores, messages and hearts stay in memory on localhost.
   Run: node tools/preview_win_hearts.cjs [port] */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const sourceRoot = path.resolve(__dirname, '../www');
const root = fs.existsSync(sourceRoot) ? sourceRoot : path.resolve(__dirname, '../../play');
const port = Number(process.argv[2]) || 4173;
const resetId = fs.readFileSync(path.join(root, 'js/core.js'), 'utf8').match(/RESET_ID = '([^']+)'/)[1];
const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monday = new Date(); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
const week = dateKey(monday);
const data = { scores: {
  'preview-dennis': { name: 'Dennis', avatar: '😊', level: 27, points: 40000, wk: week, wkPts: 4000, t: Date.now(), online: Date.now() },
  'preview-anna': { name: 'Anna', avatar: '🌷', level: 15, points: 30000, wk: week, wkPts: 3000, t: Date.now() - 864e5, online: 0 },
} };
let sequence = 0;
function get(keys) { return keys.reduce((v, k) => v && v[k], data) ?? null; }
function put(keys, value) { let node = data; for (const k of keys.slice(0, -1)) node = node[k] ||= {}; if (value == null) delete node[keys.at(-1)]; else node[keys.at(-1)] = value; }
const state = { name: 'OmaHanny', pid: 'preview-oma', avatar: '👵', level: 12, seenIntro: true, seenTray: true, seenDown: true, toolsSeen: true, sfx: false, music: false, vibrate: false, iosTip: true, giftDay: dateKey(new Date()), since: dateKey(new Date()), seenSp: { gold: 1, gift: 1, joker: 1, joker2: 1, ice: 1, lock: 1 } };
const init = `<script>
localStorage.clear();localStorage.setItem('omamj.reset',${JSON.stringify(resetId)});localStorage.setItem('omamj.v1',${JSON.stringify(JSON.stringify(state))});
addEventListener('load',async()=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 while(!window.__mjReady)await wait(50);
 await wait(500);__mj.startLevel(12);
 while(!__mj.G||__mj.G.key!=='L12')await wait(50);
 await wait(750);
 document.querySelector('#mGo')?.click();
 const solution=__mj.solveNow(80000);
 if(solution)for(const i of solution){if(!__mj.G.alive[i])continue;__mj.onTap(i);if(__mj.G.alive[i])__mj.onTap(i);}
});
</script>`;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname.startsWith('/_db/')) {
    const keys = url.pathname.slice(5).replace(/\.json$/, '').split('/').filter(Boolean);
    data.scores['preview-dennis'].online = Date.now();
    if ((req.headers.accept || '').includes('text/event-stream')) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`event: put\ndata: ${JSON.stringify({ path: '/', data: get(keys) })}\n\n`);
      const timer = setInterval(() => res.write(': keepalive\n\n'), 15000);
      req.on('close', () => clearInterval(timer)); return;
    }
    let body = ''; for await (const chunk of req) body += chunk;
    let result = get(keys);
    try {
      if (req.method === 'PUT') { result = JSON.parse(body); put(keys, result); }
      else if (req.method === 'POST') { const name = '-preview' + ++sequence; put([...keys, name], JSON.parse(body)); result = { name }; }
      else if (req.method === 'PATCH') { result = { ...result, ...JSON.parse(body) }; put(keys, result); }
    } catch (e) { res.writeHead(400); res.end('Invalid JSON'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result)); return;
  }
  if (url.pathname.endsWith('/news.json')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ updated: Date.now(), items: [] })); return; }
  // Published checkouts keep immutable versioned assets; this preview serves the editable root.
  const name = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname).replace(/^\/v\/[^/]+/, '');
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  let content = fs.readFileSync(file);
  if (name === '/index.html') content = content.toString().replace('</head>', init + '</head>');
  if (name === '/js/rules.js') content = content.toString().replace(/const DB_URL = '[^']*';/, `const DB_URL = 'http://127.0.0.1:${port}/_db';`);
  if (name === '/js/update.js') content = content.toString() + '\ncheckUpdate = async function () {};\n';
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(content);
});
server.listen(port, '127.0.0.1', () => console.log(`Local win/heart preview: http://127.0.0.1:${port}/ (sample data only)`));
