#!/usr/bin/env node
'use strict';
// Read-only local file server (127.0.0.1) for looking at a prototype page in another worktree. Writes nothing.
//   node source/tools/builder/bank/static_server.js <dir> <port>
const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2]), port = +process.argv[3] || 8261;
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg' };
http.createServer((q, r) => {
  const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
  if (q.method !== 'GET' || !f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(r);
}).listen(port, '127.0.0.1', () => console.log('serving ' + dir + ' on http://127.0.0.1:' + port + '/'));
