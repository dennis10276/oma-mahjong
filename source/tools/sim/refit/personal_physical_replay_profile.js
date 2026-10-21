'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createSession, createSessionFactory } = require('./production_physical_session.js');
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main(filename, directory, bound = false) {
  const bytes = fs.readFileSync(path.resolve(filename)), data = JSON.parse(zlib.gunzipSync(bytes)), result = data.result;
  assert.equal(result.status, 'exact');
  const folder = path.resolve(directory); assert(fs.statSync(folder).isDirectory());
  const sources = {};
  for (const source of Object.keys(require.cache).filter(source => source.startsWith(root + path.sep))) {
    const relative = path.relative(root, source).replace(/\\/g, '/'), target = path.join(folder, 'sources', relative), content = fs.readFileSync(source);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content, { flag: 'wx' }); sources[relative] = hash(content);
  }
  const candidates = result.nodes.filter(node => node.actions.length), count = Math.min(128, candidates.length);
  const selected = Array.from({ length: count }, (unused, index) => candidates[Math.floor(index * (candidates.length - 1) / Math.max(1, count - 1))]);
  const input = { made: new Date().toISOString(), targetMet: false, filename: path.resolve(filename), caseSha256: hash(bytes),
    repetitions: 5, selectedStates: selected.map(node => node.id), sources, nodeVersion: process.version, flags: process.execArgv, bound,
    note: 'Deterministic evenly spaced state samples from an already complete synthetic public-belief graph; first representative hypothesis, every legal action, five repetitions. Both modes warm standard and bound constructors before timing. CPU profiling of actual production prefix replay only; not a new policy evaluation or forecast.' };
  fs.writeFileSync(path.join(folder, 'input.json'), JSON.stringify(input), { flag: 'wx' });
  const factory = createSessionFactory(), construct = bound ? factory : createSession, first = selected[0].representatives[0];
  createSession({ tiles: result.problem.tiles, nb: Layouts.neighbors(result.problem.tiles), faces: result.worlds[first.worldId],
    down: result.problem.down, rules: null, clock: result.problem.clock || null }, { seed: result.settings.seed, choiceLimit: 4096, tapMs: 1000 });
  const start = performance.now(); let sessions = 0, taps = 0;
  for (let repetition = 0; repetition < input.repetitions; repetition++) for (const node of selected) for (const action of node.actions) {
    const representative = node.representatives[0], problem = result.problem;
    const session = construct({ tiles: problem.tiles, nb: Layouts.neighbors(problem.tiles), faces: result.worlds[representative.worldId],
      down: problem.down, rules: null, clock: problem.clock || null }, { seed: result.settings.seed, choiceLimit: 4096, tapMs: 1000 });
    sessions++;
    for (const index of representative.history.concat(action.index)) { session.tap(index); taps++; }
    const child = result.nodes[action.children.find(child => result.nodes[child].worldIds.includes(representative.worldId))];
    assert.deepEqual(session.view().state.alive, child.public.state.alive); assert.deepEqual(session.view().state.tray, child.public.state.tray);
    assert.equal(session.view().state.moves, child.public.state.moves); assert.equal(session.view().state.openPeek, child.public.state.openPeek);
  }
  const elapsedMs = performance.now() - start;
  factory.verifySource();
  for (const [relative, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  const output = { ...input, elapsedMs, productionSessions: sessions, physicalTaps: taps, physicalTapsPerSecond: taps * 1000 / elapsedMs };
  fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify(output), { flag: 'wx' });
  console.log(JSON.stringify({ folder, elapsedMs, productionSessions: sessions, physicalTaps: taps, physicalTapsPerSecond: output.physicalTapsPerSecond }));
}

if (require.main === module) {
  assert(process.argv.length === 4 || process.argv.length === 5 && process.argv[4] === '--bound');
  main(process.argv[2], process.argv[3], process.argv[4] === '--bound');
}
