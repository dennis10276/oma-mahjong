'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const { chromium } = require('playwright'), { PNG } = require('pngjs');
const Layouts = require('../../../www/layouts.js');
const { createProductionPage, drawSession } = require('./production_scene_renderer.js');
const { createSession } = require('./production_physical_session.js');
const { observe } = require('./public_pixel_capture.js');
const { supportOf } = require('./personal_pixel_capture_verify.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const OPTIONS = Object.freeze({ ...REFERENCE_PARAMETERS, continuationPruning: false });
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function fixture(name, faces, changes = {}) {
  const tiles = faces.map((face, index) => ({ x: index * 8, y: 0, z: 0 }));
  return { name, game: { tiles, nb: Layouts.neighbors(tiles), faces, down: faces.map(() => 0), rules: null, clock: null, ...changes } };
}

async function main(templateMode = 'serial') {
  assert(['serial', 'parallel'].includes(templateMode));
  const made = new Date().toISOString(), folder = path.join(root, 'analysis/archive/personal-bots/pixel-session-' + made.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder);
  const sourceFiles = [...new Set(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
    .map(filename => path.relative(root, filename).replace(/\\/g, '/')).concat(['www/style.css', 'www/tiles.js', 'www/js/board.js', 'www/js/specials.js']))];
  const sourceHashes = Object.fromEntries(sourceFiles.map(relative => [relative, hash(fs.readFileSync(path.join(root, relative)))]));
  for (const relative of sourceFiles) {
    const target = path.join(folder, 'sources', relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, relative), target);
  }
  const offsetTiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 6, z: 0 }, { x: -1, y: 0, z: 1 },
    { x: 1, y: 0, z: 1 }, { x: -1, y: 6, z: 1 }, { x: 1, y: 6, z: 1 }];
  const obstacleTiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
    { x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }, { x: 4, y: 2, z: 0 }];
  const fixtures = [fixture('visiblePairs', [1, 1, 2, 2]), fixture('inspections', [1, 1, 2, 2], { down: [1, 1, 1, 1] }),
    fixture('clockExit', [1, 1], { clock: { i: 1, n: 1 } }), fixture('jokerFinale', [101]),
    fixture('offsetReveal', [2, 2, 3, 3, 4, 4], { tiles: offsetTiles, nb: Layouts.neighbors(offsetTiles) }),
    fixture('iceAndKeys', [2, 3, 1, 3, 2, 1], { tiles: obstacleTiles, nb: Layouts.neighbors(obstacleTiles),
      clock: { i: 0, n: 6 }, rules: { ice: { 0: 2 }, iceNb: Layouts.iceNeighbors(obstacleTiles), locks: new Set([3, 4]), keys: [2, 5] } })];
  fs.writeFileSync(path.join(folder, 'config.json'), JSON.stringify({ made, targetMet: false, sourceHashes,
    fixtures: fixtures.map(entry => ({ ...entry, game: { ...entry.game, rules: entry.game.rules
      ? { ...entry.game.rules, locks: Array.from(entry.game.rules.locks || []) } : null } })), templateMode,
    witnessOptions: OPTIONS, maximumFrames: 32, displayMode: 'offline-settled-static-animation-and-transition-none-not-live-game-timing',
    ruleDisclosure: 'The tiny iceAndKeys fixture explicitly supplies its all-uncovered geometry and obstacle rules to planning; this is not general screenshot-derived role recognition.' }), { flag: 'wx' });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
  const results = [], artifacts = {};
  try {
    const page = await createProductionPage(browser, 420, 720);
    for (const entry of fixtures) {
      const session = createSession(entry.game), memory = entry.game.tiles.map(() => null), frames = [];
      const geometry = { tiles: entry.game.tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })),
        nb: Layouts.neighbors(entry.game.tiles), rules: entry.game.rules ? structuredClone(entry.game.rules) : null,
        clock: entry.game.clock ? { ...entry.game.clock } : null };
      Object.defineProperty(geometry, 'faces', { get() { throw Error('Planner read private deck'); } });
      for (const tile of geometry.tiles) Object.defineProperty(tile, 'face', { get() { throw Error('Planner read private tile identity'); } });
      let stopped = null;
      for (let position = 0; position < 32; position++) {
        const frame = session.view();
        await drawSession(page, entry.game, frame);
        await page.evaluate(() => { globalThis.pixelSessionWorld = G; G = new Proxy({}, { get() { throw Error('Observer read private world'); } }); });
        const guarded = new Proxy(page, { get(target, key) {
          if (key === 'content') throw Error('Observer read original hidden markup');
          const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
        } });
        const banks = [], observed = await observe(guarded, async (index, bank) => { banks.push({ index, bank }); }, { templateMode });
        await page.evaluate(() => { G = pixelSessionWorld; delete globalThis.pixelSessionWorld; });
        const stem = entry.name + '-' + position, image = PNG.sync.read(observed.bytes);
        fs.writeFileSync(path.join(folder, stem + '.png'), observed.bytes, { flag: 'wx' }); artifacts[stem + '.png'] = hash(observed.bytes);
        fs.writeFileSync(path.join(folder, stem + '-after.png'), observed.restoredBytes, { flag: 'wx' }); artifacts[stem + '-after.png'] = hash(observed.restoredBytes);
        assert.deepEqual(image.data, PNG.sync.read(observed.restoredBytes).data);
        const earlier = [], bankFiles = [];
        for (const { index, bank } of banks) {
          assert.deepEqual(bank.publicRecognizedContext, earlier);
          const calculated = supportOf({ ...bank, templates: bank.templates.map(template => ({ picture: template.picture, pixels: Array.from(template.pixels) })) }, image);
          const actual = observed.rows[index].observation;
          for (const [field, value] of Object.entries(calculated)) assert.deepEqual(actual[field], value);
          assert(actual.pictures.includes(entry.game.faces[index]));
          if (actual.known !== null) { assert.equal(actual.known, entry.game.faces[index]); earlier.push({ index, picture: actual.known }); }
          const bytes = zlib.gzipSync(JSON.stringify({ ...bank, templates: bank.templates.map(template => ({ picture: template.picture, pixels: Array.from(template.pixels) })) }));
          const filename = stem + '-tile' + index + '.json.gz'; fs.writeFileSync(path.join(folder, filename), bytes, { flag: 'wx' });
          artifacts[filename] = hash(bytes); bankFiles.push(filename);
        }
        for (const row of observed.rows) if (row.alive && row.observation.known !== null) {
          assert(memory[row.index] === null || memory[row.index] === row.observation.known, 'Contradictory observed identity');
          memory[row.index] = row.observation.known;
        }
        const state = { ...frame.state, pictures: memory.map((picture, index) => frame.state.alive[index] ? picture : null),
          down: frame.state.down.map((value, index) => memory[index] !== null || frame.legalTiles.includes(index) ? value : 0) };
        const saved = { position, frame, observations: observed.rows, memory: memory.slice(), bankFiles, plan: null };
        frames.push(saved);
        if (frame.type === 'productionPhysicalEnd-v1') break;
        if (state.openPeek >= 0 && state.pictures[state.openPeek] === null) { stopped = 'unresolvedPeekRecognition'; break; }
        const plan = search(geometry, state, frame.legalTiles.map(index => ({ index })), OPTIONS); saved.plan = plan;
        if (plan.unsupportedTransitions) { stopped = 'unresolvedPublicPhysics'; break; }
        session.tap(plan.index);
      }
      const final = session.view(), audit = session.audit();
      if (final.type !== 'productionPhysicalEnd-v1' && !stopped) stopped = 'unresolvedAuditFrameBudget';
      const value = { name: entry.name, frames, final, stopped, audit };
      const bytes = JSON.stringify(value); fs.writeFileSync(path.join(folder, entry.name + '.json'), bytes, { flag: 'wx' });
      artifacts[entry.name + '.json'] = hash(bytes);
      results.push({ name: entry.name, frames: frames.length, taps: audit.physicalLog.length, win: final.win ?? null,
        why: final.why || null, stopped, moves: final.state.moves, firstTap: audit.physicalLog[0]?.index ?? null });
      fs.appendFileSync(path.join(folder, 'progress.jsonl'), JSON.stringify(results.at(-1)) + '\n');
      assert.equal(stopped, null, JSON.stringify(results.at(-1))); assert.equal(final.win, true, JSON.stringify(results.at(-1)));
      if (entry.name === 'clockExit') assert.equal(audit.physicalLog[0].index, 1);
    }
    for (const [relative, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
    fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ made, targetMet: false, templateMode, sourceHashes, artifacts, results,
      observationVersion: 2, witnessOptions: OPTIONS,
      note: 'Settled-frame dynamic screenshot/reference smoke test on six declared tiny fixtures, not the25-case strength benchmark. Actual production specials.js computes key/lock and ice overlays; offline visual/audio crack effects and animation/transition sampling are disabled. Production physical tap times/clock costs are unchanged. Private real faces are used only by the trusted renderer and independent truth assertions, never supplied to recognition or witness search. Search receives screenshot singleton memory, explicit public geometry/clock and masked unknown covered down flags; legal taps are production geometry-checked. The iceAndKeys fixture explicitly discloses its all-uncovered obstacle geometry to planning; no general pixel-role recognition is claimed. No old personal coefficients, counterfactual hidden reveal, free retry or changed clock cost. Hard relief remains refused until production parity is validated. Broader structural visibility, role recognition/uncertainty, animated/flight recognition, perception errors and full real-level performance remain unvalidated.' }), { flag: 'wx' });
    console.log(JSON.stringify({ folder, results }));
  } catch (error) {
    fs.writeFileSync(path.join(folder, 'failure.json'), JSON.stringify({ made: new Date().toISOString(), error: error.stack, artifacts }), { flag: 'wx' });
    throw error;
  } finally { await browser.close(); }
}

if (require.main === module) main(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
