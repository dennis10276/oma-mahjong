'use strict';
const fs = require('fs'), path = require('path');
const { atomicJson } = require('./meter.js');
function createStageStore(dir) {
  const records = new Map(), key = (id, mode) => id + '.' + mode;
  return {
    read(id, mode) {
      const k = key(id, mode);
      if (!records.has(k)) {
        const file = path.join(dir, k + '.json');
        records.set(k, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null);
      }
      return records.get(k);
    },
    write(id, mode, result) {
      atomicJson(path.join(dir, key(id, mode) + '.json'), result);
      records.set(key(id, mode), result);
    }
  };
}
module.exports = { createStageStore };
