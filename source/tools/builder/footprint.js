'use strict';
// Reference phone 392 x 730; tray gap reserved, tools hidden as on ordinary 250+ play.
// Same rendered bounds as boardGeo, including upper-layer offsets and tile sides.
const PROFILE = Object.freeze({ name: 'phone-60-v1', width: 392, height: 599, compactHeight: 616, marginY: 20, target: 60, maxRows: 8 });
function measure(input) {
  const tiles = input.tiles || input;
  if (!Array.isArray(tiles) || !tiles.length) return { ok: false, why: 'emptyGeometry' };
  const ts = tiles.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t);
  if (ts.some(t => ![t.x,t.y,t.z].every(Number.isFinite))) return { ok: false, why: 'invalidGeometry' };
  const l = Math.min(...ts.map(t => t.x/2-t.z*.14)), r = Math.max(...ts.map(t => t.x/2-t.z*.14+1));
  const top = Math.min(...ts.map(t => t.y/2*1.24-t.z*.14)), bottom = Math.max(...ts.map(t => t.y/2*1.24-t.z*.14+1.24));
  const twW = (PROFILE.width-4)/(r-l+.125), hDen = bottom-top+.159;
  const compact = (PROFILE.height-PROFILE.marginY)/hDen < twW;
  const tilePx = Math.min(150, twW, ((compact?PROFILE.compactHeight:PROFILE.height)-PROFILE.marginY)/hDen);
  const rows = (Math.max(...ts.map(t=>t.y))-Math.min(...ts.map(t=>t.y)))/2+1;
  return { ok: tilePx >= PROFILE.target && rows <= PROFILE.maxRows, profile: PROFILE.name, tilePx, rows, compact, target: PROFILE.target, limit: tilePx < twW ? 'height' : 'width' };
}
module.exports = { PROFILE, measure };
