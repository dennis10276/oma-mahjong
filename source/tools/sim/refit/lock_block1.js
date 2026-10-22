'use strict';
const fs = require('fs');
const path = require('path');

const DB = 'https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app';

const PLAYERS = {
  Dennisisdebeste: { pid: 'pmuy78xu6tsths9', maxOpened: 157, start: 158, count: 20 },
  'Mrs. Doubtfire': { pid: 'pmv16kj3jr35750', maxOpened: 126, start: 127, count: 20 },
  PUK: { pid: 'pmv2gaa0g00eq3q', maxOpened: 58, start: 59, count: 20 },
  Gerda: { pid: 'pmv6yhzz3x9oxs8', maxOpened: 109, start: 110, count: 20 }
};

const simResults = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../analysis/personal-bots/block1-simulation-results.json'), 'utf8'));

async function main() {
  console.log('1. Checking current Firebase plays and highest opened levels...');
  for (const [name, cfg] of Object.entries(PLAYERS)) {
    const res = await fetch(`${DB}/plays/${cfg.pid}.json`);
    const plays = await res.json() || {};
    const events = Object.values(plays).filter(e => e && e.t).sort((a, b) => a.t - b.t);
    const levels = new Set(events.filter(e => e.lv).map(e => e.lv));
    const maxLv = Math.max(0, ...levels);
    console.log(`  ${name} (${cfg.pid}): highest opened = ${maxLv} (expected <= ${cfg.maxOpened})`);
    if (maxLv > cfg.maxOpened) {
      throw new Error(`ABORT: ${name} already opened level ${maxLv} > ${cfg.maxOpened}! Need to adjust starting level!`);
    }
  }

  console.log('\n2. Checking existing Firebase forecasts...');
  const existingForecastsRes = await fetch(`${DB}/forecasts.json`);
  const existingForecasts = await existingForecastsRes.json();
  console.log('  Existing forecasts in Firebase:', existingForecasts ? Object.keys(existingForecasts) : 'none');

  console.log('\n3. Building PATCH payloads for each player...');
  const patches = {};
  for (const [name, cfg] of Object.entries(PLAYERS)) {
    const playerSims = simResults.filter(r => r.name === name);
    playerSims.sort((a, b) => a.lv - b.lv);
    if (playerSims.length !== cfg.count) {
      throw new Error(`Expected ${cfg.count} simulation results for ${name}, got ${playerSims.length}`);
    }

    patches[name] = {};
    for (const r of playerSims) {
      if (r.lv < cfg.start || r.lv >= cfg.start + cfg.count) {
        throw new Error(`Level out of range for ${name}: L${r.lv}`);
      }
      patches[name][String(r.lv)] = {
        p: r.predictedAttempt,
        t: { '.sv': 'timestamp' },
        by: 'gemini',
        model: 'v9'
      };
    }
    console.log(`  ${name} (${cfg.pid}): prepared levels ${cfg.start}..${cfg.start + cfg.count - 1} (${Object.keys(patches[name]).length} levels)`);
  }

  console.log('\n4. Sending PATCH to Firebase forecasts for each player...');
  for (const [name, cfg] of Object.entries(PLAYERS)) {
    const url = `${DB}/forecasts/${cfg.pid}.json`;
    const body = patches[name];
    console.log(`  Locking ${name} (${cfg.pid})...`);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to lock ${name}: HTTP ${res.status} - ${err}`);
    }
    const responseData = await res.json();
    console.log(`    HTTP ${res.status} SUCCESS: locked ${Object.keys(responseData || {}).length} levels.`);
  }

  console.log('\n5. Verifying locked forecasts directly from Firebase...');
  for (const [name, cfg] of Object.entries(PLAYERS)) {
    const url = `${DB}/forecasts/${cfg.pid}.json`;
    const res = await fetch(url);
    const locked = await res.json() || {};
    const keys = Object.keys(locked).filter(k => /^[1-9][0-9]{0,3}$/.test(k)).map(Number).sort((a, b) => a - b);
    console.log(`  ${name}: ${keys.length} levels locked (${keys[0]}..${keys[keys.length - 1]})`);
    for (let lv = cfg.start; lv < cfg.start + cfg.count; lv++) {
      const entry = locked[String(lv)];
      if (!entry || !entry.t || entry.p == null || entry.model !== 'v9' || entry.by !== 'gemini') {
        throw new Error(`Verification failed for ${name} L${lv}: ${JSON.stringify(entry)}`);
      }
    }
  }

  console.log('\nAll 80 predictions successfully locked in Firebase before opening!');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
