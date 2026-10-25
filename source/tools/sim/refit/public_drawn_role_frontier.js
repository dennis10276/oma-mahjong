'use strict';
const assert = require('assert/strict');
const { createExposureFrontier } = require('./public_exposure_frontier.js');

function createDrawnRoleFrontier(tiles, initial, mode = 'all') {
  assert(initial.roles === undefined || Array.isArray(initial.roles) && initial.roles.length === tiles.length);
  return createExposureFrontier(tiles, initial, mode, true);
}

module.exports = { createDrawnRoleFrontier };
