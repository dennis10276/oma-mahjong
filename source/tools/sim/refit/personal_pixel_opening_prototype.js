'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), Module = require('module'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../../..'), filename = path.join(root, 'www/hard.js');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function prototype() {
  const original = fs.readFileSync(filename, 'utf8'), normalized = original.replace(/\r\n/g, '\n');
  const before = '    const sees = i => (can(i) && looked(i)) || (!down[i] && !hiddenNow(i)) || (mem !== null && mem[i] === 1);';
  assert.equal(normalized.split(before).length, 2, 'Pixel-opening source anchor changed');
  const after = `    if (g.publicPixelKnown !== undefined && (!g.captureValue || !p.publicPicturePrior || !Array.isArray(g.publicPixelKnown)
      || g.publicPixelKnown.length !== n || g.publicPixelKnown.some(value => value !== 0 && value !== 1))) throw new Error('Pixel prototype accepts validated opening capture masks only');
    const sees = i => (g.publicPixelKnown ? !!g.publicPixelKnown[i] : (can(i) && looked(i)) || (!down[i] && !hiddenNow(i))) || (mem !== null && mem[i] === 1);`;
  const source = normalized.replace(before, after), compiled = new Module(filename, module);
  compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename)); compiled._compile(source, filename);
  return { engine: compiled.exports, originalSha256: hash(original), prototypeSha256: hash(source),
    note: 'Isolated opening-capture consumer for externally rendered pixel recognition. No root edit, '
      + 'no autonomous play, no dynamic visibility update or perfect-information claim. Earlier actual memory remains separate.' };
}

module.exports = { prototype };
