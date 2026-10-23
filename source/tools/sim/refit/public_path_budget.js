'use strict';

function admitPath(shortest, identity, taps) {
  const previous = shortest.get(identity);
  if (previous !== undefined && previous <= taps) return false;
  shortest.set(identity, taps); return true;
}

function queuePath(shortest, frontier, identity, candidate) {
  if (!admitPath(shortest, identity, candidate.path.length)) return false;
  frontier.set(identity, candidate); return true;
}

module.exports = { admitPath, queuePath };
