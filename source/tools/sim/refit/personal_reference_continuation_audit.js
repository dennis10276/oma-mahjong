'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const { analyzeContinuation } = require('./public_dead_end.js');
const { advance } = require('./known_tray_plan.js');
const { decodeGeometry } = require('./personal_reference_failure_trace.js');
const { analyzeRecovery } = require('./public_recovery_graph.js');
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main(directory) {
  const parent = path.resolve(directory), reportBytes = fs.readFileSync(path.join(parent, 'report.json')), report = JSON.parse(reportBytes);
  assert.equal(report.rows.length, 29);
  for (const row of report.rows) assert.equal(hash(fs.readFileSync(path.join(parent, row.filename))), row.sha256);
  const made = new Date().toISOString(), folder = path.join(root, 'analysis/archive/personal-bots/reference-continuations-' + made.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder);
  const sourceHashes = {};
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    const relative = path.relative(root, filename).replace(/\\/g, '/'), bytes = fs.readFileSync(filename), target = path.join(folder, 'sources', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' }); sourceHashes[relative] = hash(bytes);
  }
  const input = { made, targetMet: false, parent, parentReportSha256: hash(reportBytes), sourceHashes, nodes: 4096,
    cases: report.rows.filter(row => !row.win).map(row => ({ name: row.name, lv: row.lv, cohort: row.cohort, filename: row.filename, sha256: row.sha256 })),
    note: 'All six failures from the complete29-case unchanged reference reproduction. Every saved pre-action state is probed from its own public snapshot, with no future observations. Earlier safe removals are included; merely postponing death with a board pair is not called a rescue.' };
  fs.writeFileSync(path.join(folder, 'input.json'), JSON.stringify(input), { flag: 'wx' });
  const rows = [];
  for (const entry of input.cases) {
    const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(parent, entry.filename)))), game = decodeGeometry(data.geometry);
    Object.defineProperty(game, 'faces', { get() { throw Error('Continuation probe read private actual pictures'); } });
    const probes = data.frames.map(frame => ({ position: frame.position, selected: frame.plan.index,
      tray: frame.state.tray, chosenPicture: frame.state.pictures[frame.plan.index],
      stateProof: analyzeContinuation(game, frame.state, frame.actions, input.nodes),
      selectedProof: analyzeContinuation(game, frame.state, [{ index: frame.plan.index }], input.nodes) }));
    const firstDead = probes.find(probe => probe.stateProof.knownDead), firstDoomedChoice = probes.find(probe => probe.selectedProof.knownDead && !probe.stateProof.knownDead);
    const inspect = firstDoomedChoice || (firstDead ? probes[Math.max(0, firstDead.position - 1)] : probes.at(-1));
    const snapshot = data.frames[inspect.position];
    const alternatives = snapshot.actions.map(action => ({ index: action.index, picture: snapshot.state.pictures[action.index],
      proof: analyzeContinuation(game, snapshot.state, [action], input.nodes) }));
    const finalFrame = data.frames.at(-1), exactFinal = analyzeRecovery(game, finalFrame.state, { nodes: input.nodes });
    assert(exactFinal.complete && !exactFinal.knownWinningRoute, 'Independently constructed complete recovery graph must confirm the final dead end');
    const selected = advance(game, snapshot.state, snapshot.plan.index);
    const payload = { ...entry, probes, decisionPosition: inspect.position, alternatives, exactFinal,
      decisionState: snapshot.state, chosenPlan: snapshot.plan, chosenPhysics: selected,
      firstPublicDeadState: firstDead?.position ?? null, firstPublicDoomedChoice: firstDoomedChoice?.position ?? null };
    const filename = rows.length + '.json.gz', bytes = zlib.gzipSync(JSON.stringify(payload)); fs.writeFileSync(path.join(folder, filename), bytes, { flag: 'wx' });
    const row = { name: entry.name, lv: entry.lv, firstPublicDeadState: payload.firstPublicDeadState,
      firstPublicDoomedChoice: payload.firstPublicDoomedChoice, inspectedPosition: inspect.position,
      inspectedTray: inspect.tray, chosen: inspect.selected, chosenPicture: inspect.chosenPicture,
      chosenProof: inspect.selectedProof.reason,
      alternativeFrontiers: alternatives.filter(action => !action.proof.knownDead).map(action => ({ index: action.index, picture: action.picture, reason: action.proof.reason })),
      boundedProbes: probes.filter(probe => probe.stateProof.reason === 'bounded' || probe.selectedProof.reason === 'bounded').length,
      finalKnownDead: exactFinal.complete && !exactFinal.knownWinningRoute, filename, sha256: hash(bytes) };
    rows.push(row); fs.appendFileSync(path.join(folder, 'progress.jsonl'), JSON.stringify(row) + '\n'); console.log(JSON.stringify(row));
  }
  for (const [relative, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  assert.equal(hash(fs.readFileSync(path.join(parent, 'report.json'))), hash(reportBytes));
  fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ ...input, rows }), { flag: 'wx' }); console.log(JSON.stringify({ folder, failures: rows.length }));
}

if (require.main === module) main(process.argv[2]);
