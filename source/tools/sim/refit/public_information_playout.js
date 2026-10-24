'use strict';
const { createInformationPlayout } = require('./public_interleaved_playouts.js');

function informationPlayout(options) {
  const runner = createInformationPlayout(options);
  let step;
  do { step = runner.next(); } while (!step.done);
  return step.value;
}

module.exports = { informationPlayout };
