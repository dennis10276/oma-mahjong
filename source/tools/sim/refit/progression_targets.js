'use strict';
const { tableVersion } = require('./board_versions.js');

function progressionTargets(events, score, horizon = 24) {
  if (!Number.isInteger(horizon) || horizon < 1) throw new Error('A positive progression horizon is required');
  const regular = Object.values(events || {}).filter(event => ['start', 'end'].includes(event.k) && event.m !== 'd' && !event.tk
    && Number.isInteger(event.lv)).sort((left, right) => left.t - right.t);
  const highestCleared = Math.max(0, ...regular.filter(event => event.k === 'end' && event.r === 'win').map(event => event.lv));
  const saved = Number.isInteger(score?.level) && score.level > 0 ? score.level : 1;
  const first = Math.max(saved, highestCleared + 1);
  const version = tableVersion(regular.at(-1)?.v);
  if (version !== '1.55' || first < 53 || first + horizon - 1 > 269) throw new Error('Progression needs known fixed 1.55 boards');
  return { first, version, savedProgress: saved, highestCleared,
    currentLevelAlreadyOpened: regular.some(event => event.k === 'start' && event.lv === first),
    levels: Array.from({ length: horizon }, (_, index) => first + index) };
}

function missingProgressionTasks(targets, ledger = []) {
  const covered = new Set(ledger.flatMap(snapshot => (snapshot.forecasts || []).map(row => row.name + '|' + row.lv + '|' + row.version)));
  return Object.entries(targets).flatMap(([name, target]) => target.levels.filter(lv => !covered.has(name + '|' + lv + '|' + target.version))
    .map(lv => ({ name, lv, priorCounter: 0 })));
}

module.exports = { progressionTargets, missingProgressionTasks };
