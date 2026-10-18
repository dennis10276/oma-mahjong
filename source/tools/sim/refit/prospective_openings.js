'use strict';
function includePendingOpenings(name, episodes, rawEvents, boardForStart = () => null) {
  const events = Object.values(rawEvents || {}).filter(event => event.m !== 'd' && !event.tk && event.lv >= 10 && Number(event.v) >= 1.31)
    .sort((left, right) => left.t - right.t);
  const ends = events.filter(event => event.k === 'end'), endedAids = new Set(ends.map(event => event.aid).filter(Boolean));
  const seen = new Set(), result = [...episodes];
  for (const start of events) {
    if (start.k !== 'start' || !start.aid || start.res || endedAids.has(start.aid) || seen.has(start.aid)) continue;
    seen.add(start.aid);
    const preceding = ends.filter(event => event.t < start.t).at(-1);
    if (preceding && preceding.lv === start.lv && preceding.r !== 'win' && preceding.at < start.at) continue;
    if (result.some(episode => episode.start === start.t || episode.campaignAids?.includes(start.aid))) continue;
    const confirmed = start.at === 1 || !!(preceding && (preceding.lv !== start.lv || preceding.r === 'win'));
    result.push({ name, lv: start.lv, version: start.v, board: boardForStart(start), start: start.t, end: start.t,
      firstAttempt: confirmed ? 1 : start.at, wonOn: null, loggedFirstAttempt: start.at, loggedWonOn: null,
      openingRecorded: true, source: 'pending-opening' });
  }
  return result.sort((left, right) => left.start - right.start);
}

module.exports = { includePendingOpenings };
