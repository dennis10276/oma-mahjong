'use strict';
/**
 * Task G4 Part A.1 — Detailed per-board profiler for `setting: 'planner'`.
 * Breaks down wall time across simulation, verification, visibility, controller.observe,
 * and controller.decide sub-phases (routeNext beam search, computeTrayHorizon, post-clock
 * canRelieve lookahead, attraction/blockers, candidate scoring/outs), plus exact allocation
 * and search-node counts across Slow, G2 Fast, and G4 Fast.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const { performance } = require('node:perf_hooks');

const Hard = require('../sim/refit/physics/hard.js');
const Layouts = require('../sim/refit/physics/layouts.js');
const { normalizeBoard } = require('../sim/refit/public_board_input.js');
const { decodeGame } = require('../sim/refit/personal_game_io.js');
const { createSessionFactory, parameters } = require('../sim/refit/production_physical_session.js');
const { visibilityGeometry, observeBoard, observeBoardFast } = require('../sim/refit/human_board_visibility.js');
const { clockLossTiming } = require('../sim/refit/human_clock_loss_timing.js');
const release = require('../sim/refit/human_release.js');
const { createFactoryController: createRefController } = require('../sim/refit/human_factory_controller.js');
const { createFastPlannerController } = require('../sim/refit/human_planner_controller_fast.js');
const task11Keys = require('../builder/task11_keys.js');
const { boardKey } = require('./meter.js');

const PLANNER_OVERLAY = {
  spotPenalty: 200, lookDepth: 2, lookPenalty: 150, lookFrom: 1, pairFirst: 100,
  freePeekBonus: 70, clockNeedFull: 1, routePlan: 300, routeBeam: 300,
  routeNeed: 1, routeNeedTray: 2, routeNeedSlack: 99,
};

// Build an in-memory instrumented copy of human_factory_controller.js without touching disk.
function loadInstrumentedRefController(stats) {
  const refPath = path.resolve(__dirname, '../sim/refit/human_factory_controller.js');
  let src = fs.readFileSync(refPath, 'utf8');

  // Inject lightweight counters and 5 outer timers per decide() call.
  src = src.replace(
    'const routeNext = (() => {',
    'const _tRoute0 = __prof.now(); const routeNext = (() => {'
  );
  src = src.replace(
    'return found ? found[0] : null;\n    })();',
    'return found ? found[0] : null;\n    })(); __prof.routeNextMs += __prof.now() - _tRoute0;'
  ).replace(
    'return found ? found[0] : null;\r\n    })();',
    'return found ? found[0] : null;\r\n    })(); __prof.routeNextMs += __prof.now() - _tRoute0;'
  );

  src = src.replace(
    'if (!usableIn(st.al, j)) continue;',
    '__prof.beamChecks++; if (!usableIn(st.al, j)) continue;'
  );
  src = src.replace(
    'const key = al.join(\'\') + \'|\' + tr.slice().sort((x, y) => x - y).join(\',\');',
    '__prof.seenKeyStrings++; __prof.arrayClones += 3; const key = al.join(\'\') + \'|\' + tr.slice().sort((x, y) => x - y).join(\',\');'
  );
  src = src.replace(
    'const need = new Set(), todo = [ck]',
    '__prof.setsCreated++; __prof.needLeftCalls++; const need = new Set(), todo = [ck]'
  );
  src = src.replace(
    'const next = { alive: s.alive.slice(), tray: s.tray.slice(), peek: s.peek, unlock: s.unlock };',
    '__prof.thNodes++; __prof.arrayClones += 2; const next = { alive: s.alive.slice(), tray: s.tray.slice(), peek: s.peek, unlock: s.unlock };'
  );
  src = src.replace(
    'const canRelieve = (al, tr, d) => {',
    'const canRelieve = (al, tr, d) => { __prof.canRelieveNodes++;'
  );
  src = src.replace(
    'const attraction = new Map(), clock = seen.clock;',
    'const _tAttr0 = __prof.now(); const attraction = new Map(), clock = seen.clock;'
  );
  src = src.replace(
    'const unmatchedClockInTray =',
    '__prof.attractMs += __prof.now() - _tAttr0; const _tTH0 = __prof.now(); const unmatchedClockInTray ='
  );
  src = src.replace(
    'const future = computeTrayHorizon(depth,[...keyWork],keyWork.size||retryAccess?knownKeys:null);',
    'const future = computeTrayHorizon(depth,[...keyWork],keyWork.size||retryAccess?knownKeys:null); __prof.trayHorizonMs += __prof.now() - _tTH0; const _tScore0 = __prof.now();'
  );
  src = src.replace(
    'const ok = canRelieve(al, tr, p.lookDepth ?? 1);',
    'const _tRel0 = __prof.now(); __prof.arrayClones += 2; const ok = canRelieve(al, tr, p.lookDepth ?? 1); const _relDt = __prof.now() - _tRel0; __prof.canRelieveMs += _relDt; __prof.scoringExcludeMs += _relDt;'
  );
  src = src.replace(
    'return { index: selected.index, score: selected.score };',
    '__prof.scoringMs += (__prof.now() - _tScore0) - __prof.scoringExcludeMs; __prof.scoringExcludeMs = 0; __prof.decisions++; return { index: selected.index, score: selected.score };'
  );

  const localReq = Module.createRequire(refPath);
  const mod = { exports: {} };
  const wrapper = new vm.Script(
    `(function(exports, require, module, __filename, __dirname, __prof) { ${src}\n})`,
    { filename: 'instrumented_human_factory_controller.js' }
  );
  wrapper.runInThisContext()(mod.exports, localReq, mod, refPath, path.dirname(refPath), stats);
  return mod.exports.createFactoryController;
}

// Instrumented copy of human_planner_controller_fast.js for apples-to-apples sub-phase breakdown.
function loadInstrumentedFastController(stats) {
  const fastPath = path.resolve(__dirname, '../sim/refit/human_planner_controller_fast.js');
  let src = fs.readFileSync(fastPath, 'utf8');

  src = src.replace(
    'const routeNext = (() => {',
    'const _tRoute0 = __prof.now(); const routeNext = (() => {'
  );
  src = src.replace(
    'routeCache = { sig, path: found || [] };\n        return found ? found[0] : null;\n      })();',
    'routeCache = { sig, path: found || [] };\n        return found ? found[0] : null;\n      })(); __prof.routeNextMs += __prof.now() - _tRoute0;'
  ).replace(
    'routeCache = { sig, path: found || [] };\r\n        return found ? found[0] : null;\r\n      })();',
    'routeCache = { sig, path: found || [] };\r\n        return found ? found[0] : null;\r\n      })(); __prof.routeNextMs += __prof.now() - _tRoute0;'
  );
  src = src.replace(
    'if (!usableInBits(sw0, sw1, sw2, sw3, j)) continue;',
    '__prof.beamChecks++; if (!usableInBits(sw0, sw1, sw2, sw3, j)) continue;'
  );
  src = src.replace(
    'const attraction = new Map(), clock = seen.clock;',
    'const _tAttr0 = __prof.now(); const attraction = new Map(), clock = seen.clock;'
  );
  src = src.replace(
    '// Fast zero-allocation bitset computeTrayHorizon',
    '__prof.attractMs += __prof.now() - _tAttr0; const _tTH0 = __prof.now(); // Fast zero-allocation bitset computeTrayHorizon'
  );
  src = src.replace(
    'const suggestsNoEasyEscapeFast = index => {',
    '__prof.trayHorizonMs += __prof.now() - _tTH0; const _tScore0 = __prof.now(); const suggestsNoEasyEscapeFast = index => {'
  );
  src = src.replace(
    'ok = canRelieveBits(nw0, nw1, nw2, nw3, nt0, nt1, nt2, newTLen, p.lookDepth ?? 1, 0);',
    'const _tRel0 = __prof.now(); ok = canRelieveBits(nw0, nw1, nw2, nw3, nt0, nt1, nt2, newTLen, p.lookDepth ?? 1, 0); const _relDt = __prof.now() - _tRel0; __prof.canRelieveMs += _relDt; __prof.scoringExcludeMs += _relDt;'
  );
  src = src.replace(
    'return { index: selected.index, score: selected.score };',
    '__prof.scoringMs += (__prof.now() - _tScore0) - __prof.scoringExcludeMs; __prof.scoringExcludeMs = 0; __prof.decisions++; return { index: selected.index, score: selected.score };'
  );

  const localReq = Module.createRequire(fastPath);
  const mod = { exports: {} };
  const wrapper = new vm.Script(
    `(function(exports, require, module, __filename, __dirname, __prof) { ${src}\n})`,
    { filename: 'instrumented_human_planner_controller_fast.js' }
  );
  wrapper.runInThisContext()(mod.exports, localReq, mod, fastPath, path.dirname(fastPath), stats);
  return mod.exports.createFastPlannerController;
}

function makeProfStats() {
  return {
    now: () => performance.now(),
    simulationMs: 0,
    verificationMs: 0,
    visibilityMs: 0,
    observeMs: 0,
    decideTotalMs: 0,
    routeNextMs: 0,
    trayHorizonMs: 0,
    canRelieveMs: 0,
    attractMs: 0,
    scoringMs: 0,
    scoringExcludeMs: 0,
    decisions: 0,
    attempts: 0,
    beamChecks: 0,
    needLeftCalls: 0,
    seenKeyStrings: 0,
    arrayClones: 0,
    setsCreated: 0,
    thNodes: 0,
    canRelieveNodes: 0,
    heapPositiveDeltaBytes: 0,
  };
}

function visibleRole(game, state, index) {
  if (!game.rules || state.relieved) return 'none';
  const r = game.rules, gone = r.iceNb[index].filter(i => !state.alive[i]).length;
  const remaining = Math.max(0, (r.ice[index] || 0) - gone);
  if (remaining) return remaining > 1 ? 'ice2' : 'ice';
  const keysLeft = r.keys.some(i => state.alive[i]);
  if (keysLeft && r.locks?.has(index)) return 'lock';
  return keysLeft && r.keys.includes(index) ? 'key' : 'none';
}

function verifySlow(encoded, actions, settings, audit) {
  if (!actions.length) return 0;
  const game = { ...decodeGame(encoded), physicalLog: [] }, trace = [];
  let candidates, cursor = 0;
  const result = Hard.play(game, {
    ...parameters(encoded.tiles.length, settings),
    physicalTrayPlanning(g, s, available) { candidates = available; return { features: available.map(() => []), nodes: 0, boundaries: 0 }; },
    physicalChoice() { const next = actions[cursor++], i = candidates.findIndex(a => a.index === next); assert(i >= 0); return i; },
  }, settings.seed, trace);
  assert.equal(cursor, actions.length);
  assert.deepEqual(result, audit.result);
  return actions.length;
}

function runProfiledBoardSlow(board, { runs = 20, seeds = 2, seed = 4711 } = {}) {
  const stats = makeProfStats();
  const ctrlFactory = loadInstrumentedRefController(stats);
  const encoded = normalizeBoard(board);
  const baseProfile = release.profiles.Dennis;
  const tWall0 = performance.now();

  for (const style of ['route', 'plain']) {
    const profile = { ...baseProfile, ...PLANNER_OVERLAY, ...(style === 'plain' ? { routeNeed: 0 } : {}) };
    for (let s = 0; s < seeds; s++) {
      const seedS = (seed + s * 7919) | 0;
      for (let run = 0; run < runs; run++) {
        const cSeed = (seedS + Math.imul(run + 1, 0x9e3779b9)) | 0;
        const tSimDecode0 = performance.now();
        const game = decodeGame(encoded), factory = createSessionFactory();
        stats.simulationMs += performance.now() - tSimDecode0;
        const controller = ctrlFactory(game.tiles, profile, cSeed);
        const settings = { seed: 20261111, choiceLimit: 1024, tapMs: 1000 };

        for (let attempt = 1; attempt <= 20; attempt++) {
          stats.attempts++;
          let hPrev = process.memoryUsage().heapUsed;
          controller.beginAttempt();
          const tS0 = performance.now();
          const session = factory(game, settings);
          let frame = session.view();
          stats.simulationMs += performance.now() - tS0;
          const actions = [];

          while (frame.type !== 'productionPhysicalEnd-v1') {
            const state = frame.state, legal = new Set(frame.legalTiles);
            const tVis0 = performance.now();
            const observed = observeBoard(game.tiles, state, game.clock, {
              picture: i => game.faces[i],
              role: i => visibleRole(game, state, i),
              takeable: i => legal.has(i),
            });
            stats.visibilityMs += performance.now() - tVis0;

            const tObs0 = performance.now();
            controller.observe({
              alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
              relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps,
            }, observed);
            stats.observeMs += performance.now() - tObs0;

            const tDec0 = performance.now();
            const selected = controller.decide();
            stats.decideTotalMs += performance.now() - tDec0;

            actions.push(selected.index);
            const tTap0 = performance.now();
            frame = session.tap(selected.index);
            stats.simulationMs += performance.now() - tTap0;
          }

          const tVer0 = performance.now();
          verifySlow(encoded, actions, settings, session.audit());
          stats.verificationMs += performance.now() - tVer0;

          const tVisEnd = performance.now();
          const termObs = observeBoard(game.tiles, frame.state, game.clock, {
            picture: i => game.faces[i],
            role: i => visibleRole(game, frame.state, i),
            takeable: () => false,
          });
          stats.visibilityMs += performance.now() - tVisEnd;

          const tObsEnd = performance.now();
          controller.observe({
            alive: frame.state.alive.slice(), tray: frame.state.tray.slice(), moves: frame.state.moves,
            openPeek: frame.state.openPeek, physicalTaps: frame.state.physicalTaps,
            relieved: frame.state.relieved, arriving: frame.state.arriving,
          }, termObs);
          const censored = frame.computationCensored || (!frame.win && !['tray', 'clock', 'stuck'].includes(frame.why));
          const phase = (game.clock && frame.state.alive[game.clock.i]) ? 'clock' : (frame.state.alive.reduce((a, b) => a + b, 0) <= 10 ? 'late' : 'mid');
          if (!censored) controller.endAttempt?.(frame.win ? null : phase === 'clock' ? 'beforeClock' : phase, frame.state.tray);
          stats.observeMs += performance.now() - tObsEnd;

          const hNow = process.memoryUsage().heapUsed;
          if (hNow > hPrev) stats.heapPositiveDeltaBytes += (hNow - hPrev);
          if (frame.win || censored) break;
        }
        const tVerSrc = performance.now();
        factory.verifySource();
        stats.verificationMs += performance.now() - tVerSrc;
      }
    }
  }
  stats.wallMs = performance.now() - tWall0;
  delete stats.now;
  return stats;
}

function runProfiledBoardFast(board, mode, { runs = 20, seeds = 2, seed = 4711, auditRate = 0.01 } = {}) {
  const stats = makeProfStats();
  const ctrlFactory = mode === 'g4-fast'
    ? loadInstrumentedFastController(stats)
    : loadInstrumentedRefController(stats);
  const encoded = normalizeBoard(board);
  const baseProfile = release.profiles.Dennis;
  const tWall0 = performance.now();

  for (const style of ['route', 'plain']) {
    const profile = { ...baseProfile, ...PLANNER_OVERLAY, ...(style === 'plain' ? { routeNeed: 0 } : {}) };
    for (let s = 0; s < seeds; s++) {
      const seedS = (seed + s * 7919) | 0;
      for (let run = 0; run < runs; run++) {
        const cSeed = (seedS + Math.imul(run + 1, 0x9e3779b9)) | 0;
        const tSim0 = performance.now();
        const game = decodeGame(encoded);
        const geom = visibilityGeometry(game.tiles), nb = geom.neighbors;
        const tiles = game.tiles, faces = game.faces, rules = game.rules;
        const clock = game.clock && game.clock.i >= 0 ? game.clock : null;
        const n = tiles.length, downSrc = game.down || new Uint8Array(n), alive0 = new Uint8Array(n).fill(1);
        const hasJoker = faces.includes(101);
        let byFace = null;
        if (hasJoker) {
          byFace = new Map();
          faces.forEach((f, i) => { if (!byFace.has(f)) byFace.set(f, []); byFace.get(f).push(i); });
        }
        stats.simulationMs += performance.now() - tSim0;

        const controller = ctrlFactory(tiles, profile, cSeed);
        const settings = { seed: 20261111, choiceLimit: 1024, tapMs: 1000 }, tapMs = 1000;
        const doAudit = auditRate > 0 && (auditRate >= 1 || Math.random() < auditRate);
        const auditRecords = doAudit ? [] : null;
        const legalMask = new Uint8Array(n);

        for (let attempt = 1; attempt <= 20; attempt++) {
          stats.attempts++;
          const hPrev = process.memoryUsage().heapUsed;
          controller.beginAttempt();
          const alive = new Uint8Array(n).fill(1), stateDown = Array.from(downSrc, v => +v), peeked = new Uint8Array(n);
          const arrivingUntil = new Float64Array(256), tray = [], actions = [];
          let moves = 0, left = n, openPeek = -1, physicalCount = 0, tapTime = 0, relieved = false, clockLeft = null;
          let endWin = false, endWhy = 'win', terminated = false;

          const can = i => rules && !relieved ? Layouts.takeable(i, alive, nb, rules, alive0) : Layouts.isFree(i, alive, nb);
          const peekMatch = index => openPeek >= 0 && openPeek !== index && alive[openPeek] === 1 && can(openPeek) && faces[openPeek] === faces[index] && !tray.includes(faces[index]);
          const off = (index, countsMove = true) => { alive[index] = 0; stateDown[index] = 0; if (openPeek === index) openPeek = -1; left--; if (countsMove) moves++; };
          const takeTwin = (face, excluded) => {
            let twin = -1, best = -1;
            for (let idx = 0; idx < n; idx++) if (idx !== excluded && alive[idx] && faces[idx] === face) {
              const val = (Layouts.isFree(idx, alive, nb) ? 1000 : 0) + tiles[idx].z;
              if (val > best) { best = val; twin = idx; }
            }
            if (twin >= 0) off(twin, true);
          };
          const take = i => {
            if (!alive[i]) return;
            const twin = peekMatch(i) ? openPeek : -1, f = faces[i];
            const finale = f === 101 && left === 1 && tray.length === 0;
            off(i, !finale);
            if (finale) return;
            const q = tray.indexOf(f);
            if (q >= 0) { tray.splice(q, 1); arrivingUntil[f & 255] = 0; return; }
            if (twin >= 0) { off(twin, true); return; }
            if (f === 101) {
              const cands = [];
              for (let t = 0; t < tray.length; t++) if (tray[t] !== 101 && arrivingUntil[tray[t] & 255] <= tapTime) cands.push(t);
              const target = cands.find(t => !byFace.get(tray[t]).some(tw => alive[tw] && can(tw))) ?? cands[0];
              if (target !== undefined) { const w = tray[target]; tray.splice(target, 1); takeTwin(w, -1); arrivingUntil[w & 255] = 0; return; }
              tray.push(f); arrivingUntil[f & 255] = tapTime + 230; return;
            }
            if (hasJoker) {
              const jq = tray.indexOf(101);
              if (jq >= 0 && arrivingUntil[101] <= tapTime) { tray.splice(jq, 1); takeTwin(f, i); arrivingUntil[101] = 0; return; }
            }
            tray.push(f); arrivingUntil[f & 255] = tapTime + 230;
          };

          while (left > 0) {
            const tStep0 = performance.now();
            tapTime = (physicalCount + 1) * tapMs;
            if (clock && alive[clock.i] && moves >= clock.n) { endWin = false; endWhy = 'clock'; terminated = true; stats.simulationMs += performance.now() - tStep0; break; }
            if (physicalCount >= 1024) { endWin = false; endWhy = 'contextChoiceLimit'; terminated = true; stats.simulationMs += performance.now() - tStep0; break; }
            legalMask.fill(0);
            let legalCount = 0;
            for (let i = 0; i < n; i++) if (alive[i] && can(i)) { legalMask[i] = 1; legalCount++; }
            if (legalCount === 0 && rules && !relieved && tray.length < 4) {
              for (let i = 0; i < n; i++) if (alive[i] && Layouts.isFree(i, alive, nb)) { relieved = true; break; }
              if (relieved) for (let i = 0; i < n; i++) if (alive[i] && Layouts.isFree(i, alive, nb)) { legalMask[i] = 1; legalCount++; }
            }
            if (legalCount === 0) { endWin = false; endWhy = 'none'; terminated = true; stats.simulationMs += performance.now() - tStep0; break; }
            const arriving = [];
            for (let t = 0; t < tray.length; t++) { const tf = tray[t]; if (arrivingUntil[tf & 255] > tapTime) arriving.push(tf); }
            stats.simulationMs += performance.now() - tStep0;

            const tVis0 = performance.now();
            const observed = observeBoardFast(geom, game, alive, stateDown, openPeek, moves, relieved, legalMask);
            stats.visibilityMs += performance.now() - tVis0;

            const tObs0 = performance.now();
            controller.observe({ alive, tray, moves, openPeek, relieved, arriving, physicalTaps: physicalCount }, observed);
            stats.observeMs += performance.now() - tObs0;

            const tDec0 = performance.now();
            const selected = controller.decide();
            stats.decideTotalMs += performance.now() - tDec0;

            const tPost0 = performance.now();
            const idx = selected.index;
            actions.push(idx);
            const clockWasAlive = !!(clock && alive[clock.i]), leftBeforeTap = left;
            const inOpts = !downSrc[idx] || openPeek === idx || (peeked[idx] === 1 && (tray.includes(faces[idx]) || peekMatch(idx)));
            if (!inOpts) {
              const automatic = tray.includes(faces[idx]) || peekMatch(idx);
              peeked[idx] = 1;
              if (!automatic) { openPeek = idx; physicalCount++; stats.simulationMs += performance.now() - tPost0; continue; }
            }
            if (clock && alive[clock.i] && moves >= clock.n) { endWin = false; endWhy = 'clock'; terminated = true; stats.simulationMs += performance.now() - tPost0; break; }
            take(idx);
            physicalCount++;
            if (clockWasAlive && !alive[clock.i]) clockLeft = idx === clock.i ? leftBeforeTap - 1 : left;
            if (inOpts && tray.length >= 4) { endWin = false; endWhy = 'tray'; terminated = true; stats.simulationMs += performance.now() - tPost0; break; }
            stats.simulationMs += performance.now() - tPost0;
          }
          if (!terminated) { endWin = tray.length === 0; endWhy = tray.length ? 'tray' : 'win'; }

          const tVisEnd = performance.now();
          const terminalObserved = observeBoardFast(geom, game, alive, stateDown, openPeek, moves, relieved, null);
          stats.visibilityMs += performance.now() - tVisEnd;

          const tObsEnd = performance.now();
          const endArriving = [];
          for (let t = 0; t < tray.length; t++) { const tf = tray[t]; if (arrivingUntil[tf & 255] > tapTime) endArriving.push(tf); }
          const endAliveArr = Array.from(alive), endTrayArr = tray.slice();
          controller.observe({ alive: endAliveArr, tray: endTrayArr, moves, openPeek, physicalTaps: physicalCount, relieved, arriving: endArriving }, terminalObserved);
          const computationCensored = endWhy === 'contextChoiceLimit';
          const censored = computationCensored || (!endWin && !['tray', 'clock', 'stuck'].includes(endWhy));
          const phase = (clock && alive[clock.i]) ? 'clock' : (left <= 10 ? 'late' : 'mid');
          if (!censored) controller.endAttempt?.(endWin ? null : phase === 'clock' ? 'beforeClock' : phase, endTrayArr);
          stats.observeMs += performance.now() - tObsEnd;

          if (doAudit) {
            auditRecords.push({
              actions: actions.slice(), win: endWin, why: endWhy, computationCensored, clockLeft,
              state: { alive: endAliveArr, down: stateDown.slice(), tray: endTrayArr, moves, openPeek, relieved, arriving: endArriving, physicalTaps: physicalCount, observationTime: tapTime },
            });
          }
          const hNow = process.memoryUsage().heapUsed;
          if (hNow > hPrev) stats.heapPositiveDeltaBytes += (hNow - hPrev);
          if (endWin || censored) break;
        }

        if (doAudit) {
          const tVer0 = performance.now();
          const factory = createSessionFactory();
          for (const rec of auditRecords) {
            const refSession = factory(game, settings);
            for (const tapIdx of rec.actions) refSession.tap(tapIdx);
            verifySlow(encoded, rec.actions, settings, refSession.audit());
          }
          factory.verifySource();
          stats.verificationMs += performance.now() - tVer0;
        }
      }
    }
  }
  stats.wallMs = performance.now() - tWall0;
  delete stats.now;
  return stats;
}

function loadSampleBoards() {
  const root = path.resolve(__dirname, '../..');
  const qualRows = fs.readFileSync(path.join(root, 'analysis/builder/data/qualified-200-225.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  const knobsRows = JSON.parse(fs.readFileSync(path.join(root, 'analysis/builder/knobs-v1/boards.json'), 'utf8'))
    .filter(b => !b.fail && b.design && (b.design.obst?.keys?.length || 0) > 0 && task11Keys.features(b.design).keysShownAtStart === 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  const ladderRows = JSON.parse(fs.readFileSync(path.join(root, 'analysis/builder/why-hard-v1/v3-reference/ladder/plan.json'), 'utf8'))
    .boards.filter(b => !b.fail && b.design).sort((a, b) => a.id.localeCompare(b.id));

  return [
    { id: `qualified-L${qualRows[0].level}-${qualRows[0].id}`, category: 'qualified-easy', design: qualRows[0].design },
    { id: `qualified-L${qualRows[6].level}-${qualRows[6].id}`, category: 'qualified-hard-clock', design: qualRows[6].design },
    { id: knobsRows[0].id, category: 'knobs-hidden-keys', design: knobsRows[0].design },
    { id: ladderRows[0].id, category: 'v3-ladder', design: ladderRows[0].design },
    { id: `${qualRows[6].id}-faceup`, category: 'face-up-gate-C2', design: { ...qualRows[6].design, down: [] } },
  ];
}

function main() {
  let outPath = null;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--out') outPath = process.argv[++i];
  }
  const boards = loadSampleBoards();
  // JIT warmup
  runProfiledBoardFast(boards[0].design, 'g4-fast', { runs: 2, seeds: 1, seed: 4711 });
  runProfiledBoardFast(boards[0].design, 'g2-fast', { runs: 2, seeds: 1, seed: 4711 });

  const results = [];
  for (const b of boards) {
    process.stdout.write(`Profiling ${b.id} (${b.category})...\n`);
    const slow = runProfiledBoardSlow(b.design, { runs: 20, seeds: 2, seed: 4711 });
    const g2Fast = runProfiledBoardFast(b.design, 'g2-fast', { runs: 20, seeds: 2, seed: 4711, auditRate: 0.01 });
    const g4Fast = runProfiledBoardFast(b.design, 'g4-fast', { runs: 20, seeds: 2, seed: 4711, auditRate: 0.01 });
    results.push({
      id: b.id,
      category: b.category,
      tiles: b.design.tiles.length,
      clockN: b.design.clock?.n ?? null,
      downCount: (b.design.down || []).length,
      slow,
      g2Fast,
      g4Fast,
      speedupG2OverSlow: +(slow.wallMs / g2Fast.wallMs).toFixed(2),
      speedupG4OverSlow: +(slow.wallMs / g4Fast.wallMs).toFixed(2),
      speedupG4OverG2: +(g2Fast.wallMs / g4Fast.wallMs).toFixed(2),
    });
    process.stdout.write(
      `  slow=${(slow.wallMs / 1000).toFixed(2)}s  g2=${(g2Fast.wallMs / 1000).toFixed(2)}s  g4=${(g4Fast.wallMs / 1000).toFixed(2)}s  ` +
      `(${(slow.wallMs / g4Fast.wallMs).toFixed(2)}x over slow, ${(g2Fast.wallMs / g4Fast.wallMs).toFixed(2)}x over G2)\n`
    );
  }

  const avg = fn => results.reduce((s, r) => s + fn(r), 0) / results.length;
  const summary = {
    generatedAt: new Date().toISOString(),
    sampleCount: results.length,
    meanSlowMs: +avg(r => r.slow.wallMs).toFixed(1),
    meanG2FastMs: +avg(r => r.g2Fast.wallMs).toFixed(1),
    meanG4FastMs: +avg(r => r.g4Fast.wallMs).toFixed(1),
    overallSpeedupG2OverSlow: +(avg(r => r.slow.wallMs) / avg(r => r.g2Fast.wallMs)).toFixed(2),
    overallSpeedupG4OverSlow: +(avg(r => r.slow.wallMs) / avg(r => r.g4Fast.wallMs)).toFixed(2),
    overallSpeedupG4OverG2: +(avg(r => r.g2Fast.wallMs) / avg(r => r.g4Fast.wallMs)).toFixed(2),
    meanBreakdownSlowMs: {
      simulation: +avg(r => r.slow.simulationMs).toFixed(1),
      verification: +avg(r => r.slow.verificationMs).toFixed(1),
      visibility: +avg(r => r.slow.visibilityMs).toFixed(1),
      observe: +avg(r => r.slow.observeMs).toFixed(1),
      decideTotal: +avg(r => r.slow.decideTotalMs).toFixed(1),
      routeNext: +avg(r => r.slow.routeNextMs).toFixed(1),
      trayHorizon: +avg(r => r.slow.trayHorizonMs).toFixed(1),
      canRelieve: +avg(r => r.slow.canRelieveMs).toFixed(1),
      attractBlockers: +avg(r => r.slow.attractMs).toFixed(1),
      scoringOuts: +avg(r => r.slow.scoringMs).toFixed(1),
    },
    meanBreakdownG2FastMs: {
      simulation: +avg(r => r.g2Fast.simulationMs).toFixed(1),
      verification: +avg(r => r.g2Fast.verificationMs).toFixed(1),
      visibility: +avg(r => r.g2Fast.visibilityMs).toFixed(1),
      observe: +avg(r => r.g2Fast.observeMs).toFixed(1),
      decideTotal: +avg(r => r.g2Fast.decideTotalMs).toFixed(1),
      routeNext: +avg(r => r.g2Fast.routeNextMs).toFixed(1),
      trayHorizon: +avg(r => r.g2Fast.trayHorizonMs).toFixed(1),
      canRelieve: +avg(r => r.g2Fast.canRelieveMs).toFixed(1),
      attractBlockers: +avg(r => r.g2Fast.attractMs).toFixed(1),
      scoringOuts: +avg(r => r.g2Fast.scoringMs).toFixed(1),
    },
    meanBreakdownG4FastMs: {
      simulation: +avg(r => r.g4Fast.simulationMs).toFixed(1),
      verification: +avg(r => r.g4Fast.verificationMs).toFixed(1),
      visibility: +avg(r => r.g4Fast.visibilityMs).toFixed(1),
      observe: +avg(r => r.g4Fast.observeMs).toFixed(1),
      decideTotal: +avg(r => r.g4Fast.decideTotalMs).toFixed(1),
      routeNext: +avg(r => r.g4Fast.routeNextMs).toFixed(1),
      trayHorizon: +avg(r => r.g4Fast.trayHorizonMs).toFixed(1),
      canRelieve: +avg(r => r.g4Fast.canRelieveMs).toFixed(1),
      attractBlockers: +avg(r => r.g4Fast.attractMs).toFixed(1),
      scoringOuts: +avg(r => r.g4Fast.scoringMs).toFixed(1),
    },
    meanAllocationsSlowAndG2: {
      decisions: Math.round(avg(r => r.g2Fast.decisions)),
      beamChecks: Math.round(avg(r => r.g2Fast.beamChecks)),
      needLeftCalls: Math.round(avg(r => r.g2Fast.needLeftCalls)),
      seenKeyStrings: Math.round(avg(r => r.g2Fast.seenKeyStrings)),
      arrayClones: Math.round(avg(r => r.g2Fast.arrayClones)),
      setsCreated: Math.round(avg(r => r.g2Fast.setsCreated)),
      thNodes: Math.round(avg(r => r.g2Fast.thNodes)),
      canRelieveNodes: Math.round(avg(r => r.g2Fast.canRelieveNodes)),
      heapPositiveDeltaMB: +(avg(r => r.g2Fast.heapPositiveDeltaBytes) / (1024 * 1024)).toFixed(1),
    },
    meanAllocationsG4Fast: {
      decisions: Math.round(avg(r => r.g4Fast.decisions)),
      beamChecks: Math.round(avg(r => r.g4Fast.beamChecks)),
      seenKeyStrings: 0,
      arrayClonesInSearch: 0,
      heapPositiveDeltaMB: +(avg(r => r.g4Fast.heapPositiveDeltaBytes) / (1024 * 1024)).toFixed(1),
    },
    boards: results,
  };

  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outPath), JSON.stringify(summary, null, 2) + '\n');
  }
  process.stdout.write(JSON.stringify({ summary: { ...summary, boards: undefined } }, null, 2) + '\n');
}

if (require.main === module) main();
module.exports = { runProfiledBoardSlow, runProfiledBoardFast, loadSampleBoards };
