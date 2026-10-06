/* All sounds are synthesized with WebAudio: no files, instant, works offline. */
const Sound = (() => {
  let ctx = null, master, sfx, music, verb, noiseBuf;
  let sfxOn = true, musicOn = true, musicTimer = null, beat = 0;
  // C-major pentatonic, warm "music box" register
  const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5, 1568.0];

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    music = ctx.createGain(); music.gain.value = 0.55; music.connect(master);
    // simple echo-reverb for sparkle
    const d1 = ctx.createDelay(1); d1.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    verb = ctx.createGain(); verb.gain.value = 0.28;
    verb.connect(d1); d1.connect(lp); lp.connect(fb); fb.connect(d1); lp.connect(master);
    sfx.connect(verb); music.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    if (musicOn) startMusic();
  }

  function tone(f, t, dur, vol, type = 'sine', dest = sfx, attack = 0.004) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function bell(f, t, vol = 0.18, dur = 1.1, dest = sfx) {
    tone(f, t, dur, vol, 'sine', dest);
    tone(f * 2, t, dur * 0.55, vol * 0.32, 'sine', dest);
    tone(f * 3.01, t, dur * 0.28, vol * 0.13, 'sine', dest);
  }
  function noise(t, dur, vol, f0, f1, q = 1.2) {
    if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(sfx);
    s.start(t); s.stop(t + dur + 0.02);
  }
  const now = () => ctx ? ctx.currentTime + 0.005 : 0;
  const ok = () => ctx && sfxOn;

  return {
    init,
    setSfx(v) { sfxOn = v; },
    setMusic(v) { musicOn = v; if (v) startMusic(); else stopMusic(); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

    // wooden "clack" when picking up a tile
    select() {
      if (!ok()) return; const t = now();
      noise(t, 0.06, 0.5, 2400, 1400, 3);
      tone(880, t, 0.09, 0.08, 'triangle');
    },
    flip() { if (!ok()) return; const t = now(); noise(t, 0.08, 0.35, 900, 2600, 2); tone(660, t + 0.04, 0.1, 0.05, 'triangle'); },
    deselect() { if (!ok()) return; const t = now(); noise(t, 0.05, 0.3, 1500, 900, 3); },
    blocked() {
      if (!ok()) return; const t = now();
      tone(180, t, 0.18, 0.18, 'sine'); tone(140, t + 0.07, 0.2, 0.14, 'sine');
    },
    // the reward: a bright bell chord that climbs with every combo step
    match(combo = 1) {
      if (!ok()) return; const t = now();
      const base = Math.min(combo - 1, 7);
      noise(t, 0.05, 0.45, 2600, 1800, 3);
      bell(PENTA[base + 2], t + 0.02, 0.17);
      bell(PENTA[base + 4], t + 0.09, 0.15);
      if (combo >= 2) bell(PENTA[base + 6], t + 0.16, 0.13);
      if (combo >= 3) for (let i = 0; i < 4; i++) tone(PENTA[9 + (i % 5)] * 1.0, t + 0.22 + i * 0.045, 0.25, 0.05, 'sine');
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
    undo() { if (!ok()) return; const t = now(); tone(660, t, 0.12, 0.08, 'triangle'); tone(523, t + 0.08, 0.16, 0.08, 'triangle'); },
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
  };

  // gentle generative music-box background
  function startMusic() {
    if (!ctx || musicTimer) return;
    const chords = [[0, 2, 4, 7], [4, 5, 7, 9], [3, 5, 7, 10], [1, 3, 6, 8]];
    musicTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.05;
      const ch = chords[Math.floor(beat / 8) % chords.length];
      if (beat % 8 === 0) {
        tone(PENTA[ch[0]] / 2, t, 3.6, 0.045, 'sine', music, 0.4);
        tone(PENTA[ch[1]] / 2, t, 3.6, 0.03, 'sine', music, 0.5);
      }
      if (Math.random() < (beat % 2 === 0 ? 0.7 : 0.35)) {
        const n = ch[Math.floor(Math.random() * ch.length)] + (Math.random() < 0.5 ? 0 : 3);
        bell(PENTA[Math.min(n + 2, PENTA.length - 1)], t, 0.035, 1.4, music);
      }
      beat++;
    }, 420);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
})();
