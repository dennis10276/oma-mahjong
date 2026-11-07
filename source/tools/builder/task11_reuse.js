'use strict';
// Reuse proofs only when EVERY input consumed by structural analysis is identical.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), S = require('./task10_study.js'), K = require('./task11_keys.js');
function inputs(b) {
  return { design: b.design, route: b.keep?.P || b.design.solution.slice(0, b.design.solution.indexOf(b.design.clock.i) + 1),
    card: Object.fromEntries(['clock', 'keys', 'dig', 'necessary', 'tray', 'faceDownOnDig', 'traps'].map(k => [k, b.card[k]])) };
}
function run(baseline, primary) {
  const old = [...S.collect(path.join(baseline, 'ladder-readable')).boards, ...S.collect(path.join(baseline, 'ladder-fallback')).boards].filter(b => !b.fail);
  const source = new Map(old.map(b => [M.boardKey(b.design), b])), seen = new Set(), rows = [];
  for (const b of S.collect(path.join(primary, 'ladder-readable')).boards.filter(b => !b.fail)) {
    const key = M.boardKey(b.design), a = source.get(key); if (!a || M.digest(inputs(a)) !== M.digest(inputs(b))) throw Error('Structural input changed: ' + b.id);
    if (seen.has(key)) continue; seen.add(key);
    const file = path.join(baseline, 'structures', key + '.json'), r = P.read(file), raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(baseline, r.detailFile))));
    if (r.boardKey !== key || r.detailHash !== M.digest(raw)) throw Error('Saved proof changed');
    for (const [k, value] of Object.entries(K.features(b.design))) if (M.digest(value) !== M.digest(r.structure[k])) throw Error('Key visibility changed');
    const dest = path.join(primary, r.detailFile); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(baseline, r.detailFile), dest);
    P.save(primary, 'structures/' + key + '.json', { ...r, reuse: { from: 'why-hard-v1/structures/' + key + '.json', inputs: M.digest(inputs(b)), sourceHash: M.digest(r) } });
    rows.push({ boardKey: key, inputs: M.digest(inputs(b)), originalScoring: r.scoring, source: M.digest(r), detail: r.detailHash });
  }
  const protocol = { rule: 'No new search or bot calls. Exact full design INCLUDING stored witness, kept route, and all descriptor inputs consumed by task11_analyze_worker.structural must match. Every actual key-visibility field is independently rechecked. Original engine proof hashes and scoring fingerprints are preserved. Added v3 prose/readability intents do not change physical proof inputs.',
    parent: P.read(path.join(baseline, 'selection-plan.json')).fingerprint, primary: P.read(path.join(primary, 'selection-plan.json')).fingerprint, rows };
  P.save(primary, 'structural-reuse-protocol.json', protocol); return rows.length;
}
if (require.main === module) console.log('Reused exact structural proofs:', run(path.resolve(process.argv[2]), path.resolve(process.argv[3])));
module.exports = { inputs, run };
