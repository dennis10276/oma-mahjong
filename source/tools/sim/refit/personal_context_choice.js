'use strict';
const KINDS = ['flip', 'pair', 'single', 'fatal'];
const finite = values => Array.isArray(values) && values.every(Number.isFinite);

function choiceFactory(actor, model, stages = model.trees.length) {
  if (!finite(actor.withinWeights) || actor.withinWeights.length !== 76
    || KINDS.some(kind => !finite(actor.kindModel?.weights?.[kind]) || actor.kindModel.weights[kind].length !== 26)) throw new Error('Invalid personal base actor');
  if (model.type !== 'personalChoiceTrees-v1' || model.inputPrecision !== 'float32' || model.dimensions !== 102
    || !Array.isArray(model.trees) || !Number.isInteger(stages) || stages < 0 || stages > model.trees.length) throw new Error('Invalid personal context model');
  const trees = model.trees.slice(0, stages);
  for (const nodes of trees) {
    if (!Array.isArray(nodes) || !nodes.length) throw new Error('Empty personal context tree');
    nodes.forEach((node, index) => {
      if (!finite(node) || node.length !== 5 || !Number.isInteger(node[0]) || node[0] < -1 || node[0] >= 102
        || (node[0] >= 0 && [node[2], node[3]].some(child => !Number.isInteger(child) || child <= index || child >= nodes.length))) throw new Error('Invalid personal context tree node');
    });
  }
  const within = actor.withinWeights, kindWeights = actor.kindModel.weights;
  const distribution = decision => {
    const { F, immediate, kindContext } = decision;
    if (!Array.isArray(F) || !F.length || !Array.isArray(immediate) || immediate.length !== F.length
      || !finite(kindContext) || kindContext.length !== 26) throw new Error('Invalid physical choice features');
    const kinds = F.map(feature => feature[19] ? 'flip' : feature[18] ? 'fatal' : feature[14] ? 'pair' : 'single');
    const available = KINDS.filter(kind => kinds.includes(kind));
    const typeScores = available.map(kind => kindContext.reduce((sum, value, index) => sum + value * kindWeights[kind][index], Math.log(kind === 'fatal' ? 0.01 : 1)));
    const typeMaximum = Math.max(...typeScores), typeMass = typeScores.map(value => Math.exp(value - typeMaximum));
    const typeTotal = typeMass.reduce((sum, value) => sum + value, 0);
    const withinScores = F.map((feature, index) => {
      if (!finite(feature) || feature.length !== 76 || !finite(immediate[index]) || immediate[index].length !== 29) throw new Error('Invalid actual-tap features');
      return feature.reduce((sum, value, position) => sum + value * within[position], 0);
    });
    const base = new Array(F.length).fill(0);
    available.forEach((kind, typeIndex) => {
      const indices = kinds.map((value, index) => value === kind ? index : -1).filter(index => index >= 0);
      const maximum = Math.max(...indices.map(index => withinScores[index]));
      const mass = indices.map(index => Math.exp(withinScores[index] - maximum));
      const total = mass.reduce((sum, value) => sum + value, 0);
      indices.forEach((index, position) => { base[index] = typeMass[typeIndex] / typeTotal * mass[position] / total; });
    });
    const scores = F.map((feature, index) => {
      let residual = 0;
      for (const nodes of trees) {
        let position = 0;
        while (nodes[position][0] >= 0) {
          const [part, threshold, left, right] = nodes[position];
          const value = part < 21 ? immediate[index][part] : part < 68 ? feature[part]
            : part < 76 ? immediate[index][part - 47] : kindContext[part - 76];
          position = Math.fround(value) <= threshold ? left : right;
        }
        residual += nodes[position][4];
      }
      return Math.log(Math.max(1e-300, base[index])) + residual;
    });
    if (!scores.every(Number.isFinite)) throw new Error('Nonfinite personal context scores');
    const maximum = Math.max(...scores), mass = scores.map(value => Math.exp(value - maximum));
    const total = mass.reduce((sum, value) => sum + value, 0);
    return mass.map(value => value / total);
  };
  const choose = (decision, draw) => {
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid personal choice draw');
    const probabilities = distribution(decision);
    let index = 0;
    while (index < probabilities.length - 1 && (draw -= probabilities[index]) > 0) index++;
    return index;
  };
  choose.probabilities = distribution;
  return choose;
}

module.exports = { choiceFactory };
