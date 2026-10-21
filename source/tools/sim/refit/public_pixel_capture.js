'use strict';
const assert = require('assert/strict'), crypto = require('crypto');
const { PNG } = require('pngjs');
const { compile } = require('./public_pixel_match.js');
const { condition } = require('./public_pixel_belief.js');
const { SYMBOLS, uniformPrior } = require('./personal_public_picture_prior.js');
const { crop } = require('./personal_pixel_partition_audit.js');
const { sceneOf, areaOf, templatePageOf } = require('./public_pixel_scene.js');
const { parallelTemplates } = require('./public_pixel_parallel.js');

function knownMask(rows) {
  assert(Array.isArray(rows) && rows.length);
  return rows.map((row, index) => {
    assert.equal(row.index, index);
    assert(typeof row.alive === 'boolean');
    if (!row.alive) { assert.equal(row.observation, null); return 0; }
    condition(Array.from(uniformPrior()), row.observation);
    return +(row.observation.known !== null);
  });
}

async function observe(page, onTemplates = async () => {}, options = {}) {
  assert.equal(typeof onTemplates, 'function');
  assert(Object.keys(options).every(key => key === 'templateMode'));
  const templateMode = options.templateMode ?? 'serial';
  assert(['serial', 'parallel'].includes(templateMode));
  return capture(page, onTemplates, templateMode);
}

async function capture(page, onTemplates, templateMode, recalled = null) {
  await page.evaluate(() => document.fonts.ready);
  const bytes = await page.screenshot({ animations: 'disabled' }), image = PNG.sync.read(bytes);
  const scene = await sceneOf(page), ordered = scene.tiles.slice().sort((left, right) => left.index - right.index);
  const rows = Array(ordered.length), recognized = new Set();
  ordered.forEach((tile, index) => assert.equal(tile.index, index));
  const paintOrder = scene.tiles.map((tile, offset) => ({ ...tile, offset }))
    .sort((left, right) => right.zIndex - left.zIndex || right.offset - left.offset);
  const theme = await page.evaluate(() => S.theme);
  const templatePage = await templatePageOf(page, scene, theme), parallelPages = [];
  try {
    if (templateMode === 'parallel') for (let worker = 0; worker < 4; worker++) parallelPages.push(await templatePageOf(page, scene, theme));
    for (const { index, alive, classes } of paintOrder) {
      if (!alive) { rows[index] = { index, alive: false, observation: null }; continue; }
      if (recalled?.[index]) {
        rows[index] = { index, alive: true, observation: null, recall: structuredClone(recalled[index]) };
        recognized.add(index);
        await templatePage.evaluate(({ index, picture }) => {
          const tile = document.querySelector('.tile[data-i="' + index + '"]');
          tile.querySelector('.face').innerHTML = Tiles.faceHTML(S.theme, picture);
          tile.classList.toggle('sp-joker', picture === 101);
        }, { index, picture: recalled[index].picture });
        continue;
      }
      const area = areaOf(scene, index, recognized), rectangle = area.rectangle;
      assert(rectangle.width > 0 && rectangle.height > 0 && rectangle.left >= 0 && rectangle.top >= 0
        && rectangle.left + rectangle.width <= image.width && rectangle.top + rectangle.height <= image.height,
      'Pixel capture currently requires a complete on-screen tile rectangle');
      if (recalled && (!area.mask.some(Boolean) || classes.includes('back'))) {
        if (classes.includes('back')) assert(await templatePage.evaluate(index =>
          getComputedStyle(document.querySelector('.tile[data-i="' + index + '"] .face')).visibility === 'hidden', index));
        const observation = { type: 'publicPixelPartition-v1', pictures: SYMBOLS.slice(), known: null,
          visiblePixels: 0, reason: 'noSafeVisiblePixels',
          method: classes.includes('back') ? 'public-css-hidden-face-v1' : 'public-zero-safe-mask-v1' };
        rows[index] = { index, alive: true, observation, uninformative: classes.includes('back') ? 'back' : 'opaque',
          belief: condition(Array.from(uniformPrior()), observation) };
        continue;
      }
      const context = [...recognized].map(index => ({ index, picture: rows[index].recall?.picture ?? rows[index].observation.known }));
      const templates = templateMode === 'parallel' ? await parallelTemplates(parallelPages, index, rectangle, context) : [];
      if (templateMode === 'serial') {
        await templatePage.evaluate(index => {
          const tile = document.querySelector('.tile[data-i="' + index + '"]'), original = tile.cloneNode(true);
          globalThis.restorePublicGlyph = () => document.querySelector('.tile[data-i="' + index + '"]').replaceWith(original);
        }, index);
        try {
          for (const picture of SYMBOLS) {
            await templatePage.evaluate(({ index, picture }) => {
              const tile = document.querySelector('.tile[data-i="' + index + '"]');
              tile.querySelector('.face').innerHTML = Tiles.faceHTML(S.theme, picture);
              tile.classList.toggle('sp-joker', picture === 101);
              const board = document.querySelector('#board'); board.replaceWith(board.cloneNode(true));
            }, { index, picture });
            await templatePage.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
            const candidate = PNG.sync.read(await templatePage.screenshot({ animations: 'disabled' }));
            templates.push({ picture, pixels: crop(candidate, rectangle) });
          }
        } finally {
          await templatePage.evaluate(() => restorePublicGlyph());
        }
      }
      assert(await templatePage.evaluate(context => context.every(({ index, picture }) => {
        const tile = document.querySelector('.tile[data-i="' + index + '"]'), normalized = document.createElement('div');
        normalized.innerHTML = Tiles.faceHTML(S.theme, picture);
        return tile.querySelector('.face').innerHTML === normalized.innerHTML && tile.classList.contains('sp-joker') === (picture === 101);
      }), context), 'Template foreground must contain only the archived screenshot-recognized glyphs');
      const read = compile(templates, area.mask), observation = read(crop(image, rectangle));
      await onTemplates(index, { templates, mask: area.mask, rectangle, tolerance: 1,
        publicRecognizedContext: context, ...(recalled ? { publicContextSources: [...recognized].map(index => ({ index,
          source: rows[index].recall ? 'memory' : 'currentPixels', ...(rows[index].recall ? { firstObserved: rows[index].recall.firstObserved } : {}) })) } : {}) });
      rows[index] = { index, alive: true, observation, exactDictionaryGroups: read.groups(),
        belief: condition(Array.from(uniformPrior()), observation) };
      if (observation.known !== null) {
        recognized.add(index);
        await templatePage.evaluate(({ index, picture }) => {
          const tile = document.querySelector('.tile[data-i="' + index + '"]');
          tile.querySelector('.face').innerHTML = Tiles.faceHTML(S.theme, picture);
          tile.classList.toggle('sp-joker', picture === 101);
        }, { index, picture: observation.known });
      }
    }
  } finally {
    await Promise.all(parallelPages.map(page => page.close()));
    await templatePage.close();
  }
  const restoredBytes = await page.screenshot({ animations: 'disabled' });
  return { bytes, restoredBytes, rows, known: recalled ? rows.map(row => +(row.alive && (!!row.recall || row.observation.known !== null))) : knownMask(rows) };
}

function createRememberingObserver(options = {}) {
  assert(Object.keys(options).every(key => key === 'templateMode'));
  const templateMode = options.templateMode ?? 'parallel'; assert(['serial', 'parallel'].includes(templateMode));
  let records = null, previous = null;
  return { async read(page, frame, onTemplates = async () => {}) {
    assert.equal(typeof onTemplates, 'function');
    assert(Number.isInteger(frame.state.physicalTaps) && frame.state.physicalTaps >= 0);
    const alive = frame.state.alive;
    assert(Array.isArray(alive) && alive.length && alive.every(value => value === 0 || value === 1));
    if (previous) {
      assert(frame.state.physicalTaps > previous.physicalTaps, 'Observer memory cannot cross a restart or reread the same physical frame');
      assert.equal(alive.length, previous.alive.length);
      assert(alive.every((value, index) => !value || previous.alive[index]), 'Removed tiles cannot silently return to a remembered attempt');
    }
    const retained = records || alive.map(() => null), observed = await capture(page, onTemplates, templateMode, retained);
    assert(observed.rows.every((row, index) => +row.alive === alive[index]));
    const imageSha256 = crypto.createHash('sha256').update(observed.bytes).digest('hex');
    const next = retained.map(record => record ? structuredClone(record) : null);
    for (const row of observed.rows) if (row.alive && !row.recall && row.observation.known !== null) {
      assert.equal(next[row.index], null);
      next[row.index] = { picture: row.observation.known, firstObserved: { physicalTaps: frame.state.physicalTaps,
        imageSha256, dictionaryId: row.observation.dictionaryId } };
    }
    records = next; previous = { alive: alive.slice(), physicalTaps: frame.state.physicalTaps };
    return { ...observed, observationVersion: 3, pictures: next.map((record, index) => alive[index] ? record?.picture ?? null : null),
      memory: structuredClone(next),
      note: 'Only this observer instance creates memory from its own screenshot singletons; no initial picture seed is accepted. Recalled identities are not claimed to be newly recognized pixels. Back faces require CSS-hidden glyphs, zero-safe masks remain unknown, and numerical/recognition uncertainty is not replaced with actual pictures. One instance is confined to a single monotone physical attempt; no shuffle/restart memory contract is provided.' };
  } };
}

module.exports = { knownMask, observe, createRememberingObserver };
