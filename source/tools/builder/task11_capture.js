'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), S = require('./task10_study.js');
const { pool } = require('../factory/empirical_workers.js');
async function run(dir, workers = 8) {
  const selection = P.read(path.join(dir, 'selection-plan.json')); S.verifyPlan(selection);
  const worker = require.resolve('./task11_capture_worker.js'), protocol = { selection: selection.fingerprint, worker: M.sourceHash(worker), bot: M.createMeter().fingerprint, sample: selection.traces };
  if (protocol.bot !== selection.bot) throw Error('Use an explicit zero-drift implementation amendment before changing bots');
  const file = path.join(dir, 'capture-protocol.json');
  if (fs.existsSync(file) && M.digest(P.read(file)) !== M.digest(protocol)) throw Error('Frozen trace implementation changed');
  P.save(dir, 'capture-protocol.json', protocol);
  const tasks = selection.boards.flatMap(b => selection.traces.profiles.map(profile => ({ board: b.id, design: b.design, profile, bot: selection.bot, task: M.digest([b.id, profile]) }))), pending = [];
  let done = 0;
  for (const job of tasks) {
    const f = path.join(dir, 'trace-index', job.task + '.json'), raw = path.join(dir, 'traces', job.task + '.json.gz');
    if (fs.existsSync(f) && fs.existsSync(raw) && P.read(f).valid) done++; else pending.push(job);
  }
  await pool(pending, worker, r => {
    const raw = path.join(dir, 'traces', r.task + '.json.gz'); fs.mkdirSync(path.dirname(raw), { recursive: true });
    fs.writeFileSync(raw, zlib.gzipSync(JSON.stringify(r), { level: 6 }));
    P.save(dir, 'trace-index/' + r.task + '.json', { task: r.task, board: r.board, boardKey: r.boardKey, profile: r.profile, bot: r.bot, protocol: M.digest(protocol),
      valid: r.result.valid, campaigns: r.result.results.length, attempts: r.result.results.reduce((n, c) => n + c.attempts.length, 0),
      taps: r.result.results.reduce((n, c) => n + c.attempts.reduce((n, a) => n + a.decisions.length, 0), 0), censored: r.result.censoredCampaigns, ms: r.ms,
      rawHash: M.digest(r), rawFile: 'traces/' + r.task + '.json.gz' });
    console.log(++done + '/' + tasks.length, r.board, r.profile, r.result.valid ? 'valid' : 'INVALID', Math.round(r.ms / 1000) + 's');
  }, workers);
}
if (require.main === module) run(path.resolve(process.argv[2]), +(process.argv[3] || 8)).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run };
