'use strict';

function admitPath(shortest, identity, taps) {
  const previous = shortest.get(identity);
  if (previous !== undefined && previous <= taps) return false;
  shortest.set(identity, taps); return true;
}

module.exports = { admitPath };
