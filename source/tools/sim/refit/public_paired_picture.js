'use strict';
const assert = require('assert/strict');

function inferPairedPicture(rememberedPictures, contract = {}) {
  assert(Object.keys(contract).every(key => key === 'pairedInitialPictures'));
  assert.equal(contract.pairedInitialPictures, true, 'Picture inference requires an explicit paired opening contract');
  assert(Array.isArray(rememberedPictures) && rememberedPictures.length > 0 && rememberedPictures.length % 2 === 0,
    'Supply the remembered identities of every original board tile, including removed tiles');
  const oddPictures = new Set(), unknown = [];
  rememberedPictures.forEach((picture, index) => {
    if (picture === null) { unknown.push(index); return; }
    assert(Number.isInteger(picture) && (picture >= 0 && picture < 36 || picture === 101));
    if (oddPictures.has(picture)) oddPictures.delete(picture); else oddPictures.add(picture);
  });
  assert(oddPictures.size <= unknown.length, 'Observed identities contradict the paired opening contract');
  if (unknown.length !== 1) return null;
  assert.equal(oddPictures.size, 1);
  return { index: unknown[0], picture: [...oddPictures][0], source: 'pairedOpeningParity' };
}

module.exports = { inferPairedPicture };
