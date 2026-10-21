'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const { chromium } = require('playwright'), { PNG } = require('pngjs');
const { createPage } = require('./personal_render_page.js');
const { compile } = require('./public_pixel_partition.js');
const { prototype } = require('./personal_pixel_opening_prototype.js');
const { SYMBOLS, uniformPrior } = require('./personal_public_picture_prior.js');
const { roundedContains } = require('./public_tile_pixels.js');
const Layouts = require('../../../www/layouts.js');
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function crop(image, rectangle) {
  const pixels = Buffer.alloc(rectangle.width * rectangle.height * 4);
  for (let row = 0; row < rectangle.height; row++) image.data.copy(pixels, row * rectangle.width * 4,
    ((rectangle.top + row) * image.width + rectangle.left) * 4,
    ((rectangle.top + row) * image.width + rectangle.left + rectangle.width) * 4);
  return pixels;
}

async function region(page, targetIndex = 0, excludeForeground = true) {
  assert(Number.isInteger(targetIndex) && targetIndex >= 0);
  assert.equal(typeof excludeForeground, 'boolean');
  return page.evaluate(({ targetIndex, excludeForeground }) => {
    const target = G.tiles[targetIndex], box = target.el.getBoundingClientRect();
    const rectangle = { left: Math.floor(box.left), top: Math.floor(box.top),
      width: Math.ceil(box.right) - Math.floor(box.left), height: Math.ceil(box.bottom) - Math.floor(box.top) };
    const higher = G.tiles.filter((tile, index) => index !== targetIndex && G.alive[index] && +tile.el.style.zIndex > +target.el.style.zIndex)
      .map(tile => { const bounds = tile.el.getBoundingClientRect(); return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }; });
    const mask = [];
    for (let row = 0; row < rectangle.height; row++) for (let column = 0; column < rectangle.width; column++) {
      const horizontal = rectangle.left + column + .5, vertical = rectangle.top + row + .5;
      const interior = publicRoundedContains(horizontal, vertical, box, 1);
      mask.push(+(interior && (!excludeForeground || !higher.some(upper => horizontal >= upper.left - 1 && horizontal <= upper.right + 1
        && vertical >= upper.top - 1 && vertical <= upper.bottom + 1))));
    }
    return { rectangle, mask, box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, higher };
  }, { targetIndex, excludeForeground });
}

function capture(engine, tiles, picture, mask) {
  let snapshot;
  const game = { tiles, nb: Layouts.neighbors(tiles), faces: [picture, picture, 3, 3, 4, 4], down: Array(6).fill(0),
    rules: null, clock: null, captureValue: true, valueLog: true, policyLog: [], publicPixelKnown: mask };
  const result = engine.play(game, { ...engine.P, physicalFlips: true, allMoves: true, forceMatches: false,
    peek: 0, end: 0, plan: 0, physicalPlan: 0, kindModel: { weights: {} }, publicPicturePrior: Array.from(uniformPrior()),
    physicalTrayPlanning: (publicGame, state, actions) => { snapshot = state; return { features: actions.map(() => []), nodes: 0, boundaries: 0 }; } }, 1);
  assert.equal(result.why, 'valueCapture'); return { snapshot, decision: game.capturedValue };
}

async function main() {
  const made = new Date().toISOString(), folder = path.join(root, 'analysis/archive/personal-bots/pixel-partition-' + made.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder);
  const sources = ['www/style.css', 'www/tiles.js', 'www/layouts.js', 'www/js/board.js', 'www/hard.js',
    'tools/sim/refit/public_pixel_partition.js', 'tools/sim/refit/personal_render_page.js',
    'tools/sim/refit/personal_pixel_opening_prototype.js', 'tools/sim/refit/personal_pixel_partition_audit.js',
    'tools/sim/refit/personal_public_picture_prior.js', 'tools/sim/refit/public_tile_pixels.js'];
  const sourceHashes = Object.fromEntries(sources.map(relative => [relative, hash(fs.readFileSync(path.join(root, relative)))]));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined }), results = [], banks = [];
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 6, z: 0 }, { x: -1, y: 0, z: 1 },
    { x: 1, y: 0, z: 1 }, { x: -1, y: 6, z: 1 }, { x: 1, y: 6, z: 1 }];
  try {
    const page = await createPage(browser, 420, 720);
    await page.addScriptTag({ content: 'const publicRoundedContains=' + roundedContains.toString() + ';' });
    for (const theme of ['sunflower', 'animals', 'classic']) for (const phase of ['uncovered', 'occluded', 'partial']) {
      await page.evaluate(({ tiles, theme, phase }) => {
        S.theme = theme;
        G = { tiles: tiles.map((tile, index) => ({ ...tile, face: index < 2 ? 0 : index < 4 ? 3 : 4 })),
          nb: Layouts.neighbors(tiles), alive: Uint8Array.from(tiles, (tile, index) => +(index < 2 || phase === 'occluded' || phase === 'partial' && index % 2)),
          down: new Uint8Array(tiles.length), peek: -1, gold: new Set(), clock: null, mv: 0 };
        renderBoard(false);
      }, { tiles, theme, phase });
      await page.evaluate(() => document.fonts.ready);
      const area = await region(page), templates = [];
      let baseline, outsideFootprint = 0;
      const footprintFailures = [];
      for (const picture of SYMBOLS) {
        await page.evaluate(picture => { G.tiles[0].face = picture; setFace(0); }, picture);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        const image = PNG.sync.read(await page.screenshot({ animations: 'disabled' }));
        if (!baseline) { baseline = image.data; fs.writeFileSync(path.join(folder, theme + '-' + phase + '-baseline.png'), PNG.sync.write(image), { flag: 'wx' }); }
        let outside = 0;
        const bounds = { left: image.width, top: image.height, right: 0, bottom: 0 };
        if (phase === 'uncovered') for (let pixel = 0; pixel < image.width * image.height; pixel++) {
          const horizontal = pixel % image.width + .5, vertical = Math.floor(pixel / image.width) + .5;
          if (roundedContains(horizontal, vertical, area.box, -1)) continue;
          for (let channel = 0; channel < 4; channel++) if (image.data[pixel * 4 + channel] !== baseline[pixel * 4 + channel]) {
            outsideFootprint++; outside++;
            bounds.left = Math.min(bounds.left, horizontal); bounds.right = Math.max(bounds.right, horizontal);
            bounds.top = Math.min(bounds.top, vertical); bounds.bottom = Math.max(bounds.bottom, vertical); break;
          }
        }
        if (outside) {
          footprintFailures.push({ picture, outside, bounds });
          if (footprintFailures.length === 1) fs.writeFileSync(path.join(folder, theme + '-footprint-failure.png'), PNG.sync.write(image), { flag: 'wx' });
        }
        templates.push({ picture, pixels: Array.from(crop(image, area.rectangle)) });
      }
      if (outsideFootprint) fs.writeFileSync(path.join(folder, 'footprint-failure.json'), JSON.stringify({ theme, phase, area, footprintFailures }), { flag: 'wx' });
      assert.equal(outsideFootprint, 0, 'Public glyph footprint exceeds the conservative occluder bound');
      const read = compile(templates, area.mask), observations = [];
      for (const picture of [2, 4]) {
        await page.evaluate(picture => { G.tiles[0].face = picture; G.tiles[1].face = picture; setFace(0); setFace(1); }, picture);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        const bytes = await page.screenshot({ animations: 'disabled' }), observed = read(crop(PNG.sync.read(bytes), area.rectangle));
        if (!observed.pictures.includes(picture)) {
          const actual = crop(PNG.sync.read(bytes), area.rectangle), expected = templates.find(template => template.picture === picture).pixels;
          const differences = area.mask.flatMap((selected, pixel) => selected && [0, 1, 2, 3].some(channel => actual[pixel * 4 + channel] !== expected[pixel * 4 + channel])
            ? [{ horizontal: area.rectangle.left + pixel % area.rectangle.width, vertical: area.rectangle.top + Math.floor(pixel / area.rectangle.width),
              actual: Array.from(actual.subarray(pixel * 4, pixel * 4 + 4)), expected: expected.slice(pixel * 4, pixel * 4 + 4) }] : []);
          fs.writeFileSync(path.join(folder, 'recognition-failure.json'), JSON.stringify({ theme, phase, picture, area, observed, groups: read.groups(), differences }), { flag: 'wx' });
          fs.writeFileSync(path.join(folder, 'recognition-failure.png'), bytes, { flag: 'wx' });
        }
        assert(observed.pictures.includes(picture), JSON.stringify({ theme, phase, picture, observed }));
        const filename = theme + '-' + phase + '-' + picture + '.png'; fs.writeFileSync(path.join(folder, filename), bytes, { flag: 'wx' });
        observations.push({ picture, observed, filename, sha256: hash(bytes) });
      }
      if (phase === 'occluded') {
        assert.equal(observations[0].observed.known, null); assert.equal(observations[1].observed.known, null);
        assert.deepEqual(observations[0].observed, observations[1].observed);
      }
      const groups = read.groups();
      if (phase === 'partial') assert(groups.some(group => group.length === 1), 'Partial observation discarded all useful identity information');
      results.push({ theme, phase, area, groups, dictionaryId: read.dictionaryId, outsideFootprint, observations });
      banks.push({ theme, phase, templates, mask: area.mask, rectangle: area.rectangle });
    }
    const compiled = prototype(), captures = [2, 4].map(picture => capture(compiled.engine, tiles, picture, [0, 0, 1, 1, 1, 1]));
    assert.deepEqual(captures[0], captures[1]);
    for (const [relative, expected] of Object.entries(sourceHashes)) {
      assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
      const copied = path.join(folder, 'sources', relative); fs.mkdirSync(path.dirname(copied), { recursive: true }); fs.copyFileSync(path.join(root, relative), copied);
    }
    const bankBytes = zlib.gzipSync(JSON.stringify(banks)); fs.writeFileSync(path.join(folder, 'templates.json.gz'), bankBytes, { flag: 'wx' });
    fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ made, targetMet: false, sourceHashes, browser: await browser.version(),
      animationSampling: 'disabled-static-reference-frame', antialiasingFootprintMarginPixels: 1,
      maskVersion: 'rounded-target-visible-edges-box-occluders-v2',
      tiles, results, actualOpeningCaptures: captures, templateBankSha256: hash(bankBytes),
      prototype: { originalSha256: compiled.originalSha256, prototypeSha256: compiled.prototypeSha256 },
      note: 'The recognizer receives observed pixels, a public37-symbol dictionary and an identity-independent '
        + 'conservative visible-pixel mask including exposed symbol edges, never the true target face. Dictionary hashes exclude unobserved '
        + 'pixels. Templates are static glyph hypotheses, not future move/reveal simulations. Fully occluded '
        + 'symbols remain ambiguous; partial symbols retain singleton classes where pixels support them. '
        + 'This scoped fixture verifies glyph footprint bounds and public current-scene occluders. Mask '
        + 'construction is conservative, not a proof of complete human perception or general foreground '
        + 'independence in every production state. Animation is disabled for a stable public reference '
        + 'frame; live animated-Joker phase recognition is not established. The one-pixel antialiasing '
        + 'margin also expands conservative rectangular occluder masks, including their corner antialiasing '
        + 'and excluding some potentially recognizable edges. Host fonts/browser remain explicit. An isolated capture-only '
        + 'Hard prototype consumes the derived unknown masks and removes the confirmed opening leakage. '
        + 'No root runtime edit, dynamic episode integration, perfect play or80% count accuracy is claimed.' }), { flag: 'wx' });
    console.log(JSON.stringify({ folder, results: results.map(result => ({ theme: result.theme, phase: result.phase,
      visiblePixels: result.area.mask.reduce((sum, value) => sum + value, 0), groups: result.groups.length,
      singletons: result.groups.filter(group => group.length === 1).length })), actualOpeningInvariant: true }));
  } finally { await browser.close(); }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { crop, region, capture, main };
