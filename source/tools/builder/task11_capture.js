'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), S = require('./task10_study.js');
const { pool } = require('../factory/empirical_workers.js');
function freezeProtocol(dir, stage, protocol) {
  const name = stage === 'keys' ? 'key-capture-protocol.json' : 'capture-protocol.json', file = path.join(dir, name);
  if (fs.existsSync(file) && M.digest(P.read(file)) !== M.digest(protocol)) throw Error('Frozen trace implementation changed');
  P.save(dir, name, protocol); return file;
}
async function run(dir, workers = 8, stage = 'all') {
  const selection = P.read(path.join(dir, 'selection-plan.json')); S.verifyPlan(selection);
  const worker = require.resolve('./task11_capture_worker.js'), protocol = { selection: selection.fingerprint, worker: M.sourceHash(worker), bot: M.createMeter().fingerprint, sample: selection.traces };
  if (protocol.bot !== selection.bot) throw Error('Use an explicit zero-drift implementation amendment before changing bots');
  let boards = selection.boards, profiles = selection.traces.profiles, runs = 2, indexDir = 'trace-index';
  if (stage === 'keys') {
    const keyFile = path.join(dir, 'key-selection-plan.json');
    if (!fs.existsSync(keyFile)) {
      const source = P.read(path.resolve(__dirname, '../../analysis/builder/knobs-v1/boards.json')); if (M.digest(source) !== selection.source) throw Error('Task10 source changed');
      const plan = { created: new Date().toISOString(), parent: selection.fingerprint, rule: 'Ten rated Task10 boards with zero key glyphs visible at start, family≥8, no frozen keys and both keys taken before the clock. Balance stories, then distinct puzzle structures, then lowest full family score and id. Six family campaigns each; unchanged profile/bot. Existing main-sample families may reuse their first two exact streams.', boards: require('./task11_keys.js').select(source) };
      plan.fingerprint = M.digest(plan); P.save(dir, 'key-selection-plan.json', plan);
    }
    const keyPlan = P.read(keyFile); S.verifyPlan(keyPlan); boards = keyPlan.boards; if (boards.length !== 10) throw Error('The key audit requires ten eligible hidden-key boards'); profiles = ['family']; runs = 6; indexDir = 'key-trace-index';
    protocol.keySelection = keyPlan.fingerprint; protocol.sample = { ...selection.traces, runs: 6, profiles: ['family'] };
  }
  freezeProtocol(dir, stage, protocol);
  const tasks = boards.flatMap(b => profiles.map(profile => ({ board: b.id, design: b.design, profile, runs, bot: selection.bot, task: M.digest(stage === 'keys' ? ['key-memory', b.id, profile] : [b.id, profile]) }))), pending = [];
  let done = 0;
  for (const job of tasks) {
    const f = path.join(dir, indexDir, job.task + '.json'), prior = fs.existsSync(f) ? P.read(f) : null;
    if (prior?.valid && fs.existsSync(path.join(dir, prior.rawFile))) done++; else pending.push(job);
  }
  // Reuse the exact first two campaign streams from the six-campaign key audit.
  // Keep the full raw six-campaign return unchanged and label the analysis slice explicitly.
  if (stage !== 'keys') for (let i = pending.length - 1; i >= 0; i--) {
    const job = pending[i]; if (job.profile !== 'family') continue;
    const keyMeta = path.join(dir, 'key-trace-index', M.digest(['key-memory', job.board, 'family']) + '.json');
    if (!fs.existsSync(keyMeta)) continue; const prior = P.read(keyMeta); if (!prior.valid) continue;
    const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, prior.rawFile)))), sample = raw.result.results.slice(0, 2);
    P.save(dir, 'trace-index/' + job.task + '.json', { ...prior, task: job.task, protocol: M.digest(protocol), campaigns: 2, sourceCampaigns: prior.campaigns, sampleRuns: 2,
      sourceMs: prior.ms, ms: 0, sourceAttempts: prior.attempts, sourceTaps: prior.taps, attempts: sample.reduce((n, c) => n + c.attempts.length, 0),
      taps: sample.reduce((n, c) => n + c.attempts.reduce((n, a) => n + a.decisions.length, 0), 0),
      reuse: 'First two exact campaign streams from the separate six-campaign key-memory study; raw source unchanged.' });
    pending.splice(i, 1); done++;
  }
  await pool(pending, worker, r => {
    const raw = path.join(dir, 'traces', r.task + '.json.gz'); fs.mkdirSync(path.dirname(raw), { recursive: true });
    fs.writeFileSync(raw, zlib.gzipSync(JSON.stringify(r), { level: 6 }));
    P.save(dir, indexDir + '/' + r.task + '.json', { task: r.task, board: r.board, boardKey: r.boardKey, profile: r.profile, bot: r.bot, protocol: M.digest(protocol),
      valid: r.result.valid, campaigns: r.result.results.length, attempts: r.result.results.reduce((n, c) => n + c.attempts.length, 0),
      taps: r.result.results.reduce((n, c) => n + c.attempts.reduce((n, a) => n + a.decisions.length, 0), 0), censored: r.result.censoredCampaigns, ms: r.ms,
      rawHash: M.digest(r), rawFile: 'traces/' + r.task + '.json.gz' });
    console.log(++done + '/' + tasks.length, r.board, r.profile, r.result.valid ? 'valid' : 'INVALID', Math.round(r.ms / 1000) + 's');
  }, workers);
}
if (require.main === module) run(path.resolve(process.argv[2]), +(process.argv[3] || 8), process.argv[4] || 'all').catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run, freezeProtocol };
