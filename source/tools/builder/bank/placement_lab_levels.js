#!/usr/bin/env node
'use strict';
// Build a placement-editor lab (Codex's narrow_placement_* tools) for a chosen list of levels.
// Levels already in an earlier lab keep that lab's starting board, so Dennis's saved arrangements stay valid (copied over).
//   node placement_lab_levels.js <levels> <assetDir> <dataDir> [<earlier assetDir> <earlier dataDir>]
const fs = require('fs'), path = require('path');
const P = require('./narrow_proof'), N = require('./narrow'), E = require('../engine'), B = require('./narrow_placement_build');
const [levelsArg, assetDir, dataDir, oldAssets, oldData] = process.argv.slice(2), levels = levelsArg.split(',').map(Number);
const old = oldAssets ? JSON.parse(fs.readFileSync(path.join(oldAssets, 'placement-data.json'))) : { levels: [] };
const copy = x => JSON.parse(JSON.stringify(x)), rows = [];
for (const level of levels) {
  const prev = old.levels.find(r => r.level === level);
  if (prev) { rows.push(prev); continue; }
  const before = P.original(level), seed = B.seedProposal(before), base = copy(seed.design), g = E.game(before.design);
  const roles = [before.design.clock.i, ...before.design.obst.keys, ...before.design.obst.locks, ...Object.keys(before.design.obst.ice).map(Number)];
  rows.push({ level, status: 'needs placement', base, baseHash: P.hash(base), original: before.design, problem: seed.problem, trap: [...N.trapSet(before, { g, roles })], column: seed.column, row: seed.row });
}
const src = oldAssets || B.OUT;
fs.mkdirSync(assetDir, { recursive: true }); fs.cpSync(src, assetDir, { recursive: true });
fs.writeFileSync(path.join(assetDir, 'placement-data.json'), JSON.stringify({ version: 1, rendererCommit: '3b188bcd', levels: rows }));
fs.mkdirSync(dataDir, { recursive: true });
if (oldData) for (const level of levels) for (const f of [`level-${level}.json`]) if (fs.existsSync(path.join(oldData, f))) fs.copyFileSync(path.join(oldData, f), path.join(dataDir, f));
console.log(JSON.stringify(rows.map(r => ({ level: r.level, toPlace: r.problem.length, fromEarlierLab: !!old.levels.find(q => q.level === r.level) }))));
