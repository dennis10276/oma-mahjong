'use strict';
/* trap_chain_sweep.js: light yield sweep of the chain shapes over the 48 layouts (construction + exact proofs only, wall-limited, no bots, no Firebase).
     node source/tools/builder/trap_chain_sweep.js <shape index|all> [--seeds 1] [--wall 8000] [--layouts 0,1,2] [--top] [--dial 5,3]
   --dial run2,at3: build with the tray-pressure dial (the stored route keeps 2+ waiting for run2 moves in a row and sits at 3 waiting at3 times); the sweep goes to chain-sweep-dial-<i>.json (or -dial-top-).
   --top: only the readable top third of the layouts (trap_stories.readableLayouts, Dennis lab 5: "you see things better"); the hosts are listed readable-first either way.
   writes source/build/traps/chain-sweep-<index>.json (chain-sweep-top-<index>.json for --top / --layouts): { sig, hosts:[layouts that built], rows:[{layout, built, k, baits, ms}], fails }. */
const fs = require('fs'), path = require('path');
const T = require('./trap_stories.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const seeds = +arg('seeds', 1), wall = +arg('wall', 8000), which = process.argv[2];
const READ = T.readableLayouts(), TOP = new Set(READ.top), rk = l => READ.ranked.find(r => r.layout === l).rank;
const layouts = arg('layouts', null) ? arg('layouts').split(',').map(Number) : process.argv.includes('--top') ? READ.top.slice() : [...Array(48).keys()];
const dial = arg('dial', null) ? (([a, b]) => ({ run2: +a, at3: +b }))(arg('dial').split(',')) : null, partial = process.argv.includes('--top') || !!arg('layouts', null);   // a partial sweep goes to chain-sweep-top-<i>.json and leaves the full one alone
const idx = which === 'all' || which == null ? [...T.CHAIN_SHAPES.keys()] : [+which];
const dir = path.resolve(__dirname, '../../build/traps'); fs.mkdirSync(dir, { recursive: true });
for (const si of idx) {
  const sig = T.CHAIN_SHAPES[si], rows = [], fails = {};
  for (const layout of layouts) {
    const t0 = Date.now(); let row = { layout, built: false };
    for (let seed = 1; seed <= seeds && !row.built; seed++) {
      const r = T.build('chain', { chain: sig, layout, seed, stage: 'edge', ...(dial ? { pressure: dial } : {}) }, { tries: 12, wallMs: wall });
      if (r.design) row = { layout, built: true, seed, k: r.card.clock.fewestMoves, spare: r.card.clock.spare, baits: r.card.trap.baits.map(b => b.name + ':' + (b.result === 'lose' ? 'lose' : b.cost) + '/' + b.value), control: r.card.trap.control.value };
      else for (const [k, n] of Object.entries(r.fails || {})) { const kk = k.replace(/^s\d:/, ''); fails[kk] = (fails[kk] || 0) + n; }
    }
    row.ms = Date.now() - t0; rows.push(row);
  }
  const hosts = rows.filter(r => r.built).map(r => r.layout).sort((a, b) => (TOP.has(b) - TOP.has(a)) || rk(a) - rk(b));
  fs.writeFileSync(path.join(dir, 'chain-sweep-' + (dial ? 'dial-' : '') + (partial ? 'top-' : '') + si + '.json'), JSON.stringify({ index: si, sig, length: T.CHAIN[sig].length, seeds, wall, dial, hosts, readableHosts: hosts.filter(l => TOP.has(l)), rows, fails }, null, 1));
  console.log(si, sig, 'hosts', hosts.length + '/' + layouts.length, hosts.join(','), '| readable top third:', hosts.filter(l => TOP.has(l)).join(','));
}
