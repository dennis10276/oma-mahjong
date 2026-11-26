#!/usr/bin/env node
'use strict';
// Rate every checked combined-chain board: footprint, towers, mirror, links/ideas, tempting wrong moves (trap_offers), pressure parks.
//   node source/tools/builder/bank/combo_eval.js [dir] -> <dir>/eval.json
const fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '../../../analysis/builder/bank/combo-350/checked'));
const F = require('../footprint.js'), Dt = require('./detower.js'), { offers } = require('./trap_offers.js'), { expert } = require('./feel.js');
const profiles = require('../chained_finish_profiles');
const shard = (process.argv[3] || '0/1').split('/').map(Number), outF = path.join(dir, '..', shard[1] > 1 ? `eval-${shard[0]}.json` : 'eval.json'), old = fs.existsSync(outF) ? JSON.parse(fs.readFileSync(outF, 'utf8')) : {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().filter((f, i) => i % shard[1] === shard[0])) {
  const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), d = r.design, t = r.card && r.card.trap || {};
  const finish = r.card?.finishVerification;
  if (old[f] && !finish) continue;
  const fp = F.measure(d, { minimum: d.tiles.length >= 96 ? 52 : 58 }), sh = Dt.strip(Dt.shape(d.tiles));
  const ex = finish ? r.card.feel : expert(d, { playouts: 10, wrong: false }), of = offers(d);
  old[f] = { file: f, layout: r.brief && r.brief.layout, tiles: d.tiles.length, px: +fp.tilePx.toFixed(1), rows: fp.rows, ...sh, links: t.links, ideas: r.card.wrongIdea || null,
    pressure: +(ex.parkAt[1] + ex.parkAt[2]).toFixed(1), ...of };
  if (finish) Object.assign(old[f], {
    finishProfile: r.card.finishProfile, finishAfter: finish.afterMove,
    finishReady: r.verification?.ok === true && profiles.check(r, ex, r.card.tail)
      && profiles.check(r, finish.independent, r.card.tail),
  });
  console.log(JSON.stringify(old[f]));
  fs.writeFileSync(outF, JSON.stringify(old, null, 1));
}
