'use strict';
const ForecastScore = require('./official_forecast_score.js');

const DB = 'https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app';

async function checkCard() {
  const [fcRes, playsRes, scoresRes] = await Promise.all([
    fetch(DB + '/forecasts.json'),
    fetch(DB + '/plays.json'),
    fetch(DB + '/scores.json')
  ]);
  const forecasts = await fcRes.json();
  const plays = await playsRes.json();
  const scores = await scoresRes.json();

  const nameOf = pid => {
    if (scores[pid] && scores[pid].name) return scores[pid].name;
    const ev = Object.values(plays[pid] || {}).filter(e => e && e.t).sort((a,b)=>a.t-b.t);
    const op = ev.filter(e => e.name).pop();
    return op ? op.name : pid;
  };

  const people = Object.keys(forecasts || {})
    .filter(pid => !pid.startsWith('test-') && forecasts[pid] && typeof forecasts[pid] === 'object')
    .map(pid => {
      const ev = Object.values(plays[pid] || {}).filter(e => e && e.t).sort((a,b)=>a.t-b.t);
      const ok = ForecastScore.APPROVED[pid] || [];
      return {
        pid,
        name: nameOf(pid),
        models: ForecastScore.byModel(forecasts[pid], ev, ok)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log('VOORSPELTEST CARD:');
  console.log('------------------------------------------------------------------------------------------------------------------------');
  console.log('Speler          | Model | Reeks   | Voorspelling | Altijd 1  | Bezig | Wachten | Te laat | Niet gev | Overgeslagen');
  console.log('------------------------------------------------------------------------------------------------------------------------');
  for (const p of people) {
    for (const m of p.models) {
      const s = m.summary;
      const predStr = s.decided ? `${s.ok} van ${s.decided}` : '–';
      const baseStr = s.decided ? `${s.baseline} van ${s.decided}` : '–';
      console.log(
        p.name.padEnd(16) + '| ' +
        m.model.padEnd(6) + '| ' +
        `${s.cohort} van ${s.size}`.padEnd(8) + '| ' +
        predStr.padEnd(13) + '| ' +
        baseStr.padEnd(10) + '| ' +
        String(s.playing).padEnd(6) + '| ' +
        String(s.waiting).padEnd(8) + '| ' +
        String(s.late).padEnd(8) + '| ' +
        String(s.unverified).padEnd(9) + '| ' +
        String(m.skipped.length)
      );
    }
  }
  console.log('------------------------------------------------------------------------------------------------------------------------');
}

checkCard().catch(console.error);
