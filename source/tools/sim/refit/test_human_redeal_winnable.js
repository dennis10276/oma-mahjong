'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { encodeGame } = require('./personal_game_io.js');
const { digest } = require('./human_redeal.js');
const { drawSeed, protocol } = require('./human_redeal_draws.js');
const { makeManifest, casesOf, validateManifest, runShard, summarize, renderReport } = require('./human_redeal_benchmark.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');
const { selectBoard, assemble } = require('./human_redeal_winnable.js');

function test() {
  for (let draw = 1; draw <= 1000; draw++) {
    assert.equal(drawSeed(17, 'development', draw), drawSeed(17, 'development', draw));
    assert(drawSeed(17, 'development', draw) < 0x80000000);
    assert(drawSeed(17, 'luck', draw) >= 0x80000000);
  }
  const tiles = [0, 4, 8, 12].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const game = encodeGame({ tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2],
    down: [0, 0, 0, 0], rules: null, clock: null });
  const manifest = makeManifest({ observedAt: 'test', rows: [{ name: 'Dennisisdebeste', lv: 17,
    wonOn: 1, boardSource: 'currentFixedDefinition', historicalBoardExact: false, game }] });
  const entry = manifest.entries[0], rows = [];
  const selected = selectBoard(entry, 'development', { emit: row => rows.push(row) });
  assert.equal(selected.draws, 10); assert.equal(selected.accepted.length, 10);
  assert(selected.accepted.every(row => row.productionVerified));
  const header = { manifestHash: manifest.hash, split: 'development', protocolHash: digest(protocol), sourceHash: 'test' };
  const worker = { header, draws: rows, boards: [selected], footer: { sourceUnchanged: true } };
  const certified = assemble(manifest, 'development', [worker]);
  validateManifest(certified); assert.equal(casesOf(certified).length, 10);
  assert.deepEqual(casesOf(certified).map(row => row.seed), selected.accepted.map(row => row.seed));
  assert(certified.entries.every(row => row.redeals.development.every(certificate => !Object.hasOwn(certificate, 'path'))));
  const botRows = runShard(certified, {}, 0, 1, { runCampaign(actual, options) {
    for (const key of ['redeals', 'selection', 'path', 'witnessHash', 'seed', 'level']) {
      assert(!Object.hasOwn(actual, key)); assert(!Object.hasOwn(options, key));
    }
    return playHumanCampaign(actual, options);
  } });
  const report = summarize(certified, [{ header: { manifestHash: certified.hash, profileHash: digest({}), sourceHash: 'test' },
    rows: botRows, footer: { sourceUnchanged: true } }]);
  assert(report.complete && report.valid && report.targetRate === 1);
  assert(renderReport(report).includes('Draws | Proven losses | Node caps'));
  const resumed = selectBoard(entry, 'development', { previous: rows.slice(0, 4) });
  assert.deepEqual(resumed.accepted, selected.accepted);
  let calls = 0;
  const mixed = selectBoard(entry, 'development', { solve() {
    calls++;
    return calls === 1 ? { status: 'lost', exhaustive: true, nodes: 3 }
      : calls === 2 ? { status: 'node_cap', nodes: protocol.oracleNodeLimit }
        : { status: 'cleared', path: [], nodes: 1, productionVerified: true };
  } });
  assert.equal(mixed.draws, 12); assert.equal(mixed.lost, 1); assert.equal(mixed.capped, 1);
  assert.throws(() => assemble(manifest, 'development', [{ ...worker, draws: [], boards: [] }]));
  const tampered = JSON.parse(JSON.stringify(certified));
  tampered.entries[0].redeals.development[0].productionVerified = false;
  const { hash, ...payload } = tampered; tampered.hash = digest(payload);
  assert.throws(() => validateManifest(tampered));
  const bad = { ...worker, draws: mixed.accepted, boards: [mixed] };
  assert.throws(() => assemble(manifest, 'development', [bad]));
  console.log('PASS published disjoint draw streams, production-certified selection, legacy and v2 manifests, exact checkpoint resume, per-board rejection counts, private witness separation and tamper refusal');
}

if (require.main === module) test();
module.exports = test;
