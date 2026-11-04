'use strict';
const signatures = new WeakMap();

function aliveSignature(alive) {
  if (!Object.isFrozen(alive)) return alive.join('');
  let signature = signatures.get(alive);
  if (signature === undefined) { signature = alive.join(''); signatures.set(alive, signature); }
  return signature;
}

module.exports = { aliveSignature };
