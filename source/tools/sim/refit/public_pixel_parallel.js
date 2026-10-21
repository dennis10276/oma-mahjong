'use strict';
const assert = require('assert/strict');
const { PNG } = require('pngjs');
const { SYMBOLS } = require('./personal_public_picture_prior.js');
const { crop } = require('./personal_pixel_partition_audit.js');

async function parallelTemplates(pages, index, rectangle, context) {
  assert(Array.isArray(pages) && pages.length > 0 && pages.length <= 8);
  assert(Number.isInteger(index) && index >= 0 && Array.isArray(context));
  assert(['left', 'top', 'width', 'height'].every(key => Number.isInteger(rectangle[key]) && rectangle[key] >= 0));
  assert(rectangle.width > 0 && rectangle.height > 0);
  assert(context.every(entry => Number.isInteger(entry.index) && entry.index >= 0 && entry.index !== index && SYMBOLS.includes(entry.picture)));
  assert.equal(new Set(context.map(entry => entry.index)).size, context.length);
  const batches = await Promise.allSettled(pages.map(async (page, worker) => {
    await page.evaluate(({ index, context }) => {
      for (const { index: earlier, picture } of context) {
        const tile = document.querySelector('.tile[data-i="' + earlier + '"]');
        tile.querySelector('.face').innerHTML = Tiles.faceHTML(S.theme, picture);
        tile.classList.toggle('sp-joker', picture === 101);
      }
      const tile = document.querySelector('.tile[data-i="' + index + '"]'), original = tile.cloneNode(true);
      globalThis.restoreParallelGlyph = () => document.querySelector('.tile[data-i="' + index + '"]').replaceWith(original);
    }, { index, context });
    const templates = [];
    try {
      for (const picture of SYMBOLS.filter((value, offset) => offset % pages.length === worker)) {
        await page.evaluate(({ index, picture }) => {
          const tile = document.querySelector('.tile[data-i="' + index + '"]');
          tile.querySelector('.face').innerHTML = Tiles.faceHTML(S.theme, picture);
          tile.classList.toggle('sp-joker', picture === 101);
          const board = document.querySelector('#board'); board.replaceWith(board.cloneNode(true));
        }, { index, picture });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        templates.push({ picture, pixels: crop(PNG.sync.read(await page.screenshot({ animations: 'disabled' })), rectangle) });
      }
    } finally { await page.evaluate(() => restoreParallelGlyph()); }
    return templates;
  }));
  const failed = batches.find(batch => batch.status === 'rejected');
  if (failed) throw failed.reason;
  return batches.flatMap(batch => batch.value).sort((left, right) => SYMBOLS.indexOf(left.picture) - SYMBOLS.indexOf(right.picture));
}

module.exports = { parallelTemplates };
