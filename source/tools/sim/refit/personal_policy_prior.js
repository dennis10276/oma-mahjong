'use strict';
const DEFAULT_KINDS = {};
for (let tray = 0; tray <= 3; tray++) for (const pair of [false, true]) for (const flip of [false, true]) {
  DEFAULT_KINDS['t' + tray + (pair ? 'p' : 'n') + (flip ? '' : '-')] = {
    pair: pair ? 0.9 : 0, flip: flip ? pair ? 0.08 : 0.9 : 0,
    single: tray < 3 ? pair ? 0.02 : 0.1 : 0, fatal: tray === 3 ? 0.01 : 0,
  };
}
module.exports = { DEFAULT_KINDS };
