/* Chapter 2 milestones arrive earned without overwriting a player's saved trophies. */
'use strict';

module.exports = {
  name: 'Chapter 2 trophy migration preserves earned dates in legacy and migrated saves',
  async run(t, { TODAY }) {
    const earned = { l20: '2026-08-20', s50: '2026-09-02', c5: '2026-09-07', l100: '2026-09-20' };
    const expected = { ...earned, l150: TODAY, l200: TODAY, l250: TODAY };
    for (const econV of [1, 2]) {
      const p = await t.phone({ state: { level: 251, econV, trophies: earned } });
      const savedTrophies = () => p.evaluate(() => JSON.parse(localStorage.getItem('omamj.v1')).trophies);
      t.eq(await savedTrophies(), expected, `economy ${econV}: only passed milestones added`);
      t.eq(await p.evaluate(() => newTrophies().filter(t => /^l[0-9]{3}$/.test(t.id)).map(t => t.id)), [], `economy ${econV}: no old milestone celebrations`);
      await p.clock.setFixedTime(new Date('2026-10-08T15:00:00'));
      const durableTrophies = await savedTrophies();
      await p.reload();
      await p.waitForFunction(() => window.__mjReady === true);
      t.eq(await savedTrophies(), durableTrophies, `economy ${econV}: reload preserves every award date`);
    }
  },
};
