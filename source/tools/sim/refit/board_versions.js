'use strict';
const ALIASES = { '1.54': '1.55', '1.56': '1.55', '1.57': '1.55', '1.58': '1.55' };
const tableVersion = version => ALIASES[version] || version;
const fixedEarlyLevel = (version, level) => (version || '0').split('.').map(Number).reduce((total, part) => total * 100 + part, 0) >= 155
  && (level === 51 || (level >= 53 && level < 70));
module.exports = { tableVersion, fixedEarlyLevel };
