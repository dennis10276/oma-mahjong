'use strict';
const assert = require('assert/strict');
const { PNG } = require('pngjs');
const { parallelTemplates } = require('./public_pixel_parallel.js');
const { observe } = require('./public_pixel_capture.js');
const { SYMBOLS } = require('./personal_public_picture_prior.js');

async function test() {
  const makePage = (fail = false) => ({ pictures: [], restored: 0, current: null, context: null,
    async evaluate(fn, argument) {
      if (argument?.context) this.context = argument.context;
      if (argument?.picture !== undefined) { this.current = argument.picture; this.pictures.push(argument.picture); }
      if (String(fn).includes('restoreParallelGlyph()')) this.restored++;
    },
    async screenshot() {
      if (fail) throw Error('Declared screenshot failure');
      return PNG.sync.write({ width: 1, height: 1, data: Buffer.from([this.current, 0, 0, 255]) });
    } });
  const pages = Array.from({ length: 4 }, () => makePage()), rectangle = { left: 0, top: 0, width: 1, height: 1 };
  const context = [{ index: 2, picture: 9 }];
  Object.defineProperty(context[0], 'actualFace', { get() { throw Error('Private picture access'); } });
  const templates = await parallelTemplates(pages, 1, rectangle, context);
  assert.deepEqual(templates.map(template => template.picture), SYMBOLS);
  assert(templates.every(template => template.pixels[0] === template.picture));
  assert.deepEqual(pages.flatMap(page => page.pictures).sort((left, right) => left - right), SYMBOLS.slice().sort((left, right) => left - right));
  assert(pages.every(page => page.restored === 1 && page.context === context));
  const failing = [makePage(true), makePage()];
  await assert.rejects(parallelTemplates(failing, 1, rectangle, context), /Declared screenshot failure/);
  assert(failing.every(page => page.restored === 1));
  assert.equal(failing[1].pictures.length, Math.floor(SYMBOLS.length / 2));
  for (const invalid of [[], Array.from({ length: 9 }, makePage)]) await assert.rejects(parallelTemplates(invalid, 1, rectangle, context));
  await assert.rejects(parallelTemplates(pages, -1, rectangle, context));
  await assert.rejects(parallelTemplates(pages, 1, { ...rectangle, left: -.5 }, context));
  await assert.rejects(parallelTemplates(pages, 1, { ...rectangle, width: 0 }, context));
  await assert.rejects(parallelTemplates(pages, 2, rectangle, context));
  await assert.rejects(parallelTemplates(pages, 1, rectangle, context.concat(context)));
  await assert.rejects(parallelTemplates(pages, 1, rectangle, [{ index: 2, picture: 999 }]));
  await assert.rejects(observe(null, undefined, { templateMode: 'atlas' }));
  await assert.rejects(observe(null, undefined, { templateMode: 'oracle' }));
  await assert.rejects(observe(null, undefined, { actualFaces: [] }));
  console.log('PASS public parallel templates partition the complete alphabet, retain public context/order, restore every worker on failure and reject invalid inputs');
}

if (require.main === module) test().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = test;
