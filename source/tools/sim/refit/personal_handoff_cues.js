'use strict';
const CONTEXT = ['bias', 'newTrayCue', 'knownInspection', 'tray1', 'tray2', 'tray3', 'clock', 'urgency',
  'newTrayClock', 'otherTrayMatch', 'keyProgress', 'clockProgress', 'optionShare'];
const trayCount = decision => decision.kindContext[1] + 2 * decision.kindContext[2] + 3 * decision.kindContext[3];
const positionOf = feature => [feature[21], feature[22], feature[26]];
const pictureOf = feature => {
  const present = feature.slice(27, 64).flatMap((value, index) => value > 0 ? [index] : []);
  return present.length === 1 && present[0] < 36 ? present[0] : null;
};

function descriptorOf(decision, selected) {
  const feature = decision.F[selected];
  if (!feature || feature.length !== 76 || !feature.every(Number.isFinite)) throw new Error('Invalid actual handoff action');
  return { position: positionOf(feature), picture: pictureOf(feature), inspect: feature[19] > 0,
    knownReopen: feature[65] > 0, pairPreparation: feature[67] > 0, tray: trayCount(decision) };
}

function cueOf(decision, previous) {
  if (!previous) return null;
  let indices = [], type = null;
  if (previous.inspect) {
    const current = decision.F.filter(feature => feature[19] === 0 && positionOf(feature).every((value, index) => value === previous.position[index]));
    if (current.length !== 1) return null;
    indices = decision.F.flatMap((feature, index) => feature[66] > 0 ? [index] : []);
    type = 'peekPair';
  } else if (trayCount(decision) > previous.tray && previous.picture !== null) {
    indices = decision.F.flatMap((feature, index) => feature[64] > 0 && pictureOf(feature) === previous.picture ? [index] : []);
    type = 'newTrayMate';
  }
  return indices.length ? { type, indices, previous } : null;
}

function contextOf(decision, cue) {
  const clock = decision.kindContext[11] > 0, newTray = cue.type === 'newTrayMate', recipients = new Set(cue.indices);
  const boundedMaximum = part => Math.min(1, Math.max(0, ...cue.indices.map(index => decision.F[index][part])));
  return [1, +newTray, +(cue.previous.inspect && cue.previous.knownReopen), ...decision.kindContext.slice(1, 4),
    +clock, clock ? 1 - decision.kindContext[12] : 0, +(newTray && clock),
    +decision.F.some((feature, index) => feature[64] > 0 && !recipients.has(index)), boundedMaximum(68),
    Math.max(boundedMaximum(71), boundedMaximum(72)), cue.indices.length / decision.F.length];
}

function shiftGroup(values, indices, delta) {
  if (!Array.isArray(values) || !values.length || values.some(value => !Number.isFinite(value) || value < 0)
    || Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-12 || !Number.isFinite(delta)
    || new Set(indices).size !== indices.length || indices.some(index => !Number.isInteger(index) || index < 0 || index >= values.length)) throw new Error('Invalid handoff odds transfer');
  if (!indices.length || delta === 0) return values.slice();
  const recipients = new Set(indices), mass = indices.reduce((sum, index) => sum + values[index], 0);
  if (mass <= 0 || mass >= 1) return values.slice();
  const clipped = Math.min(1 - 1e-12, Math.max(1e-12, mass)), logit = Math.log(clipped) - Math.log1p(-clipped) + delta;
  const next = logit >= 0 ? 1 / (1 + Math.exp(-logit)) : Math.exp(logit) / (1 + Math.exp(logit));
  return values.map((value, index) => value * (recipients.has(index) ? next / mass : (1 - next) / (1 - mass)));
}

module.exports = { CONTEXT, trayCount, positionOf, pictureOf, descriptorOf, cueOf, contextOf, shiftGroup };
