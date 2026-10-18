'use strict';

function campaignsOf(rawEvents) {
  const events = Object.values(rawEvents || {}).filter(event => event.m !== 'd' && !event.tk
    && event.lv >= 10 && Number(event.v) >= 1.31 && ['start', 'end'].includes(event.k))
    .sort((left, right) => left.t - right.t);
  const active = new Map(), campaigns = [];
  for (const event of events) {
    let campaign = active.get(event.lv);
    if (campaign && event.k === 'start' && !event.res
      && event.at < Math.max(0, ...campaign.starts.map(start => start.at || 0), ...campaign.events.map(end => end.at || 0))) campaign = null;
    if (!campaign) {
      campaign = { lv: event.lv, starts: [], events: [], campaignAids: [] };
      campaigns.push(campaign);
      active.set(event.lv, campaign);
    }
    if (event.aid && !campaign.campaignAids.includes(event.aid)) campaign.campaignAids.push(event.aid);
    if (event.k === 'start') campaign.starts.push(event);
    else {
      const duplicate = campaign.events.find(previous => previous.at === event.at && previous.r === event.r);
      if (!duplicate) campaign.events.push(event);
      if (event.r === 'win') active.delete(event.lv);
    }
  }
  return campaigns.map(campaign => {
    const firstEnd = campaign.events[0];
    const starts = campaign.starts.filter(start => !firstEnd || start.t <= firstEnd.t);
    const opening = starts.find(start => !start.res) || starts[0];
    const start = opening?.t ?? firstEnd.t - (firstEnd.dur || 0) * 1000;
    const preceding = events.filter(event => event.k === 'end' && event.t < start).at(-1);
    const firstCounter = opening?.at || firstEnd?.at || 1;
    return { ...campaign, start, opening, firstCounter,
      confirmedOpening: firstCounter === 1 || !!(opening && preceding && (preceding.lv !== campaign.lv || preceding.r === 'win')) };
  }).sort((left, right) => left.start - right.start);
}

module.exports = { campaignsOf };
