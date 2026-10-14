/* Follow only the selected attempt. Existing 30-second replay batches are never called instant video. */
(function () {
  'use strict';
  const el = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let source = null, key = '', records = {}, replay = null, context = null, connected = false, error = '', generation = 0;
  function close() { generation++; if (source) source.close(); source = null; }
  function empty(message, keepReplay = false) {
    if (!keepReplay) replay = null;
    el('watchScreen').hidden = true; el('watchEmpty').hidden = false;
    el('watchEmpty').textContent = message; el('watchStats').textContent = '';
  }
  function status() {
    const label = el('watchStatus'); label.classList.remove('on');
    if (!context || !context.pid) { label.textContent = 'Kies een speler'; return; }
    if (error) { label.textContent = error; return; }
    if (!replay || !replay.initial) { label.textContent = key ? 'Wachten op spelbeeld…' : 'Geen spelopname'; return; }
    if (!replay.view) { label.textContent = 'Wachten op de eerste weergave…'; return; }
    const age = Math.max(0, Math.floor((Date.now() - replay.updatedAt) / 1000));
    const ago = age < 60 ? `${age} sec geleden` : age < 3600 ? `${Math.floor(age / 60)} min geleden` : age < 86400 ? `${Math.floor(age / 3600)} uur geleden` : `${Math.floor(age / 86400)} dagen geleden`;
    const outcome = context.result || replay.result;
    const paused = context.paused || replay.paused;
    const fresh = connected && !document.hidden && !outcome && !paused && !replay.gap && !replay.truncated && Date.now() >= replay.updatedAt && age < 45;
    const mode = outcome ? ({ win: 'Level gehaald', stuck: 'Vastgelopen', restart: 'Opnieuw begonnen' })[outcome] || 'Spel afgelopen'
      : replay.gap || replay.truncated ? 'Onvolledig spelbeeld' : paused ? 'Gepauzeerd' : fresh ? 'Spel bezig' : 'Laatste spelbeeld';
    label.textContent = `${mode} · bijgewerkt ${ago}${!connected && !outcome ? ' · opnieuw verbinden…' : ''}`;
    label.classList.toggle('on', fresh);
  }
  function faceMarkup(kind, theme, x, y, w, h) {
    if (kind !== 101 && Tiles.THEMES[theme].svg) return Tiles.faceHTML(theme, kind).replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
    const text = kind === 101 ? '🃏' : Tiles.THEMES[theme].faces[kind];
    return `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" font-size="${w * .85}">${escape(text)}</text>`;
  }
  function draw() {
    if (!replay || !replay.initial) { empty('De opname is nog onderweg. Het eerste spelbeeld verschijnt vanzelf.'); status(); return; }
    if (!replay.view) { empty('De eerste weergave-instellingen komen met de volgende opname-update.', true); status(); return; }
    const { initial, state, view } = replay;
    const theme = view && Object.hasOwn(Tiles.THEMES, view[5]) ? view[5] : 'classic';
    const nums = !view || view[6] !== false;
    const positions = initial.tiles.map(([x, y, z], i) => ({ i, x: x / 2 - z * .14, y: y / 2 * 1.24 - z * .14, z, order: z * 10000 + y * 100 + x }));
    const left = Math.min(...positions.map(t => t.x)) - .2, top = Math.min(...positions.map(t => t.y)) - .2;
    const width = Math.max(...positions.map(t => t.x + 1.1)) - left + .2, height = Math.max(...positions.map(t => t.y + 1.4)) - top + .2;
    let board = '';
    for (const tile of [...positions].sort((a, b) => a.order - b.order)) {
      const i = tile.i; if (!state.a[i]) continue;
      const back = state.d[i] && state.p !== i, gold = initial.gold.includes(i), ob = state.ob;
      const ice = ob && ob.left[i] > 0, locked = ob && !ob.unlocked && ob.locks.includes(i), isKey = ob && !ob.unlocked && ob.keys.includes(i);
      const title = back ? 'Omgedraaide steen' : ice ? 'Steen met ijs' : locked ? 'Steen met slot' : isKey ? 'Sleutelsteen' : gold ? 'Gouden steen' : 'Steen';
      board += `<g class="watch-tile${back ? ' back' : ''}" data-tile="${i}" transform="translate(${tile.x},${tile.y})"><title>${title}</title>` +
        `<rect x=".055" y=".075" width=".98" height="1.22" rx=".09" fill="#c6af73"/><rect width=".98" height="1.22" rx=".09" fill="${back ? '#2a78d6' : gold ? '#ffe89a' : '#fff8e8'}"/>` +
        (back ? '<path d="M.18 .2 L.8 1 M.8 .2 L.18 1 M.49 .12 V1.1" stroke="#8dbff4" stroke-width=".04"/>' : faceMarkup(state.f[i], theme, .06, .07, .86, 1.08)) +
        (ice ? `<rect width=".98" height="1.22" rx=".09" fill="#a9dfff" opacity=".5"/><text x=".49" y=".7" text-anchor="middle" font-size=".48">❄️</text>` : '') +
        (locked || isKey ? `<text x=".72" y="1.07" text-anchor="middle" font-size=".4">${locked ? '🔒' : '🔑'}</text>` : '') +
        (replay.tap === i ? '<rect width=".98" height="1.22" rx=".09" fill="none" stroke="#ffc531" stroke-width=".06"/>' : '') + '</g>';
    }
    if (state.ck && state.a[state.ck.i]) {
      const tile = positions[state.ck.i];
      board += `<g transform="translate(${tile.x + .55},${tile.y - .08})"><rect x="-.1" y="-.28" width=".95" height=".4" rx=".1" fill="#fff8e8"/><text x=".36" y="0" text-anchor="middle" font-size=".25">⏰ ${Math.max(0, state.ck.n - state.m)}</text></g>`;
    }
    el('watchBoard').setAttribute('viewBox', `${left} ${top - .3} ${width} ${height + .3}`);
    el('watchBoard').classList.toggle('nonum', !nums);
    el('watchBoard').innerHTML = board;
    el('watchTray').innerHTML = Array.from({ length: 4 }, (_, slot) => {
      const i = state.tr[slot];
      return `<div class="watch-slot${i === undefined ? ' vacant' : ''}">${i === undefined ? '' : `<svg viewBox="0 0 1 1.24" role="img" aria-label="Steen in vakje ${slot + 1}">${faceMarkup(state.f[i], theme, .06, .07, .88, 1.1)}</svg>`}</div>`;
    }).join('');
    el('watchTray').classList.toggle('nonum', !nums);
    el('watchScreen').hidden = false; el('watchEmpty').hidden = true;
    const level = initial.key.startsWith('L') ? `Level ${initial.key.slice(1)}` : initial.key.startsWith('D') ? `Dagpuzzel ${initial.key.slice(1)}` : initial.key;
    const seconds = Math.floor(replay.ms / 1000);
    el('watchStats').textContent = `${level} · poging ${initial.at || 1} · ${state.a.reduce((n, a) => n + a, 0)} stenen over · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}${initial.partial ? ' · hervatte opname' : ''}`;
    status();
  }
  function update(type, message, token) {
    if (generation !== token) return;
    try {
      const { path, data } = JSON.parse(message.data), parts = path.split('/').filter(Boolean);
      if (parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p) || ['__proto__', 'constructor', 'prototype'].includes(p))) throw Error('Ongeldig opnamepad');
      if (!parts.length) records = type === 'put' ? (data || {}) : { ...records, ...(data || {}) };
      else {
        const [chunk, field] = parts;
        if (parts.length > 2) throw Error('Ongeldig opnamepad');
        if (field) records[chunk] = { ...records[chunk], [field]: data };
        else if (data === null) delete records[chunk];
        else records[chunk] = type === 'patch' ? { ...records[chunk], ...data } : data;
      }
      replay = DashReplay.read(records, context.aid); connected = true; error = ''; draw();
    } catch (e) { error = 'Spelopname is onvolledig of ongeldig'; empty('Dit spelbeeld kan nog niet betrouwbaar worden getoond. Nieuwe opnamegegevens worden automatisch verwerkt.'); status(); }
  }
  function connect() {
    if (!context || !context.aid || document.hidden) return;
    close(); connected = false;
    const token = generation;
    source = new EventSource(dbUrl(`replays/${encodeURIComponent(context.pid)}/${encodeURIComponent(context.aid)}`));
    source.addEventListener('put', e => update('put', e, token));
    source.addEventListener('patch', e => update('patch', e, token));
    source.onerror = () => { if (generation === token) { connected = false; status(); } };
    source.addEventListener('cancel', () => { if (generation === token) { error = 'Geen toegang tot spelopnames'; close(); empty('De database laat het lezen van deze opname niet toe.'); status(); } });
  }
  function follow(pid, name, events) {
    const reverse = [...events].reverse();
    const anchor = reverse.find(e => e.k === 'start' || e.k === 'end');
    const expired = anchor && anchor.t < Date.now() - 30 * 86400000;
    const aid = !expired && anchor && typeof anchor.aid === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(anchor.aid) ? anchor.aid : '';
    const phase = reverse.find(e => ['start', 'end', 'pause', 'hide', 'show'].includes(e.k));
    context = { pid, aid, result: anchor && anchor.k === 'end' ? anchor.r : null,
      paused: !!(phase && (phase.k === 'pause' || phase.k === 'hide' || phase.k === 'show' && phase.scr && phase.scr !== 'game')) };
    el('watchName').textContent = name || 'Kies een speler';
    const next = aid && pid ? `${pid}/${aid}` : '';
    if (key !== next || !next) {
      close(); key = next; records = {}; replay = null; connected = false; error = '';
      empty(!pid ? 'Kies een speler om mee te kijken.' : !anchor ? 'Er is nog geen gespeeld level om te tonen.' : expired ? 'Spelopnames worden 30 dagen bewaard. Deze poging is ouder.' : !aid ? 'Voor deze poging is geen spelopname beschikbaar. Nieuwe pogingen vanaf versie 1.50 kunnen hier worden getoond.' : 'Wachten op het eerste spelbeeld…');
      if (next) connect();
    }
    status();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { close(); connected = false; status(); } else { connect(); status(); } });
  addEventListener('pagehide', close);
  setInterval(status, 1000);
  window.DashWatch = { follow };
})();
