// uses: board, win
/* All sounds are synthesized with WebAudio: no files, instant, works offline. */
const Sound = (() => {
  let ctx = null, master, sfx, verb, noiseBuf, pinkBuf = null, brownBuf = null;
  let sfxOn = true, musicOn = true, musicTimer = null, beat = 0, mood = 'calm';
  let trackId = 'mus_piano', explicitTrack = false, previewId = null, activeLoopId = null;
  let loopGen = 0, activeSession = null, sfxPack = 'sfx_ivory', sfxPrev = null;
  // C-major pentatonic, warm "music box" register
  const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5, 1568.0];

  // Self-contained Pass A approved offline music tracks (mirrors SHOP_CATALOG.music 1-to-1; null-prototype blocks inherited keys)
  const MUSIC_TRACKS = Object.assign(Object.create(null), {
    mus_piano: { synth: 'piano' },
    mus_sunflower: { synth: 'sunflower' },
    mus_moonlight: { notes: [277.2, 329.6, 415.3, 277.2, 329.6, 415.3, 392.0, 329.6], wave: 'sine', tempo: 420, overtone: 2.0, decay: 0.56 },
    mus_clair: { notes: [349.2, 440.0, 523.3, 698.5, 659.3, 523.3, 440.0, 392.0], wave: 'sine', tempo: 430, overtone: 2.0, softAttack: 0.04, decay: 0.60 },
    mus_waltz: { notes: [261.6, 392.0, 392.0, 329.6, 392.0, 392.0, 349.2, 440.0], wave: 'triangle', tempo: 350, overtone: 2.0, softAttack: 0.035, decay: 0.44 },
    mus_guzheng: { notes: [293.7, 329.6, 440.0, 587.3, 493.9, 440.0, 329.6, 293.7], wave: 'triangle', tempo: 340, overtone: 2.0, decay: 0.50 },
    mus_lotus: { notes: [261.6, 293.7, 392.0, 440.0, 523.3, 440.0, 392.0, 293.7], wave: 'sine', tempo: 420, overtone: 2.0, decay: 0.58 },
    mus_teahouse: { notes: [329.6, 392.0, 440.0, 523.3, 659.3, 523.3, 440.0, 392.0], wave: 'sine', tempo: 370, overtone: 1.5, decay: 0.48 },
    mus_waterfall: { synth: 'waterfall' },
    mus_guitar: { notes: [293.7, 370.0, 440.0, 587.3, 493.9, 440.0, 370.0, 329.6], wave: 'triangle', tempo: 320, overtone: 2.0, decay: 0.42 },
    mus_rain: { synth: 'rain' },
    mus_box: { notes: [523.3, 659.3, 784.0, 1046.5, 987.8, 784.0, 659.3, 587.3], wave: 'sine', tempo: 290, overtone: 3.0, decay: 0.36 },
    mus_cafe: { notes: [329.6, 392.0, 493.9, 659.3, 587.3, 493.9, 392.0, 349.2], wave: 'triangle', tempo: 340, overtone: 1.5, decay: 0.42 },
    mus_harp: { notes: [392.0, 493.9, 587.3, 784.0, 987.8, 784.0, 587.3, 493.9], wave: 'sine', tempo: 300, overtone: 2.0, decay: 0.52 },
  });

  const isValidTrackId = id => typeof id === 'string' && Object.prototype.hasOwnProperty.call(MUSIC_TRACKS, id);
  const normalizeTrackId = id => (isValidTrackId(id) ? id : 'mus_piano');

  function _init(skipAutoMusic = false) {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    // Dedicated SFX echo-reverb so stopping/switching music never cuts SFX tails
    const d1 = ctx.createDelay(1); d1.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    verb = ctx.createGain(); verb.gain.value = 0.28;
    verb.connect(d1); d1.connect(lp); lp.connect(fb); fb.connect(d1); lp.connect(master);
    sfx.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    if (!skipAutoMusic && musicOn) startMusic();
  }
  const init = () => _init(false);

  function ensureAmbientBuffers() {
    if (!ctx || (pinkBuf && brownBuf)) return;
    const len = ctx.sampleRate * 4;
    pinkBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const p = pinkBuf.getChannelData(0), b = brownBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, lastBrown = 0;
    for (let i = 0; i < len; i++) {
      const wh = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + wh * 0.0555179;
      b1 = 0.99332 * b1 + wh * 0.0750759;
      b2 = 0.96900 * b2 + wh * 0.1538520;
      b3 = 0.86650 * b3 + wh * 0.3104856;
      b4 = 0.55000 * b4 + wh * 0.5329522;
      b5 = -0.7616 * b5 - wh * 0.0168980;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + wh * 0.5362) * 0.045;
      b6 = wh * 0.115926;
      lastBrown = (lastBrown + 0.02 * wh) / 1.02;
      b[i] = lastBrown * 1.1;
    }
    const xf = Math.min(2000, Math.floor(len / 4));
    for (let i = 0; i < xf; i++) {
      const k = i / xf;
      p[len - xf + i] = p[len - xf + i] * (1 - k) + p[i] * k;
      b[len - xf + i] = b[len - xf + i] * (1 - k) + b[i] * k;
    }
  }

  function trackVoice(v, voices) {
    if (!voices) return;
    voices.add(v);
    v.onended = () => voices.delete(v);
  }

  function tone(f, t, dur, vol, type = 'sine', dest = sfx, attack = 0.004, voices = null) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    trackVoice(o, voices);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function bell(f, t, vol = 0.18, dur = 1.1, dest = sfx, voices = null) {
    tone(f, t, dur, vol, 'sine', dest, 0.004, voices);
    tone(f * 2, t, dur * 0.55, vol * 0.32, 'sine', dest, 0.004, voices);
    tone(f * 3.01, t, dur * 0.28, vol * 0.13, 'sine', dest, 0.004, voices);
  }
  function noise(t, dur, vol, f0, f1, q = 1.2, dest = sfx, voices = null) {
    if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(Math.max(80, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(dest);
    trackVoice(s, voices);
    s.start(t); s.stop(t + dur + 0.02);
  }
  const now = () => ctx ? ctx.currentTime + 0.005 : 0;
  // wooden marimba: sine + a quick bright partial
  function marimba(f, t, vol = 0.15, dest = sfx) {
    tone(f, t, 0.5, vol, 'sine', dest);
    tone(f * 4, t, 0.06, vol * 0.25, 'sine', dest);
    tone(f * 2, t, 0.18, vol * 0.2, 'triangle', dest);
  }
  // a little bird: two fast upward whistles
  function chirp(t, vol = 0.05, dest = sfx, voices = null) {
    if (!ctx) return;
    for (let k = 0; k < 2; k++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), s0 = t + k * 0.09;
      o.type = 'sine';
      o.frequency.setValueAtTime(2300 + Math.random() * 300, s0);
      o.frequency.exponentialRampToValueAtTime(3600 + Math.random() * 500, s0 + 0.06);
      g.gain.setValueAtTime(0.0001, s0); g.gain.exponentialRampToValueAtTime(vol, s0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.08);
      o.connect(g); g.connect(dest);
      trackVoice(o, voices);
      o.start(s0); o.stop(s0 + 0.1);
    }
  }
  function playCoins(t0, count) {
    for (let i = 0; i < count; i++) {
      const ti = t0 + i * 0.085;
      tone(1318.5 + i * 110, ti, 0.14, 0.11, 'sine', sfx, 0.002);
      tone(2637 + i * 220, ti, 0.08, 0.055, 'triangle', sfx, 0.002);
    }
  }
  // ---- tile sound packs (SHOP_CATALOG.sfx): only tap, land and match change; sfx_ivory is the original sound ----
  const packOf = id => {
    const list = typeof SHOP_CATALOG !== 'undefined' && SHOP_CATALOG.sfx;
    return list && typeof id === 'string' ? list.find(p => p.id === id) || null : null;
  };
  const isStarterPack = id => id === 'sfx_ivory' || !packOf(id);
  // one tile hit of a pack at tray slot 0..3 (the pitch steps up 6% per slot); vol scales the whole hit
  function packHit(p, t, slot, vol, dest) {
    const f = p.freq * (1 + slot * 0.06), soft = p.softAttack ? 0.025 : 0.004;
    if (p.clickFreq || p.synth === 'mallet') {
      const c = p.clickFreq || p.freq * 3.4;
      noise(t, 0.045, 0.28 * vol, c, c * 0.65, 3.2, dest);
    }
    if (p.sweep) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f * 0.75, t);
      o.frequency.exponentialRampToValueAtTime(f * p.sweep, t + 0.08);
      g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.14 * vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.13);
    } else {
      tone(f, t, 0.13, 0.14 * vol, p.type, dest, soft);
      if (p.overtone) tone(f * p.overtone, t, 0.08, 0.05 * vol, 'sine', dest, 0.004);
    }
  }
  // the match chord of a pack: its ratios, climbing two semitones per combo step
  function packMatch(p, t, combo, dest) {
    const up = Math.pow(2, Math.min(Math.max(combo, 1) - 1, 6) * 2 / 12);
    (p.matchRatios || [1, 1.25, 1.5]).forEach((r, i) => {
      const tm = t + i * 0.075, f = p.freq * r * up;
      tone(f, tm, 0.42, 0.15, p.type, dest, 0.005);
      tone(f * 2, tm, 0.22, 0.045, 'sine', dest, 0.005);
    });
  }
  // sfx_ivory: today's sounds, unchanged
  const ivoryTap = (t, dest) => { noise(t, 0.06, 0.5, 2400, 1400, 3, dest); tone(880, t, 0.09, 0.08, 'triangle', dest); };
  const ivoryLand = (t, s, dest) => {
    const scale = 1 + s * 0.06;
    tone(520 * scale, t, 0.07, 0.07, 'sine', dest);
    noise(t, 0.03, 0.25, 1200 * scale, 800 * scale, 4, dest);
  };
  function ivoryMatch(t, combo, dest) {
    if (mood === 'sunny') {
      const b = Math.min(combo - 1, 6);
      noise(t, 0.04, 0.4, 2800, 2000, 3, dest);
      [0, 2, 4].forEach((k, i) => marimba(PENTA[b + k + 2], t + 0.02 + i * 0.06, 0.16, dest));
      if (combo >= 2) marimba(PENTA[Math.min(b + 7, 13)], t + 0.2, 0.13, dest);
      chirp(t + 0.12, 0.05, dest);
      if (combo >= 3) chirp(t + 0.3, 0.05, dest);
      return;
    }
    const base = Math.min(combo - 1, 7);
    noise(t, 0.05, 0.45, 2600, 1800, 3, dest);
    bell(PENTA[base + 2], t + 0.02, 0.17, 1.1, dest);
    bell(PENTA[base + 4], t + 0.09, 0.15, 1.1, dest);
    if (combo >= 2) bell(PENTA[base + 6], t + 0.16, 0.13, 1.1, dest);
    if (combo >= 3) for (let i = 0; i < 4; i++) tone(PENTA[9 + (i % 5)], t + 0.22 + i * 0.045, 0.25, 0.05, 'sine', dest);
  }
  const slotOf = slot => Math.max(0, Math.min(3, Math.floor(Number(slot) || 0)));
  function stopSfxPreview() {
    if (!sfxPrev) return;
    const pv = sfxPrev; sfxPrev = null;
    clearTimeout(pv.timer);
    try { pv.bus.gain.setValueAtTime(0.0001, ctx.currentTime); } catch (e) { }
    setTimeout(() => { try { pv.bus.disconnect(); } catch (e) { } }, 60);
  }
  const ok = () => ctx && sfxOn;
  const resolvedTrackId = () => explicitTrack ? normalizeTrackId(trackId) : (mood === 'sunny' ? 'mus_sunflower' : 'mus_piano');

  return {
    init,
    setSfx(v) { sfxOn = Boolean(v); },
    setMusic(v) {
      musicOn = Boolean(v);
      previewId = null;
      if (musicOn) startTrack(resolvedTrackId());
      else stopMusicLoop();
    },
    // 'calm' = music box, 'sunny' = the Zonnebloem theme's cheerful waltz with birds (until explicit track chosen)
    setMood(m) {
      if (m === mood) return;
      mood = m;
      beat = 0;
      if (!explicitTrack && !previewId && activeLoopId) startTrack(resolvedTrackId());
    },
    setMusicTrack(id) {
      explicitTrack = true;
      trackId = normalizeTrackId(id);
      if (ctx && musicOn && !previewId && activeLoopId !== trackId) startTrack(trackId);
      return trackId;
    },
    previewMusic(id) {
      if (!isValidTrackId(id)) return false;
      _init(true);
      if (!ctx) return false;
      previewId = id;
      startTrack(id);
      return true;
    },
    // the ▶ of a Steengeluid row: a short tap, land and match phrase; onEnd runs when it ends by itself
    previewSfx(id, onEnd) {
      const p = packOf(id);
      if (!p || !sfxOn) return false;
      _init(true);
      if (!ctx) return false;
      stopSfxPreview();
      const bus = ctx.createGain(); bus.connect(sfx);
      const t = now(), ivory = isStarterPack(id);
      if (ivory) { ivoryTap(t, bus); ivoryLand(t + 0.4, 0, bus); ivoryLand(t + 0.6, 1, bus); ivoryMatch(t + 1.0, 2, bus); }
      else { packHit(p, t, 0, 1, bus); packHit(p, t + 0.4, 0, 0.7, bus); packHit(p, t + 0.6, 1, 0.7, bus); packMatch(p, t + 1.0, 2, bus); }
      const timer = setTimeout(() => { if (sfxPrev && sfxPrev.bus === bus) { stopSfxPreview(); if (onEnd) onEnd(); } }, 2300);
      sfxPrev = { bus, timer };
      return true;
    },
    stopSfxPreview,
    stopPreview(resumeEquipped = true) {
      previewId = null;
      stopMusicLoop();
      if (resumeEquipped && musicOn && ctx) startTrack(resolvedTrackId());
    },
    stopMusic() {
      previewId = null;
      stopMusicLoop();
    },
    hasMusicTrack(id) { return isValidTrackId(id); },
    listMusicTracks() { return Object.keys(MUSIC_TRACKS); },
    pickShuffleTrack(ownedIds, currentId) {
      const valid = [];
      const seen = new Set();
      if (Array.isArray(ownedIds)) {
        for (const id of ownedIds) {
          if (isValidTrackId(id) && !seen.has(id)) { seen.add(id); valid.push(id); }
        }
      }
      if (!valid.length) return 'mus_piano';
      const cur = isValidTrackId(currentId) ? currentId : resolvedTrackId();
      const pool = valid.length >= 2 ? valid.filter(id => id !== cur) : valid;
      return pool[Math.floor(Math.random() * pool.length)] || valid[0];
    },
    applyAudio(opts = {}) {
      if (opts && typeof opts.musicTrack === 'string') this.setMusicTrack(opts.musicTrack);
      // the equipped tile sound pack (a missing or unknown id falls back to the starter)
      const want = opts && typeof opts.sfxPack === 'string' ? opts.sfxPack : (typeof S !== 'undefined' && S ? S.sfxPack : '');
      sfxPack = packOf(want) ? want : 'sfx_ivory';
      return { musicTrack: resolvedTrackId(), sfxPack };
    },
    getMusicState() {
      return {
        trackId: resolvedTrackId(),
        previewId,
        activeLoopId,
        playing: Boolean(activeLoopId),
        musicOn,
        sfxOn,
        mood,
        explicitTrack,
        sfxPack,
        activeNodeCount: activeSession ? activeSession.nodes.length : 0,
        tracks: Object.keys(MUSIC_TRACKS),
      };
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

    // wooden "clack" when picking up a tile
    select() {
      if (!ok()) return; const t = now();
      if (isStarterPack(sfxPack)) ivoryTap(t, sfx); else packHit(packOf(sfxPack), t, 0, 1, sfx);
    },
    flip() { if (!ok()) return; const t = now(); noise(t, 0.08, 0.35, 900, 2600, 2); tone(660, t + 0.04, 0.1, 0.05, 'triangle'); },
    blocked() {
      if (!ok()) return; const t = now();
      tone(180, t, 0.18, 0.18, 'sine'); tone(140, t + 0.07, 0.2, 0.14, 'sine');
    },
    // the reward: a bright bell chord that climbs with every combo step
    match(combo = 1) {
      if (!ok()) return; const t = now();
      if (isStarterPack(sfxPack)) ivoryMatch(t, combo, sfx); else packMatch(packOf(sfxPack), t, combo, sfx);
    },
    // a tile settling into its tray slot (slot 0..3 steps pitch gently upward)
    land(slot = 0) {
      if (!ok()) return;
      const t = now();
      const s = slotOf(slot);
      if (isStarterPack(sfxPack)) ivoryLand(t, s, sfx); else packHit(packOf(sfxPack), t, s, 0.7, sfx);
    },
    // tray has only one slot left: two gentle warning notes
    warn() { if (!ok()) return; const t = now(); tone(587, t, 0.18, 0.07, 'triangle'); tone(740, t + 0.14, 0.22, 0.07, 'triangle'); },
    // big moment: 5x combo or the last pair
    supercombo() {
      if (!ok()) return; const t = now();
      for (let i = 0; i < 10; i++) tone(PENTA[3 + i], t + i * 0.035, 0.35, 0.06, 'sine');
      bell(PENTA[12], t + 0.38, 0.14, 1.6); bell(PENTA[9], t + 0.38, 0.1, 1.6);
    },
    perfect() {
      if (!ok()) return; const t = now();
      [7, 9, 10, 12].forEach((n, i) => bell(PENTA[n], t + i * 0.1, 0.13, 1.4));
      if (mood === 'sunny') chirp(t + 0.5, 0.06);
    },
    trophy() {
      if (!ok()) return; const t = now();
      [[0, 0], [2, 0.12], [4, 0.24], [7, 0.36]].forEach(([n, d]) => { tone(PENTA[n + 2], t + d, 0.35, 0.09, 'triangle'); bell(PENTA[n + 5], t + d, 0.08, 0.6); });
      [PENTA[2], PENTA[4], PENTA[7]].forEach(f => tone(f, t + 0.5, 1.6, 0.06, 'triangle'));
      bell(PENTA[12], t + 0.5, 0.12, 1.8);
    },
    sunflower() {
      if (!ok()) return; const t = now();
      const mel = [5, 7, 9, 7, 9, 10, 12, 13];
      mel.forEach((n, i) => marimba(PENTA[n], t + i * 0.13, 0.15));
      [PENTA[0], PENTA[2], PENTA[4], PENTA[7]].forEach(f => tone(f, t + 1.0, 2.2, 0.06, 'triangle'));
      chirp(t + 0.4, 0.06); chirp(t + 1.1, 0.06); chirp(t + 1.5, 0.05);
    },
    // overtaking someone in the ranking: a rising "whoosh-ding", higher with every pass
    pass(k = 0) {
      if (!ok()) return; const t = now();
      const idx = Math.max(0, Math.min(8, Math.floor(Number(k) || 0)));
      noise(t, 0.18, 0.3, 600, 2600, 1);
      bell(PENTA[5 + idx], t + 0.1, 0.14, 0.9);
    },
    // gentle welcoming chime for actionable "X passed you" notice (replaces Sound.blocked())
    passedNotice() {
      if (!ok()) return; const t = now();
      bell(PENTA[5], t, 0.11, 0.65);
      bell(PENTA[7], t + 0.11, 0.12, 0.85);
    },
    rankUp() {
      if (!ok()) return; const t = now();
      [4, 7, 9, 12].forEach((n, i) => bell(PENTA[n], t + i * 0.09, 0.14, 1.2));
      [PENTA[0], PENTA[4], PENTA[7]].forEach(f => tone(f, t + 0.4, 1.4, 0.06, 'triangle'));
    },
    hint() {
      if (!ok()) return; const t = now();
      [0, 1, 2, 3, 4].forEach(i => tone(PENTA[7 + i], t + i * 0.06, 0.4, 0.07, 'sine'));
    },
    shuffle() {
      if (!ok()) return; const t = now();
      noise(t, 0.5, 0.5, 400, 3000, 0.8);
      for (let i = 0; i < 6; i++) noise(t + 0.08 + i * 0.06, 0.05, 0.25, 2000, 1500, 4);
    },
    button() { if (!ok()) return; const t = now(); tone(740, t, 0.08, 0.06, 'triangle'); },
    star(i) { if (!ok()) return; const t = now(); bell(PENTA[5 + i * 2], t, 0.2, 1.4); tone(PENTA[10 + i], t + 0.05, 0.5, 0.06); },
    win() {
      if (!ok()) return; const t = now();
      const seq = [0, 2, 4, 5, 7, 9];
      seq.forEach((n, i) => bell(PENTA[n + 2], t + i * 0.09, 0.15, 0.9));
      [PENTA[0], PENTA[2], PENTA[3], PENTA[5]].forEach(f => tone(f, t + 0.6, 1.8, 0.07, 'triangle'));
    },
    stuck() {
      if (!ok()) return; const t = now();
      [7, 5, 4, 2].forEach((n, i) => tone(PENTA[n], t + i * 0.16, 0.5, 0.09, 'triangle'));
    },
    unlock() {
      if (!ok()) return; const t = now();
      [5, 7, 9, 12, 13].forEach((n, i) => bell(PENTA[n], t + i * 0.08, 0.12, 1.2));
    },
    coin(count = 1) {
      if (!ok()) return;
      const n = Math.max(1, Math.min(4, Math.floor(Number(count) || 1)));
      playCoins(now(), n);
    },
    autoFinish(coins = 2) {
      if (!ok()) return;
      const t = now();
      [7, 9, 10].forEach((n, i) => bell(PENTA[n], t + i * 0.06, 0.09, 0.55));
      const c = Math.max(0, Math.min(4, Math.floor(Number(coins) || 0)));
      if (c > 0) playCoins(t + 0.14, c);
    },
  };

  function createSession(ambientMode) {
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(master);
    const session = { out, fb: null, busses: [], nodes: [], voices: new Set(), dest: null, cleaned: false };
    if (ambientMode) {
      // Dry ambient bus bypasses echo-reverb so continuous rain/waterfall noise stays phase-clean
      const amb = ctx.createGain();
      amb.gain.value = 0.52;
      amb.connect(out);
      session.dest = amb;
      session.busses.push(amb);
    } else {
      const dry = ctx.createGain();
      dry.gain.value = 0.55;
      dry.connect(out);
      const mv = ctx.createGain();
      mv.gain.value = 0.28;
      const d1 = ctx.createDelay(1);
      d1.delayTime.value = 0.23;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      dry.connect(mv); mv.connect(d1); d1.connect(lp); lp.connect(fb); fb.connect(d1); lp.connect(out);
      session.fb = fb;
      session.dest = dry;
      session.busses.push(dry, mv, d1, fb, lp);
    }
    return session;
  }

  function teardownSession(session) {
    if (!session) return;
    const cleanup = () => {
      if (session.cleaned) return;
      session.cleaned = true;
      try { session.out.disconnect(); } catch (e) { }
      if (session.fb) { try { session.fb.disconnect(); } catch (e) { } }
      for (const n of session.busses) { try { n.disconnect(); } catch (e) { } }
      for (const n of session.nodes) {
        try { if (n.stop) n.stop(); } catch (e) { }
        try { if (n.disconnect) n.disconnect(); } catch (e) { }
      }
      for (const v of session.voices) {
        try { if (v.stop) v.stop(); } catch (e) { }
        try { if (v.disconnect) v.disconnect(); } catch (e) { }
      }
      session.busses.length = 0;
      session.nodes.length = 0;
      session.voices.clear();
    };
    if (ctx && ctx.state === 'running') {
      try {
        const t0 = ctx.currentTime;
        const cur = Math.max(0.0001, session.out.gain.value);
        session.out.gain.cancelScheduledValues(t0);
        session.out.gain.setValueAtTime(cur, t0);
        session.out.gain.linearRampToValueAtTime(0.0001, t0 + 0.025);
      } catch (e) { }
      setTimeout(cleanup, 40);
    } else {
      cleanup();
    }
  }

  function startMusic() {
    if (!ctx || activeLoopId) return;
    startTrack(previewId || resolvedTrackId());
  }

  function startTrack(id) {
    if (!ctx) return;
    const validId = normalizeTrackId(id);
    const tr = MUSIC_TRACKS[validId];
    stopMusicLoop();
    const gen = loopGen;
    const ambientMode = tr.synth === 'rain' || tr.synth === 'waterfall';
    const session = createSession(ambientMode);
    activeSession = session;
    activeLoopId = validId;
    beat = 0;
    if (tr.synth === 'sunflower') return startSunny(gen, session);
    if (tr.synth === 'rain') return startZachteRegen(gen, session);
    if (tr.synth === 'waterfall') return startWaterval(gen, session);
    if (tr.synth === 'piano') return startPiano(gen, session);
    return startCatalogTrack(tr, gen, session);
  }

  // gentle generative music-box background (mus_piano)
  function startPiano(gen, session) {
    const chords = [[0, 2, 4, 7], [4, 5, 7, 9], [3, 5, 7, 10], [1, 3, 6, 8]];
    musicTimer = setInterval(() => {
      if (gen !== loopGen || session !== activeSession || !ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.05;
      const ch = chords[Math.floor(beat / 8) % chords.length];
      if (beat % 8 === 0) {
        tone(PENTA[ch[0]] / 2, t, 3.6, 0.045, 'sine', session.dest, 0.4, session.voices);
        tone(PENTA[ch[1]] / 2, t, 3.6, 0.03, 'sine', session.dest, 0.5, session.voices);
      }
      if (Math.random() < (beat % 2 === 0 ? 0.7 : 0.35)) {
        const n = ch[Math.floor(Math.random() * ch.length)] + (Math.random() < 0.5 ? 0 : 3);
        bell(PENTA[Math.min(n + 2, PENTA.length - 1)], t, 0.035, 1.4, session.dest, session.voices);
      }
      beat++;
    }, 420);
  }

  // cheerful summer waltz (3/4) with a marimba tune and birds now and then (mus_sunflower)
  function startSunny(gen, session) {
    const bars = [[0, 2, 4], [3, 5, 7], [4, 6, 8], [0, 2, 4], [1, 3, 5], [3, 5, 7], [4, 6, 9], [0, 4, 7]];
    const tune = [7, 9, 10, 9, 7, 5, 7, 9, 12, 10, 9, 7, 5, 4, 5, 7, 9, 7, 5, 4, 2, 4, 5, 4];
    musicTimer = setInterval(() => {
      if (gen !== loopGen || session !== activeSession || !ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.05;
      const bar = bars[Math.floor(beat / 3) % bars.length], pos = beat % 3;
      if (pos === 0) tone(PENTA[bar[0]] / 2, t, 0.9, 0.05, 'triangle', session.dest, 0.01, session.voices);
      else {
        tone(PENTA[bar[1]], t, 0.25, 0.022, 'triangle', session.dest, 0.004, session.voices);
        tone(PENTA[bar[2]], t, 0.25, 0.018, 'triangle', session.dest, 0.004, session.voices);
      }
      const n = tune[beat % tune.length];
      if (Math.random() < 0.8) tone(PENTA[Math.min(n, 13)], t, 0.45, 0.045, 'sine', session.dest, 0.004, session.voices);
      if (beat % 24 === 17 && Math.random() < 0.7) chirp(t + 0.1, 0.018, session.dest, session.voices);
      beat++;
    }, 330);
  }

  // approved soft pattering rain on leaves + occasional warm felt-piano note (mus_rain)
  function startZachteRegen(gen, session) {
    ensureAmbientBuffers();
    const src = ctx.createBufferSource(); src.buffer = pinkBuf; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1150;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.24, ctx.currentTime + 0.5);
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(session.dest);
    src.start();
    session.nodes.push(src, g);

    let step = 0;
    const softNotes = [329.63, 392.0, 440.0, 523.25, 392.0, 329.63];
    musicTimer = setInterval(() => {
      if (gen !== loopGen || session !== activeSession || !ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.03;
      if (Math.random() < 0.78) {
        const f = 1100 + Math.random() * 850;
        noise(t + Math.random() * 0.14, 0.035, 0.022, f, f * 0.75, 4.5, session.dest, session.voices);
      }
      if (step % 7 === 1) {
        const nf = softNotes[Math.floor(step / 7) % softNotes.length];
        tone(nf, t + 0.05, 1.8, 0.024, 'sine', session.dest, 0.06, session.voices);
      }
      step++;
    }, 240);
  }

  // approved 4-layer waterfall (170-1550 Hz) calibrated for phone speakers & tap headroom (mus_waterfall)
  function startWaterval(gen, session) {
    ensureAmbientBuffers();
    const WATERVAL_GAIN = 0.84;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.001, ctx.currentTime);
    out.gain.linearRampToValueAtTime(WATERVAL_GAIN, ctx.currentTime + 0.55);
    out.connect(session.dest);

    // Layer 1: Warm cascade body above phone-speaker roll-off (170-560 Hz)
    const bodySrc = ctx.createBufferSource(); bodySrc.buffer = brownBuf; bodySrc.loop = true;
    const bodyHp = ctx.createBiquadFilter(); bodyHp.type = 'highpass'; bodyHp.frequency.value = 170;
    const bodyLp = ctx.createBiquadFilter(); bodyLp.type = 'lowpass'; bodyLp.frequency.value = 560; bodyLp.Q.value = 0.6;
    const bodyGain = ctx.createGain(); bodyGain.gain.value = 0.26;
    bodySrc.connect(bodyHp); bodyHp.connect(bodyLp); bodyLp.connect(bodyGain); bodyGain.connect(out);
    bodySrc.start();

    // Layer 2: Main falling water curtain (380-1480 Hz) with two slow incommensurate LFOs
    const foamSrc = ctx.createBufferSource(); foamSrc.buffer = pinkBuf; foamSrc.loop = true;
    foamSrc.loopStart = 0.55; foamSrc.loopEnd = 3.85;
    const foamBp = ctx.createBiquadFilter(); foamBp.type = 'bandpass'; foamBp.frequency.value = 780; foamBp.Q.value = 0.72;
    const foamLp = ctx.createBiquadFilter(); foamLp.type = 'lowpass'; foamLp.frequency.value = 1480; foamLp.Q.value = 0.7;
    const foamGain = ctx.createGain(); foamGain.gain.value = 0.22;

    const lfoFreq = ctx.createOscillator(), lfoFreqGain = ctx.createGain();
    lfoFreq.frequency.value = 0.13; lfoFreqGain.gain.value = 95;
    lfoFreq.connect(lfoFreqGain); lfoFreqGain.connect(foamBp.frequency);

    const lfoAmp = ctx.createOscillator(), lfoAmpGain = ctx.createGain();
    lfoAmp.frequency.value = 0.23; lfoAmpGain.gain.value = 0.028;
    lfoAmp.connect(lfoAmpGain); lfoAmpGain.connect(foamGain.gain);

    foamSrc.connect(foamBp); foamBp.connect(foamLp); foamLp.connect(foamGain); foamGain.connect(out);
    foamSrc.start(); lfoFreq.start(); lfoAmp.start();

    // Layer 3: Secondary aerated mist veil (650-1550 Hz)
    const veilSrc = ctx.createBufferSource(); veilSrc.buffer = pinkBuf; veilSrc.loop = true;
    veilSrc.loopStart = 1.9; veilSrc.loopEnd = 3.95; veilSrc.playbackRate.value = 0.93;
    const veilBp = ctx.createBiquadFilter(); veilBp.type = 'bandpass'; veilBp.frequency.value = 1120; veilBp.Q.value = 1.1;
    const veilLp = ctx.createBiquadFilter(); veilLp.type = 'lowpass'; veilLp.frequency.value = 1550;
    const veilGain = ctx.createGain(); veilGain.gain.value = 0.085;

    const lfoVeil = ctx.createOscillator(), lfoVeilGain = ctx.createGain();
    lfoVeil.frequency.value = 0.19; lfoVeilGain.gain.value = 0.020;
    lfoVeil.connect(lfoVeilGain); lfoVeilGain.connect(veilGain.gain);

    veilSrc.connect(veilBp); veilBp.connect(veilLp); veilLp.connect(veilGain); veilGain.connect(out);
    veilSrc.start(); lfoVeil.start();

    session.nodes.push(bodySrc, foamSrc, veilSrc, lfoFreq, lfoAmp, lfoVeil, out);

    // Layer 4: Soft aerated splash puffs & subtle plunge-pool bubble glugs
    musicTimer = setInterval(() => {
      if (gen !== loopGen || session !== activeSession || !ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.02;
      if (Math.random() < 0.72) {
        const s0 = t + Math.random() * 0.09;
        const dur = 0.085 + Math.random() * 0.06;
        const f0 = 700 + Math.random() * 520;
        const vol = 0.032 + Math.random() * 0.016;
        const s = ctx.createBufferSource(); s.buffer = pinkBuf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.8;
        bp.frequency.setValueAtTime(f0, s0);
        bp.frequency.exponentialRampToValueAtTime(Math.max(120, f0 * 0.76), s0 + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, s0);
        g.gain.exponentialRampToValueAtTime(vol, s0 + 0.022);
        g.gain.exponentialRampToValueAtTime(0.0001, s0 + dur);
        s.connect(bp); bp.connect(g); g.connect(out);
        trackVoice(s, session.voices);
        s.start(s0, Math.random() * 2.5); s.stop(s0 + dur + 0.03);
      }
      if (Math.random() < 0.42) {
        const b0 = t + Math.random() * 0.12;
        const bDur = 0.055 + Math.random() * 0.02;
        const bf = 420 + Math.random() * 340;
        const bVol = 0.012 + Math.random() * 0.008;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(bf, b0);
        o.frequency.exponentialRampToValueAtTime(bf * (1.42 + Math.random() * 0.26), b0 + bDur);
        g.gain.setValueAtTime(0.0001, b0);
        g.gain.exponentialRampToValueAtTime(bVol, b0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, b0 + bDur);
        o.connect(g); g.connect(out);
        trackVoice(o, session.voices);
        o.start(b0); o.stop(b0 + bDur + 0.02);
      }
    }, 185);
  }

  function startCatalogTrack(tr, gen, session) {
    let step = 0;
    const tick = () => {
      if (gen !== loopGen || session !== activeSession || !ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.03;
      const idx = step % tr.notes.length;
      const f = tr.notes[idx];
      if (idx % 4 === 0) tone(f * 0.5, t, (tr.tempo * 3.4) / 1000, 0.038, 'sine', session.dest, 0.04, session.voices);
      tone(f, t, tr.decay + 0.25, 0.052, tr.wave, session.dest, tr.softAttack || 0.014, session.voices);
      if (tr.overtone) tone(f * tr.overtone, t, tr.decay * 0.55, 0.016, 'sine', session.dest, 0.01, session.voices);
      step++;
    };
    tick();
    musicTimer = setInterval(tick, tr.tempo);
  }

  function stopMusicLoop() {
    loopGen++;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    activeLoopId = null;
    const session = activeSession;
    activeSession = null;
    if (session) teardownSession(session);
  }
})();
