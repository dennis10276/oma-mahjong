'use strict';
/* trap_chain_sweep.js: light yield sweep of the chain shapes over the 48 layouts (construction + exact proofs only, wall-limited, no bots, no Firebase).
     node source/tools/builder/trap_chain_sweep.js <shape index|all> [--seeds 1] [--wall 8000] [--layouts 0,1,2]
   writes source/build/traps/chain-sweep-<index>.json: { sig, hosts:[layouts that built], rows:[{layout, built, k, baits, ms}], fails }. */
const fs = require('fs'), path = require('path');
const T = require('./trap_stories.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const seeds = +arg('seeds', 1), wall = +arg('wall', 8000), which = process.argv[2];
const layouts = arg('layouts', null) ? arg('layouts').split(',').map(Number) : [...Array(48).keys()];
const idx = which === 'all' || which == null ? [...T.CHAIN_SHAPES.keys()] : [+which];
const dir = path.resolve(__dirname, '../../build/traps'); fs.mkdirSync(dir, { recursive: true });
for (const si of idx) {
  const sig = T.CHAIN_SHAPES[si], rows = [], fails = {};
  for (const layout of layouts) {
    const t0 = Date.now(); let row = { layout, built: false };
    for (let seed = 1; seed <= seeds && !row.built; seed++) {
      const r = T.build('chain', { chain: sig, layout, seed, stage: 'edge' }, { tries: 12, wallMs: wall });
      if (r.design) row = { layout, built: true, seed, k: r.card.clock.fewestMoves, spare: r.card.clock.spare, baits: r.card.trap.baits.map(b => b.name + ':' + (b.result === 'lose' ? 'lose' : b.cost) + '/' + b.value), control: r.card.trap.control.value };
      else for (const [k, n] of Object.entries(r.fails || {})) { const kk = k.replace(/^s\d:/, ''); fails[kk] = (fails[kk] || 0) + n; }
    }
    row.ms = Date.now() - t0; rows.push(row);
  }
  const hosts = rows.filter(r => r.built).map(r => r.layout);
  fs.writeFileSync(path.join(dir, 'chain-sweep-' + si + '.json'), JSON.stringify({ index: si, sig, length: T.CHAIN[sig].length, seeds, wall, hosts, rows, fails }, null, 1));
  console.log(si, sig, 'hosts', hosts.length + '/' + layouts.length, hosts.join(','));
}
