/* A wall-clock timeline and a 1x playback clock. Arrival of a batch never seeks playback. */
(function (root) {
  'use strict';
  const DELAY = 60000;
  function timeline(replay, summaries, aid) {
    if (!replay.initial || !replay.frames.length) return { frames: [], coverage: 0, timingMissing: false };
    const starts = summaries.filter(e => e.k === 'start' && e.aid === aid).sort((a, b) => a.t - b.t);
    const first = replay.frames[0];
    const start = starts.find(e => Math.abs(e.t - replay.born) < 5000);
    let base = (start ? start.t : replay.born) - first.ms, paused = false, pauseWall = 0, lastWall = -Infinity, lastMs = -Infinity;
    const frames = []; let timingMissing = false, hint = null, nudge = null, tap = null, hintUsed = false, shuffleUsed = false;
    const nextAttempt = summaries.find(e => e.k === 'start' && e.aid !== aid && e.t > (start ? start.t : replay.born));
    const controls = summaries.filter(e => (e.k === 'start' && e.aid === aid || e.k === 'show' && e.scr === 'game') && e.t >= replay.born && (!nextAttempt || e.t < nextAttempt.t));
    for (const frame of replay.frames) {
      if (frame.ms < lastMs) { timingMissing = true; break; }
      if (frame.kind === 'resume' && paused) {
        const resumed = controls.find(e => e.t > pauseWall + 1);
        if (!resumed) { timingMissing = true; break; }
        base = resumed.t - frame.ms; paused = false;
      }
      const wall = base + frame.ms;
      if (wall < lastWall) { timingMissing = true; break; }
      if (frame.kind === 'pause') { paused = true; pauseWall = wall; }
      if (frame.kind === 'tap') { tap = { wall, data: frame.data }; hint = null; }
      if (frame.kind === 'hint') { hint = { wall, tiles: frame.data }; hintUsed = true; }
      if (frame.kind === 'nudge') nudge = { wall, tiles: frame.data };
      if (frame.kind === 'shuffle') { shuffleUsed = true; hint = null; nudge = null; }
      frames.push({ ...frame, wall, hint, nudge, tapEvent: tap, hintUsed, shuffleUsed });
      lastWall = wall; lastMs = frame.ms;
    }
    const ended = !timingMissing && frames.length && frames[frames.length - 1].result;
    // A chunk can be one part of a larger drain. Its upload timestamp does not
    // prove that all earlier moves have arrived; only the last ordered event does.
    return { frames, timingMissing, coverage: ended ? Infinity : frames.length ? lastWall : 0 };
  }
  function frameAt(frames, wall) {
    let lo = 0, hi = frames.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (frames[mid].wall <= wall) lo = mid + 1; else hi = mid; }
    return lo - 1;
  }
  class Clock {
    constructor() { this.cursor = null; this.lastReal = null; }
    reset(now) { this.cursor = now - DELAY; this.lastReal = now; }
    advance(now, coverage = Infinity) {
      if (this.cursor === null) this.reset(now);
      const elapsed = Math.min(100, Math.max(0, now - this.lastReal));
      this.lastReal = now;
      this.cursor = Math.max(this.cursor, Math.min(this.cursor + elapsed, now - DELAY, coverage));
      return this.cursor;
    }
    suspend(now) { this.lastReal = now; }
  }
  const api = { DELAY, timeline, frameAt, Clock };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DashPlayback = api;
})(typeof window === 'object' ? window : globalThis);
