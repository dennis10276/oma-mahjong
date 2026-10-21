'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const { verifyCertificate } = require('./public_belief_certificate.js');
const { verifySupport } = require('./public_belief_support.js');
const { verifyGrounding } = require('./public_belief_grounding.js');
const { physicalBound } = require('./public_belief_physical_bound.js');
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function verifyReferencePaths(result, reference) {
  assert.equal(reference.rows.length, result.worlds.length);
  const publicChoices = new Map(); let decisions = 0;
  for (const [worldId, row] of reference.rows.entries()) {
    assert.equal(row.worldId, worldId);
    let node = result.nodes[result.roots.find(index => result.nodes[index].worldIds.includes(worldId))];
    const history = [];
    for (const index of row.history) {
      assert.notEqual(node.public.type, 'productionPhysicalEnd-v1');
      history.push(node.public);
      const key = JSON.stringify(history);
      if (publicChoices.has(key)) assert.equal(publicChoices.get(key), index, 'Identical public histories produced different reference actions');
      else publicChoices.set(key, index);
      history.push(index);
      const action = node.actions.find(action => action.index === index); assert(action);
      node = result.nodes[action.children.find(child => result.nodes[child].worldIds.includes(worldId))]; decisions++;
    }
    if (row.win === null) {
      assert.equal(row.why, 'unresolvedPolicyTapBudget'); assert.equal(row.history.length, 512);
      assert.notEqual(node.public.type, 'productionPhysicalEnd-v1');
    }
    else { assert.equal(node.public.type, 'productionPhysicalEnd-v1'); assert.equal(row.win, node.public.win); assert.equal(row.why, node.public.why); }
  }
  assert.equal(reference.wins, reference.rows.filter(row => row.win === true).length);
  assert.equal(reference.losses, reference.rows.filter(row => row.win === false).length);
  assert.equal(reference.unresolved, reference.rows.filter(row => row.win === null).length);
  assert(reference.wins <= result.winningWorlds, 'A public reference policy cannot exceed a valid exact public-belief optimum');
  for (const regret of reference.regrets) {
    const node = result.nodes[regret.stateId], action = node.actions.find(action => action.index === regret.chosen); assert(action);
    assert.equal(regret.attainableWins, node.winningWorlds); assert.equal(regret.chosenWins, action.winningWorlds);
    assert.equal(regret.conditionalWorlds, node.worldIds.length); assert(action.winningWorlds < node.winningWorlds);
  }
  assert.equal(reference.distinctSuboptimalDecisions, reference.regrets.length);
  return { recordedDecisions: decisions, distinctPublicHistoryChoices: publicChoices.size };
}

function main(directory, graphOnly = false) {
  const folder = path.resolve(directory), reportBytes = fs.readFileSync(path.join(folder, 'report.json')), report = JSON.parse(reportBytes);
  const inputBytes = fs.readFileSync(path.join(folder, 'input.json')), input = JSON.parse(inputBytes);
  assert.equal(hash(inputBytes), report.inputSha256); assert.deepEqual(report.sourceHashes, input.sourceHashes);
  assert.deepEqual(report.rows.map(row => row.name), input.cases.map(entry => entry.name));
  for (const [relative, expected] of Object.entries(input.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(folder, 'sources', relative))), expected);
  const stem = graphOnly ? 'independent-graph-verify' : 'independent-full-verify', sources = {};
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    const relative = path.relative(root, filename).replace(/\\/g, '/'), bytes = fs.readFileSync(filename), target = path.join(folder, stem + '-sources', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' }); sources[relative] = hash(bytes);
  }
  if (!graphOnly) for (const relative of ['www/hard.js', 'www/layouts.js', 'tools/sim/refit/production_physical_session.js',
    'tools/sim/refit/personal_game_io.js', 'tools/sim/refit/personal_public_picture_prior.js']) assert.equal(sources[relative], input.sourceHashes[relative]);
  const rows = [];
  for (const [index, row] of report.rows.entries()) {
    const bytes = fs.readFileSync(path.join(folder, row.filename)); assert.equal(hash(bytes), row.sha256);
    const data = JSON.parse(zlib.gunzipSync(bytes)), result = data.result;
    assert.deepEqual(result.problem, input.cases[index].problem); assert.deepEqual(result.settings, input.settings);
    assert.equal(result.status, row.status);
    if (result.status !== 'exact') { assert.equal(result.winningWorlds, null); rows.push({ name: row.name, status: result.status, reason: result.reason }); continue; }
    const support = verifySupport(result), certificate = verifyCertificate(result), referencePaths = verifyReferencePaths(result, data.reference);
    assert.deepEqual(certificate, data.certificate);
    assert.equal(row.optimalWins, result.winningWorlds); assert.equal(row.totalWorlds, result.totalWorlds);
    assert.equal(row.referenceWins, data.reference.wins); assert.equal(row.referenceUnresolved, data.reference.unresolved);
    rows.push({ name: row.name, status: result.status, support, certificate, referencePaths,
      physicalBound: physicalBound(result),
      grounding: graphOnly ? null : verifyGrounding(result) });
  }
  for (const [relative, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  const value = { made: new Date().toISOString(), targetMet: false, reportSha256: hash(reportBytes), inputSha256: hash(inputBytes),
    scope: graphOnly ? 'support-certificate-reference-history-and-archive-replay-not-second-physics-run' : 'complete-independent-graph-and-production-replay',
    sources, nodeVersion: process.version, rows };
  fs.writeFileSync(path.join(folder, stem + '.json'), JSON.stringify(value), { flag: 'wx' });
  console.log(JSON.stringify({ folder, scope: value.scope, cases: rows.length,
    exactCases: rows.filter(row => row.status === 'exact').length, states: rows.reduce((sum, row) => sum + (row.certificate?.states || 0), 0) }));
}

if (require.main === module) {
  assert(process.argv.length === 3 || process.argv.length === 4 && process.argv[3] === '--graph-only');
  main(process.argv[2], process.argv[3] === '--graph-only');
}
module.exports = { verifyReferencePaths };
