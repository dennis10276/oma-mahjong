'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');

module.exports = {
  name: 'level builder board check verifies plan evidence and calibration',
  run(t) {
    const test = path.join(__dirname, 'board_check.test.js');
    const result = spawnSync(process.execPath, ['--test', test], { encoding: 'utf8', timeout: 10000 });
    t.ok(result.status === 0, 'board check tests pass', result.error?.message || result.stdout + result.stderr);
  },
};
