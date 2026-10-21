'use strict';
const assert = require('assert/strict'), crypto = require('crypto');
const { compile: exactDictionary } = require('./public_pixel_partition.js');
const { SYMBOLS } = require('./personal_public_picture_prior.js');

function compile(templates, mask, tolerance = 1, alphabet = SYMBOLS) {
  assert(Number.isInteger(tolerance) && tolerance >= 0 && tolerance <= 1);
  const exact = exactDictionary(templates, mask, alphabet);
  const positions = Array.from(mask).flatMap((selected, index) => selected ? [index * 4] : []);
  const valuesOf = pixels => positions.flatMap(position => [0, 1, 2, 3].map(channel => pixels[position + channel]));
  const candidates = templates.map(template => ({ picture: template.picture, values: valuesOf(template.pixels) }));
  const dictionaryId = crypto.createHash('sha256').update(JSON.stringify([exact.dictionaryId, tolerance])).digest('hex');
  const read = pixels => {
    const original = exact(pixels), values = valuesOf(pixels);
    const found = candidates.filter(candidate => candidate.values.every((value, index) => Math.abs(value - values[index]) <= tolerance))
      .map(candidate => candidate.picture).sort((left, right) => left - right);
    const pictures = found.length ? found : alphabet.slice().sort((left, right) => left - right);
    return { ...original, pictures, known: positions.length && found.length === 1 ? found[0] : null,
      reason: !positions.length ? 'noSafeVisiblePixels' : !found.length ? 'outsideDictionary' : found.length > 1 ? 'ambiguousPixels' : 'identified',
      dictionaryId, method: 'per-channel-bounded-template-support-v1', tolerance };
  };
  read.groups = exact.groups; read.dictionaryId = dictionaryId; return read;
}

module.exports = { compile };
