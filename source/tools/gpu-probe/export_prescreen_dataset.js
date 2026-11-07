'use strict';
/**
 * Exports all current-bot rated boards from `training-data.json` and `knobs-v1/boards.json`
 * into a packed binary batch (`source/build/prescreen-dataset.bin`) plus metadata and a
 * group-stratified 75% train / 25% held-out test split (`source/build/prescreen-dataset.json`).
 */
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const { boardKey } = require('../factory/meter.js');
const { SCREEN_BOARD_BYTES, packScreenBoardInto } = require('./board_pack.js');

const CURRENT_BOT = 'f32859281c746f4277ab5ef4c0006d43c76dddcc342741af8b0ff45a1b63d561';

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function difficultyBucket(exp) {
  if (exp <= 6) return 'easy_le6';
  if (exp < 10) return 'mid_6_10';
  if (exp <= 13) return 'inband_10_13';
  if (exp < 18) return 'mid_13_18';
  return 'hard_ge18';
}

function main() {
  const root = path.resolve(__dirname, '../..');
  const trainPath = path.join(root, 'analysis/builder/data/training-data.json');
  const knobsPath = path.join(root, 'analysis/builder/knobs-v1/boards.json');
  const outDir = path.join(root, 'build');
  fs.mkdirSync(outDir, { recursive: true });

  const rawTrain = JSON.parse(fs.readFileSync(trainPath, 'utf8'));
  const rawKnobs = JSON.parse(fs.readFileSync(knobsPath, 'utf8'));

  const records = [];
  const seenKeys = new Set();
  let skippedOldBot = 0;
  let skippedDup = 0;

  for (const r of rawTrain) {
    if (!r.design || !r.family || r.family.valid === false) continue;
    if (r.kind === 'historical' && r.family.bot !== CURRENT_BOT) {
      skippedOldBot++;
      continue;
    }
    const key = boardKey(r.design);
    if (seenKeys.has(key)) {
      skippedDup++;
      continue;
    }
    seenKeys.add(key);
    const familyExp = Number(r.family.expectedTries ?? r.family.exp);
    const skilledExp = r.skilled && (r.skilled.expectedTries ?? r.skilled.exp) != null
      ? Number(r.skilled.expectedTries ?? r.skilled.exp)
      : null;
    records.push({
      id: r.id || key.slice(0, 16),
      source: 'training-data',
      subkind: r.kind || 'experiment',
      group: `td:${r.group || r.id || key.slice(0, 16)}`,
      familyExp,
      familyFirst: Number(r.family.firstTryRate ?? r.family.first ?? 0),
      skilledExp,
      design: r.design,
    });
  }

  for (const r of rawKnobs) {
    if (!r.design || !r.family || r.fail) continue;
    const key = boardKey(r.design);
    if (seenKeys.has(key)) {
      skippedDup++;
      continue;
    }
    seenKeys.add(key);
    const familyExp = Number(r.family.exp ?? r.family.expectedTries);
    const skilledExp = r.skilled && (r.skilled.exp ?? r.skilled.expectedTries) != null
      ? Number(r.skilled.exp ?? r.skilled.expectedTries)
      : null;
    const baseGroup = r.base || `${r.brief?.story}-L${r.brief?.layout}`;
    records.push({
      id: r.id || key.slice(0, 16),
      source: 'knobs-v1',
      subkind: r.brief?.story || 'knobs',
      group: `kv1:${baseGroup}`,
      familyExp,
      familyFirst: Number(r.family.first ?? r.family.firstTryRate ?? 0),
      skilledExp,
      design: r.design,
    });
  }

  // Group-level quantile-stratified 75% train / 25% held-out test split per dataset source
  const groups = new Map();
  for (let idx = 0; idx < records.length; idx++) {
    const rec = records[idx];
    let g = groups.get(rec.group);
    if (!g) {
      g = { group: rec.group, source: rec.source, indices: [], exps: [] };
      groups.set(rec.group, g);
    }
    g.indices.push(idx);
    g.exps.push(rec.familyExp);
  }

  const bySourceGroups = new Map();
  for (const g of groups.values()) {
    g.meanExp = g.exps.reduce((a, b) => a + b, 0) / g.exps.length;
    if (!bySourceGroups.has(g.source)) bySourceGroups.set(g.source, []);
    bySourceGroups.get(g.source).push(g);
  }

  const splitByIdx = new Array(records.length).fill('train');
  for (const [, gList] of bySourceGroups.entries()) {
    gList.sort((a, b) => (a.meanExp - b.meanExp) || (hashString(a.group) - hashString(b.group)));
    let seen = 0;
    let te = 0;
    for (const g of gList) {
      const k = g.indices.length;
      if ((te + 0.5 * k) <= 0.25 * (seen + k)) {
        for (const idx of g.indices) splitByIdx[idx] = 'test';
        te += k;
      }
      seen += k;
    }
  }

  console.log(`Packing ${records.length} boards (${(records.length * SCREEN_BOARD_BYTES / (1024 * 1024)).toFixed(2)} MB)...`);
  const t0 = performance.now();
  const buf = new ArrayBuffer(records.length * SCREEN_BOARD_BYTES);
  const metadata = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const byteOffset = i * SCREEN_BOARD_BYTES;
    packScreenBoardInto(rec.design, buf, byteOffset, { nodes: 15000, ms: 30 });
    const hdr = new Int32Array(buf, byteOffset, 8);
    const initVis = new Uint32Array(buf, byteOffset + 32 + (4 * 128 * 4 + 6 * 4) * 4, 4);
    const numKeys = hdr[6];
    const keyPacked = hdr[7] >>> 0;
    const iceH = new Uint8Array(buf, byteOffset + 8432, 128);
    let keysVis0 = 0;
    for (let m = 0; m < numKeys; m++) {
      const k = (keyPacked >>> (m * 8)) & 0xff;
      const roleVis = ((initVis[k >> 5] >>> (k & 31)) & 1) !== 0;
      if (roleVis && iceH[k] === 0) keysVis0++;
    }

    metadata.push({
      index: i,
      id: rec.id,
      source: rec.source,
      subkind: rec.subkind,
      group: rec.group,
      split: splitByIdx[i],
      familyExp: rec.familyExp,
      familyFirst: rec.familyFirst,
      skilledExp: rec.skilledExp,
      n: hdr[0],
      clockI: hdr[1],
      clockN: hdr[2],
      hasLocks: hdr[3],
      routeLen: hdr[4],
      clockShortestK: hdr[5],
      numKeys,
      keysVis0,
      downCount: (rec.design.down || []).length,
    });
  }
  const packMs = performance.now() - t0;

  const binFile = path.join(outDir, 'prescreen-dataset.bin');
  const jsonFile = path.join(outDir, 'prescreen-dataset.json');
  fs.writeFileSync(binFile, new Uint8Array(buf));

  const trainCount = metadata.filter(m => m.split === 'train').length;
  const testCount = metadata.filter(m => m.split === 'test').length;
  const summary = {
    totalBoards: metadata.length,
    skippedOldBot,
    skippedDup,
    trainBoards: trainCount,
    testBoards: testCount,
    testFraction: Number((testCount / metadata.length).toFixed(4)),
    packTotalMs: Number(packMs.toFixed(1)),
    packMsPerBoard: Number((packMs / metadata.length).toFixed(3)),
    screenBoardBytes: SCREEN_BOARD_BYTES,
  };
  fs.writeFileSync(jsonFile, JSON.stringify({ summary, boards: metadata }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main();
}
