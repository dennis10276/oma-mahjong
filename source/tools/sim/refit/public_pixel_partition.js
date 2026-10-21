'use strict';
const assert = require('assert/strict'), crypto = require('crypto');
const { SYMBOLS } = require('./personal_public_picture_prior.js');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function compile(templates, mask, alphabet = SYMBOLS) {
  assert(Array.isArray(alphabet) && alphabet.length && new Set(alphabet).size === alphabet.length && alphabet.every(picture => SYMBOLS.includes(picture)));
  assert(mask && mask.length > 0 && Array.from(mask).every(value => value === 0 || value === 1));
  assert(Array.isArray(templates) && templates.length === alphabet.length);
  assert.deepEqual(templates.map(template => template.picture).sort((left, right) => left - right), alphabet.slice().sort((left, right) => left - right));
  const positions = Array.from(mask).flatMap((value, index) => value ? [index * 4] : []), pixelLength = mask.length * 4;
  const signature = pixels => {
    assert(pixels && pixels.length === pixelLength);
    const selected = Buffer.alloc(positions.length * 4);
    positions.forEach((position, index) => {
      for (let channel = 0; channel < 4; channel++) {
        const value = pixels[position + channel]; assert(Number.isInteger(value) && value >= 0 && value <= 255);
        selected[index * 4 + channel] = value;
      }
    });
    return hash(selected);
  };
  const groups = new Map(), fingerprints = [];
  for (const template of templates) {
    const key = signature(template.pixels);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(template.picture); fingerprints.push([template.picture, key]);
  }
  for (const pictures of groups.values()) pictures.sort((left, right) => left - right);
  const dictionaryId = hash(JSON.stringify([alphabet.slice().sort((left, right) => left - right), Array.from(mask), fingerprints.sort((left, right) => left[0] - right[0])]));
  const read = pixels => {
    const key = signature(pixels), found = groups.get(key), pictures = found || alphabet.slice().sort((left, right) => left - right);
    return { type: 'publicPixelPartition-v1', pictures: pictures.slice(), known: found && pictures.length === 1 ? pictures[0] : null,
      visiblePixels: positions.length, reason: !positions.length ? 'noSafeVisiblePixels' : !found ? 'outsideDictionary' : pictures.length > 1 ? 'ambiguousPixels' : 'identified',
      dictionaryId, signature: key };
  };
  read.groups = () => [...groups.values()].map(pictures => pictures.slice());
  read.dictionaryId = dictionaryId; return read;
}

module.exports = { compile };
