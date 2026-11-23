'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');

module.exports = {
  name: 'level builder board check verifies plan evidence, calibration and finish pressure',
  run(t) {
    const tests = ['board_check.test.js', 'feel.test.js', 'full_tray_clock.test.js', 'thaw_trap.test.js', 'earned_tray.test.js']
      .map(file => path.join(__dirname, file));
    const result = spawnSync(process.execPath, ['--test', ...tests], { encoding: 'utf8', timeout: 10000 });
    t.ok(result.status === 0, 'builder tests pass', result.error?.message || result.stdout + result.stderr);
  },
};
