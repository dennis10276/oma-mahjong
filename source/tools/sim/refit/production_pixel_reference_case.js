'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const { chromium } = require('playwright'), { PNG } = require('pngjs');
const Layouts = require('../../../www/layouts.js');
const { decodeGame } = require('./personal_game_io.js');
const { createProductionPage, drawSession } = require('./production_scene_renderer.js');
const { createSession } = require('./production_physical_session.js');
const { createRememberingObserver } = require('./public_pixel_capture.js');
const { sceneOf, areaOf, TARGET_OPAQUE_INSET } = require('./public_pixel_scene.js');
const { SYMBOLS } = require('./personal_public_picture_prior.js');
const { supportOf } = require('./personal_pixel_capture_verify.js');
const { reference } = require('./public_witness_reference.js');
const { advance } = require('./known_tray_plan.js');
const { REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const SETTINGS = Object.freeze({ seed: 20261111, choiceLimit: 512, tapMs: 1000, maximumFrames: 513 });

function verifyFrame(game, frame, observed, scene, banks, retained) {
  const image = PNG.sync.read(observed.bytes), imageSha256 = hash(observed.bytes), next = structuredClone(retained);
  assert(image.data.equals(PNG.sync.read(observed.restoredBytes).data));
  const ordered = scene.tiles.map((tile, offset) => ({ ...tile, offset }))
    .sort((left, right) => right.zIndex - left.zIndex || right.offset - left.offset);
  const byIndex = new Map(banks.map(entry => [entry.index, entry.bank])); assert.equal(byIndex.size, banks.length);
  const context = [], sources = [], recognized = new Set();
  for (const tile of ordered) {
    const row = observed.rows[tile.index]; assert.equal(row.index, tile.index); assert.equal(+row.alive, frame.state.alive[tile.index]);
    if (!row.alive) { assert.equal(row.observation, null); assert(!byIndex.has(tile.index)); continue; }
    if (row.recall) {
      assert.deepEqual(row.recall, retained[tile.index]); assert(row.recall.firstObserved.physicalTaps < frame.state.physicalTaps);
      assert(!byIndex.has(tile.index));
      context.push({ index: tile.index, picture: row.recall.picture });
      sources.push({ index: tile.index, source: 'memory', firstObserved: row.recall.firstObserved }); recognized.add(tile.index);
      continue;
    }
    if (row.uninformative) {
      assert(!byIndex.has(tile.index)); assert.equal(row.observation.known, null); assert.deepEqual(row.observation.pictures, SYMBOLS);
      if (row.uninformative === 'back') assert(tile.classes.includes('back'));
      else { assert.equal(row.uninformative, 'opaque'); assert(!areaOf(scene, tile.index, recognized).mask.some(Boolean)); }
      continue;
    }
    const bank = byIndex.get(tile.index); assert(bank); assert.deepEqual(bank.publicRecognizedContext, context);
    assert.deepEqual(bank.publicContextSources, sources);
    const calculated = supportOf({ ...bank, templates: bank.templates.map(template => ({ picture: template.picture, pixels: Array.from(template.pixels) })) }, image);
    for (const [key, value] of Object.entries(calculated)) assert.deepEqual(row.observation[key], value);
    assert(calculated.pictures.includes(game.faces[tile.index]));
    if (calculated.known !== null) {
      assert.equal(calculated.known, game.faces[tile.index]); assert.equal(next[tile.index], null);
      next[tile.index] = { picture: calculated.known, firstObserved: { physicalTaps: frame.state.physicalTaps, imageSha256, dictionaryId: row.observation.dictionaryId } };
      context.push({ index: tile.index, picture: calculated.known }); sources.push({ index: tile.index, source: 'currentPixels' }); recognized.add(tile.index);
    }
  }
  assert.deepEqual(observed.memory, next);
  assert.deepEqual(observed.pictures, next.map((record, index) => frame.state.alive[index] ? record?.picture ?? null : null));
  return next;
}

async function main(directory, name, level) {
  const inputFile = path.join(path.resolve(directory), 'input.json'), inputBytes = fs.readFileSync(inputFile), data = JSON.parse(inputBytes);
  const matches = data.cases.filter(entry => entry.name === name && entry.lv === +level); assert.equal(matches.length, 1);
  const entry = matches[0], game = decodeGame(entry.game);
  assert(!Object.keys(game.rules?.ice || {}).length && !(game.rules?.keys || []).length && !(game.rules?.locks?.size || 0),
    'General hidden-role recognition is not validated; this first real-level integration requires an obstacle-free board');
  const made = new Date().toISOString(), folder = path.join(root, 'analysis/archive/personal-bots/pixel-reference-' + made.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder);
  const files = [...new Set(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
    .map(filename => path.relative(root, filename).replace(/\\/g, '/')).concat(['www/style.css', 'www/tiles.js', 'www/js/board.js', 'www/js/specials.js']))];
  const sourceHashes = Object.fromEntries(files.map(relative => [relative, hash(fs.readFileSync(path.join(root, relative)))]));
  for (const relative of files) {
    const target = path.join(folder, 'sources', relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, relative), target);
  }
  const artifacts = {}, write = (filename, bytes) => {
    fs.writeFileSync(path.join(folder, filename), bytes, { flag: 'wx' }); artifacts[filename] = hash(bytes);
  };
  write('input.json', JSON.stringify({ made, targetMet: false, entry, settings: SETTINGS, witnessOptions: REFERENCE_PARAMETERS, observationVersion: 3,
    sourceHashes, pixelMask: { targetOpaqueInset: TARGET_OPAQUE_INSET }, parentInput: path.relative(root, inputFile).replace(/\\/g, '/'), parentInputSha256: hash(inputBytes),
    note: 'One explicitly selected obstacle-free real research board to validate persistent screenshot/memory/production integration. Selection is for missing-mechanic isolation, not a favorable-subset accuracy claim. Not the full25-case milestone or a personal forecast. All unresolved boundaries and actual losses are retained.' }));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
  const session = createSession(game, { seed: SETTINGS.seed, choiceLimit: SETTINGS.choiceLimit, tapMs: SETTINGS.tapMs });
  const observer = createRememberingObserver(), planner = reference(REFERENCE_PARAMETERS), geometry = {
    tiles: game.tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })), nb: Layouts.neighbors(game.tiles), rules: null, clock: game.clock ? { ...game.clock } : null };
  Object.defineProperty(geometry, 'faces', { get() { throw Error('Planner read private deck'); } });
  for (const tile of geometry.tiles) Object.defineProperty(tile, 'face', { get() { throw Error('Planner read private tile identity'); } });
  let retained = game.tiles.map(() => null), stopped = null, frames = 0, classifiedTiles = 0, recalledTiles = 0, uninformativeTiles = 0, knownPhysicsControls = 0;
  try {
    const page = await createProductionPage(browser);
    for (let position = 0; position < SETTINGS.maximumFrames; position++) {
      const frame = session.view(); await drawSession(page, game, frame);
      await page.evaluate(() => { globalThis.pixelReferenceWorld = G; G = new Proxy({}, { get() { throw Error('Observer read private world'); } }); });
      const guarded = new Proxy(page, { get(target, key) {
        if (key === 'content') throw Error('Observer read original hidden markup');
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      const banks = [], bankFiles = [];
      const observed = await observer.read(guarded, frame, async (index, bank) => {
        banks.push({ index, bank }); const filename = position + '-tile' + index + '.json.gz'; bankFiles.push(filename);
        write(filename, zlib.gzipSync(JSON.stringify({ ...bank, templates: bank.templates.map(template => ({ picture: template.picture, pixels: Array.from(template.pixels) })) })));
      });
      const scene = await sceneOf(guarded);
      await page.evaluate(() => { G = pixelReferenceWorld; delete globalThis.pixelReferenceWorld; });
      write(position + '.png', observed.bytes); write(position + '-after.png', observed.restoredBytes);
      retained = verifyFrame(game, frame, observed, scene, banks, retained);
      classifiedTiles += banks.length; recalledTiles += observed.rows.filter(row => row.recall).length;
      uninformativeTiles += observed.rows.filter(row => row.uninformative).length;
      const state = { ...frame.state, pictures: observed.pictures,
        down: frame.state.down.map((value, index) => observed.pictures[index] !== null || frame.legalTiles.includes(index) ? value : 0) };
      const saved = { position, frame, scene, observations: observed.rows, memory: observed.memory, bankFiles, plan: null };
      if (frame.type !== 'productionPhysicalEnd-v1') {
        if (state.openPeek >= 0 && state.pictures[state.openPeek] === null) stopped = 'unresolvedPeekRecognition';
        else {
          planner.physicalTrayPlanning(geometry, state, frame.legalTiles.map(index => ({ index })));
          saved.plan = planner.report();
          if (saved.plan.unsupportedTransitions) stopped = 'unresolvedPublicPhysics';
          else {
            const expected = advance(geometry, state, saved.plan.index);
            planner.acknowledgeTile(saved.plan.index); const next = session.tap(saved.plan.index);
            if (!expected.uncertain) {
              for (const key of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(next.state[key], expected.state[key]);
              knownPhysicsControls++;
            }
          }
        }
      }
      write(position + '.json', JSON.stringify(saved)); frames++;
      fs.appendFileSync(path.join(folder, 'progress.jsonl'), JSON.stringify({ position, left: frame.state.alive.filter(Boolean).length,
        physicalTaps: frame.state.physicalTaps, classifiedTiles, recalledTiles, uninformativeTiles, stopped }) + '\n');
      if (frame.type === 'productionPhysicalEnd-v1' || stopped) break;
    }
    const final = session.view();
    if (final.type !== 'productionPhysicalEnd-v1' && !stopped) stopped = 'unresolvedFrameBudget';
    for (const [relative, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
    assert.equal(hash(fs.readFileSync(inputFile)), hash(inputBytes));
    write('physical-audit.json', JSON.stringify(session.audit()));
    const result = { made, targetMet: false, name, level: +level, frames, classifiedTiles, recalledTiles, uninformativeTiles,
      knownPhysicsControls, stopped, final, planner: planner.stats(), sourceHashes, artifacts,
      note: 'Actual persistent production actions and screenshot-only singleton memory on one real board. Original world/markup reads and planner private pictures throw; truth is used only by the trusted renderer/audit. All pixel banks, memory provenance and known physical transitions are checked. No hypothetical hidden faces, free retry or personal coefficients. Finite integration evidence only; not the full25-case benchmark, general hidden-role/relief/perception proof or80% future human accuracy.' };
    fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify(result), { flag: 'wx' }); console.log(JSON.stringify({ folder, ...result, sourceHashes: undefined, artifacts: undefined }));
  } catch (error) {
    fs.writeFileSync(path.join(folder, 'failure.json'), JSON.stringify({ error: error.stack, artifacts, frames }), { flag: 'wx' }); throw error;
  } finally { await browser.close(); }
}

if (require.main === module) main(process.argv[2], process.argv[3], process.argv[4]).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { verifyFrame };
