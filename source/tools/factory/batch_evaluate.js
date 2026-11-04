'use strict';
const fs = require('fs'), path = require('path');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const { createMeter, boardKey, atomicJson } = require('./meter.js');
const { roomProfile, trapTiles } = require('./design_traps.js');
const { checkOrigin } = require('./originality.js');

function evaluate(row, mode, meter) {
  if (row.seedSource === 'fresh-designed' && checkOrigin(row)) throw Error('Invalid fresh origin: ' + checkOrigin(row));
  const d = row.design, opts = { setting: 'family', runs: 20, seeds: 2, seed: 4711 };
  const room = row.room || roomProfile(d);
  if (mode === 'screen') {
    if (!room.ok || room.unrelieved > 1) return { room, eligible: false };
    const m = meter.measure(d, { ...opts, runs: 6, seeds: 1 });
    return { room, exp: m.expectedTries, valid: m.valid, eligible: m.valid && m.expectedTries >= 4.5 && m.expectedTries <= 13 };
  }
  const m = meter.measure(d, { ...opts, capture: 'tail' });
  const T = trapTiles(d), losses = m.results.flatMap(r => r.attempts).filter(a => !a.win && !a.censored);
  const at = losses.filter(a => a.why === 'clock' || (a.decisions || []).slice(-4).some(x => T.tiles.has(x.index)) ||
    (a.decisions?.at(-1)?.state.tray || []).some(f => T.faces.has(f))).length;
  const late = losses.filter(a => a.left <= 0.45 * d.tiles.length).length;
  const base = { room, train: { exp: m.expectedTries, first: m.firstTryRate, valid: m.valid, version: m.version },
    atTrap: losses.length ? at / losses.length : 1, lateShare: losses.length ? late / losses.length : 0 };
  if (mode === 'rate') {
    if (!m.valid || m.expectedTries < 5.5 || m.expectedTries > 11.5) return { ...base, eligible: false };
    const v = meter.measure(d, { ...opts, seed: 18427 });
    return { ...base, validation: { exp: v.expectedTries, first: v.firstTryRate, valid: v.valid, seed: 18427 },
      eligible: v.valid && Math.abs(m.expectedTries - v.expectedTries) <= 2 };
  }
  if (mode !== 'quality') throw Error('Unknown evaluation stage');
  const preview = row.forcePlanner ? null : meter.measure(d, { ...opts, setting: 'planner', runs: 3, seeds: 1 });
  // A small run may conservatively discard a candidate. It can never qualify
  // one: selected boards still get the full calibrated planner afterwards.
  if (preview && (!preview.valid || preview.expectedTries > 8)) return { ...base, plannerPreview: preview.expectedTries, eligible: false, reason: 'plannerScreen' };
  const md = meter.measure(d, { ...opts, setting: 'planner' });
  const special = {}, ob = d.obst || {};
  const ablate = (k, b) => {
    const x = meter.measure(b, opts);
    special[k] = { without: x.expectedTries, first: x.firstTryRate, valid: x.valid,
      matters: x.valid && (Math.abs(m.expectedTries - x.expectedTries) >= 0.3 || Math.abs(m.firstTryRate - x.firstTryRate) >= 0.15) };
  };
  if (Object.keys(ob.ice || {}).length) ablate('ice', { ...d, obst: { ...ob, ice: {} } });
  if ((ob.locks || []).length) ablate('locks', { ...d, obst: { ...ob, locks: [], keys: [] } });
  if (d.clock) ablate('clock', { ...d, clock: null });
  const idle = Object.entries(special).filter(([, s]) => !s.matters).map(([k]) => k);
  const forced = (row.recipe || []).some(k => k === 'dontGrab' || k === 'keyToEscape') ? meter.measure({ ...d, clock: { ...d.clock, n: 1 } }, opts) : null;
  const grabValid = !forced || forced.valid && forced.expectedTries >= m.expectedTries + 1;
  return { ...base, skilled: { exp: md.expectedTries, valid: md.valid }, special, idle, grabFirst: forced?.expectedTries ?? null,
    eligible: m.valid && md.valid && md.expectedTries <= 6 && room.ok && room.unrelieved <= 1 && base.atTrap >= 0.6 && !idle.length && grabValid };
}

if (!isMainThread) {
  const meter = createMeter();
  parentPort.on('message', ({ row, mode }) => {
    const started = Date.now();
    try { parentPort.postMessage({ id: row.id, key: boardKey(row.design), mode, bot: meter.fingerprint,
      ...evaluate(row, mode, meter), seconds: (Date.now() - started) / 1000 }); }
    catch (e) { parentPort.postMessage({ id: row.id, mode, error: e.stack }); }
  });
} else {
  async function run(poolFile, outDir, mode, jobs = 8, force = false) {
    const rows = JSON.parse(fs.readFileSync(poolFile, 'utf8'));
    fs.mkdirSync(outDir, { recursive: true });
    const queue = rows.filter(r => force || !fs.existsSync(path.join(outDir, r.id + '.' + mode + '.json')));
    console.log(mode, queue.length, 'new candidates,', jobs, 'workers');
    const started = Date.now();
    let done = 0, eligible = 0;
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, () => new Promise((resolve, reject) => {
      const worker = new Worker(__filename);
      worker.on('error', reject);
      const next = () => { const row = queue.shift(); if (row) worker.postMessage({ row, mode }); else worker.terminate().then(resolve, reject); };
      worker.on('message', result => {
        atomicJson(path.join(outDir, result.id + '.' + mode + '.json'), result);
        done++; if (result.eligible) eligible++;
        console.log(mode, done, result.id, result.error ? 'ERROR' : JSON.stringify({ exp: result.exp ?? result.train?.exp,
          validation: result.validation?.exp, skilled: result.skilled?.exp, idle: result.idle, eligible: result.eligible }), result.seconds?.toFixed(1) + 's');
        next();
      });
      next();
    })));
    console.log(mode, 'finished', done, 'eligible', eligible, 'seconds', ((Date.now() - started) / 1000).toFixed(1));
  }
  module.exports = { run, evaluate };
  if (require.main === module) run(process.argv[2], process.argv[3], process.argv[4], +(process.argv[5] || 8), process.argv.includes('--force')).catch(e => { console.error(e); process.exitCode = 1; });
}
