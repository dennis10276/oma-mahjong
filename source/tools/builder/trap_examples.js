'use strict';
/* trap_examples.js: build example trap boards, separate their twins (bank/separate.js), re-prove the story and write
   source/build/traps/examples2/<trap>-<layout>.json (light: engine only, no bots, no Firebase, every search wall-limited).
     node source/tools/builder/trap_examples.js [trap ...] [--per 2] [--wall 90000] [--seeds 4]      the fixed stories (keyOnClock, wrongMelt, lockedMelt, guardedKey)
     node source/tools/builder/trap_examples.js --chain [--n 10] [--wall 90000] [--shapes 0,3,5]        one board per chain shape, each on a different layout
     node source/tools/builder/trap_examples.js --readable                                            write source/build/traps/readable-layouts.json (the 48 layouts ranked by readable stacking)
     node source/tools/builder/trap_examples.js --examples3 [--n 10] [--shapes 16,20,..] [--wall 90000] [--seeds 4] [--band 0.15,0.40] [--run2 5] [--at3 3] [--pool 4,7,41] [--layouts 6]
                                                one board per shape with 3+ links on a readable layout, pressure dial on, twins apart, tail tuned, full card -> source/build/traps/examples3/<shape>-<layout>.json
   Layouts the owner has already played (2026-11-13 lab 4 and earlier) are tried last: [0, 2, 3, 5, 7, 12, 14, 15, 16, 21, 23, 24, 30, 31]. */
const fs = require('fs'), path = require('path');
const T = require('./trap_stories.js'), B = require('./builder.js'), M = require('../factory/meter.js'), SEP = require('./bank/separate.js');
const PLAYED = [0, 2, 3, 5, 7, 12, 14, 15, 16, 21, 23, 24, 30, 31];
const PLAYED3 = [0, 1, 2, 3, 5, 6, 7, 8, 9, 12, 14, 15, 16, 21, 23, 24, 30, 31, 46];   // all lab boards played up to lab 5
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

// ---------- readable layouts (Dennis, lab 5: "I like to see this way of stacking more") ----------
function readableMode() {
  const R = T.readableLayouts(), file = path.resolve(__dirname, '../../build/traps/readable-layouts.json');
  fs.writeFileSync(file, JSON.stringify({ savedAt: new Date().toISOString().slice(0, 10), source: 'trap_stories.js readableLayouts()', reference: R.reference,
    finding: 'Layout 8 (cross, the stacking Dennis liked on level 296) is deep - 89% of the tiles lie under another, up to 8 tiles above one, 5 layers - but staggered by half a tile, so 84% of the covered tiles still show their picture (layout average about 70%; the deep layouts 2, 21, 27: 60-65%). No layout stacks exactly aligned: the difference is how many stacked tiles stay readable, not the height.',
    score: '0.45 readStack + 0.30 picVis + 0.15 meanShown + 0.10 (1 - hidden), each min-max scaled over the 48 layouts', topThird: R.top, played: PLAYED3, topThirdUnplayed: R.top.filter(l => !PLAYED3.includes(l)), ranked: R.ranked }, null, 1));
  console.log('top third:', R.top.join(','), '| unplayed:', R.top.filter(l => !PLAYED3.includes(l)).join(','), '| layout 8 rank', R.reference.rank, '->', file);
}

// ---------- examples for a new lab: 3+ links, readable layouts, pressure dial, twins apart, tail tuned ----------
function examples3() {
  const R = T.readableLayouts(), top = new Set(R.top);
  const want = +arg('n', 10), band = (arg('band', '0.15,0.40')).split(',').map(Number), dial = { run2: +arg('run2', 5), at3: +arg('at3', 3) }, outDir = path.resolve(__dirname, '../../build/traps/examples3');
  fs.mkdirSync(outDir, { recursive: true });
  const sel = arg('shapes', null) ? arg('shapes').split(',').map(Number) : T.CHAIN_RICH.slice();
  const used = new Set(), done = [], failed = [];
  const hostsOf = si => { const rd = fs.existsSync(path.resolve(__dirname, '../../build/traps/chain-sweep-dial-top-' + si + '.json')) || fs.existsSync(path.resolve(__dirname, '../../build/traps/chain-sweep-dial-' + si + '.json')); let hs = null; for (const f of rd ? ['chain-sweep-dial-top-', 'chain-sweep-dial-'] : ['chain-sweep-top-', 'chain-sweep-']) { try { hs = (hs || []).concat(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../build/traps/' + f + si + '.json'), 'utf8')).hosts); } catch (e) { /* no sweep */ } } return hs && [...new Set(hs)]; };   // hosts found WITH the pressure dial when such a sweep exists
  for (const si of sel) {
    if (done.length >= want) break;
    const sig = T.CHAIN_SHAPES[si], def = T.CHAIN[sig], swept = hostsOf(si), hosts = swept || [];
    if (swept && !swept.length) { failed.push({ shape: si, sig, log: ['no host layout in the 48-layout sweep'] }); console.log('shape', si, sig, 'skipped: no host layout in the sweep'); continue; }
    // layouts, best first: a host in the readable top third that was not played; a host in the top third; a host outside it, unplayed, by readable rank; a played host; the top third without a known host
    const rk = l => R.ranked.find(r => r.layout === l).rank, isHost = l => hosts.includes(l), unplayed = l => !PLAYED3.includes(l);
    const cls = l => isHost(l) ? (top.has(l) ? (unplayed(l) ? 0 : 1) : (unplayed(l) ? 2 : 3)) : (unplayed(l) ? 4 : 5);
    const pool = arg('pool', null) ? arg('pool').split(',').map(Number) : null;   // --pool 4,7: only these layouts (parallel runs get disjoint pools)
    const cand = [...new Set([...hosts, ...R.top])].filter(l => !used.has(l) && (!pool || pool.includes(l))).sort((a, b) => cls(a) - cls(b) || rk(a) - rk(b));
    let best = null; const log = [];
    for (const layout of cand.slice(0, +arg('layouts', 6))) {
      for (let seed = 1; seed <= seeds; seed++) {
        const t0 = Date.now(), r = T.build('chain', { chain: sig, layout, seed, stage: 'edge', pressure: dial }, { tries: 30, wallMs: 25000 });
        if (!r.design) { log.push(`${layout}/${seed}: no build`); continue; }
        const k = r.card.clock.fewestMoves, spare = r.card.clock.spare, name = 'chain';
        // twins apart: up to 4 passes from the best state so far (each pass another seed, bait pictures free in its second stage); every kept state re-proves the trap
        const before = SEP.closeTwins(r.design); let sep = null, cur = r.design, swapsAll = [];
        for (let pass = 0; pass < +arg('passes', 4); pass++) {
          const o = T.separateBoard(name, { ...r, design: cur }, { wallMs: wall, seed: seed + pass * 7 });
          if (!o.proofOk) { if (!sep) log.push(`${layout}/${seed}: proof lost after separation ${o.proofWhy}`); break; }
          sep = { ...o, edits: swapsAll.concat(o.edits) }; swapsAll = sep.edits; cur = o.design;
          if (SEP.closeTwins(cur).visible === 0) break;
        }
        if (!sep) continue;
        const after = SEP.closeTwins(sep.design);
        if (after.visible !== 0) { log.push(`${layout}/${seed}: ${after.visible} visible close twins left (discarded)`); continue; }
        const tuned = T.tuneTail(name, r, sep.design, { band, wallMs: +arg('tailwall', 40000), seed });
        const final = tuned.design, rp = T.reprove(name, final, r.roles, r.brief, spare, k);
        if (!rp.ok) { log.push(`${layout}/${seed}: proof lost after tail tuning ${rp.why}`); continue; }
        const facts = T.pressureFacts(final), c2 = SEP.closeTwins(final), tc = { ...rp.proof.card, trapType: 'chain:' + sig };
        const row = { layout, seed, k, spare, firstOk: facts.firstMoves.winning, tail: tuned.after.tailGreedyWin, inBand: tuned.inBand, run2: facts.run2, at3: facts.at3, ms: Date.now() - t0 };
        const score = (facts.firstMoves.atLeast3 ? 100 : 0) + (tuned.inBand ? 50 : 0) - Math.abs(tuned.after.tailGreedyWin - (band[0] + band[1]) / 2) * 20;
        if (!best || score > best.score) best = { score, row, layout, seed, r, sep, tuned, final, facts, c2, before, after, tc, rp };
        log.push(`${layout}/${seed}: ok firstMoves ${facts.firstMoves.winning}/${facts.firstMoves.legal} tail ${tuned.before.tailGreedyWin}->${tuned.after.tailGreedyWin}${tuned.inBand ? '' : ' (out of band)'} run2 ${facts.run2} at3 ${facts.at3}`);
        if (facts.firstMoves.atLeast3 && tuned.inBand) break;
      }
      if (best && best.facts.firstMoves.atLeast3 && best.tuned.inBand) break;
    }
    if (!best) { failed.push({ shape: si, sig, log }); console.log('shape', si, sig, 'NOT PLACED:', log.slice(-4).join(' | ')); continue; }
    used.add(best.layout);
    const { r, final, tuned, facts, tc, layout, seed } = best, lay = B.LAYOUTS[layout], file = path.join(outDir, si + '-' + layout + '.json');
    const card = { ...tc, links: def.length, easy: def.length <= 2, needsUi: def.needsUi || null };
    fs.writeFileSync(file, JSON.stringify({ trap: 'chain', shapeIndex: si, shape: sig, links: def.length, needsUi: def.needsUi || null, layout, layoutShape: lay.shape, seed, tiles: final.tiles.length, boardKey: M.boardKey(final),
      readableLayout: top.has(layout), readableRank: R.ranked.find(x => x.layout === layout).rank, playedLayout: PLAYED3.includes(layout),
      baits: tc.baits.map(b => ({ name: b.name, tiles: b.tiles, provenResult: b.result, provenCost: b.cost, value: b.value, controlValue: tc.control.value })), controlDearest: tc.control,
      pressureDial: dial, pressure: { orphans: facts.twinAfterClock, occ: facts.occ, peak: facts.peak, run2: facts.run2, at3: facts.at3, moves2plus: facts.moves2plus, waiters: facts.waiters, twinAfterClock: facts.twinAfterClock, capProof: facts.capProof, needsWaiting: facts.needsWaiting, needsWaitingProven: facts.needsWaitingProven },
      firstMoves: { winning: facts.firstMoves.winning, legal: facts.firstMoves.legal, atLeast3: facts.firstMoves.atLeast3, losingOrUnknownTiles: facts.firstMoves.rows, unknown: facts.firstMoves.unknown },
      tail: { band, before: tuned.before, after: tuned.after, inBand: tuned.inBand, swaps: tuned.swaps, gamble: tuned.gamble, notes: tuned.notes },
      closeTwins: { before: SEP.summary(best.before), afterSeparation: SEP.summary(best.after), final: SEP.summary(best.c2), swaps: best.sep.edits.length },
      faceDownShare: +(final.down.length / final.tiles.length).toFixed(3), clock: r.card.clock, sentence: tc.see, card, attempts: best.row, log, design: final }, null, 1));
    done.push({ si, layout, file, ...best.row });
    console.log('shape', si, sig, '->', layout, JSON.stringify(best.row), 'readable', top.has(layout), 'played', PLAYED3.includes(layout));
  }
  console.log('examples3:', done.length, 'boards; not placed:', failed.map(f => f.shape).join(','));
  fs.writeFileSync(path.join(outDir, '_index' + (arg('shapes', null) ? '-' + arg('shapes').replace(/,/g, '_') : '') + '.json'), JSON.stringify({ made: done, failed, dial, band, note: 'each board: shape, links, readable layout, baits with proven and control costs, winning first moves, pressure, tail before/after, close twins, needsUi' }, null, 1));
}

if (process.argv.includes('--readable')) readableMode();
else if (process.argv.includes('--examples3')) examples3();
else if (chain) {
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
