'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const { fork } = require('child_process');
const { spearman } = require('./human_lab_ranking.js');

const repoRoot = path.resolve(__dirname, '../../../../');
const REAL_TRIES_FILE = path.join(repoRoot, 'source/analysis/factory/real-tries-92-200.json');

function getLevelsData(filter = null) {
  const data = JSON.parse(fs.readFileSync(REAL_TRIES_FILE, 'utf8'));
  let list = data.levels.filter(l => l.level >= 92 && l.level <= 164 && l.target != null);
  if (filter === 'evens') list = list.filter(l => l.level % 2 === 0);
  else if (filter === 'odds') list = list.filter(l => l.level % 2 !== 0);
  return list;
}

function evaluateResults(results, g21Reference = null) {
  const targets = results.map(r => r.target);
  const exps = results.map(r => r.expectedTries);
  const diffs = results.map(r => Math.abs(r.target - r.expectedTries));
  const mae = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const within15 = results.filter(r => Math.abs(r.target - r.expectedTries) <= 1.5).length / results.length;
  const sp = spearman(targets, exps);

  const evens = results.filter(r => r.level % 2 === 0);
  const odds = results.filter(r => r.level % 2 !== 0);

  function subEval(subset) {
    if (!subset.length) return {};
    const t = subset.map(r => r.target);
    const e = subset.map(r => r.expectedTries);
    const d = subset.map(r => Math.abs(r.target - r.expectedTries));
    return {
      count: subset.length,
      spearman: spearman(t, e),
      mae: d.reduce((a, b) => a + b, 0) / d.length,
      within15: subset.filter(r => Math.abs(r.target - r.expectedTries) <= 1.5).length / subset.length
    };
  }

  const misses = results.filter(r => Math.abs(r.target - r.expectedTries) > 1.5).map(r => ({
    level: r.level,
    target: r.target,
    expectedTries: r.expectedTries,
    diff: Number((r.expectedTries - r.target).toFixed(2))
  }));

  const l150 = results.find(r => r.level === 150);
  const l132 = results.find(r => r.level === 132);
  const range127_137 = results.filter(r => r.level >= 127 && r.level <= 137 && r.level !== 132);
  const max127_137 = range127_137.length ? Math.max(...range127_137.map(r => r.expectedTries)) : null;

  const totalFirstTryWins = results.reduce((acc, r) => acc + (r.firstTryWins || 0), 0);
  const totalRuns = results.reduce((acc, r) => acc + (r.runs || 0), 0);
  const overallFirstTryRate = totalRuns > 0 ? totalFirstTryWins / totalRuns : null;

  return {
    count: results.length,
    spearman: sp,
    mae,
    within15,
    evens: subEval(evens),
    odds: subEval(odds),
    misses,
    l150: l150 ? l150.expectedTries : null,
    l132: l132 ? l132.expectedTries : null,
    max127_137_excluding132: max127_137,
    l132_above_all_127_137: l132 && max127_137 ? l132.expectedTries > max127_137 : false,
    overallFirstTryRate
  };
}

// Worker logic
if (process.argv[2] === '--worker') {
  const { measureHuman } = require('./human_style_measure.js');
  const context = {};
  const repoRoot = path.resolve(__dirname, '../../../../');
  vm.runInNewContext(
    fs.readFileSync(path.join(repoRoot, 'source/www/layouts.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(repoRoot, 'source/www/hard.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(repoRoot, 'source/www/levels-hard.js'), 'utf8') + '\nthis.get=Hard.get;',
    context
  );

  process.on('message', (msg) => {
    const { items, options } = msg;
    const out = [];
    for (const item of items) {
      const b = context.get(item.level);
      const res = measureHuman(b, {
        setting: 'dennis',
        seed: options.seed ?? 4711,
        runs: options.runs ?? 20,
        maxAttempts: options.maxAttempts ?? 12
      });
      out.push({
        level: item.level,
        target: item.target,
        expectedTries: res.expectedTries,
        firstTryRate: res.firstTryRate,
        firstTryWins: res.firstTryWins,
        runs: res.runs,
        label: res.label
      });
    }
    process.send(out);
  });
} else {
  // Master logic
  async function runParallel(numWorkers = 6, options = {}, filter = null) {
    const levels = getLevelsData(filter);
    console.log(`Evaluating ${levels.length} levels (filter: ${filter || 'all'}) with ${numWorkers} workers...`);
    const chunks = Array.from({ length: numWorkers }, () => []);
    levels.forEach((l, idx) => chunks[idx % numWorkers].push(l));

    const promises = chunks.filter(c => c.length > 0).map((chunk) => {
      return new Promise((resolve, reject) => {
        const cp = fork(__filename, ['--worker']);
        cp.on('message', (res) => {
          cp.kill();
          resolve(res);
        });
        cp.on('error', reject);
        cp.send({ items: chunk, options });
      });
    });

    const chunkResults = await Promise.all(promises);
    const flat = chunkResults.flat().sort((a, b) => a.level - b.level);
    const summary = evaluateResults(flat);
    return { flat, summary };
  }

  module.exports = { runParallel, evaluateResults, getLevelsData };

  if (require.main === module) {
    const numWorkers = parseInt(process.argv[2] || '6', 10);
    const filter = process.argv.includes('--evens') ? 'evens' : process.argv.includes('--odds') ? 'odds' : null;
    const started = Date.now();
    const repoRoot = path.resolve(__dirname, '../../../');
    runParallel(numWorkers, {}, filter).then(({ flat, summary }) => {
      console.log('Finished in', ((Date.now() - started) / 1000).toFixed(1), 's');
      console.log('Results summary:');
      console.log(JSON.stringify(summary, null, 2));
    }).catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
}
