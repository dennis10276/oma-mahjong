'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { solvePublicBelief } = require('./public_belief_exact.js');
const { verifyCertificate } = require('./public_belief_certificate.js');
const { verifyGrounding } = require('./public_belief_grounding.js');
const { reference } = require('./public_witness_reference.js');
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const columns = heights => heights.flatMap((height, column) => Array.from({ length: height }, (unused, layer) => ({ x: column * 8, y: 0, z: layer })));
const make = (heights, inventory, changes = {}) => ({ tiles: columns(heights), down: inventory.map(() => 0),
  belief: { kind: 'declared-public-inventory-uniform-v1', inventory }, ...changes });
const CASES = Object.freeze([
  { name: 'clock-first-control', split: 'analyticControl', problem: make([1, 1], [1, 1], { clock: { i: 1, n: 1 } }) },
  { name: 'four-hidden-pairs', split: 'analyticControl', problem: make([1, 1, 1, 1], [1, 1, 2, 2], { down: [1, 1, 1, 1] }) },
  { name: 'three-two-high-columns', split: 'development', problem: make([2, 2, 2], [1, 1, 2, 2, 3, 3], { openingPictures: [null, 1, null, 2, null, 3] }) },
  { name: 'three-deep-unknown-clock', split: 'development', problem: make([3, 3, 2], [1, 1, 2, 2, 3, 3, 4, 4],
    { openingPictures: [null, null, 1, null, null, 2, null, 3], clock: { i: 0, n: 3 } }) },
  { name: 'mixed-peeks-clock', split: 'validationDeclaredBeforeMeasurement', problem: make([3, 3, 2], [1, 1, 2, 2, 3, 3, 4, 4],
    { down: [1, 0, 0, 1, 1, 0, 0, 0], openingPictures: [null, null, 1, null, null, 2, null, 3], clock: { i: 3, n: 4 } }) },
  { name: 'short-column-clock', split: 'validationDeclaredBeforeMeasurement', problem: make([3, 3, 2], [1, 1, 2, 2, 3, 3, 4, 4],
    { openingPictures: [null, null, 1, null, null, 1, null, 2], clock: { i: 6, n: 2 } }) },
  { name: 'four-deep-tight-clock-risk', split: 'newChallengeDeclaredBeforeMeasurement', problem: make([4, 2, 2, 2], [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    { openingPictures: [null, null, null, 1, null, 2, null, 3, null, 4], clock: { i: 0, n: 4 } }) },
  { name: 'two-unseen-kinds-route-risk', split: 'newChallengeDeclaredBeforeMeasurement', problem: make([4, 3, 3], [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    { openingPictures: [null, null, null, 1, null, null, 2, null, null, 3], clock: { i: 7, n: 4 } }) },
]);

function evaluateReference(result, options) {
  const geometry = { tiles: result.problem.tiles, nb: Layouts.neighbors(result.problem.tiles), rules: null, clock: result.problem.clock || null };
  Object.defineProperty(geometry, 'faces', { get() { throw Error('Reference read private actual deck'); } });
  const rows = [], regrets = new Map();
  for (let worldId = 0; worldId < result.worlds.length; worldId++) {
    const planner = reference(options); let node = result.nodes[result.roots.find(index => result.nodes[index].worldIds.includes(worldId))];
    const history = [];
    while (node.public.type !== 'productionPhysicalEnd-v1' && history.length < 512) {
      planner.physicalTrayPlanning(geometry, structuredClone(node.public.state), node.public.legalTiles.map(index => ({ index })));
      const report = planner.report(), action = node.actions.find(action => action.index === report.index); assert(action);
      if (action.winningWorlds < node.winningWorlds) {
        const key = node.id + '|' + action.index;
        if (!regrets.has(key)) regrets.set(key, { stateId: node.id, chosen: action.index, attainableWins: node.winningWorlds,
          chosenWins: action.winningWorlds, conditionalWorlds: node.worldIds.length, optimalIndex: node.policyIndex, report });
      }
      planner.acknowledgeTile(action.index); history.push(action.index);
      node = result.nodes[action.children.find(child => result.nodes[child].worldIds.includes(worldId))];
    }
    rows.push({ worldId, history, win: node.public.type === 'productionPhysicalEnd-v1' ? node.public.win : null,
      why: node.public.why || 'unresolvedPolicyTapBudget' });
  }
  return { wins: rows.filter(row => row.win === true).length, losses: rows.filter(row => row.win === false).length,
    unresolved: rows.filter(row => row.win === null).length, distinctSuboptimalDecisions: regrets.size, regrets: [...regrets.values()], rows };
}

function main() {
  const made = new Date().toISOString(), folder = path.join(root, 'analysis/archive/personal-bots/public-belief-exact-' + made.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder);
  const sourceFiles = Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep)), sourceHashes = {};
  for (const filename of sourceFiles) {
    const relative = path.relative(root, filename).replace(/\\/g, '/'), target = path.join(folder, 'sources', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(filename, target); sourceHashes[relative] = hash(fs.readFileSync(filename));
  }
  const input = { made, targetMet: false, cases: CASES, settings: { maximumWorlds: 2048, maximumNodes: 50000, maximumSimulatedTaps: 10000000, seed: 73 }, sourceHashes,
    note: 'Synthetic declared public inventories only, never an inventory extracted from a real concealed deal. Complete predeclared catalog, including unresolved limits. Validation split becomes development if inspected for subsequent fitting. Not a personal prediction or screenshot benchmark.' };
  const inputBytes = JSON.stringify(input); fs.writeFileSync(path.join(folder, 'input.json'), inputBytes, { flag: 'wx' });
  const rows = [];
  for (const entry of CASES) {
    const start = Date.now(), result = solvePublicBelief(entry.problem, input.settings);
    const certificate = result.status === 'exact' ? verifyCertificate(result) : null;
    const grounding = result.status === 'exact' ? verifyGrounding(result) : null;
    const compared = result.status === 'exact' ? evaluateReference(result) : null;
    const filename = entry.name + '.json.gz', bytes = zlib.gzipSync(JSON.stringify({ result, certificate, grounding, reference: compared }));
    fs.writeFileSync(path.join(folder, filename), bytes, { flag: 'wx' });
    const row = { name: entry.name, split: entry.split, status: result.status, reason: result.reason || null,
      states: result.nodes?.length ?? result.exploredNodes, stats: result.stats, elapsedMs: Date.now() - start,
      optimalWins: result.winningWorlds, totalWorlds: result.totalWorlds,
      referenceWins: compared?.wins ?? null, referenceUnresolved: compared?.unresolved ?? null,
      distinctSuboptimalDecisions: compared?.distinctSuboptimalDecisions ?? null,
      filename, sha256: hash(bytes) };
    rows.push(row); fs.appendFileSync(path.join(folder, 'progress.jsonl'), JSON.stringify(row) + '\n'); console.log(JSON.stringify(row));
  }
  for (const [relative, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  assert.equal(hash(fs.readFileSync(path.join(folder, 'input.json'))), hash(inputBytes));
  const report = { ...input, rows, inputSha256: hash(inputBytes) };
  fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify(report), { flag: 'wx' }); console.log(JSON.stringify({ folder, completeCases: rows.length }));
}

if (require.main === module) main();
module.exports = { CASES, evaluateReference };
