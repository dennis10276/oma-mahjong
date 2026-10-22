'use strict';
const fs = require('fs');
const path = require('path');
const ForecastScore = require('./official_forecast_score.js');

const plays = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../analysis/archive/realdata/plays.json'), 'utf8'));
const scores = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../analysis/archive/realdata/scores.json'), 'utf8'));

const PLAYERS = {
  Dennisisdebeste: 'pmuy78xu6tsths9',
  'Mrs. Doubtfire': 'pmv16kj3jr35750',
  PUK: 'pmv2gaa0g00eq3q',
  Gerda: 'pmv6yhzz3x9oxs8'
};

for (let v = 2; v <= 8; v++) {
  const filePath = path.resolve(__dirname, `../../../analysis/personal-bots/personal-source-bound-causal-forecasts-v${v}.jsonl`);
  if (!fs.existsSync(filePath)) {
    console.log(`v${v} not found!`);
    continue;
  }
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8').trim().split('\n')[0]);
  const forecastsByPlayer = {};
  for (const f of content.forecasts) {
    forecastsByPlayer[f.name] = forecastsByPlayer[f.name] || {};
    forecastsByPlayer[f.name][f.lv] = f.predictedAttempt;
  }

  console.log(`\n=== Model v${v} vs 'Always 1' on games already played ===`);
  for (const [name, pid] of Object.entries(PLAYERS)) {
    const ev = Object.values(plays[pid] || {}).filter(e => e && e.t).sort((a,b)=>a.t-b.t);
    const pForecasts = forecastsByPlayer[name] || {};
    
    let scored = 0;
    let ok = 0;
    let baselineOk = 0;
    const details = [];

    for (const [lvStr, p] of Object.entries(pForecasts)) {
      const lv = Number(lvStr);
      const o = ForecastScore.outcome(ev, lv);
      if (o.winAt != null) {
        scored++;
        const isOk = ForecastScore.correct(p, o.winAt);
        const isBase = ForecastScore.correct(1, o.winAt);
        if (isOk) ok++;
        if (isBase) baselineOk++;
        details.push({ lv, p, actual: o.winAt, isOk, isBase });
      }
    }

    const pct = scored > 0 ? (ok / scored * 100).toFixed(1) : '–';
    const basePct = scored > 0 ? (baselineOk / scored * 100).toFixed(1) : '–';
    console.log(`  ${name.padEnd(16)}: ${ok}/${scored} (${pct}%) vs always 1: ${baselineOk}/${scored} (${basePct}%)`);
  }
}
