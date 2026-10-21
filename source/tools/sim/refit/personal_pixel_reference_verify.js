'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const { PNG } = require('pngjs');
const { supportOf } = require('./personal_pixel_capture_verify.js');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function replayPrior() {
  return Array.from({ length: 256 }, (unused, picture) => picture < 36 || picture === 101 ? 1 / 37 : 0);
}

function main(directory) {
  const folder = path.resolve(directory), read = relative => {
    const filename = path.resolve(folder, relative); assert(filename.startsWith(folder + path.sep)); return fs.readFileSync(filename);
  };
  const reportBytes = read('report.json'), report = JSON.parse(reportBytes), input = JSON.parse(read('input.json'));
  const targetOpaqueInset = input.pixelMask?.targetOpaqueInset ?? 1;
  assert([1, 1.5].includes(targetOpaqueInset));
  assert.deepEqual(report.sourceHashes, input.sourceHashes);
  for (const [relative, expected] of Object.entries(report.sourceHashes)) assert.equal(hash(read('sources/' + relative)), expected);
  for (const [relative, expected] of Object.entries(report.artifacts)) assert.equal(hash(read(relative)), expected);
  const game = input.entry.game, memory = game.tiles.map(() => null), actions = [];
  const alphabet = Array.from({ length: 36 }, (unused, index) => index).concat(101);
  let verifiedBanks = 0, verifiedRecalls = 0, verifiedUninformative = 0;
  for (let position = 0; position < report.frames; position++) {
    const saved = JSON.parse(read(position + '.json')), image = PNG.sync.read(read(position + '.png'));
    assert.equal(saved.position, position); assert.equal(saved.frame.state.physicalTaps, position);
    assert(image.data.equals(PNG.sync.read(read(position + '-after.png')).data));
    const banks = new Map(saved.bankFiles.map(filename => {
      const match = filename.match(/^(\d+)-tile(\d+)\.json\.gz$/); assert(match && +match[1] === position);
      return [+match[2], JSON.parse(zlib.gunzipSync(read(filename)))];
    }));
    assert.equal(banks.size, saved.bankFiles.length);
    const context = [], sources = [], previous = structuredClone(memory), seen = new Set();
    const paintOrder = saved.scene.tiles.map((tile, offset) => ({ ...tile, offset }))
      .sort((left, right) => right.zIndex - left.zIndex || right.offset - left.offset);
    for (const tile of paintOrder) {
      const index = tile.index, row = saved.observations[index]; assert(!seen.has(index)); seen.add(index);
      assert.equal(row.index, index); assert.equal(+row.alive, saved.frame.state.alive[index]);
      assert.equal(row.alive, tile.alive);
      if (!row.alive) { assert.equal(row.observation, null); assert(!banks.has(index)); continue; }
      if (row.recall) {
        assert.deepEqual(row.recall, previous[index]); assert(row.recall.firstObserved.physicalTaps < position);
        assert.equal(hash(read(row.recall.firstObserved.physicalTaps + '.png')), row.recall.firstObserved.imageSha256);
        assert(!banks.has(index)); context.push({ index, picture: row.recall.picture });
        sources.push({ index, source: 'memory', firstObserved: row.recall.firstObserved }); verifiedRecalls++; continue;
      }
      if (row.uninformative) {
        assert(!banks.has(index)); assert.equal(row.observation.known, null); assert.deepEqual(row.observation.pictures, alphabet);
        assert.equal(row.observation.reason, 'noSafeVisiblePixels'); assert.equal(row.observation.visiblePixels, 0);
        if (row.uninformative === 'back') {
          assert(tile.classes.includes('back')); assert(saved.frame.state.down[index]); assert.notEqual(saved.frame.state.openPeek, index);
          assert.equal(row.observation.method, 'public-css-hidden-face-v1');
        } else {
          assert.equal(row.uninformative, 'opaque'); assert.equal(row.observation.method, 'public-zero-safe-mask-v1');
          const box = tile.bounds, depth = parseFloat(saved.scene.depth || '0');
          const higher = paintOrder.slice(0, paintOrder.indexOf(tile)).filter(entry => entry.alive);
          const contains = (horizontal, vertical, bounds, inset) => {
            const width = bounds.right - bounds.left, height = bounds.bottom - bounds.top;
            const left = bounds.left + inset, right = bounds.right - inset, top = bounds.top + inset, bottom = bounds.bottom - inset;
            if (horizontal < left || horizontal > right || vertical < top || vertical > bottom) return false;
            const horizontalRadius = width * .14, verticalRadius = height * .14;
            const horizontalDistance = Math.max(bounds.left + horizontalRadius - horizontal, 0, horizontal - bounds.right + horizontalRadius);
            const verticalDistance = Math.max(bounds.top + verticalRadius - vertical, 0, vertical - bounds.bottom + verticalRadius);
            const threshold = 1 - inset / Math.min(horizontalRadius, verticalRadius);
            return (horizontalDistance / horizontalRadius) ** 2 + (verticalDistance / verticalRadius) ** 2 <= threshold ** 2;
          };
          const opaque = higher.flatMap(entry => [[0, 0], [depth * .5, depth * .6], [depth, depth * 1.2]].map(([horizontal, vertical]) => ({
            left: entry.bounds.left + horizontal, right: entry.bounds.right + horizontal,
            top: entry.bounds.top + vertical, bottom: entry.bounds.bottom + vertical,
            inset: context.some(known => known.index === entry.index) ? 1 : -1 })));
          for (let vertical = Math.floor(box.top); vertical < Math.ceil(box.bottom); vertical++) for (let horizontal = Math.floor(box.left); horizontal < Math.ceil(box.right); horizontal++) {
            assert(!contains(horizontal + .5, vertical + .5, box, targetOpaqueInset)
              || opaque.some(bounds => contains(horizontal + .5, vertical + .5, bounds, bounds.inset)));
          }
        }
        verifiedUninformative++; continue;
      }
      const bank = banks.get(index); assert(bank); assert.deepEqual(bank.publicRecognizedContext, context); assert.deepEqual(bank.publicContextSources, sources);
      const calculated = supportOf(bank, image);
      for (const [key, value] of Object.entries(calculated)) assert.deepEqual(row.observation[key], value);
      assert(calculated.pictures.includes(game.faces[index])); verifiedBanks++;
      if (calculated.known !== null) {
        assert.equal(calculated.known, game.faces[index]); assert.equal(previous[index], null);
        memory[index] = { picture: calculated.known, firstObserved: { physicalTaps: position,
          imageSha256: hash(read(position + '.png')), dictionaryId: row.observation.dictionaryId } };
        context.push({ index, picture: calculated.known }); sources.push({ index, source: 'currentPixels' });
      }
    }
    assert.equal(seen.size, game.tiles.length); assert.deepEqual(saved.memory, memory);
    if (saved.plan && !report.stopped) actions.push(saved.plan.index);
    else if (saved.plan && position < report.frames - 1) actions.push(saved.plan.index);
  }
  const physical = JSON.parse(read('physical-audit.json'));
  assert.deepEqual(actions, physical.physicalLog.map(action => action.index));
  assert(physical.physicalLog.every(action => ['flip', 'take'].includes(action.kind)));
  const Hard = require(path.join(folder, 'sources/www/hard.js'));
  const replay = { ...game, down: Uint8Array.from(game.down), rules: game.rules ? { ...game.rules,
    locks: game.rules.locks ? new Set(game.rules.locks) : null } : null, physicalLog: [], log: [],
    follow: physical.physicalLog.map(action => action.kind === 'flip' ? -action.index - 1 : action.index) };
  const prior = replayPrior();
  const result = Hard.play(replay, { ...Hard.P, physicalFlips: true, physicalSingleStep: false, allMoves: true, flips: true,
    forceMatches: false, peek: 0, end: 0, plan: 0, keyPlan: 0, physicalPlan: 0, physicalKeyPlan: 0,
    physicalSafety: false, physicalFollowThrough: false, physicalPairFollowThrough: false, search: 0,
    kindModel: { weights: {} }, publicPicturePrior: prior, tapMs: input.settings.tapMs }, input.settings.seed);
  assert.deepEqual(replay.physicalLog, physical.physicalLog);
  if (physical.result && !report.final.computationCensored) for (const key of ['win', 'why', 'moves', 'left', 'tray']) assert.deepEqual(result[key], physical.result[key]);
  assert.equal(verifiedBanks, report.classifiedTiles); assert.equal(verifiedRecalls, report.recalledTiles);
  assert.equal(verifiedUninformative, report.uninformativeTiles);
  const value = { made: new Date().toISOString(), targetMet: false, reportSha256: hash(reportBytes),
    verificationSourceSha256: hash(fs.readFileSync(__filename)), verifiedFrames: report.frames, verifiedBanks, verifiedRecalls,
    verifiedUninformative, verifiedOriginalProductionPhysicalTaps: replay.physicalLog.length,
    note: 'Independent archived source/artifact/image hashes, direct pixel-support arithmetic, earlier-only memory/context provenance, zero-safe geometry, and original unmodified production Hard follow replay. Hidden-back recognition relies on the pinned CSS-hidden face contract, not a general arbitrary-theme perception proof. This single-board integration is not the full25-case benchmark or future80% personal prediction evidence.' };
  fs.copyFileSync(__filename, path.join(folder, 'independent-reference-verify-source.js'), fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(path.join(folder, 'independent-reference-verify.json'), JSON.stringify(value), { flag: 'wx' });
  console.log(JSON.stringify(value));
}

if (require.main === module) main(process.argv[2]);
module.exports = { main, replayPrior };
