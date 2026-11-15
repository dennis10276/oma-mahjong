#!/usr/bin/env node
'use strict';
/**
 * Render one 392x730 phone screenshot per layout in layouts-6wide.json
 * using the real game renderer via source/tests/lib.js.
 */
const fs = require('fs');
const path = require('path');
const lib = require('../../tests/lib.js');

const DEFAULT_IN = path.resolve(__dirname, '../../analysis/builder/data/layouts-6wide.json');
const DEFAULT_OUT = path.resolve(__dirname, '../../../../gemini-tasks/results/six-wide/images');

function seededFaces(n, seed) {
  const faces = [];
  for (let i = 0; i < n / 2; i++) {
    const f = i % 36;
    faces.push(f, f);
  }
  let s = (seed || 1) >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = faces.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [faces[i], faces[j]] = [faces[j], faces[i]];
  }
  return faces;
}

async function main() {
  const inPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_IN;
  const outDir = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUT;
  fs.mkdirSync(outDir, { recursive: true });
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const designs = Array.isArray(raw) ? raw : raw.layouts;

  await lib.setup();
  const report = [];
  try {
    for (let i = 0; i < designs.length; i++) {
      const d = designs[i];
      const idx = String(i).padStart(2, '0');
      const fileName = `${idx}-L${d.level}-${d.shape}.png`;
      const outPath = path.join(outDir, fileName);
      const faces = seededFaces(d.n, (d.seed || 1) + i * 97);
      const p = await lib.phone({
        size: [392, 730],
        state: {
          name: 'SixWide',
          level: 251,
          theme: 'classic',
          sfx: false,
          music: false,
        },
      });
      try {
        await p.evaluate((arg) => {
          const made = {
            faces: arg.faces,
            down: [],
            gold: [],
            obst: { ice: {}, locks: [], keys: [] },
            clock: null,
          };
          begin({
            mode: 'level',
            level: 251,
            key: 'L' + arg.level,
            title: arg.shape,
            track: '',
            fixedAspect: 1.6,
            makeSpec: () => ({
              tiles: arg.tiles.map(([x, y, z]) => ({ x, y, z })),
              kinds: new Set(made.faces).size,
              seed: arg.seed || 1,
              diff: Layouts.difficultyFor(arg.level || 301),
              made,
            }),
          }, true);
        }, { tiles: d.tiles, faces, level: d.level, shape: d.shape, seed: d.seed });
        await lib.sleep(350);
        const box = await p.evaluate(() => {
          const tiles = [...document.querySelectorAll('.tile')];
          if (!tiles.length) return { count: 0 };
          let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
          for (const el of tiles) {
            const r = el.getBoundingClientRect();
            if (r.left < minX) minX = r.left;
            if (r.top < minY) minY = r.top;
            if (r.right > maxX) maxX = r.right;
            if (r.bottom > maxY) maxY = r.bottom;
          }
          return {
            count: tiles.length,
            minX: Math.round(minX),
            minY: Math.round(minY),
            maxX: Math.round(maxX),
            maxY: Math.round(maxY),
            vw: window.innerWidth,
            vh: window.innerHeight,
            clipped: minX < 0 || minY < 0 || maxX > window.innerWidth || maxY > window.innerHeight,
          };
        });
        await p.screenshot({ path: outPath });
        const errs = p.errors ? p.errors.slice() : [];
        report.push({ index: i, level: d.level, shape: d.shape, fileName, ...box, errors: errs });
        if ((i + 1) % 8 === 0 || i === designs.length - 1) {
          console.log(`Rendered ${i + 1}/${designs.length}: ${fileName} (clipped=${box.clipped}, errs=${errs.length})`);
        }
      } finally {
        await p.ctx.close();
      }
    }
  } finally {
    await lib.teardown();
  }
  const summaryPath = path.join(path.dirname(outDir), 'render-check.json');
  fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2));
  const bad = report.filter((r) => r.clipped || r.errors.length || r.count !== designs[r.index].n);
  console.log(`All ${report.length} screenshots saved to ${outDir}. Problems: ${bad.length}`);
  if (bad.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
