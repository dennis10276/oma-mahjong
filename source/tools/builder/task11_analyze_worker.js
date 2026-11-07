'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { parentPort } = require('worker_threads');
const M = require('../factory/meter.js'), A = require('./task11_analyze.js'), Placement = require('../factory/placement_score.js');
function structural(b, w) {
  const d = b.design, xy = i => ({ x: d.tiles[i][0], y: d.tiles[i][1], z: d.tiles[i][2] }), ck = xy(d.clock.i), keys = d.obst.keys || [];
  const distance = i => Math.hypot(xy(i).x - ck.x, xy(i).y - ck.y), P = b.keep?.P || d.solution.slice(0, d.solution.indexOf(d.clock.i) + 1);
  const xs = P.map(i => xy(i).x), ys = P.map(i => xy(i).y), zs = P.map(i => xy(i).z);
  return { way: b.card.clock.fewestMoves, spare: b.card.clock.spare, tiles: d.tiles.length, clockDepth: b.card.clock.depth, keys: keys.length,
    keyDistances: keys.map(distance), maxKeyDistance: keys.length ? Math.max(...keys.map(distance)) : 0, keyCover: b.card.keys.map(k => k.cover),
    locks: d.obst.locks.length, iceTiles: Object.keys(d.obst.ice).length, dig: b.card.dig, necessary: b.card.necessary, trayThree: b.card.tray.three,
    luck: b.card.tray.luck, hiddenOnDig: b.card.faceDownOnDig, designedTraps: b.card.traps.tempting, readable: Placement.readable(d),
    routeSpanX: Math.max(...xs) - Math.min(...xs), routeSpanY: Math.max(...ys) - Math.min(...ys), routeLayers: new Set(zs).size,
    realDecisionPoints: w.realDecisionPoints, requestedDecisionPoints: w.requestedDecisionPoints, decisionUnknownStates: w.statesWithUnknown,
    losingOptionShare: A.share(w.losingOptions, w.losingOptions + w.winningOptions),
    meanWinningOptions: A.share(w.winningOptions, w.actionsToClock) };
}
function analyze(job) {
  const t = Date.now(), a = A.analyzer(job.board, job.budget), witness = a.witness(), structure = structural(job.board, witness);
  if (job.kind === 'structure') return { task: job.task, kind: job.kind, boardKey: M.boardKey(job.board.design), structure, witness, ms: Date.now() - t, states: a.records };
  const profiles = [], allMoves = [], mismatches = [];
  for (const profile of ['family', 'planner-route', 'planner-plain']) {
    const id = M.digest([job.board.id, profile]), meta = JSON.parse(fs.readFileSync(path.join(job.root, 'trace-index', id + '.json')));
    const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(job.root, meta.rawFile))));
    if (!meta.valid || raw.boardKey !== M.boardKey(job.board.design) || raw.bot !== job.bot || M.digest(raw) !== meta.rawHash) throw Error('Missing/changed trace evidence');
    const r = a.trace(raw); profiles.push(r.profile); allMoves.push({ profile, moves: r.moves }); mismatches.push(...r.mismatches.map(m => ({ profile, ...m })));
  }
  const full = require('../factory/empirical_cache.js').inspector().full(job.board.design, 'planner', 4711)?.result;
  const preferredPlanner = full?.plannerStyles ? (full.plannerStyles.route <= full.plannerStyles.plain ? 'planner-route' : 'planner-plain') : null;
  if (!preferredPlanner) throw Error('Cannot identify the full-protocol planner style');
  const score = { task: job.task, id: job.board.id, boardKey: M.boardKey(job.board.design), band: job.board.band, story: job.board.brief.story, shape: job.board.brief.shape,
    fullRatings: { family: job.board.family, skilled: job.board.skilled, plannerStyles: full.plannerStyles }, preferredPlanner, structure, witness, profiles,
    engineStateCount: a.records.length, ms: Date.now() - t };
  return { task: job.task, kind: job.kind, score, detail: { states: a.records, allMoves, mismatches }, ms: Date.now() - t };
}
parentPort.on('message', job => { try { parentPort.postMessage(analyze(job)); } catch (e) { parentPort.postMessage({ error: e.stack }); } });
module.exports = { structural };
