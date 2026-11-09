'use strict';
const fs = require('fs'), path = require('path');
const B = require('../../../tools/builder/builder.js');
const E = require('../../../tools/builder/engine.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const Y = require('../../../tools/builder/loop/yardstick.js');
const D = require('../../../tools/builder/loop/detour.js');
const P = require('../../../tools/builder/loop/publicfork.js');
const O = require('../../../tools/builder/loop/obvious.js');
const A = require('../../../tools/builder/task11_analyze.js');
const bot = require('../../../tools/sim/refit/human_bot_planner_fast.js');
const M = require('../../../tools/factory/meter.js');

const ys = Y.createYardstick({ cacheDir: path.resolve('source/build/factory-cache') });
const profile = GP.loadProfile('e5-v1');
const W = D.work();

function loadBoards() {
  const list = [];
  // 1-5: reserveNote variants
  const noteVariants = [
    { id: 'note-b1-none', bridges: 1, relief: 'none' },
    { id: 'note-b2-none', bridges: 2, relief: 'none' },
    { id: 'note-b2-open', bridges: 2, relief: 'open' },
    { id: 'note-b2-covered', bridges: 2, relief: 'covered' },
    { id: 'note-b2-covered2', bridges: 2, relief: 'covered2' }
  ];
  for (const v of noteVariants) {
    const b = B.build({ mode: 'reserveNote', shape: 'musicNote', story: 'reserveMatchingCopies', frame: { spare: 2 }, targets: { bridges: v.bridges, relief: v.relief }, seed: 1 });
    if (!b.design) throw Error('Failed to build ' + v.id + ': ' + b.fail);
    list.push({ id: v.id, type: 'note', desc: `${v.bridges} bridges, relief: ${v.relief}`, design: b.design, card: b.card, brief: b.card });
  }

  // 6: U 45-w2
  const tailRows = fs.readFileSync('source/analysis/builder/tail-plans-v1/rows.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
  const u45 = tailRows.find(r => r.index === 45 && r.width === 2);
  if (u45) list.push({ id: 'u-45-w2', type: 'u-body', desc: 'U body 45-w2 (face-up 76-tile)', design: u45.design, card: u45.card });

  // 7: U k5-9-lock42
  const preludeRows = fs.readFileSync('source/analysis/builder/dependency-choices-v1/prelude-order/rows.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
  const lock42 = preludeRows.find(r => r.id === 'k5-9-lock42');
  if (lock42) list.push({ id: 'u-k5-9-lock42', type: 'u-body', desc: 'U prelude k5-9-lock42 (target 13 proposal)', design: lock42.design, card: lock42.card });

  // 8: U repair-0
  const repairRows = fs.readFileSync('source/analysis/builder/dependency-choices-v1/prelude-repaired/rows.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
  if (repairRows.length) list.push({ id: 'u-repair-0', type: 'u-body', desc: 'U repaired prelude repair-0', design: repairRows[0].design, card: repairRows[0].card });

  return list;
}

function analyzeFirstConsequentialChoice(item) {
  const d = item.design;
  const g = E.game(d);
  const sol = d.solution || [];
  let s = E.start(g);

  // Replay solution until a state with a known losing alternative branch
  let choiceState = null;
  let moveIdx = 0;
  for (let i = 0; i < sol.length; i++) {
    const legal = E.legal(g, s);
    const winningMoves = [];
    const losingMoves = [];

    for (const a of legal) {
      const sNext = E.step(g, s, a);
      if (!sNext) continue;
      const r = W.win(g, sNext, 25000);
      if (r.result === 'win') winningMoves.push({ action: a, path: r.path });
      else if (r.result === 'lose') losingMoves.push({ action: a });
    }

    if (winningMoves.length > 0 && losingMoves.length > 0) {
      // Found first consequential choice!
      choiceState = {
        step: i,
        tilesLeft: s.alive.reduce((a, b) => a + b, 0),
        tray: s.tray.slice(),
        trayFaces: s.tray.map(idx => d.faces[idx]),
        legalCount: legal.length,
        winningMoves: winningMoves.map(w => ({
          action: w.action,
          tiles: typeof w.action === 'object' ? w.action.pair : [w.action],
          faces: (typeof w.action === 'object' ? w.action.pair : [w.action]).map(idx => d.faces[idx])
        })),
        losingMoves: losingMoves.map(l => {
          const tiles = typeof l.action === 'object' ? l.action.pair : [l.action];
          const sAfter = E.step(g, s, l.action);
          const longest = sAfter ? W.longest(g, sAfter, 10, 10000) : { depth: 0 };
          return {
            action: l.action,
            tiles,
            faces: tiles.map(idx => d.faces[idx]),
            forcedDepth: longest.depth,
            depthMin: !longest.exact
          };
        }),
        solMove: sol[i],
        solFace: d.faces[sol[i]]
      };
      break;
    }

    s = E.step(g, s, sol[i]);
    if (!s) break;
  }

  return choiceState;
}

function runDiagnostics() {
  const items = loadBoards();
  const results = [];

  for (const item of items) {
    const t0 = Date.now();
    console.log(`Analyzing ${item.id} (${item.desc})...`);

    // 1. Ratings
    const dRate = ys.rate(item.design, { block: 'CURVE' });
    const sRate = ys.planner(item.design, { spare: 2 });

    // 2. Static gates
    const sg = SG.staticGates(item.design, { stopEarly: false });
    const staticRes = GP.applyStatic(sg, profile);

    // 3. Choice analysis
    const choice = analyzeFirstConsequentialChoice(item);

    // 4. Planner bot run (2 campaigns, route style)
    const pRun = bot.measureHuman(M.boardOf(item.design), {
      runs: 2, seeds: 1, seed: 4711, maxAttempts: 20, capture: true, setting: 'planner', plannerStyle: 'route'
    });
    const pAttempts = (pRun.results[0]?.attempts || []).map(a => ({
      attempt: a.attempt,
      win: a.win,
      taps: a.taps,
      left: a.left,
      why: a.why,
      actionsCount: a.actions?.length
    }));

    const a6 = staticRes.gates.A6;

    results.push({
      id: item.id,
      desc: item.desc,
      D: dRate.D,
      S: sRate.S,
      styles: sRate.styles,
      staticPass: staticRes.pass,
      failedGates: profile.static.required.filter(g => staticRes.gates[g]?.pass === false),
      a6: {
        pass: a6.pass,
        loseForks: a6.detail?.loseForks,
        fair: a6.detail?.fair,
        unfair: a6.detail?.unfair
      },
      choice,
      plannerAttempts: pAttempts,
      ms: Date.now() - t0
    });

    console.log(`  D=${dRate.D}, S=${sRate.S}, staticPass=${staticRes.pass}, A6=${a6.pass}`);
  }

  const outPath = 'source/analysis/builder/g6-puzzle-balance/diagnostics.json';
  fs.writeFileSync(outPath, JSON.stringify({
    schema: 'g6-diagnostics-v1',
    date: new Date().toISOString(),
    results
  }, null, 2) + '\n');

  console.log(`Wrote diagnostics to ${outPath}`);
}

runDiagnostics();
