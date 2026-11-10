'use strict';
const fs = require('fs');
const path = require('path');

const resFile = path.join(__dirname, 'results/b2_benchmark_results.json');
const data = JSON.parse(fs.readFileSync(resFile, 'utf8'));

console.log('=== Aggregate Benchmark Summary (44 Boards) ===\n');

const suites = ['focal', 'human-dev', 'human-reserved', 'builder-qualified'];

function summarize(records) {
  let baseS = 0, b1S = 0, b2S = 0;
  let base1st = 0, b11st = 0, b21st = 0;
  let baseUnc = 0, b1Unc = 0, b2Unc = 0;
  let totalCampaigns = 0;
  let timeSeconds = 0;

  for (const r of records) {
    baseS += r.baseline.pooled.expectedTries;
    b1S += r.b1.pooled.expectedTries;
    b2S += r.b2.pooled.expectedTries;

    base1st += r.baseline.pooled.firstTryWins;
    b11st += r.b1.pooled.firstTryWins;
    b21st += r.b2.pooled.firstTryWins;

    baseUnc += r.baseline.pooled.uncleared;
    b1Unc += r.b1.pooled.uncleared;
    b2Unc += r.b2.pooled.uncleared;

    totalCampaigns += r.b2.pooled.totalCampaigns;
    timeSeconds += r.elapsedSeconds;
  }

  const N = records.length;
  return {
    count: N,
    baseMeanS: (baseS / N).toFixed(2),
    b1MeanS: (b1S / N).toFixed(2),
    b2MeanS: (b2S / N).toFixed(2),
    base1stRate: ((base1st / totalCampaigns) * 100).toFixed(1) + '%',
    b11stRate: ((b11st / totalCampaigns) * 100).toFixed(1) + '%',
    b21stRate: ((b21st / totalCampaigns) * 100).toFixed(1) + '%',
    baseUnc,
    b1Unc,
    b2Unc,
    totalCampaigns,
    timeSeconds: timeSeconds.toFixed(1),
  };
}

for (const s of suites) {
  const recs = data.records.filter(r => r.suite === s);
  const sm = summarize(recs);
  console.log(`Suite [${s}] (${sm.count} boards, ${sm.totalCampaigns} campaigns):`);
  console.log(`  Mean S:       Base ${sm.baseMeanS} | B1 ${sm.b1MeanS} | B2 ${sm.b2MeanS} (ΔS: ${(sm.b2MeanS - sm.baseMeanS).toFixed(2)})`);
  console.log(`  1st Try Rate: Base ${sm.base1stRate} | B1 ${sm.b11stRate} | B2 ${sm.b21stRate}`);
  console.log(`  Uncleared:    Base ${sm.baseUnc} | B1 ${sm.b1Unc} | B2 ${sm.b2Unc}`);
  console.log(`  Runtime:      ${sm.timeSeconds}s\n`);
}

const totalSm = summarize(data.records);
console.log(`OVERALL TOTAL (${totalSm.count} boards, ${totalSm.totalCampaigns} campaigns):`);
console.log(`  Mean S:       Base ${totalSm.baseMeanS} | B1 ${totalSm.b1MeanS} | B2 ${totalSm.b2MeanS} (ΔS: ${(totalSm.b2MeanS - totalSm.baseMeanS).toFixed(2)})`);
console.log(`  1st Try Rate: Base ${totalSm.base1stRate} | B1 ${totalSm.b11stRate} | B2 ${totalSm.b21stRate}`);
console.log(`  Uncleared:    Base ${totalSm.baseUnc} | B1 ${totalSm.b1Unc} | B2 ${totalSm.b2Unc}`);
console.log(`  Runtime:      ${totalSm.timeSeconds}s (${(totalSm.timeSeconds/60).toFixed(1)} mins)\n`);
