'use strict';

function roundedContains(horizontal, vertical, bounds, inset = 0) {
  if (horizontal < bounds.left + inset || horizontal > bounds.right - inset
    || vertical < bounds.top + inset || vertical > bounds.bottom - inset) return false;
  const radiusHorizontal = (bounds.right - bounds.left) * .14, radiusVertical = (bounds.bottom - bounds.top) * .14;
  const distanceHorizontal = Math.max(bounds.left + radiusHorizontal - horizontal, 0, horizontal - bounds.right + radiusHorizontal);
  const distanceVertical = Math.max(bounds.top + radiusVertical - vertical, 0, vertical - bounds.bottom + radiusVertical);
  return Math.hypot(distanceHorizontal / radiusHorizontal, distanceVertical / radiusVertical)
    <= 1 - inset / Math.min(radiusHorizontal, radiusVertical);
}

module.exports = { roundedContains };
