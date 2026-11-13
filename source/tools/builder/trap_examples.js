'use strict';
/* trap_examples.js: build example trap boards, separate their twins (bank/separate.js), re-prove the story and write
   source/build/traps/examples2/<trap>-<layout>.json (light: engine only, no bots, no Firebase, every search wall-limited).
     node source/tools/builder/trap_examples.js [trap ...] [--per 2] [--wall 90000] [--seeds 4]      the fixed stories (keyOnClock, wrongMelt, lockedMelt, guardedKey)
     node source/tools/builder/trap_examples.js --chain [--n 10] [--wall 90000] [--shapes 0,3,5]        one board per chain shape, each on a different layout
   Layouts the owner has already played (2026-11-13 lab 4 and earlier) are tried last: [0, 2, 3, 5, 7, 12, 14, 15, 16, 21, 23, 24, 30, 31]. */
const fs = require('fs'), path = require('path');
const T = require('./trap_stories.js'), B = require('./builder.js'), M = require('../factory/meter.js'), SEP = require('./bank/separate.js');
const PLAYED = [0, 2, 3, 5, 7, 12, 14, 15, 16, 21, 23, 24, 30, 31];
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const per = +arg('per', 2), wall = +arg('wall', 90000), seeds = +arg('seeds', 4), chain = process.argv.includes('--chain');
const dir = path.resolve(__dirname, '../../build/traps/examples2'); fs.mkdirSync(dir, { recursive: true });
const order = [...Array(48).keys()].filter(l => !PLAYED.includes(l)).concat(PLAYED);
const slug = sig => sig.replace(/[<:;]/g, m => ({ '<': '-', ':': '-', ';': '' }[m])).replace(/\s+/g, '').replace(/clock/g, 'ck').replace(/cover/g, 'cv');
const files = [], report = [];

function one(name, brief, label, layout) {
  let r = null, seed = 0;
  for (seed = 1; seed <= seeds && !r; seed++) { const x = T.build(name, { ...brief, layout, seed, stage: 'edge' }, { tries: 30, wallMs: 25000 }); if (x.design) r = x; }
  seed--; if (!r) return null;
  const before = SEP.closeTwins(r.design), o = T.separateBoard(name, r, { wallMs: wall }), after = SEP.closeTwins(o.design), tc = o.proof ? o.proof.card : r.card.trap, lay = B.LAYOUTS[layout];
  if (!o.proofOk) { console.log(label, layout, 'proof lost after separation:', o.proofWhy, '- not written'); return null; }
  const file = path.join(dir, label + '-' + layout + '.json');
  const trapCard = { ...tc, trapType: r.card.trapType };
  fs.writeFileSync(file, JSON.stringify({ trap: name, shape: name === 'chain' ? brief.chain : undefined, trapType: r.card.trapType, layout, layoutShape: lay.shape, seed, tiles: o.design.tiles.length, boardKey: M.boardKey(o.design), playedLayout: PLAYED.includes(layout),
    closeTwins: { before: SEP.summary(before), after: SEP.summary(after), pairsBefore: before.close.map(p => p.slice(0, 2)), pairsAfter: after.close.map(p => p.slice(0, 2)), swaps: o.edits.length, notes: o.notes },
    shown: { clock: tc.shown.clock, minRole: tc.shown.minRole, roles: tc.shown.roles },
    bait: r.roles.bait.tiles, card: trapCard, clock: r.card.clock, story: r.card.story, sentence: tc.see || r.card.sentence, design: o.design }, null, 1));
  const row = { trap: label, layout, played: PLAYED.includes(layout), seed, k: r.card.clock.fewestMoves, spare: r.card.clock.spare, close: before.count + '->' + after.count, visible: before.visible + '->' + after.visible, four: before.four + '->' + after.four,
    share: before.share + '->' + after.share, shown: tc.shown.clock + '/' + tc.shown.minRole, baits: tc.baits.map(b => b.name + ':' + (b.result === 'lose' ? 'lose' : b.cost) + ' (value ' + b.value + ')'), control: tc.control.value, ms: o.ms };
  report.push(row); console.log(JSON.stringify(row)); files.push(file); return row;
}

if (chain) {
  const want = +arg('n', 10), sel = arg('shapes', null) ? arg('shapes').split(',').map(Number) : [...T.CHAIN_SHAPES.keys()], used = new Set();
  let n = 0;
  for (const si of sel) {
    if (n >= want) break; const sig = T.CHAIN_SHAPES[si];
    // layouts that hosted the shape in the sweep first (if there is one), then the rest; never a layout already used by another example
    let hosts = []; try { hosts = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../build/traps/chain-sweep-' + si + '.json'), 'utf8')).hosts; } catch (e) { /* no sweep */ }
    const cand = hosts.filter(l => !used.has(l)).sort((a, b) => PLAYED.includes(a) - PLAYED.includes(b)).concat(order.filter(l => !hosts.includes(l) && !used.has(l)).slice(0, hosts.length ? 0 : 10));
    for (const layout of cand) { const row = one('chain', { chain: sig }, 'chain-' + si, layout); if (row) { used.add(layout); n++; break; } }
  }
  console.log('chain examples:', n, 'on layouts', [...used].join(','));
} else {
  const names = process.argv.slice(2).filter(a => T.NAMES.includes(a)), todo = names.length ? names : T.NAMES;
  for (const name of todo) { let n = 0; for (const layout of order) { if (n >= per) break; if (one(name, {}, name, layout)) n++; } if (n < per) console.log(name + ': only ' + n + ' boards'); }
}
console.log(files.join('\n'));
