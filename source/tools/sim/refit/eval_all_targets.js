'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const { fork } = require('child_process');
const { spearman } = require('./human_lab_ranking.js');

const repoRoot = path.resolve(__dirname, '../../../../');
const TARGETS_FILE = path.join(repoRoot, 'source/analysis/factory/targets-85-155.json');
const DENNIS_PLAYS_FILE = path.join(repoRoot, 'source/analysis/factory/dennis-plays.json');
const REAL_LOSSES_FILE = path.join(repoRoot, 'source/analysis/factory/real-losses-85-174.json');

function loadAllItems() {
  const context = {};
  vm.runInNewContext(
    fs.readFileSync(path.join(repoRoot, 'source/www/layouts.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(repoRoot, 'source/www/hard.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(repoRoot, 'source/www/levels-hard.js'), 'utf8') + '\nthis.get=Hard.get;',
    context
  );

  const targetsData = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8'));
  const liveItems = [];
  for (const row of targetsData.levels) {
    if (row.target == null) continue;
    const board = context.get(row.level);
    liveItems.push({
      kind: 'live',
      id: `live-${row.level}`,
      level: row.level,
      target: row.target,
      dennis: row.dennis,
      gerda: row.gerda,
      mrsd: row.mrsd,
      plus2: row.plus2,
      board
    });
  }

  const dpData = JSON.parse(fs.readFileSync(DENNIS_PLAYS_FILE, 'utf8'));
  const factoryItems = [];
  for (const b of dpData.boards) {
    if (!b.key || b.key.startsWith('lab-')) continue;
    const won = b.results && b.results.some(r => r.r === 'win');
    const target = b.tries + (won ? 0 : 1);
    factoryItems.push({
      kind: 'factory',
      id: b.key,
      key: b.key,
      target,
      dennis: b.tries,
      won,
      board: b.board
    });
  }

  return { liveItems, factoryItems, allItems: [...liveItems, ...factoryItems] };
}

if (process.argv[2] === '--worker') {
  const { measureHuman } = require('./human_style_measure.js');
  process.on('message', ({ items, options }) => {
    const results = [];
    for (const item of items) {
      const t0 = Date.now();
      try {
        const res = measureHuman(item.board, {
          setting: 'dennis',
          seed: options.seed ?? 4711,
          seeds: options.seeds ?? 2,
          runs: options.runs ?? 20,
          maxAttempts: options.maxAttempts ?? 12
        });
        const elapsed = (Date.now() - t0) / 1000;

        let trayLossesLeft = [];
        let clockLosses = 0, totalLosses = 0;
        if (res.results) {
          for (const c of res.results) {
            for (const a of c.attempts) {
              if (a.win === false) {
                totalLosses++;
                if (a.why === 'clock') clockLosses++;
                if (a.why === 'tray' && a.left != null) trayLossesLeft.push(a.left);
              }
            }
          }
        }
        trayLossesLeft.sort((a, b) => a - b);
        const medianTrayLeft = trayLossesLeft.length
          ? trayLossesLeft[Math.floor(trayLossesLeft.length / 2)]
          : null;
        const clockLossShare = totalLosses ? Number((clockLosses / totalLosses).toFixed(3)) : 0;

        results.push({
          id: item.id,
          kind: item.kind,
          level: item.level,
          key: item.key,
          target: item.target,
          expectedTries: Number(res.expectedTries.toFixed(2)),
          firstTryRate: Number(res.firstTryRate.toFixed(2)),
          firstTryWins: res.firstTryWins,
          clockLossShare,
          medianTrayLeft,
          lossCounts: res.lossCounts,
          elapsed
        });
      } catch (err) {
        results.push({
          id: item.id,
          kind: item.kind,
          level: item.level,
          key: item.key,
          target: item.target,
          error: err.message
        });
      }
    }
    process.send(results);
  });
} else {
  async function run() {
    const numWorkers = parseInt(process.env.WORKERS || '8', 10);
    const { liveItems, factoryItems, allItems } = loadAllItems();
    console.log(`Evaluating ${allItems.length} boards (${liveItems.length} live 85-174 + ${factoryItems.length} factory) with ${numWorkers} worker processes...`);

    const chunks = Array.from({ length: numWorkers }, () => []);
    allItems.forEach((item, idx) => chunks[idx % numWorkers].push(item));

    const tStart = Date.now();
    const promises = chunks.filter(c => c.length > 0).map(chunk => {
      return new Promise((resolve, reject) => {
        const cp = fork(__filename, ['--worker']);
        cp.on('message', (msg) => {
          cp.kill();
          resolve(msg);
        });
        cp.on('error', reject);
        cp.send({ items: chunk, options: { runs: 20, seed: 4711, seeds: 2, maxAttempts: 12 } });
      });
    });

    const chunkResults = await Promise.all(promises);
    const results = chunkResults.flat();
    const totalElapsed = (Date.now() - tStart) / 1000;

    // Separate results
    const liveResults = results.filter(r => r.kind === 'live').sort((a,b) => a.level - b.level);
    const factoryResults = results.filter(r => r.kind === 'factory');

    function calcMetrics(list, name) {
      if (!list.length) return null;
      const targets = list.map(r => r.target);
      const exps = list.map(r => r.expectedTries);
      const diffs = list.map(r => Math.abs(r.target - r.expectedTries));
      const mae = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const within15 = list.filter(r => Math.abs(r.target - r.expectedTries) <= 1.5).length / list.length;
      const sp = spearman(targets, exps);
      return {
        name,
        count: list.length,
        mae: Number(mae.toFixed(4)),
        within15: Number((within15 * 100).toFixed(2)),
        spearman: sp != null ? Number(sp.toFixed(4)) : null
      };
    }

    console.log(`\n=== ALL SIMULATIONS COMPLETED in ${totalElapsed.toFixed(1)}s ===`);

    // Check A:
    console.log('\n--- CHECK A: Target Anchors (150 and 132) ---');
    const r150 = liveResults.find(r => r.level === 150);
    const r132 = liveResults.find(r => r.level === 132);

    // 10 levels around 150: 145..149 and 151..155
    const around150 = liveResults.filter(r => (r.level >= 145 && r.level <= 149) || (r.level >= 151 && r.level <= 155));
    const countBelow150 = around150.filter(r => r150.expectedTries > r.expectedTries).length;
    const pass150Dist = Math.abs(r150.expectedTries - 5) <= 1.0;
    const pass150Rank = countBelow150 >= 8;

    console.log(`Level 150: exp = ${r150.expectedTries} (target 5) | within 1.0 of 5: ${pass150Dist ? 'PASS' : 'FAIL'} (|${r150.expectedTries} - 5| = ${Math.abs(r150.expectedTries - 5).toFixed(2)})`);
    console.log(`Level 150: above ${countBelow150} of 10 surrounding levels (145-149, 151-155) -> ${pass150Rank ? 'PASS' : 'FAIL'}`);
    around150.forEach(r => console.log(`   Level ${r.level}: exp = ${r.expectedTries} (target ${r.target})`));

    // 132 above every level 127-137
    const range127_137 = liveResults.filter(r => r.level >= 127 && r.level <= 137 && r.level !== 132);
    const max127_137 = Math.max(...range127_137.map(r => r.expectedTries));
    const pass132 = r132.expectedTries > max127_137;
    console.log(`Level 132: exp = ${r132.expectedTries} (target ${r132.target}) | max of 127-137 excl 132: ${max127_137} -> ${pass132 ? 'PASS' : 'FAIL'}`);
    range127_137.forEach(r => console.log(`   Level ${r.level}: exp = ${r.expectedTries} (target ${r.target})`));

    // Check B:
    console.log('\n--- CHECK B: All Live (85-174) + Factory Boards ---');
    const combinedAll = results;
    const mCombined = calcMetrics(combinedAll, 'Live (85-174) + Factory');
    console.log(`Total boards: ${mCombined.count}`);
    console.log(`Spearman: ${mCombined.spearman} (Gate: >= 0.35, ${mCombined.spearman >= 0.35 ? 'PASS' : 'FAIL'})`);
    console.log(`MAE: ${mCombined.mae}`);
    console.log(`Within 1.5 tries: ${mCombined.within15}% (Gate: >= 70.0%, ${mCombined.within15 >= 70.0 ? 'PASS' : 'FAIL'})`);

    // Evens vs Odds:
    const evenLive = liveResults.filter(r => r.level % 2 === 0);
    const oddLive = liveResults.filter(r => r.level % 2 !== 0);
    const mEvenLive = calcMetrics(evenLive, 'Even Live Levels');
    const mOddLive = calcMetrics(oddLive, 'Odd Live Levels');
    console.log(`\nEven Live (${mEvenLive.count} boards): MAE = ${mEvenLive.mae}, Spearman = ${mEvenLive.spearman}, Within 1.5 = ${mEvenLive.within15}%`);
    console.log(`Odd Live (${mOddLive.count} boards): MAE = ${mOddLive.mae}, Spearman = ${mOddLive.spearman}, Within 1.5 = ${mOddLive.within15}%`);

    // Check C: Loss Shape Comparison with real human recordings
    console.log('\n--- CHECK C: Loss Shapes (Clock Loss Share & Tray Loss Median Remaining) ---');
    if (fs.existsSync(REAL_LOSSES_FILE)) {
      const realLosses = JSON.parse(fs.readFileSync(REAL_LOSSES_FILE, 'utf8'));
      for (const lv of [132, 150, 91, 147, 155, 162]) {
        const botR = liveResults.find(r => r.level === lv);
        const humR = realLosses.levels.find(l => l.level === lv);
        if (botR && humR) {
          const d = humR.players.Dennis;
          const g = humR.players.Gerda;
          const m = humR.players.MrsDoubtfire || humR.players['Mrs. Doubtfire'];
          const humClockShare = d.clock / Math.max(1, d.clock + d.tray);
          console.log(`Level ${lv}: Bot clockLossShare = ${botR.clockLossShare}, Bot medianTrayLeft = ${botR.medianTrayLeft}`);
          console.log(`   Dennis: clock = ${d.clock}, tray = ${d.tray}, trayLossTilesLeftMedian = ${d.trayLossTilesLeftMedian}`);
          if (g) console.log(`   Gerda : clock = ${g.clock}, tray = ${g.tray}, trayLossTilesLeftMedian = ${g.trayLossTilesLeftMedian}`);
          if (m) console.log(`   MrsD  : clock = ${m.clock}, tray = ${m.tray}, trayLossTilesLeftMedian = ${m.trayLossTilesLeftMedian}`);
        }
      }
    }

    // Check D: Factory Boards Alone
    console.log('\n--- CHECK D: Factory Boards Alone (Target: MAE <= 0.8979) ---');
    const mFactory = calcMetrics(factoryResults, 'Factory Boards Alone');
    console.log(`Total factory boards: ${mFactory.count}`);
    console.log(`MAE: ${mFactory.mae} (Gate: <= 0.8979, ${mFactory.mae <= 0.8979 ? 'PASS' : 'FAIL'})`);
    console.log(`Spearman: ${mFactory.spearman}`);
    console.log(`Within 1.5 tries: ${mFactory.within15}%`);
    for (const r of factoryResults) {
      console.log(`  ${r.key.padEnd(16)} Target: ${r.target}  Exp: ${r.expectedTries.toFixed(2).padStart(5)}  Diff: ${(r.expectedTries - r.target).toFixed(2)}`);
    }

    // Key diagnostic levels:
    console.log('\n--- KEY DIAGNOSTIC LEVELS ---');
    [150, 132, 91, 155, 147, 162].forEach(lv => {
      const r = liveResults.find(x => x.level === lv);
      if (r) {
        console.log(`Level ${lv}: Target = ${r.target}, Exp = ${r.expectedTries}, Diff = ${(r.expectedTries - r.target).toFixed(2)}, 1stTryRate = ${r.firstTryRate}`);
      }
    });

    // Check E: Speed
    const maxElapsed = Math.max(...results.map(r => r.elapsed || 0));
    console.log(`\n--- CHECK E: Speed ---`);
    console.log(`Max board simulation time: ${maxElapsed.toFixed(2)}s (Gate: <= 60s, ${maxElapsed <= 60 ? 'PASS' : 'FAIL'})`);

    // Save full JSON output for inspection
    const outArgIdx = process.argv.indexOf('--out');
    const outJsonPath = outArgIdx >= 0 ? path.resolve(process.argv[outArgIdx + 1]) : path.join(repoRoot, 'source/analysis/factory/eval-output-current.json');
    fs.writeFileSync(outJsonPath, JSON.stringify({
      metrics: {
        combined: mCombined,
        evenLive: mEvenLive,
        oddLive: mOddLive,
        factory: mFactory
      },
      checkA: {
        level150: { exp: r150.expectedTries, target: 5, passDist: pass150Dist, passRank: pass150Rank, countBelow: countBelow150 },
        level132: { exp: r132.expectedTries, target: r132.target, max127_137, pass: pass132 }
      },
      results
    }, null, 2));
    console.log(`Full output saved to: ${outJsonPath}`);
  }

  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
