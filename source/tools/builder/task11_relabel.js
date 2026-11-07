'use strict';
// Correct descriptive labels using saved states. No solver or bot calls; proof results stay unchanged.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), S = require('./task10_study.js'), E = require('./engine.js'), F = require('./task11_physics.js'), A = require('./task11_analyze.js');
function run(root) {
  const selection = P.read(path.join(root, 'selection-plan.json')); S.verifyPlan(selection);
  const file = path.join(root, 'label-correction-protocol.json');
  let protocol;
  if (fs.existsSync(file)) protocol = P.read(file);
  else {
    protocol = { created: new Date().toISOString(), selection: selection.fingerprint, originalScoring: M.digest(P.read(path.join(root, 'scoring-protocol.json'))),
      classifier: M.digest(F.reason.toString().replace(/\r\n/g, '\n')),
      reason: 'The engine toClock field is only a search-order hint and omits covers of keys. It wrongly labelled133 of982 first errors as detours although the tile lies on the stored winning clock route. Recompute descriptive labels from the saved exact states and the stored route. Off-route remains relative to that route, not a proof that no winning route ever uses the tile. All original trace/proof outcomes remain unchanged; originals are backed up.' };
    protocol.fingerprint = M.digest(protocol); P.save(root, 'label-correction-protocol.json', protocol);
  }
  S.verifyPlan(protocol); if (protocol.classifier !== M.digest(F.reason.toString().replace(/\r\n/g, '\n'))) throw Error('Label classifier changed');
  let corrected = 0;
  for (const file of fs.readdirSync(path.join(root, 'profiles')).filter(f => f.endsWith('.json'))) {
    const dest = path.join(root, 'profiles', file), r = P.read(dest); if (r.labelCorrection === protocol.fingerprint) continue;
    const b = selection.boards.find(b => b.id === r.id), g = E.game(b.design), backup = path.join(root, 'labels-v1-backup');
    fs.mkdirSync(path.join(backup, 'profiles'), { recursive: true }); const oldProfile = path.join(backup, 'profiles', file);
    if (!fs.existsSync(oldProfile)) fs.copyFileSync(dest, oldProfile);
    const details = path.join(root, r.detailFile), oldDetail = path.join(backup, r.detailFile); fs.mkdirSync(path.dirname(oldDetail), { recursive: true });
    if (!fs.existsSync(oldDetail)) fs.copyFileSync(details, oldDetail);
    const detail = JSON.parse(zlib.gunzipSync(fs.readFileSync(oldDetail)));
    if (M.digest(detail) !== r.detailHash) throw Error('Original engine detail changed');
    const proofs = M.digest(detail.states);
    for (const group of detail.allMoves) for (const row of group.moves) {
      const state = detail.states[row.state], physical = { alive: state.alive, tray: state.trayFaces, moves: row.movesBefore };
      const label = F.reason(g, F.state(g, physical), row.move, row.event); if (label !== row.kind) corrected++; row.kind = label;
    }
    for (const profile of r.profiles) {
      for (const a of profile.attemptProfiles) if (a.firstError) { const e = a.firstError; e.kind = F.reason(g, F.state(g, e.before), e.move, e.event); }
      const errors = profile.attemptProfiles.filter(a => a.firstError && !a.recovery).map(a => a.firstError);
      profile.errorKinds = A.countBy(errors, 'kind'); const top = Object.entries(profile.errorKinds).sort((a, b) => b[1] - a[1])[0];
      profile.story = `${profile.profile}: ${profile.losses} losses in ${profile.attempts} sampled attempts. ${profile.provedFirstErrors} have a proved first irreversible error; typical error at removal move ${profile.medianFirstErrorMove ?? 'unresolved'}, terminal loss at move ${profile.medianTerminalMove ?? 'none'}. ${top ? 'Most first errors: ' + top[0] + ' (' + top[1] + ').' : 'No proved first-error kind.'} ${profile.repeatedKnownLosingMove} repeat an earlier losing move with its picture remembered. Unknowns and engine mismatches remain separate.`;
    }
    if (proofs !== M.digest(detail.states)) throw Error('Proof outcomes must not change during relabelling');
    const tmp = details + '.label.tmp'; fs.writeFileSync(tmp, zlib.gzipSync(JSON.stringify(detail), { level: 6 })); fs.renameSync(tmp, details);
    r.detailHash = M.digest(detail); r.labelCorrection = protocol.fingerprint; P.save(root, 'profiles/' + file, r);
  }
  return { correctedMoveLabels: corrected, physicsAndBotCalls: 0, originalProofsRetained: true };
}
if (require.main === module) console.log(run(path.resolve(process.argv[2])));
module.exports = { run };
