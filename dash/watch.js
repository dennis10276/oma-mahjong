/* Buffered, read-only replay with local recording transport controls. Network batches only extend the timeline. */
(function () {
  'use strict';
  const el = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const sessions = new Map(), clock = new DashPlayback.Clock();
  let context = { pid: null, name: '', events: [] }, replay = null, current = null, error = '', buffered = false, paintKey = '', generation = 0, lastUi = 0;
  let recordedAid = null, playbackPaused = false, playbackFinished = false;
  let playbackSpeed = 1, scrubbing = false, scene = null;
  function close(entry) { entry.generation = ++generation; if (entry.source) entry.source.close(); entry.source = null; entry.connected = false; }
  function empty(message, keepReplay = false) {
    if (!keepReplay) replay = null;
    scene = null; el('watchAction').hidden = true;
    el('watchScreen').hidden = true; el('watchEmpty').hidden = false;
    el('watchEmpty').textContent = message; el('watchStats').textContent = '';
  }
  function status(now = Date.now()) {
    const label = el('watchStatus'); label.classList.remove('on');
    const lag = clock.cursor === null ? 60 : Math.max(60, Math.round((now - clock.cursor) / 1000));
    el('watchReset').hidden = !!recordedAid || !context.pid || lag < 65;
    el('watchControls').hidden = !recordedAid;
    el('watchTransport').hidden = !recordedAid;
    transport();
    el('watchTiming').textContent = recordedAid ? `Opname op ${playbackSpeed}× snelheid. Sleep de tijdbalk om vooruit of terug te kijken.` : 'Live: 1 minuut vertraagd, met de oorspronkelijke timing van elke zet.';
    el('watchPause').textContent = playbackFinished ? '▶ Opnieuw' : playbackPaused ? '▶ Verder' : '⏸ Pauze';
    el('watchPause').disabled = !replay;
    if (recordedAid) {
      const issue = current && (current.timeline.timingMissing ? ' · pauzetiming ontbreekt' : current.recording && (current.recording.gap || current.recording.truncated) ? ' · opname onvolledig' : '');
      label.textContent = error || (!replay ? 'Opname laden…' : `${playbackFinished ? 'Opname afgelopen' : playbackPaused ? 'Afspelen gepauzeerd' : 'Opname afspelen'} · ${playbackSpeed}×${issue || ''}`);
      return;
    }
    if (!context.pid) { label.textContent = 'Kies een speler'; return; }
    if (error) { label.textContent = error; return; }
    if (!replay || !replay.initial || !replay.view) { label.textContent = 'Buffer opbouwen · 1 minuut vertraagd'; return; }
    const outcome = replay.result && ({ win: 'Level gehaald', stuck: 'Vastgelopen', restart: 'Opnieuw begonnen' })[replay.result];
    const mode = buffered ? 'Bufferen' : outcome || (replay.paused ? 'Gepauzeerd' : 'Afspelen');
    label.textContent = `${mode} · ${lag} sec vertraagd${current && current.timeline.timingMissing ? ' · pauzetiming ontbreekt' : current && current.recording.gap ? ' · opname onvolledig' : ''}`;
    label.classList.toggle('on', !buffered && !outcome && !replay.paused);
  }
  function faceMarkup(kind, theme, x, y, w, h) {
    if (kind !== 101 && Tiles.THEMES[theme].svg) return Tiles.faceHTML(theme, kind).replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
    const text = kind === 101 ? '🃏' : Tiles.THEMES[theme].faces[kind];
    return `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" font-size="${w * .85}">${escape(text)}</text>`;
  }
  function transport() {
    const frames = current && current.timeline.frames, ready = !!(recordedAid && frames && frames.length);
    const start = ready ? frames[0].wall : 0, end = ready ? frames[frames.length - 1].wall : 0;
    const duration = Math.max(0, end - start), position = ready ? Math.max(0, Math.min(duration, clock.cursor - start)) : 0;
    const time = ms => { const n = Math.floor(ms / 1000); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
    const bar = el('watchSeek'); bar.max = String(duration); bar.disabled = !ready || !duration;
    if (!scrubbing) bar.value = String(position);
    bar.setAttribute('aria-valuetext', `${time(position)} van ${time(duration)}`);
    el('watchPosition').textContent = time(position); el('watchDuration').textContent = time(duration);
    el('watchBack').disabled = !ready || position <= 0; el('watchForward').disabled = !ready || position >= duration;
  }
  function captureTiles() {
    return new Map([...el('watchBoard').querySelectorAll('.watch-tile, .watch-slot[data-tile]')].map(node => {
      const m = node.transform.baseVal.consolidate().matrix, rect = node.querySelector('rect');
      return [Number(node.dataset.tile), { node, x: m.e, y: m.f, scale: m.a, width: Number(rect.getAttribute('width')) * m.a, slot: node.classList.contains('watch-slot') }];
    }));
  }
  function feedback(text) {
    const action = el('watchAction'); action.getAnimations().forEach(a => a.cancel()); action.textContent = text; action.hidden = false;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) action.animate([{ opacity: 1 }, { opacity: 1, offset: .65 }, { opacity: 0 }], { duration: 1100, fill: 'forwards' });
  }
  function animateMoves(before, previous) {
    if (!previous || previous.aid !== current.aid || clock.cursor <= previous.wall || clock.cursor - previous.wall > 2500) return;
    const after = captureTiles(), removed = [...before].filter(([id]) => !after.has(id));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, speed = recordedAid ? playbackSpeed : 1;
    let changed = false, matched = false;
    for (const [id, from] of before) {
      const to = after.get(id), partner = removed.find(([other]) => other !== id && (previous.state.f[other] === previous.state.f[id] || previous.state.f[id] === 101 || previous.state.f[other] === 101));
      if (to && !from.slot && to.slot || !to) {
        changed = true; matched ||= !!partner;
        if (reduced) continue;
        const destination = to || (partner ? from.slot ? from : partner[1].slot ? partner[1] : { ...from, x: (from.x + partner[1].x) / 2, y: (from.y + partner[1].y) / 2 - from.width * .3 } : from);
        const ghost = from.node.cloneNode(true); ghost.setAttribute('class', 'watch-flight'); ghost.removeAttribute('data-tile'); ghost.setAttribute('aria-hidden', 'true');
        el('watchBoard').appendChild(ghost);
        const transform = (p, scale = 1) => `translate(${p.x}px, ${p.y}px) scale(${from.scale * p.width / from.width * scale})`;
        const frames = to ? [{ transform: transform(from) }, { transform: transform(destination) }] : [{ transform: transform(from), opacity: 1 }, { transform: transform(destination), opacity: 1, offset: .5 }, { transform: transform(destination, .2), opacity: 0 }];
        const destinationNode = to && el('watchBoard').querySelector(`.watch-slot[data-tile="${id}"]`);
        if (destinationNode) destinationNode.style.opacity = '0';
        ghost.animate(frames, { duration: Math.max(80, (to ? 230 : 460) / speed), easing: 'cubic-bezier(.35,.1,.25,1)' }).onfinish = () => { ghost.remove(); if (destinationNode) destinationNode.style.opacity = ''; };
      } else if (to && !to.slot && (previous.state.d[id] !== replay.state.d[id] || previous.state.p !== replay.state.p && (previous.state.p === id || replay.state.p === id) || previous.state.f[id] !== replay.state.f[id])) {
        changed = true;
        if (!reduced) el('watchBoard').querySelector(`.watch-tile[data-tile="${id}"] .watch-face`).animate([{ transform: 'scaleX(.1)', opacity: .4 }, { transform: 'scaleX(1)', opacity: 1 }], { duration: Math.max(80, 180 / speed) });
      }
    }
    if (changed) feedback(matched ? '✨ Paar weggehaald' : replay.kind === 'shuffle' || previous.state.f.some((face, i) => face !== replay.state.f[i]) ? '🔀 Geschud' : replay.state.tr.length > previous.state.tr.length ? 'Steen naar het vakje' : 'Steen omgedraaid');
    else if (replay.kind === 'hint') feedback('💡 Hint');
    else if (replay.kind === 'tap' && replay.data && replay.data[2]) feedback('Deze steen zit nog vast');
  }
  function draw() {
    if (!replay || !replay.initial || !replay.view) { empty('Wachten op het opgenomen spelbeeld…', true); return; }
    const before = captureTiles(), previous = scene;
    const { initial, state, view } = replay;
    const dimension = (v, fallback) => Number.isFinite(v) && v > 0 && v < 10000 ? v : fallback;
    const vw = dimension(view[0], 390), vh = dimension(view[1], 844), bw = dimension(view[2], vw), bh = dimension(view[3], vh - 180);
    const origin = Array.isArray(view[12]) && view[12].length === 2 && view[12].every(Number.isFinite) ? view[12] : [0, 140];
    const theme = Object.hasOwn(Tiles.THEMES, view[5]) ? view[5] : 'classic';
    const points = initial.tiles.map(([x, y, z], i) => ({ i, x: x / 2 - z * .14, y: y / 2 * 1.24 - z * .14, z, order: z * 10000 + y * 100 + x }));
    const left = Math.min(...points.map(t => t.x)), top = Math.min(...points.map(t => t.y));
    const spanX = Math.max(...points.map(t => t.x + 1)) - left, spanY = Math.max(...points.map(t => t.y + 1.24)) - top;
    const tw = dimension(view[4], Math.min((bw - 8) / (spanX + .125), (bh - 8) / (spanY + .16)));
    const depth = Math.max(3, tw * .085), ox = origin[0] + (bw - spanX * tw - depth) / 2 - left * tw, oy = origin[1] + (bh - spanY * tw - depth * 1.4) / 2 - top * tw;
    const slotW = Math.min(vw * .125, 60, vh * .07), slotH = slotW * 1.24, trayW = slotW * 4 + 30, trayX = (vw - trayW) / 2, trayY = Math.max(50, origin[1] - slotH - 16);
    const tileW = 1 - 1.5 / tw, tileH = 1.24 - 1.5 / tw;
    const level = initial.key.startsWith('L') ? `Level ${initial.key.slice(1)}` : `Dagpuzzel ${initial.key.slice(1)}`;
    const progress = (initial.tiles.length - state.a.reduce((n, a) => n + a, 0) - state.tr.length) / initial.tiles.length;
    let board = `<defs><linearGradient id="watchTileBack" x2=".5" y2="1"><stop stop-color="#3dbb90"/><stop offset="1" stop-color="#1b8063"/></linearGradient><pattern id="watchCross" width=".18" height=".18" patternUnits="userSpaceOnUse"><path d="M0 0L.18 .18M.18 0L0 .18" stroke="#ffffff" opacity=".13" stroke-width=".025"/></pattern></defs><rect width="${vw}" height="${vh}" fill="#0b4d3c"/><g aria-label="Spelkop"><rect x="10" y="8" width="44" height="44" rx="14" fill="#fff8e8"/><text x="32" y="38" text-anchor="middle" font-size="24">🏠</text><text x="${vw / 2}" y="28" text-anchor="middle" font-size="19" font-weight="800" fill="white">${escape(level)}</text><rect x="64" y="36" width="${Math.max(1, vw - 128)}" height="10" rx="5" fill="#073b2e"/><rect x="64" y="36" width="${Math.max(0, (vw - 128) * progress)}" height="10" rx="5" fill="#ffc531"/><rect x="${vw - 54}" y="8" width="44" height="44" rx="14" fill="#fff8e8"/><text x="${vw - 32}" y="38" text-anchor="middle" font-size="26">↻</text></g>`;
    for (const tile of [...points].sort((a, b) => a.order - b.order)) {
      const i = tile.i; if (!state.a[i]) continue;
      const back = state.d[i] && state.p !== i, gold = initial.gold.includes(i), ob = state.ob;
      const ice = ob && ob.left[i] > 0, locked = ob && !ob.unlocked && ob.locks.includes(i), isKey = ob && !ob.unlocked && ob.keys.includes(i);
      const [tx, ty, tz] = initial.tiles[i];
      const live = initial.tiles.filter((t, j) => j !== i && state.a[j] && Math.abs(t[1] - ty) < 2);
      const blocked = live.some(t => t[2] > tz && Math.abs(t[0] - tx) < 2) || live.some(t => t[2] === tz && t[0] === tx - 2) && live.some(t => t[2] === tz && t[0] === tx + 2);
      const hint = replay.hint && clock.cursor - replay.hint.wall < 2500 && Array.isArray(replay.hint.tiles) && replay.hint.tiles.includes(i);
      const nudge = replay.nudge && Array.isArray(replay.nudge.tiles) && replay.nudge.tiles.includes(i);
      const tap = replay.tapEvent && clock.cursor - replay.tapEvent.wall < 600 && replay.tapEvent.data[0] === i;
      board += `<g class="watch-tile${back ? ' back' : ''}" data-tile="${i}" transform="translate(${ox + tile.x * tw},${oy + tile.y * tw}) scale(${tw})"><title>${back ? 'Omgedraaide steen' : 'Steen'}</title><g class="watch-face">` +
        `<rect x="${depth / tw}" y="${depth / tw}" width="${tileW}" height="${tileH}" rx=".09" fill="#c6af73"/><rect width="${tileW}" height="${tileH}" rx=".09" fill="${back ? 'url(#watchTileBack)' : gold ? '#ffe89a' : view[7] ? '#fff' : '#fff8e8'}"/>` +
        (back ? theme === 'sunflower' ? `<image href="tile-back-sunflower.png" width="${tileW}" height="${tileH}" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="${tileW}" height="${tileH}" rx=".09" fill="url(#watchCross)"/><circle cx=".49" cy=".61" r=".15" fill="#e8b13a"/><circle cx=".49" cy=".61" r=".1" fill="#ffe08a"/>` : faceMarkup(state.f[i], theme, .06, .07, .86, 1.08)) +
        (view[8] && blocked ? `<rect width="${tileW}" height="${tileH}" rx=".09" fill="${view[7] ? '#000' : '#3c280a'}" opacity="${view[7] ? '.42' : '.30'}"/>` : '') +
        (view[7] ? `<rect width="${tileW}" height="${tileH}" rx=".09" fill="none" stroke="#222" stroke-width="${2 / tw}"/>` : '') +
        (ice ? `<rect width="${tileW}" height="${tileH}" rx=".09" fill="#a9dfff" opacity=".5"/><text x=".49" y=".7" text-anchor="middle" font-size=".48">❄️</text>` : '') +
        (locked || isKey ? `<text x=".72" y="1.07" text-anchor="middle" font-size=".4">${locked ? '🔒' : '🔑'}</text>` : '') +
        (tap || hint || nudge ? `<rect width="${tileW}" height="${tileH}" rx=".09" fill="none" stroke="${hint || nudge ? '#ffc531' : '#f68a32'}" stroke-width=".065"/>` : '') + '</g></g>';
    }
    if (state.ck && state.a[state.ck.i]) {
      const tile = points[state.ck.i];
      board += `<g transform="translate(${ox + (tile.x + .55) * tw},${oy + (tile.y - .08) * tw}) scale(${tw})"><rect x="-.1" y="-.28" width=".95" height=".4" rx=".1" fill="#fff8e8"/><text x=".36" y="0" text-anchor="middle" font-size=".25">⏰ ${Math.max(0, state.ck.n - state.m)}</text></g>`;
    }
    board += `<g id="watchTray" role="group" aria-label="De vier vakjes"><rect x="${trayX}" y="${trayY}" width="${trayW}" height="${slotH + 12}" rx="16" fill="${theme === 'sunflower' ? '#cf8c1f' : '#8a5a33'}"/>`;
    for (let slot = 0; slot < 4; slot++) {
      const i = state.tr[slot], x = trayX + 6 + slot * (slotW + 6), y = trayY + 6;
      board += `<g class="watch-slot${i === undefined ? ' vacant' : ''}" ${i === undefined ? '' : `data-tile="${i}"`} transform="translate(${x},${y})"><rect width="${slotW}" height="${slotH}" rx="10" fill="${i === undefined ? '#57341f' : '#fff8e8'}"/>${i === undefined ? '' : faceMarkup(state.f[i], theme, 3, 3, slotW - 6, slotH - 6)}</g>`;
    }
    board += '</g>';
    if (view[10] !== false) {
      const y = Math.min(vh - 42, origin[1] + bh + 4), w = Math.min(140, (vw - 42) / 2);
      for (const [k, label, used] of [[0, '💡 Hint', replay.hintUsed], [1, '🔀 Schudden', replay.shuffleUsed]]) {
        const x = vw / 2 + (k ? 7 : -w - 7);
        board += `<g opacity="${used ? '.45' : '1'}"><rect x="${x}" y="${y}" width="${w}" height="34" rx="12" fill="#fff8e8"/><text x="${x + w / 2}" y="${y + 23}" text-anchor="middle" font-size="16" font-weight="700">${label}</text></g>`;
      }
    }
    const touch = replay.tapEvent && replay.tapEvent.data && replay.tapEvent.data[3];
    if (Array.isArray(touch) && touch.length === 2 && touch.every(Number.isFinite) && clock.cursor - replay.tapEvent.wall < 600) board += `<circle class="watch-touch" cx="${touch[0]}" cy="${touch[1]}" r="13" fill="#ffc53155" stroke="#ffc531" stroke-width="3"/>`;
    el('watchBoard').setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    el('watchBoard').setAttribute('aria-label', 'Opgenomen scherm: ' + level);
    el('watchBoard').classList.toggle('nonum', view[6] === false);
    el('watchBoard').innerHTML = board;
    animateMoves(before, previous);
    scene = { aid: current.aid, wall: clock.cursor, state: replay.state };
    el('watchScreen').hidden = false; el('watchEmpty').hidden = true;
    stats();
  }
  function update(entry, type, message, token) {
    if (entry.generation !== token || sessions.get(entry.aid) !== entry) return;
    try {
      const { path, data } = JSON.parse(message.data), parts = path.split('/').filter(Boolean);
      if (parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p) || ['__proto__', 'constructor', 'prototype'].includes(p)) || parts.length > 2) throw Error('Ongeldig opnamepad');
      if (!parts.length) entry.records = type === 'put' ? (data || {}) : { ...entry.records, ...(data || {}) };
      else {
        const [chunk, field] = parts;
        if (field) entry.records[chunk] = { ...entry.records[chunk], [field]: data };
        else if (data === null) delete entry.records[chunk];
        else entry.records[chunk] = type === 'patch' ? { ...entry.records[chunk], ...data } : data;
      }
      entry.recording = DashReplay.read(entry.records, entry.aid);
      entry.timeline = DashPlayback.timeline(entry.recording, context.events, entry.aid);
      entry.connected = true; entry.received = true; entry.error = '';
      // A first join may have less than a minute of delivered history. Start at the
      // available point once; subsequent uploads never move or reset the clock.
      if (!recordedAid && !entry.started && entry === current && entry.timeline.frames.length) clock.cursor = Math.min(clock.cursor, entry.timeline.coverage);
    } catch (e) { entry.error = 'Spelopname is onvolledig of ongeldig'; }
  }
  function connect(entry) {
    if (document.hidden || entry.source) return;
    const token = entry.generation = ++generation;
    entry.source = new EventSource(dbUrl(`replays/${encodeURIComponent(context.pid)}/${encodeURIComponent(entry.aid)}`));
    entry.source.addEventListener('put', e => update(entry, 'put', e, token));
    entry.source.addEventListener('patch', e => update(entry, 'patch', e, token));
    entry.source.onerror = () => { if (entry.generation === token) entry.connected = false; };
    entry.source.addEventListener('cancel', () => { if (entry.generation === token) { entry.error = 'Geen toegang tot spelopnames'; close(entry); } });
  }
  function anchorAt(wall) { return [...context.events].reverse().find(e => (e.k === 'start' || e.k === 'end') && e.t <= wall); }
  function valid(e) { return e && typeof e.aid === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(e.aid) && e.t >= Date.now() - 30 * 86400000; }
  function reconcile() {
    if (!context.pid) return;
    const wanted = new Set(), anchor = anchorAt(clock.cursor);
    if (recordedAid) wanted.add(recordedAid);
    else if (valid(anchor)) wanted.add(anchor.aid);
    // Prefetch only attempts in the selected player's one-minute broadcast queue.
    // This preserves short retries and level endings instead of switching early.
    if (!recordedAid) for (const e of context.events) if ((e.k === 'start' || e.k === 'end') && e.t >= clock.cursor && e.t <= Date.now() && valid(e)) wanted.add(e.aid);
    for (const [aid, entry] of sessions) if (!wanted.has(aid)) { close(entry); sessions.delete(aid); }
    for (const aid of wanted) {
      if (!sessions.has(aid)) sessions.set(aid, { aid, records: {}, recording: null, timeline: { frames: [], coverage: 0 }, source: null, generation: 0, connected: false, error: '' });
      connect(sessions.get(aid));
    }
  }
  function tickRecorded(now) {
    const previousMode = `${error}/${playbackFinished}/${!!replay}`;
    current = sessions.get(recordedAid);
    if (!current) { reconcile(); return; }
    if (current.error) { error = current.error; empty('Dit spelbeeld kan niet betrouwbaar worden afgespeeld.'); clock.suspend(now); }
    else if (!current.timeline.frames.length) {
      error = current.received ? 'Voor deze poging is geen spelopname beschikbaar.' : '';
      empty(error || 'Opname laden…'); clock.suspend(now);
    } else {
      error = '';
      const frames = current.timeline.frames, last = frames[frames.length - 1].wall;
      if (!current.started) { clock.cursor = frames[0].wall; clock.suspend(now); current.started = true; }
      const elapsed = Math.min(100, Math.max(0, now - clock.lastReal));
      if (!playbackPaused && !scrubbing) clock.cursor = Math.min(last, clock.cursor + elapsed * playbackSpeed);
      clock.suspend(now);
      playbackFinished = clock.cursor >= last;
      const index = DashPlayback.frameAt(frames, clock.cursor), frame = frames[index];
      if (frame && frame.view) {
        replay = { ...current.recording, ...frame, ms: frame.ms + (frame.paused || frame.result ? 0 : Math.max(0, clock.cursor - frame.wall)) };
        const cue = frame.tapEvent && clock.cursor - frame.tapEvent.wall < 600, hint = frame.hint && clock.cursor - frame.hint.wall < 2500;
        const stamp = `${current.aid}/${index}/${!!cue}/${!!hint}`;
        if (stamp !== paintKey) { draw(); paintKey = stamp; }
        if (now - lastUi >= 200) stats();
      } else empty('Wachten op de oorspronkelijke weergave…');
    }
    if (previousMode !== `${error}/${playbackFinished}/${!!replay}` || now - lastUi >= 200) { status(now); lastUi = now; }
  }
  function tick() {
    const now = Date.now();
    if (document.hidden || !context.pid) { clock.suspend(now); requestAnimationFrame(tick); return; }
    if (recordedAid) { tickRecorded(now); requestAnimationFrame(tick); return; }
    const anchor = anchorAt(clock.cursor), entry = valid(anchor) ? sessions.get(anchor.aid) : null;
    let coverage = entry ? entry.timeline.frames.length ? entry.timeline.coverage : clock.cursor : Infinity;
    const next = context.events.find(e => e.k === 'start' && e.t > clock.cursor && e.t <= now - DashPlayback.DELAY);
    if (next) coverage = Math.min(coverage, next.t);
    // A newly delivered batch can prove that a previously buffering interval was
    // idle. Rejoin the one-minute clock only across an interval with no events;
    // never seek past a move, pause, end, or attempt transition.
    if (entry && entry.started) {
      const index = DashPlayback.frameAt(entry.timeline.frames, clock.cursor), future = entry.timeline.frames[index + 1];
      const verified = Math.min(now - DashPlayback.DELAY, coverage);
      if (verified > clock.cursor && (!future || future.wall > verified)) { clock.cursor = verified; clock.suspend(now); }
    }
    clock.advance(now, coverage);
    const playing = anchorAt(clock.cursor);
    const selected = valid(playing) ? sessions.get(playing.aid) : null;
    if (selected !== current) { current = selected; paintKey = ''; replay = null; error = ''; reconcile(); }
    buffered = !!(current && (clock.cursor >= current.timeline.coverage && now - DashPlayback.DELAY > current.timeline.coverage + 100 || !current.timeline.frames.length));
    if (current && current.error) { error = current.error; if (paintKey !== 'error') { empty('Dit spelbeeld kan niet betrouwbaar worden afgespeeld.'); paintKey = 'error'; } }
    else if (current) {
      error = '';
      if (!current.started && current.timeline.frames.length) clock.cursor = Math.min(clock.cursor, current.timeline.coverage);
      const index = DashPlayback.frameAt(current.timeline.frames, clock.cursor), frame = current.timeline.frames[index];
      if (frame && frame.view) {
        current.started = true;
        replay = { ...current.recording, ...frame, ms: frame.ms + (frame.paused || frame.result ? 0 : Math.max(0, clock.cursor - frame.wall)) };
        const cue = frame.tapEvent && clock.cursor - frame.tapEvent.wall < 600, hint = frame.hint && clock.cursor - frame.hint.wall < 2500;
        const stamp = `${current.aid}/${index}/${!!cue}/${!!hint}`;
        if (stamp !== paintKey) { draw(); paintKey = stamp; }
        if (now - lastUi >= 200) stats();
      } else if (paintKey !== 'waiting') { empty('Wachten op de eerste minuut opname en de oorspronkelijke weergave…'); paintKey = 'waiting'; }
    } else {
      const message = !playing ? 'De uitzending begint zodra er één minuut opname beschikbaar is.' : !valid(playing) ? 'Voor deze poging is geen spelopname beschikbaar.' : 'De volgende poging wordt gebufferd…';
      if (paintKey !== message) { empty(message); paintKey = message; }
    }
    if (now - lastUi >= 200) { status(now); lastUi = now; reconcile(); }
    requestAnimationFrame(tick);
  }
  function stats() {
    if (!replay || !replay.initial) return;
    const level = replay.initial.key.startsWith('L') ? `Level ${replay.initial.key.slice(1)}` : `Dagpuzzel ${replay.initial.key.slice(1)}`;
    if (recordedAid) transport();
    const seconds = Math.floor(replay.ms / 1000);
    el('watchStats').textContent = `${level} · poging ${replay.initial.at || 1} · ${replay.state.a.reduce((n, a) => n + a, 0)} stenen over · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}${replay.initial.partial ? ' · hervatte opname' : ''}`;
  }
  function follow(pid, name, events) {
    if (context.pid !== pid) {
      for (const entry of sessions.values()) close(entry);
      recordedAid = null; playbackPaused = false; playbackFinished = false; scrubbing = false; scene = null;
      sessions.clear(); current = null; replay = null; paintKey = ''; error = ''; clock.reset(Date.now());
      empty(pid ? 'De uitzending wordt één minuut achter de speler opgebouwd…' : 'Kies een speler om mee te kijken.');
    }
    context = { pid, name, events };
    el('watchName').textContent = name || 'Kies een speler';
    for (const entry of sessions.values()) if (entry.recording) entry.timeline = DashPlayback.timeline(entry.recording, events, entry.aid);
    reconcile(); status();
  }
  function playAttempt(aid) {
    if (!context.pid || !context.events.some(e => e.aid === aid && (e.k === 'start' || e.k === 'end') && valid(e))) return false;
    for (const entry of sessions.values()) close(entry);
    sessions.clear(); recordedAid = aid; playbackPaused = false; playbackFinished = false; scrubbing = false; scene = null; el('watchAction').hidden = true;
    current = null; replay = null; paintKey = ''; error = ''; clock.suspend(Date.now());
    empty('Opname laden…'); reconcile(); status(); return true;
  }
  function seek(position) {
    if (!recordedAid || !current || !current.timeline.frames.length) return;
    const frames = current.timeline.frames, start = frames[0].wall, last = frames[frames.length - 1].wall;
    clock.cursor = Math.max(start, Math.min(last, start + position)); current.started = true;
    scene = null; paintKey = ''; el('watchAction').hidden = true; clock.suspend(Date.now());
    tickRecorded(Date.now()); status(); transport();
  }
  el('watchPause').onclick = () => {
    if (playbackFinished) { playbackPaused = false; seek(0); } else playbackPaused = !playbackPaused;
    el('watchScreen').getAnimations({ subtree: true }).forEach(animation => {
      if (playbackPaused && animation.playState === 'running') animation.pause();
      else if (!playbackPaused && animation.playState === 'paused') animation.play();
    });
    clock.suspend(Date.now()); status();
  };
  el('watchRestart').onclick = () => { playbackPaused = false; seek(0); };
  el('watchBack').onclick = () => seek(clock.cursor - current.timeline.frames[0].wall - 30000);
  el('watchForward').onclick = () => seek(clock.cursor - current.timeline.frames[0].wall + 30000);
  el('watchSpeed').onchange = event => {
    const speed = Number(event.target.value); if ([.5, 1, 1.5, 2, 4, 8].includes(speed)) playbackSpeed = speed;
    clock.suspend(Date.now()); status();
  };
  el('watchSeek').onpointerdown = () => { scrubbing = true; clock.suspend(Date.now()); };
  el('watchSeek').oninput = event => seek(Number(event.target.value));
  const finishScrub = () => { scrubbing = false; clock.suspend(Date.now()); };
  el('watchSeek').onchange = finishScrub;
  addEventListener('pointerup', finishScrub); addEventListener('pointercancel', finishScrub);
  el('watchLive').onclick = () => {
    recordedAid = null; playbackPaused = false; playbackFinished = false; scrubbing = false; scene = null; el('watchAction').hidden = true;
    for (const entry of sessions.values()) close(entry);
    sessions.clear(); current = null; replay = null; paintKey = ''; error = ''; clock.reset(Date.now());
    empty('De uitzending wordt één minuut achter de speler opgebouwd…'); reconcile(); status();
  };
  el('watchReset').onclick = () => { scene = null; clock.reset(Date.now()); current = null; paintKey = ''; reconcile(); };
  document.addEventListener('visibilitychange', () => { clock.suspend(Date.now()); if (document.hidden) { for (const entry of sessions.values()) close(entry); } else reconcile(); });
  addEventListener('pagehide', () => { for (const entry of sessions.values()) close(entry); });
  requestAnimationFrame(tick);
  window.DashWatch = { follow, playAttempt };
})();
