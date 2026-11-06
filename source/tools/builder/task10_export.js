'use strict';
// Copy measured evidence only; this command never invokes a bot or changes a level table.
const fs = require('fs'), path = require('path'), M = require('../factory/meter.js'), S = require('./task10_study.js');
const FILES = ['protocol.json', 'analysis-plan.json', 'plan.json', 'range-requests.json', 'trap-selection-amendment.json',
  'trap-requests.json', 'trap-plan.json', 'diagnostic-addendum-protocol.json', 'baseline-levels.jsonl', 'baseline-plan.json',
  'boards.json', 'summary.json', 'REPORT.md', 'range.png', 'frozen-guards.json', 'FROZEN-GUARDS.md',
  'speed-calibration.json', 'speed-range-replay.json', 'summary-for-dennis.md', 'SPEED.md'];
function copyFile(from, to) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); }
function copyTree(from, to) {
  if (!fs.existsSync(from)) return;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name), dest = path.join(to, e.name);
    if (e.isDirectory()) copyTree(src, dest); else if (e.isFile() && !e.name.endsWith('.tmp')) copyFile(src, dest);
  }
}
function exportStudy(root, source, external) {
  const cache = require('../factory/empirical_cache.js').inspector(), manifest = [], seen = new Set();
  for (const sub of ['', 'diagnostics']) {
    const dir = path.join(root, sub); if (!fs.existsSync(path.join(dir, 'plan.json'))) continue;
    const d = S.collect(dir);
    for (const dest of [source, external]) {
      for (const f of FILES) if (fs.existsSync(path.join(dir, f))) copyFile(path.join(dir, f), path.join(dest, sub, f));
      for (const child of ['construction', 'measurements']) copyTree(path.join(dir, child), path.join(dest, sub, child));
    }
    for (const b of d.boards.filter(b => b.design && !b.fail)) for (const settings of d.protocol.settings) {
      const key = S.keyFor(b.design, settings, d.protocol.bot), compact = d.records.get(key);
      if (!compact?.valid) throw Error('Missing valid completed measurement: ' + b.id + ':' + settings.setting + ':' + settings.seed);
      if (compact.boardKey !== M.boardKey(b.design) || compact.plan !== d.plan.fingerprint) throw Error('Wrong board/plan evidence');
      if (seen.has(key)) continue; seen.add(key);
      const full = cache.full(b.design, settings.setting, settings.seed);
      if (!full || Math.abs(full.result.expectedTries - compact.exp) > 1e-8) throw Error('Missing/mismatched cached API record: ' + key);
      const file = 'full-api-records/' + key + '.json';
      M.atomicJson(path.join(external, file), { key, boardKey: compact.boardKey, settings, cacheFingerprint: full.fingerprint, result: full.result });
      manifest.push({ key, file, profile: settings.setting, seed: settings.seed, exp: compact.exp });
    }
  }
  for (const dest of [source, external]) {
    copyTree(path.join(root, 'pilot'), path.join(dest, 'pilot-evidence'));
    M.atomicJson(path.join(dest, 'full-api-manifest.json'), { records: manifest.length, externalFolder: 'full-api-records/',
      note: 'External results contain the complete frozen meter API return for each study measurement. The API retains first20 campaign traces (winning full style only for planner), plus pooled40-campaign score and planner-style scalar scores. These are not all40 individual traces. Source contains compact checkpoints; no bot calls were made to export.', measurements: manifest });
  }
  return { records: manifest.length };
}
if (require.main === module) console.log(exportStudy(...process.argv.slice(2).map(x => path.resolve(x))));
module.exports = { exportStudy, copyTree };
