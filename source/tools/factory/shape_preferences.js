'use strict';
// Dennis: block silhouettes are a fallback, and every board has over 70 tiles.
const baseOf = shape => String(shape).split(' · ')[0];
const minimum = plan => Math.max(72, plan?.minTiles ?? 72);
const penalty = (shape, plan = {}) => (plan.discouragedShapes ?? ['block']).includes(baseOf(shape)) ? (plan.discouragedShapePenalty ?? 1) : 0;
function order(shapes, plan, preferred = []) {
  return shapes.slice().sort((a, b) => penalty(a.name, plan) - penalty(b.name, plan) ||
    Number(preferred.includes(b.name)) - Number(preferred.includes(a.name)));
}
module.exports = { baseOf, minimum, penalty, order };
