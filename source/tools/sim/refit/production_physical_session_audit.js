'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { createSession } = require('./production_physical_session.js');
const { prefixOf, reconstruct } = require('./personal_prefix_data.js');
const { boardId } = require('./personal_model.js');
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main(directories) {
  assert(directories.length);
  const made = new Date().toISOString(), folder = path.join(root, 'analysis/archive/personal-bots/physical-session-' + made.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder);
  const sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
    .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))]));
  for (const relative of Object.keys(sourceHashes)) {
    const target = path.join(folder, 'sources', relative); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, relative), target);
  }
  const rows = [], inputs = {}, artifacts = {};
  for (const directory of directories) {
    const current = path.resolve(directory), manifestFile = path.join(current, 'manifest.json'), manifestBytes = fs.readFileSync(manifestFile);
    const manifest = JSON.parse(manifestBytes);
    assert.equal(manifest.evidence, 'read-only-live-campaign-replays-and-exact-observed-physics-audit-not-predictive-accuracy');
    inputs[path.relative(root, manifestFile).replace(/\\/g, '/')] = hash(manifestBytes);
    for (const [name, expected] of Object.entries(manifest.files)) {
      assert(/^[a-zA-Z0-9_-]+\.json$/.test(name));
      const filename = path.join(current, name), bytes = fs.readFileSync(filename); assert.equal(hash(bytes), expected);
      inputs[path.relative(root, filename).replace(/\\/g, '/')] = expected;
      const natural = prefixOf(JSON.parse(bytes));
      if (!natural) { rows.push({ name: manifest.name, lv: manifest.level, aid: name.slice(0, -5), status: 'noEligibleNaturalPrefix' }); continue; }
      assert.equal(boardId(natural.g), manifest.campaign.board);
      assert.equal(natural.lv, manifest.level);
      const control = reconstruct({ ...natural, aid: name.slice(0, -5) }, false, null, true);
      if (!control || control.prefix.physicsBoundary) {
        rows.push({ name: manifest.name, lv: manifest.level, aid: name.slice(0, -5), status: !control ? 'initialPhysicsMismatch' : 'existingPhysicsBoundary' }); continue;
      }
      const options = { tapTimes: natural.actions.map(action => action.time), settleBefore: natural.actions.map(action => action.settled) };
      const session = createSession(natural.g, options), frames = [session.view()];
      let mismatch = null;
      for (const [position, action] of natural.actions.entries()) {
        const before = session.view();
        if (before.type !== 'productionPhysicalFrame-v1' || !before.legalTiles.includes(action.index)) {
          mismatch = { position, requested: action.index, before }; break;
        }
        frames.push(session.tap(action.index));
        const actual = session.audit().physicalLog.at(-1), expected = control.state.physicalLog[position];
        if (JSON.stringify(actual) !== JSON.stringify(expected)) { mismatch = { position, actual, expected }; break; }
      }
      const audit = session.audit(), final = session.view();
      const row = { name: manifest.name, lv: manifest.level, aid: name.slice(0, -5), recordedComplete: natural.complete,
        recordedEnding: natural.ending, status: mismatch ? 'physicalMismatch' : 'exactRetainedPhysicalPath',
        choices: natural.actions.length, terminal: final.type === 'productionPhysicalEnd-v1',
        terminalWhy: final.why || null, win: final.win ?? null, computationCensored: final.computationCensored || false,
        engine: audit.engine, mismatch };
      const artifact = row.aid + '.json', artifactBytes = JSON.stringify({ row, frames, audit });
      fs.writeFileSync(path.join(folder, artifact), artifactBytes, { flag: 'wx' }); artifacts[artifact] = hash(artifactBytes);
      assert(!mismatch, JSON.stringify(row));
      assert.deepEqual(audit.physicalLog, control.state.physicalLog);
      if (natural.complete && natural.ending === 'win') assert(final.win);
      if (natural.complete && natural.ending === 'stuck') assert(final.type === 'productionPhysicalEnd-v1' && !final.win);
      rows.push(row);
    }
  }
  for (const [relative, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  for (const [relative, expected] of Object.entries(inputs)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  const totals = { attempts: rows.length, noEligiblePrefix: rows.filter(row => row.status === 'noEligibleNaturalPrefix').length,
    physicsBoundaries: rows.filter(row => row.status === 'initialPhysicsMismatch' || row.status === 'existingPhysicsBoundary').length,
    exactRetainedPaths: rows.filter(row => row.status === 'exactRetainedPhysicalPath').length,
    exactCompleteRecordings: rows.filter(row => row.status === 'exactRetainedPhysicalPath' && row.recordedComplete).length,
    physicalChoices: rows.reduce((sum, row) => sum + (row.choices || 0), 0),
    computationCensored: rows.filter(row => row.computationCensored).length };
  fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ made, targetMet: false, sourceHashes, inputs, artifacts, rows, totals,
    note: 'Single persistent source-anchored production generators replay actual manual tap indices and timestamps, preserving every physical state against independent original production follow reconstruction. Missing/ineligible prefixes and partial recordings remain explicit. Policy views omit pictures/deck, symbolic features, known masks and inspect/take hints; this does not validate every structural field as human-visible, integrate screenshots/memory, prove all possible physics or establish autonomous strength/80% forecasts.' }), { flag: 'wx' });
  console.log(JSON.stringify({ folder, totals }));
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { main };
