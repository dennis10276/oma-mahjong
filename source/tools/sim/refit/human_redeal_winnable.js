'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const { decodeGame } = require('./personal_game_io.js');
const { digest, makeRedeal } = require('./human_redeal.js');
const { drawSeed, protocol } = require('./human_redeal_draws.js');
const { solveRedeal, replayOraclePath } = require('./human_redeal_oracle.js');
const { validateManifest, assertRawOutput, sourceFingerprint } = require('./human_redeal_benchmark.js');

function selectBoard(entry, split, { previous = [], emit = () => {}, solve = solveRedeal } = {}) {
  const count = split === 'development' ? protocol.developmentCount : protocol.luckCount;
  assert(['development', 'luck'].includes(split));
  const draws = previous.slice(), accepted = [], seen = new Set();
  const consume = row => {
    assert.equal(row.level, entry.level); assert.equal(row.split, split);
    assert.equal(row.draw, seen.size + draws.filter(prior => prior.status === 'seed_collision' && prior.draw < row.draw).length + 1);
    assert.equal(row.seed, drawSeed(entry.level, split, row.draw));
    if (seen.has(row.seed)) { assert.equal(row.status, 'seed_collision'); return; }
    seen.add(row.seed);
    assert(['cleared', 'lost', 'node_cap'].includes(row.status));
    if (row.status === 'cleared') {
      assert(row.productionVerified && Array.isArray(row.path));
      assert.equal(row.witnessHash, digest(row.path));
      assert.equal(row.gameHash, digest(makeRedeal(entry.game, row.seed).game));
      accepted.push(row);
    }
  };
  for (const row of previous) consume(row);
  assert(accepted.length <= count);
  for (let draw = draws.length + 1; accepted.length < count; draw++) {
    const seed = drawSeed(entry.level, split, draw), redeal = makeRedeal(entry.game, seed);
    const result = seen.has(seed) ? { status: 'seed_collision', nodes: 0 }
      : solve(decodeGame(redeal.game), { nodeLimit: protocol.oracleNodeLimit });
    assert(['cleared', 'lost', 'node_cap', 'seed_collision'].includes(result.status));
    const row = { level: entry.level, split, draw, seed, status: result.status, nodes: result.nodes,
      ...(result.status === 'cleared' ? { path: result.path, gameHash: digest(redeal.game),
        witnessHash: digest(result.path), productionVerified: result.productionVerified, engine: result.engine } : {}) };
    consume(row); draws.push(row); emit(row);
  }
  return { level: entry.level, split, draws: draws.length, accepted,
    lost: draws.filter(row => row.status === 'lost').length,
    capped: draws.filter(row => row.status === 'node_cap').length,
    collisions: draws.filter(row => row.status === 'seed_collision').length };
}

function readSelection(filename) {
  const rows = fs.readFileSync(filename, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  assert.equal(rows[0]?.type, 'header');
  return { header: rows[0], draws: rows.filter(row => row.type === 'draw').map(({ type, ...row }) => row),
    boards: rows.filter(row => row.type === 'board'), footer: rows.find(row => row.type === 'footer') };
}

function assemble(manifest, split, selections) {
  validateManifest(manifest);
  assert(selections.length && selections.every(row => row.footer?.sourceUnchanged));
  assert(selections.every(row => row.header.manifestHash === manifest.hash && row.header.split === split
    && row.header.protocolHash === digest(protocol) && row.header.sourceHash === selections[0].header.sourceHash));
  const records = selections.flatMap(row => row.boards), byLevel = new Map(records.map(row => [row.level, row]));
  assert.equal(records.length, manifest.entries.length); assert.equal(byLevel.size, records.length);
  const entries = manifest.entries.map(entry => {
    const record = byLevel.get(entry.level); assert(record);
    const draws = selections.flatMap(row => row.draws).filter(row => row.level === entry.level);
    const checked = selectBoard(entry, split, { previous: draws, solve() { throw Error('Missing certified draws'); } });
    assert.deepEqual(checked.accepted, record.accepted);
    const certificates = checked.accepted.map(row => {
      const game = decodeGame(makeRedeal(entry.game, row.seed).game);
      assert(replayOraclePath(game, row.path).view.win, 'Selected witness failed fresh production replay');
      const { path, type, ...certificate } = row;
      return certificate;
    });
    return { ...entry, redeals: { development: [], luck: [], ...entry.redeals, [split]: certificates } };
  });
  const { hash, ...payload } = manifest;
  const updated = { ...payload, schema: 'human-reference-winnable-manifest-v2', entries,
    seedManifestHash: digest(protocol), developmentSeeds: [], luckSeeds: [],
    selection: { protocolHash: digest(protocol), sourceHash: selections[0].header.sourceHash,
      luckComplete: split === 'luck',
      statistics: { ...manifest.selection?.statistics, [split]: records.map(({ accepted, type, ...row }) => ({ ...row, accepted: accepted.length })) } } };
  const result = { ...updated, hash: digest(updated) }; validateManifest(result); return result;
}

function main(command, manifestFile, split, ...args) {
  assert(['development', 'luck'].includes(split));
  const manifest = JSON.parse(fs.readFileSync(manifestFile)); validateManifest(manifest);
  if (command === 'assemble') {
    const [output, ...inputs] = args; assertRawOutput(output); assert(!fs.existsSync(output));
    const selected = assemble(manifest, split, inputs.map(readSelection));
    fs.writeFileSync(output, JSON.stringify(selected), { flag: 'wx' });
    console.log(JSON.stringify({ boards: selected.entries.length, manifestHash: selected.hash, split })); return;
  }
  assert(['build', 'resume'].includes(command)); assert.equal(args.length, 3);
  const [shardText, countText, output] = args, shard = Number(shardText), count = Number(countText);
  assert(Number.isInteger(count) && count > 0 && count <= 12 && Number.isInteger(shard) && shard >= 0 && shard < count);
  assertRawOutput(output); const source = sourceFingerprint();
  const header = { type: 'header', manifestHash: manifest.hash, split, protocolHash: digest(protocol),
    sourceHash: source.hash, sourceFiles: source.files, shard, count, pid: process.pid, startedAt: new Date().toISOString() };
  let prior = { boards: [], draws: [] };
  if (command === 'resume') {
    prior = readSelection(output); assert(!prior.footer);
    for (const field of ['manifestHash', 'split', 'protocolHash', 'sourceHash', 'shard', 'count']) assert.equal(prior.header[field], header[field]);
  } else { assert(!fs.existsSync(output)); fs.writeFileSync(output, JSON.stringify(header) + '\n', { flag: 'wx' }); }
  const write = row => { assert.equal(source.fingerprint(), source.hash); fs.appendFileSync(output, JSON.stringify(row) + '\n'); };
  console.log(JSON.stringify({ type: 'started', shard, split, sourceHash: source.hash, pid: process.pid }));
  const completed = new Set(prior.boards.map(row => row.level));
  for (const [ordinal, entry] of manifest.entries.entries()) if (ordinal % count === shard && !completed.has(entry.level)) {
    const result = selectBoard(entry, split, { previous: prior.draws.filter(row => row.level === entry.level),
      emit(row) { write({ type: 'draw', ...row }); } });
    write({ type: 'board', ...result });
    console.log(JSON.stringify({ level: entry.level, accepted: result.accepted.length,
      draws: result.draws, lost: result.lost, capped: result.capped }));
  }
  write({ type: 'footer', sourceUnchanged: true, finishedAt: new Date().toISOString() });
}

if (require.main === module) { try { main(...process.argv.slice(2)); } catch (error) { console.error(error); process.exitCode = 1; } }
module.exports = { selectBoard, readSelection, assemble };
