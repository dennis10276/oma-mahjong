#!/usr/bin/env node
'use strict';
/* hand_draw.js: a picture of a layout or a hand board, for designing by eye (Dennis 2026-11-16: "Really understand the game yourself
   and pick a layout and everything and design it all smartly").
     node source/tools/builder/bank/hand_draw.js <layout id | board.json> <out.png> [--state <comma list of taken tiles>]
   Tiles are drawn as in the game (upper layers shifted up-left, darker frame per layer), with the tile id, the picture number,
   F = face-down, and the specials: C clock, I/II ice, L gold lock, K gold key, l silver lock, k silver key. A tile that is free now
   gets a green frame. Needs Playwright (NODE_PATH to the tests' node_modules, CHROME to a Chromium). */
const fs = require('fs'), path = require('path'), E = require('../engine.js'), H = require('./hand.js');
const [src, out] = process.argv.slice(2), arg = n => { const i = process.argv.indexOf('--' + n); return i < 0 ? null : process.argv[i + 1]; };
let d;
if (/\.json$/.test(src)) d = JSON.parse(fs.readFileSync(src, 'utf8')).design;
else { const l = H.layouts()[+src]; d = { tiles: l.tiles.map(t => t.slice(0, 3)), faces: l.tiles.map(() => -1), down: [], obst: {}, clock: null, solution: [] }; }
const taken = new Set((arg('state') || '').split(',').filter(Boolean).map(Number));
const g = E.game({ ...d, faces: d.faces.map(f => f < 0 ? 0 : f), clock: d.clock ? { ...d.clock, n: 999 } : null }, { strict: true });
const alive = new Uint8Array(d.tiles.length).fill(1); taken.forEach(i => alive[i] = 0);
const free = new Set(E.legal(g, { alive, tray: [], moves: 0, clockTaken: true }).filter(x => typeof x === 'number'));
const ob = d.obst || {}, mark = i => [d.clock && d.clock.i === i ? 'C' : '', ob.ice && ob.ice[i] ? 'I'.repeat(ob.ice[i]) : '', (ob.locks || []).includes(i) ? 'L' : '',
  (ob.keys || []).includes(i) ? 'K' : '', (ob.locks2 || []).includes(i) ? 'l' : '', (ob.keys2 || []).includes(i) ? 'k' : '', (d.down || []).includes(i) ? 'F' : ''].join('');
const U = 44, zs = [...new Set(d.tiles.map(t => t[2]))].sort((a, b) => a - b), mx = Math.max(...d.tiles.map(t => t[0])) + 2, my = Math.max(...d.tiles.map(t => t[1])) + 2;
const PW = mx * U / 2 + 20, W = PW * zs.length + 10, Hh = my * U * 0.62 + 60;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" font-family="Arial">`;
zs.forEach((z, k) => {
  const ox = 10 + k * PW; svg += `<text x="${ox}" y="18" font-size="14" font-weight="700" fill="#fff">layer ${z}</text>`;
  d.tiles.forEach(([x, y, zz], i) => {
    if (zz !== z) return;
    const X = ox + x * U / 2, Y = 28 + y * U * 0.62, w = U - 3, h = U * 1.24 - 3, m = mark(i), sp = /[CILKlk]/.test(m), on = alive[i];
    const covered = g.nb.above[i].some(j => alive[j]);
    svg += `<rect x="${X}" y="${Y}" width="${w}" height="${h}" rx="5" fill="${!on ? '#2e6b4a' : covered ? '#b9b2a0' : '#f4ecd8'}" stroke="${free.has(i) ? '#13b33c' : '#5a4a2a'}" stroke-width="${free.has(i) ? 4 : 1}" ${on ? '' : 'stroke-dasharray="3 3"'}/>`;
    svg += `<text x="${X + w / 2}" y="${Y + 18}" font-size="15" font-weight="700" text-anchor="middle" fill="${on ? '#111' : '#9c9'}">${i}</text>`;
    if (d.faces[i] >= 0) svg += `<text x="${X + w / 2}" y="${Y + 33}" font-size="11" text-anchor="middle" fill="#444">p${d.faces[i]}</text>`;
    if (m) svg += `<text x="${X + w / 2}" y="${Y + 46}" font-size="12" font-weight="700" text-anchor="middle" fill="${sp ? '#c0201a' : '#2a3a8a'}">${m}</text>`;
  });
});
svg += `<text x="10" y="${Hh - 8}" font-size="12" fill="#fff">grey = something lies on it; green frame = free now${taken.size ? '; ' + taken.size + ' taken' : ''}</text></svg>`;
(async () => {
  const { chromium } = require('playwright'), b = await chromium.launch({ executablePath: process.env.CHROME }), p = await b.newPage({ viewport: { width: Math.ceil(W), height: Math.ceil(Hh) } });
  await p.setContent(`<html><body style="margin:0;background:#2e6b4a">${svg}</body></html>`); await p.screenshot({ path: out }); await b.close(); console.log('drawn', out);
})();
