'use strict';
const Hard = require('../../../www/hard.js');

function physicalActor(actor) {
  if (actor.scope !== 'ownAll' || actor.jointChoice || !Array.isArray(actor.withinWeights)
    || actor.withinWeights.length !== Hard.POLICY_FEAT.length + Hard.GOAL_FEAT.length) throw new Error('Invalid current own physical actor');
  return { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, forceMatches: false, peek: 0, end: 0, plan: 0,
    physicalSingleStep: !!actor.physicalSingleStep, kindModel: actor.kindModel,
    w: actor.withinWeights.slice(0, Hard.FEAT.length),
    spatial: actor.withinWeights.slice(Hard.FEAT.length, Hard.POLICY_FEAT.length),
    goalWeights: actor.withinWeights.slice(Hard.POLICY_FEAT.length) };
}

module.exports = { physicalActor };
