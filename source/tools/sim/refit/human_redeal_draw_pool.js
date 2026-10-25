'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { digest, makeRedeal } = require('./human_redeal.js');
const { decodeGame } = require('./personal_game_io.js');
const { drawSeed, protocol } = require('./human_redeal_draws.js');
const { solveRedeal } = require('./human_redeal_oracle.js');
const { selectBoard, readSelection, assemble } = require('./human_redeal_winnable.js');
const { sourceFingerprint, assertRawOutput, validateManifest } = require('./human_redeal_benchmark.js');
const root = path.resolve(__dirname, '../../..');

const readHeader = filename => JSON.parse(fs.readFileSync(filename, 'utf8').split('\n')[0]);

function verifySource(header) {
  const actual = digest(header.sourceFiles.map(filename => [filename.replace(/\\/g, '/'),
    crypto.createHash('sha256').update(fs.readFileSync(path.join(root, filename))).digest('hex')]));
  assert.equal(actual, header.sourceHash, 'Frozen executor source changed');
  return actual;
}

function readRange(filename) {
  const records = fs.readFileSync(filename, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  assert.equal(records[0].type, 'rangeHeader');
  return { header: records[0], draws: records.filter(row => row.type === 'draw').map(({ type, ...row }) => row),
    footer: records.find(row => row.type === 'footer') ?? null };
}

function mergePrefix(entry, split, records) {
  const count = split === 'development' ? protocol.developmentCount : protocol.luckCount;
  const byDraw = new Map();
  for (const record of records.filter(row => row.level === entry.level && row.split === split)) {
    const { type, ...row } = record;
    assert(Number.isInteger(row.draw) && row.draw > 0);
    assert.equal(row.seed, drawSeed(entry.level, split, row.draw));
    assert(['cleared', 'lost', 'node_cap', 'seed_collision'].includes(row.status));
    if (byDraw.has(row.draw)) assert.deepEqual(row, byDraw.get(row.draw), 'Duplicate draw outcomes differ');
    else byDraw.set(row.draw, row);
  }
  const prefix = []; let wins = 0;
  for (let draw = 1; byDraw.has(draw); draw++) {
    const row = byDraw.get(draw); prefix.push(row); wins += +(row.status === 'cleared');
    if (wins === count) return { complete: true, prefix,
      board: selectBoard(entry, split, { previous: prefix, solve() { throw Error('A complete prefix must never draw again'); } }),
      excludedAhead: byDraw.size - prefix.length };
  }
  return { complete: false, prefix, wins, nextDraw: prefix.length + 1, observed: byDraw.size };
}

function runRange(manifest, reference, level, split, start, end, output, resume = false) {
  validateManifest(manifest); verifySource(reference);
  assert(['development', 'luck'].includes(split));
  assert(Number.isInteger(start) && start > 0 && Number.isInteger(end) && end >= start);
  const entry = manifest.entries.find(row => row.level === level); assert(entry);
  assertRawOutput(output); const source = sourceFingerprint();
  const header = { type: 'rangeHeader', manifestHash: manifest.hash, protocolHash: digest(protocol),
    referenceSourceHash: reference.sourceHash, sourceHash: source.hash, sourceFiles: source.files,
    level, split, start, end, pid: process.pid, startedAt: new Date().toISOString() };
  let previous = [];
  if (resume) {
    const saved = readRange(output); assert(!saved.footer);
    for (const field of ['manifestHash', 'protocolHash', 'referenceSourceHash', 'sourceHash', 'level', 'split', 'start', 'end'])
      assert.equal(saved.header[field], header[field]);
    previous = saved.draws;
    previous.forEach((row, offset) => { assert.equal(row.draw, start + offset); assert.equal(row.level, level); assert.equal(row.split, split); });
  } else fs.writeFileSync(output, JSON.stringify(header) + '\n', { flag: 'wx' });
  const seen = new Set();
  for (let draw = 1; draw < start + previous.length; draw++) seen.add(drawSeed(level, split, draw));
  let wins = previous.filter(row => row.status === 'cleared').length, lastDraw = start + previous.length - 1;
  console.log(JSON.stringify({ type: 'started', level, split, start, end, pid: process.pid, sourceHash: source.hash }));
  for (let draw = start + previous.length; draw <= end && wins < protocol[split + 'Count']; draw++) {
    const seed = drawSeed(level, split, draw), redeal = makeRedeal(entry.game, seed);
    const result = seen.has(seed) ? { status: 'seed_collision', nodes: 0 }
      : solveRedeal(decodeGame(redeal.game), { nodeLimit: protocol.oracleNodeLimit });
    assert(['cleared', 'lost', 'node_cap', 'seed_collision'].includes(result.status));
    if (result.status === 'lost') assert(result.exhaustive);
    if (result.status === 'cleared') assert(result.productionVerified);
    const row = { type: 'draw', level, split, draw, seed, status: result.status, nodes: result.nodes,
      ...(result.status === 'cleared' ? { path: result.path, gameHash: digest(redeal.game),
        witnessHash: digest(result.path), productionVerified: result.productionVerified, engine: result.engine } : {}) };
    verifySource(reference); assert.equal(source.fingerprint(), source.hash);
    fs.appendFileSync(output, JSON.stringify(row) + '\n');
    seen.add(seed); wins += +(result.status === 'cleared'); lastDraw = draw;
  }
  fs.appendFileSync(output, JSON.stringify({ type: 'footer', sourceUnchanged: source.fingerprint() === source.hash,
    referenceUnchanged: verifySource(reference) === reference.sourceHash, lastDraw, wins, finishedAt: new Date().toISOString() }) + '\n');
  console.log(JSON.stringify({ level, start, lastDraw, wins }));
}

function consolidate(config, output) {
  const manifest = JSON.parse(fs.readFileSync(config.manifestFile)); validateManifest(manifest);
  const original = config.originalFiles.map(readSelection), ranges = config.rangeFiles.map(readRange);
  const stopped = new Map((config.stopped ?? []).map(row => [row.shard, row]));
  for (const worker of original) {
    assert.equal(worker.header.manifestHash, manifest.hash); verifySource(worker.header);
    assert.equal(worker.header.protocolHash, digest(protocol));
    if (!worker.footer) {
      const transition = stopped.get(worker.header.shard);
      assert(transition?.authoritativelyTerminal && transition.pid === worker.header.pid && transition.reason,
        'An interrupted original worker needs an explicit verified terminal transition');
    } else assert(worker.footer.sourceUnchanged);
  }
  const referenceHashes = new Set(original.map(worker => worker.header.sourceHash));
  for (const worker of ranges) {
    assert.equal(worker.header.manifestHash, manifest.hash); assert.equal(worker.header.protocolHash, digest(protocol));
    assert(referenceHashes.has(worker.header.referenceSourceHash)); verifySource(worker.header);
    assert(worker.footer?.sourceUnchanged && worker.footer.referenceUnchanged);
  }
  const records = [...original.flatMap(worker => worker.draws), ...ranges.flatMap(worker => worker.draws)];
  const merged = manifest.entries.map(entry => mergePrefix(entry, config.split, records));
  assert(merged.every(row => row.complete), 'Every requested board still needs a complete first-winning-draw prefix');
  const provenance = { schema: 'frozen-redeal-executors-v1', protocolHash: digest(protocol),
    originalSources: [...referenceHashes].sort(), rangeSources: [...new Set(ranges.map(worker => worker.header.sourceHash))].sort(),
    originalFiles: config.originalFiles, rangeFiles: config.rangeFiles, stopped: config.stopped ?? [],
    selection: 'Earliest ten/fifty verified wins in the identical published draw stream; all earlier draws accounted for. Extra speculative draws excluded.',
    excludedAhead: merged.reduce((sum, row) => sum + row.excludedAhead, 0) };
  const evidence = { header: { type: 'header', kind: 'consolidated-frozen-executors', manifestHash: manifest.hash,
    split: config.split, protocolHash: digest(protocol), sourceHash: digest(provenance) },
    draws: merged.flatMap(row => row.prefix), boards: merged.map(row => row.board),
    footer: { sourceUnchanged: true }, provenance };
  const selected = assemble(manifest, config.split, [evidence]);
  selected.selection.construction = provenance;
  const { hash, ...payload } = selected; selected.hash = digest(payload); validateManifest(selected);
  assertRawOutput(output); assert(!fs.existsSync(output));
  fs.writeFileSync(output + '.evidence.json', JSON.stringify(evidence), { flag: 'wx' });
  fs.writeFileSync(output, JSON.stringify(selected), { flag: 'wx' });
  return selected;
}

function main(command, ...args) {
  if (command === 'assemble') {
    assert.equal(args.length, 2);
    const selected = consolidate(JSON.parse(fs.readFileSync(args[0])), args[1]);
    console.log(JSON.stringify({ manifestHash: selected.hash, boards: selected.entries.length })); return;
  }
  assert(['range', 'resume'].includes(command)); assert.equal(args.length, 7);
  const [manifestFile, referenceFile, level, split, start, end, output] = args;
  runRange(JSON.parse(fs.readFileSync(manifestFile)), readHeader(referenceFile),
    Number(level), split, Number(start), Number(end), output, command === 'resume');
}

if (require.main === module) { try { main(...process.argv.slice(2)); } catch (error) { console.error(error); process.exitCode = 1; } }
module.exports = { verifySource, readRange, mergePrefix, runRange, consolidate };
