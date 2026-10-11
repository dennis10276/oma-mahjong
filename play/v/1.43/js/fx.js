/* Oma's Mahjong — particles: confetti, sparkles and flying emoji on a canvas over the game. */
'use strict';

// ---------- particles ----------
const FX = (() => {
  const c = $('#fx'), g = c.getContext('2d');
  let parts = [], running = false, dpr = 1;
  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
  resize(); addEventListener('resize', resize);
  const COLS = ['#ffd23f', '#ff6fa3', '#4fc3ff', '#5ee07f', '#ff9a3d', '#b48cff', '#ffffff'];
  function burst(x, y, n = 22, big = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (big ? 4 : 2.5) + Math.random() * (big ? 7 : 5);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, g: 0.18, life: 0, max: 40 + Math.random() * 25, size: (big ? 7 : 5) + Math.random() * 6, col: COLS[i % COLS.length], kind: i % 3 ? 'spark' : 'dot', rot: Math.random() * 6, vr: (Math.random() - .5) * .3 });
    }
    go();
  }
  function confetti() {
    for (let i = 0; i < 170; i++) {
      parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.6, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 3, g: 0.04, life: 0, max: 220 + Math.random() * 80, size: 7 + Math.random() * 7, col: COLS[i % 6], kind: 'paper', rot: Math.random() * 6, vr: (Math.random() - .5) * .25, sway: Math.random() * 6 });
    }
    go();
  }
  const sprites = {};
  function sprite(ch) {
    if (sprites[ch]) return sprites[ch];
    const S2 = 64, c2 = document.createElement('canvas'); c2.width = c2.height = S2;
    const x2 = c2.getContext('2d');
    x2.font = (S2 * 0.8) + "px 'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif";
    x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(ch, S2 / 2, S2 / 2 + 3);
    return (sprites[ch] = c2);
  }
  function emoji(x, y, list, n = 9) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4, sp = 3 + Math.random() * 5;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.16, life: 0, max: 55 + Math.random() * 25, size: 20 + Math.random() * 16, kind: 'emo', ch: list[i % list.length], rot: (Math.random() - .5), vr: (Math.random() - .5) * .12 });
    }
    go();
  }
  function sunRain() {
    for (let i = 0; i < 34; i++) parts.push({ x: Math.random() * innerWidth, y: -40 - Math.random() * innerHeight * 0.8, vx: (Math.random() - .5) * 1.5, vy: 2 + Math.random() * 2.5, g: 0.02, life: 0, max: 260, size: 26 + Math.random() * 22, kind: 'emo', ch: ['🌻', '🌼', '🐝', '🌻'][i % 4], rot: Math.random(), vr: (Math.random() - .5) * .06, sway: Math.random() * 6 });
    go();
  }
  function go() { if (!running) { running = true; requestAnimationFrame(loop); } }
  function spark(x, y, r) {
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  function loop() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life < p.max);
    for (const p of parts) {
      p.life++; p.vy += p.g; p.x += p.vx + (p.sway !== undefined ? Math.sin((p.life + p.sway * 10) / 12) * 1.2 : 0); p.y += p.vy; p.rot += p.vr;
      if (p.kind !== 'paper' && p.sway === undefined) { p.vx *= 0.97; p.vy *= 0.97; }
      const a = 1 - Math.max(0, (p.life - p.max * 0.6) / (p.max * 0.4));
      g.globalAlpha = Math.max(0, a); g.fillStyle = p.col;
      if (p.kind === 'spark') spark(p.x, p.y, p.size);
      else if (p.kind === 'dot') { g.beginPath(); g.arc(p.x, p.y, p.size * 0.45, 0, 7); g.fill(); }
      else if (p.kind === 'emo') { g.setTransform(dpr * Math.cos(p.rot), dpr * Math.sin(p.rot), -dpr * Math.sin(p.rot), dpr * Math.cos(p.rot), p.x * dpr, p.y * dpr); g.drawImage(sprite(p.ch), -p.size / 2, -p.size / 2, p.size, p.size); g.setTransform(dpr, 0, 0, dpr, 0, 0); }
      else { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.4 + Math.abs(Math.sin(p.life / 6)))); g.restore(); }
    }
    g.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function clear() { parts = []; }
  return { burst, confetti, clear, emoji, sunRain };
})();
