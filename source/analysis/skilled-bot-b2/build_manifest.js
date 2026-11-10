'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeBoard } = require('../../tools/sim/refit/public_board_input.js');

const WORKTREE = path.resolve(__dirname, '../../..');
const B1_EVIDENCE = path.resolve(WORKTREE, 'source/analysis/skilled-bot-b1/evidence');
const DATA_DIR = path.resolve(WORKTREE, 'source/analysis/builder/data');
const FACTORY_DIR = path.resolve(WORKTREE, 'source/analysis/factory');
const OUT_FILE = path.join(__dirname, 'benchmark_manifest.json');

const hash = val => crypto.createHash('sha256').update(JSON.stringify(val)).digest('hex');

function loadBoard(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function main() {
  console.log('Building frozen benchmark manifest for Task B2...');
  const manifest = {
    schema: 'skilled-b2-benchmark-manifest-v1',
    createdAt: new Date().toISOString(),
    description: 'Frozen benchmark manifest for Task B2 containing 44 evaluation boards across 4 suites: focal (2), human development (10), human reserved held-out (14), and builder qualified 200-225 (18).',
    standardSeeds: [4711, 18427],
    diagnosticSeeds: [4711, 18427, 23456],
    campaignConfig: {
      runsPerBlock: 20,
      seedBlocks: 2,
      totalCampaignsPerSeed: 40,
      maxAttempts: 20,
      setting: 'planner',
      fast: true,
      allResults: true,
    },
    boards: [],
  };

  // 1. Focal suite (2 boards)
  const g9Board = loadBoard(path.join(B1_EVIDENCE, 'g9-board.json'));
  manifest.boards.push({
    id: 'focal-g9',
    name: 'G9 Board (e038d9ff...)',
    suite: 'focal',
    category: 'G9 starting case (76-tile U geometry, ice, clock deadline 16)',
    level: 215, // G9 equivalent
    seeds: [4711, 18427, 23456],
    dennis: {
      tries: 1,
      won: true,
      verdict: 'easy',
      stars: 3,
      note: 'The puzzle itself was quite good. Just weird it didnt have face down and was so easy.',
    },
    boardHash: hash(normalizeBoard(g9Board)),
    board: g9Board,
  });

  const balancedBoard = loadBoard(path.join(B1_EVIDENCE, 'balanced-control-board.json'));
  manifest.boards.push({
    id: 'focal-control',
    name: 'Balanced Control Board',
    suite: 'focal',
    category: 'Balanced key control board (76-tile U geometry)',
    level: null,
    seeds: [4711, 18427],
    dennis: { tries: null, won: null, verdict: null, stars: null, note: 'Synthetic control case' },
    boardHash: hash(normalizeBoard(balancedBoard)),
    board: balancedBoard,
  });

  // 2. Human Development suite (10 boards from dennis-plays.json measured in B1)
  const devKeys = [
    'factory5-177', // Dennis 1 try
    'factory2-192', // Dennis 1 try
    'factory1-175', // Dennis 1 try
    'factory1-184', // Dennis 2 tries
    'factory1-189', // Dennis 1 try
    'factory2-175', // Dennis 4 tries
    'factory2-184', // Dennis 1 try (Focal human mismatch in B1)
    'factory3-176', // Dennis 1 try
    'factory4-176', // Dennis 2 tries
    'factory4-178', // Dennis 1 try
  ];

  // 3. Human Reserved suite (14 boards from dennis-plays.json held-out from B1)
  const reservedKeys = [
    'factory3-182', // Dennis 0 tries (censored)
    'factory4-175', // Dennis 3 tries
    'factory5-180', // Dennis 2 tries
    'factory5-176', // Dennis 1 try
    'factory6-188', // Dennis 4 tries
    'factory6-184', // Dennis 5 tries
    'factory6-190', // Dennis 2 tries
    'blind1-187',   // Dennis 3 tries
    'blind1-183',   // Dennis 5 tries
    'blind1-194',   // Dennis 4 tries
    'blind1-185',   // Dennis 6 tries
    'release163-175', // Dennis 1 try
    'release163-185', // Dennis 2 tries
    'release163-194', // Dennis 8 tries
  ];

  const dpFile = path.join(FACTORY_DIR, 'dennis-plays.json');
  const dp = JSON.parse(fs.readFileSync(dpFile, 'utf8'));

  for (const key of devKeys) {
    const entry = dp.boards.find(b => b.key === key);
    if (!entry || !entry.board) throw new Error(`Missing dev board: ${key}`);
    const isMismatchFocal = key === 'factory2-184' || key === 'factory1-189';
    manifest.boards.push({
      id: `human-dev-${key}`,
      name: key,
      suite: 'human-dev',
      category: `Dennis playtest development board (Level ${entry.level})`,
      level: entry.level,
      seeds: isMismatchFocal ? [4711, 18427, 23456] : [4711, 18427],
      dennis: {
        tries: entry.tries,
        won: entry.results ? entry.results.some(r => r.r === 'win') : true,
        verdict: entry.verdict,
        stars: entry.stars,
        note: entry.note,
      },
      boardHash: hash(normalizeBoard(entry.board)),
      board: entry.board,
    });
  }

  for (const key of reservedKeys) {
    const entry = dp.boards.find(b => b.key === key);
    if (!entry || !entry.board) throw new Error(`Missing reserved board: ${key}`);
    manifest.boards.push({
      id: `human-reserved-${key}`,
      name: key,
      suite: 'human-reserved',
      category: `Dennis playtest held-out reserved board (Level ${entry.level})`,
      level: entry.level,
      seeds: [4711, 18427],
      dennis: {
        tries: entry.tries,
        won: entry.results ? entry.results.some(r => r.r === 'win') : (entry.tries > 0),
        verdict: entry.verdict,
        stars: entry.stars,
        note: entry.note,
      },
      boardHash: hash(normalizeBoard(entry.board)),
      board: entry.board,
    });
  }

  // 4. Builder Qualified 200-225 suite (18 boards)
  const qFile = path.join(DATA_DIR, 'qualified-200-225.jsonl');
  const qLines = fs.readFileSync(qFile, 'utf8').trim().split('\n');
  for (const line of qLines) {
    const q = JSON.parse(line);
    const ev = q.skilledEvidence || {};
    const isRegressionOrBorderline = q.level === 201 || q.level === 223;
    manifest.boards.push({
      id: `builder-qualified-${q.level}`,
      name: `Level ${q.level} (${q.shape})`,
      suite: 'builder-qualified',
      category: `Qualified Builder board (${q.shape}, target ${q.target})`,
      level: q.level,
      shape: q.shape,
      target: q.target,
      storedSkilled: q.botSkilled ?? q.skilled,
      seeds: isRegressionOrBorderline ? [4711, 18427, 23456] : [4711, 18427],
      dennis: {
        tries: ev.tries ?? null,
        won: ev.won ?? null,
        verdict: ev.verdict ?? null,
        stars: ev.stars ?? null,
        note: ev.note ?? null,
      },
      boardHash: q.boardHash || hash(normalizeBoard(q.design)),
      board: q.design,
    });
  }

  console.log(`Manifest created with ${manifest.boards.length} boards:`);
  console.log(`- Focal: ${manifest.boards.filter(b => b.suite === 'focal').length}`);
  console.log(`- Human Dev: ${manifest.boards.filter(b => b.suite === 'human-dev').length}`);
  console.log(`- Human Reserved: ${manifest.boards.filter(b => b.suite === 'human-reserved').length}`);
  console.log(`- Builder Qualified: ${manifest.boards.filter(b => b.suite === 'builder-qualified').length}`);

  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Wrote frozen manifest to: ${OUT_FILE}`);
}

main();
