'use strict';
const { NAMES, conditional } = require('./personal_model.js');
const GROUPS = {
  extraChains: ['prior', 'strong', 'learned'],
  retryChains: ['learn', 'keys', 'earlyPlan', 'lowPictureMemory'],
  memoryChains: ['twoPictures', 'fourPictures', 'eightPictures', 'fourPicturesNoRetryRecall', 'fourPicturesMediumRetryRecall'],
};

function histories(rows, target) {
  const before = rows.filter(row => row.end < target.start && row.firstAttempt === 1 && row.wonOn !== null)
    .sort((left, right) => left.end - right.end);
  const mine = before.filter(row => row.name === target.name).slice(-20), family = before.filter(row => row.board === target.board);
  const rate = (data, predicate) => (1 + data.filter(predicate).length) / (2 + data.length);
  const average = data => data.length ? data.reduce((sum, row) => sum + row.wonOn, 0) / data.length : 2;
  return [mine.length, rate(mine, row => row.wonOn === 1), rate(mine, row => row.wonOn <= 2),
    average(mine), rate(mine, row => row.assisted), family.length, average(family), rate(family, row => row.wonOn === 1)];
}

function featureNames(row) {
  const names = [...NAMES.map(name => 'person.' + name), 'level',
    ...['tiles', 'hiddenShare', 'height', 'free', 'pairs', 'clockRatio', 'hasClock', 'ice', 'locks', 'keys', 'pictures'].map(name => 'board.' + name),
    ...[1, 2, 3, 4].map(attempt => 'base.conditional' + attempt),
    ...['count', 'firstWin', 'withinTwo', 'meanAttempts', 'assisted', 'sameBoardCount', 'sameBoardMean', 'sameBoardFirst'].map(name => 'history.' + name)];
  if (row.reference) names.push('reference.strong', 'reference.average');
  for (const [group, profiles] of Object.entries(GROUPS)) {
    if (!row[group]) continue;
    if (Object.keys(row[group]).length !== profiles.length || profiles.some(profile => !row[group][profile])) throw new Error('Incomplete ' + group);
    for (const profile of profiles) for (const statistic of ['conditional1', 'conditional2', 'withinFour']) names.push(group + '.' + profile + '.' + statistic);
  }
  return names;
}

function buildFeatures(rows, row) {
  const result = [...NAMES.map(name => +(name === row.name)), row.lv, ...row.physical,
    ...[1, 2, 3, 4].map(attempt => conditional(row.chain, attempt)), ...histories(rows, row)];
  if (row.reference) result.push(row.reference.strong, row.reference.average);
  for (const [group, profiles] of Object.entries(GROUPS)) if (row[group]) {
    for (const profile of profiles) {
      const chain = row[group][profile];
      if (!chain) throw new Error('Missing ' + group + '.' + profile);
      result.push(conditional(chain, 1), conditional(chain, 2), chain.within[3]);
    }
  }
  if (result.length !== featureNames(row).length || result.some(value => !Number.isFinite(value))) throw new Error('Invalid attempt features');
  return result;
}

function rebuildFeatures(data) {
  const names = data.rows.length ? featureNames(data.rows[0]) : [];
  const encoded = JSON.stringify(names);
  const values = data.rows.map(row => {
    if (JSON.stringify(featureNames(row)) !== encoded) throw new Error('Inconsistent attempt feature schema');
    return buildFeatures(data.rows, row);
  });
  data.rows.forEach((row, index) => {
    row.features = values[index];
    for (const flag of ['policyFeaturesAdded', 'retryFeaturesAdded', 'memoryFeaturesAdded']) delete row[flag];
  });
  data.featureSchema = { version: 1, names };
  return data;
}

module.exports = { GROUPS, histories, featureNames, buildFeatures, rebuildFeatures };
