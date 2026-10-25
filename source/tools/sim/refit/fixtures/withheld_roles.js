'use strict';

function withholdClosedRoles(state, readRole) {
  return index => state.down[index] && state.openPeek !== index ? null : readRole(index);
}

module.exports = { withholdClosedRoles };
