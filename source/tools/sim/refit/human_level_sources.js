'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function captureSources(entry) {
  const root = path.resolve(__dirname, '../../..'), visited = new Set(), files = new Set();
  function visit(loaded) {
    if (!loaded || visited.has(loaded.id)) return;
    visited.add(loaded.id);
    if (loaded.filename?.startsWith(root + path.sep)) files.add(loaded.filename);
    for (const child of loaded.children ?? []) visit(child);
  }
  visit(entry);
  for (const filename of ['www/tiles.js', 'www/js/board.js', 'www/js/specials.js', 'www/style.css']) files.add(path.join(root, filename));
  const ordered = [...files].sort();
  const fingerprint = () => crypto.createHash('sha256').update(JSON.stringify(ordered.map(filename => [
    path.relative(root, filename).replace(/\\/g, '/'), crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex')
  ]))).digest('hex');
  const hash = fingerprint();
  return { hash, files: ordered.map(filename => path.relative(root, filename).replace(/\\/g, '/')),
    verify() { assert.equal(fingerprint(), hash, 'Restart the measurement process after changing bot source'); } };
}

module.exports = { captureSources };
