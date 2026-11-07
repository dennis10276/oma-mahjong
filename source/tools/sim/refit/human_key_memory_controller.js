'use strict';
// Candidate decision logic only. The observer and production environment stay unchanged.
const assert = require('assert/strict');
const { createFactoryController: reference } = require('./human_factory_controller.js');
const { createKeyIdentityMemory } = require('./public_key_identity_memory.js');
function createFactoryController(tiles, profile, seed, baseFactory = reference) {
  const { rememberObservedKeyRoles = 0, ...baseProfile } = profile;
  assert(rememberObservedKeyRoles === 0 || rememberObservedKeyRoles === 1);
  const base = baseFactory(tiles, baseProfile, seed);
  if (!rememberObservedKeyRoles) return base;
  const facts = createKeyIdentityMemory(tiles.length); let attempt = 0;
  return { ...base,
    beginAttempt() { attempt++; return base.beginAttempt(); },
    observe(state, observed) {
      // Learn only from the original actual glyph stream, never from restored roles.
      facts.observe(state, observed.roles, attempt);
      const roles = observed.roles.slice();
      if (!state.relieved) for (const fact of facts.entries()) {
        if (fact.attempt < attempt && state.alive[fact.index] && roles[fact.index] === null) roles[fact.index] = 'key';
      }
      // A remembered static fact belongs to controller knowledge. Pictures, takeability,
      // clock, geometry and the captured original observation are left untouched.
      return base.observe(state, { ...observed, roles });
    },
    rememberedKeyRoleEvidence() { return facts.entries(); }
  };
}
module.exports = { createFactoryController };
