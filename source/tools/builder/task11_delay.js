'use strict';
// Correct a descriptive off-by-one/two from saved profiles; never reclassify.
const fs = require('fs'), path = require('path'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), A = require('./task11_analyze.js');
function run(root) {
  const protocolFile = path.join(root, 'delay-correction-protocol.json');
  const protocol = fs.existsSync(protocolFile) ? P.read(protocolFile) : { created: new Date().toISOString(),
    rule: 'Old actualDelayToTerminal included the mistaken action itself. Subtract its removed-tile count (take1, peek-pair2, clock-blocked0). Retain the original pre-error-to-terminal span and backups. No bot, engine proof, classified move result or rating changes.' };
  if (!protocol.fingerprint) { protocol.fingerprint = M.digest(protocol); P.save(root, 'delay-correction-protocol.json', protocol); }
  const { fingerprint, ...contents } = protocol; if (M.digest(contents) !== fingerprint) throw Error('Delay protocol changed');
  const manifest = [], counts = { firstErrors: 0, single: 0, pair: 0 };
  for (const name of fs.readdirSync(path.join(root, 'profiles')).filter(f => f.endsWith('.json'))) {
    const file = path.join(root, 'profiles', name), r = P.read(file); if (r.delayCorrection === protocol.fingerprint) continue;
    const before = M.digest(r), backup = path.join(root, 'delay-v1-backup/profiles', name); fs.mkdirSync(path.dirname(backup), { recursive: true }); if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    for (const p of r.profiles) {
      for (const a of p.attemptProfiles) if (a.firstError) {
        const e = a.firstError, n = { take: 1, 'peek-pair': 2, 'clock-blocked': 0 }[e.event];
        if (n == null || e.actualDelayToTerminal < n) throw Error('Unexpected error transition');
        e.preErrorToTerminalRemovals = e.actualDelayToTerminal; e.errorRemovals = n; e.actualDelayToTerminal -= n;
        counts.firstErrors++; if (n === 1) counts.single++; if (n === 2) counts.pair++;
      }
      p.medianDelayAfterError = A.median(p.attemptProfiles.filter(a => a.firstError && !a.recovery).map(a => a.firstError.actualDelayToTerminal));
    }
    r.delayCorrection = protocol.fingerprint; P.save(root, 'profiles/' + name, r); manifest.push({ file: 'profiles/' + name, before, after: M.digest(r), unchangedEngineDetail: r.detailHash });
  }
  if (manifest.length) P.save(root, 'delay-correction-manifest.json', { protocol: protocol.fingerprint, counts, manifest }); return counts;
}
if (require.main === module) console.log(run(path.resolve(process.argv[2])));
module.exports = { run };
