'use strict';
const fs = require('fs'), path = require('path');
const { fork } = require('child_process');
const { spearman } = require('./human_lab_ranking.js');

const repoRoot = path.resolve(__dirname, '../../../../');
const DENNIS_PLAYS_FILE = path.join(repoRoot, 'source/analysis/factory/dennis-plays.json');

const plannedKeys = [
  'factory4-178', 'factory5-177', 'factory5-176', 'factory6-190',
  'factory4-176', 'factory5-180', 'factory4-175', 'factory6-188', 'factory6-184'
];
const dennisTries = {
  'factory4-178': 1, 'factory5-177': 1, 'factory5-176': 1, 'factory6-190': 2,
  'factory4-176': 2, 'factory5-180': 2, 'factory4-175': 3, 'factory6-188': 4, 'factory6-184': 5
};
const blindKeys = ['blind1-187', 'blind1-194', 'blind1-183', 'blind1-185'];

if (process.argv[2] === '--worker') {
  const { measureHuman } = require('./human_style_measure.js');
  process.on('message', ({ items, options }) => {
    const out = [];
    for (const item of items) {
      try {
        const res = measureHuman(item.board, {
          setting: 'dennis',
          seed: options.seed ?? 20261029,
          runs: options.runs ?? 20,
          maxAttempts: options.maxAttempts ?? 12
        });
        out.push({
          key: item.key,
          expectedTries: Number(res.expectedTries.toFixed(2)),
          firstTryRate: Number(res.firstTryRate.toFixed(2)),
          firstTryWins: res.firstTryWins,
          valid: res.valid,
          slowestMove: res.slowestMove,
          minutes: res.minutes
        });
      } catch (err) {
        out.push({ key: item.key, error: err.message });
      }
    }
    process.send(out);
  });
} else {
  async function main() {
    const numWorkers = parseInt(process.argv[2] || '4', 10);
    const dp = JSON.parse(fs.readFileSync(DENNIS_PLAYS_FILE, 'utf8'));

    const allKeys = [...plannedKeys, ...blindKeys];
    const items = allKeys.map(k => {
      const entry = dp.boards.find(x => x.key === k);
      if (!entry) throw new Error('Key not found: ' + k);
      return { key: k, board: entry.board };
    });

    const chunks = Array.from({ length: numWorkers }, () => []);
    items.forEach((item, idx) => chunks[idx % numWorkers].push(item));

    const startTime = Date.now();
    const promises = chunks.filter(c => c.length > 0).map(chunk => {
      return new Promise((resolve, reject) => {
        const cp = fork(__filename, ['--worker']);
        cp.on('message', (msg) => {
          cp.kill();
          resolve(msg);
        });
        cp.on('error', reject);
        cp.send({ items: chunk, options: { runs: 20, seed: 20261029, maxAttempts: 12 } });
      });
    });

    const chunkResults = await Promise.all(promises);
    const rawResults = chunkResults.flat();
    const elapsed = (Date.now() - startTime) / 1000;

    const planned = plannedKeys.map(k => rawResults.find(r => r.key === k));
    const blind = blindKeys.map(k => rawResults.find(r => r.key === k));

    const pDennis = plannedKeys.map(k => dennisTries[k]);
    const pExp = planned.map(r => r.expectedTries);
    const pSpearman = spearman(pDennis, pExp);

    console.log(`\n=== PLANNED BOARDS (N=9, seed=20261029) in ${elapsed.toFixed(1)}s ===`);
    for (let i = 0; i < plannedKeys.length; i++) {
      const k = plannedKeys[i];
      const r = planned[i];
      console.log(`  ${k.padEnd(14)} Dennis: ${pDennis[i]}  Bot Exp: ${r.expectedTries.toFixed(2).padStart(5)}  1stTry: ${r.firstTryRate.toFixed(2)}`);
    }
    console.log(`Planned Spearman: ${pSpearman.toFixed(4)} (Target: >= 0.60, Status: ${pSpearman >= 0.60 ? 'PASS' : 'FAIL'})`);

    console.log(`\n=== BLIND-1 BOARDS (Target order: 187 < 194 < 183 < 185) ===`);
    const b187 = blind.find(r => r.key === 'blind1-187');
    const b194 = blind.find(r => r.key === 'blind1-194');
    const b183 = blind.find(r => r.key === 'blind1-183');
    const b185 = blind.find(r => r.key === 'blind1-185');
    console.log(`  blind1-187: ${b187.expectedTries.toFixed(2)}`);
    console.log(`  blind1-194: ${b194.expectedTries.toFixed(2)}`);
    console.log(`  blind1-183: ${b183.expectedTries.toFixed(2)}`);
    console.log(`  blind1-185: ${b185.expectedTries.toFixed(2)}`);

    const blindOrderPass = b187.expectedTries < b194.expectedTries &&
                           b194.expectedTries < b183.expectedTries &&
                           b183.expectedTries < b185.expectedTries;
    console.log(`Blind-1 Order: ${b187.expectedTries.toFixed(2)} < ${b194.expectedTries.toFixed(2)} < ${b183.expectedTries.toFixed(2)} < ${b185.expectedTries.toFixed(2)} -> ${blindOrderPass ? 'PASS' : 'FAIL'}`);

    return { plannedSpearman: pSpearman, blindOrderPass, planned, blind };
  }

  main().catch(err => { console.error(err); process.exit(1); });
}
