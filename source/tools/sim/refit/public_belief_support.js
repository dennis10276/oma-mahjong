'use strict';
const assert = require('assert/strict');

function verifySupport(result) {
  const { problem, worlds } = result, size = problem.tiles.length, inventory = problem.belief.inventory;
  assert.equal(problem.belief.kind, 'declared-public-inventory-uniform-v1');
  assert(size > 0 && size <= 10 && inventory.length === size && problem.down.length === size);
  assert(inventory.every(picture => Number.isInteger(picture) && picture >= 0 && picture < 36));
  assert(problem.down.every(value => value === 0 || value === 1));
  const opening = problem.openingPictures || Array(size).fill(null), counts = Array(36).fill(0);
  assert.equal(opening.length, size); inventory.forEach(picture => counts[picture]++);
  let unknown = size;
  for (let index = 0; index < size; index++) if (opening[index] !== null) {
    assert(Number.isInteger(opening[index]) && opening[index] >= 0 && opening[index] < 36);
    const target = problem.tiles[index];
    assert(!problem.down[index] && !problem.tiles.some(tile => tile.x === target.x && tile.y === target.y && tile.z > target.z),
      'Prior conditioning must not reveal a concealed opening picture');
    assert(counts[opening[index]] > 0); counts[opening[index]]--; unknown--;
  }
  const factorial = count => { let value = 1; for (let factor = 2; factor <= count; factor++) value *= factor; return value; };
  const expected = factorial(unknown) / counts.reduce((product, count) => product * factorial(count), 1);
  assert(Number.isSafeInteger(expected) && expected > 0); assert.equal(worlds.length, expected, 'Incomplete declared prior support');
  const wanted = inventory.slice().sort((left, right) => left - right), unique = new Set();
  for (const faces of worlds) {
    assert(Array.isArray(faces) && faces.length === size); assert.deepEqual(faces.slice().sort((left, right) => left - right), wanted);
    for (let index = 0; index < size; index++) if (opening[index] !== null) assert.equal(faces[index], opening[index]);
    unique.add(JSON.stringify(faces));
  }
  assert.equal(unique.size, expected, 'Duplicate hypotheses cannot replace missing prior mass');
  return { completeUniformHypotheses: expected, publicOpeningConstraints: size - unknown,
    proof: 'Independent conditional-multinomial cardinality, unique hypotheses, exact declared inventory and visibly public opening constraints. Does not use the solver permutation generator.' };
}

module.exports = { verifySupport };
