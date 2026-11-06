'use strict';
// Read-only handoff of measured boards. Never launches a bot or fills a missing rating.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const M = require('../factory/meter.js');
const { loadHistorical } = require('../factory/learn_pieces.js');
const { inventory } = require('../factory/empirical_results.js');

function exportPools(buildRoot, outDir) {
  const bot = M.createMeter().fingerprint, boards = new Map();
  const add = row => {
    if (!row.design || !row.family && !row.skilled && !row.quality) return;
    const id = M.boardKey(row.design);
    let item = boards.get(id);
    if (!item) {
      item = { schema: 1, id, design: row.design, shape: row.shape || null, kinds: [], family: null, skilled: null, quality: null, observations: [] };
      boards.set(id, item);
    }
    const kind = row.kind || 'historical';
    if (!item.kinds.includes(kind)) item.kinds.push(kind);
    const observation = { kind, sourceId: row.id, family: row.family || null, skilled: row.skilled || null, quality: row.quality || null };
    item.observations.push(observation);
    for (const field of ['family', 'skilled']) {
      const next = row[field], prior = item[field];
      if (!next?.valid) continue;
      // Keep fingerprints attached. Prefer current measurements, then more complete campaigns.
      const score = x => (x.bot === bot ? 100 : 0) + (x.seedCount || 1);
      if (!prior || score(next) >= score(prior)) item[field] = next;
    }
    if (row.quality) item.quality = row.quality;
    if (row.authoring) item.authoring = row.authoring;
  };
  const seedFile = path.resolve(__dirname, '../../analysis/builder/data/training-data.json');
  for (const row of JSON.parse(fs.readFileSync(seedFile, 'utf8'))) add(row);
  const historical = loadHistorical(buildRoot, bot);
  for (const row of historical.rows) add(row);
  const stock = inventory(buildRoot);
  for (const r of stock.boards) {
    if (!r.rate && !r.quality && !Number.isFinite(r.skilled)) continue;
    const family = r.rate ? { exp: (r.rate.train.exp + r.rate.validation.exp) / 2, valid: true, seedCount: 2,
      seeds: [r.rate.train.exp, r.rate.validation.exp], bot: r.rate.bot, source: r.rateDir } : null;
    const skilled = Number.isFinite(r.skilled) ? { exp: r.skilled, valid: true, bot, source: r.qualityDir || r.sources[r.sources.length - 1], evidence: 'current quality/confirmation; bot rating, without human override' } : null;
    const quality = r.quality ? { ...r.quality, source: r.qualityDir } : null;
    add({ id: r.id, design: r.row.design, shape: r.row.shape, family, skilled, quality,
      authoring: { recipe: r.row.recipe, origin: r.row.origin, edit: r.row.edit || null, tunedFrom: r.row.tunedFrom || null } });
  }
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'measured-pools.jsonl');
  const rows = [...boards.values()].sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  const counts = { boards: rows.length, family: rows.filter(r => r.family).length, skilled: rows.filter(r => r.skilled).length,
    currentFamily: rows.filter(r => r.family?.bot === bot).length, currentSkilled: rows.filter(r => r.skilled?.bot === bot).length,
    quality: rows.filter(r => r.quality).length, missingSkilled: rows.filter(r => !r.skilled).length };
  const manifest = { schema: 1, created: new Date().toISOString(), bot, file: path.basename(file), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), counts,
    scope: 'All batch-200-225* measured pools plus Claude phase-1 historical/control data. Deduplicated by physical board key. Fingerprints and observation kinds retained; missing ratings are null. Selected/tuned historical data are not random trials.',
    historicalScan: historical.stats };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
if (require.main === module) console.log(JSON.stringify(exportPools(path.resolve(process.argv[2]), path.resolve(process.argv[3])), null, 2));
module.exports = { exportPools };
