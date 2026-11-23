/* Oma's Mahjong — particles: confetti, sparkles and flying emoji over the game.
   Sparkles and emoji (every pair, while playing) are little elements whose whole flight is handed
   to the phone's graphics chip at once (Web Animations): no drawing work per frame for the game.
   Before 1.58 they were drawn on a full-screen canvas 60 times a second, which on its own took
   about half of the work while matching. Confetti and the sunflower rain (win screens) still use
   the canvas. */
'use strict';

// ---------- particles ----------
const FX = (() => {
  const c = $('#fx'), g = c.getContext('2d');
  let parts = [], running = false, dpr = 1;
  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
  resize(); addEventListener('resize', resize);
  const COLS = ['#ffd23f', '#ff6fa3', '#4fc3ff', '#5ee07f', '#ff9a3d', '#b48cff', '#ffffff'];
  // ---- flights handed to the graphics chip ----
  const quick = typeof Element !== 'undefined' && !!Element.prototype.animate;
  let layer = null;
  const STAR = 'polygon(' + Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, r = i % 2 ? 0.35 : 1; return `${(50 + 50 * r * Math.cos(a)).toFixed(1)}% ${(50 + 50 * r * Math.sin(a)).toFixed(1)}%`; }).join(',') + ')';
  const AT = [0, .08, .17, .27, .38, .5, .6, .7, .8, .9, 1];   // where the flight is sampled (0.6: the fading starts)
  const MAX_FLYING = 140;          // enough for a super combo; many pairs at once (the end playing itself) share it
  function fly(p) {
    if (!layer) { layer = document.createElement('div'); layer.id = 'fxl'; document.body.appendChild(layer); }
    if (layer.childElementCount >= MAX_FLYING) return;
    // the same motion as the canvas particles: speed, gravity and drag per frame of 1/60 s
    const pos = [];
    let { x, y, vx, vy, rot } = p;
    for (let f = 0; f <= p.max; f++) {
      pos.push([x - p.x, y - p.y, rot]);
      vy += p.g; x += vx; y += vy; rot += p.vr; vx *= 0.97; vy *= 0.97;
    }
    const el = document.createElement(p.kind === 'emo' ? 'span' : 'i');
    const box = p.kind === 'spark' ? p.size * 2 : p.kind === 'dot' ? p.size * 0.9 : p.size;
    el.className = 'fxp ' + p.kind;
    el.style.cssText = `left:${(p.x - box / 2).toFixed(1)}px;top:${(p.y - box / 2).toFixed(1)}px;width:${box.toFixed(1)}px;height:${box.toFixed(1)}px;` +
      (p.kind === 'emo' ? `font-size:${(p.size * 0.8).toFixed(1)}px` : `background:${p.col}` + (p.kind === 'spark' ? `;clip-path:${STAR}` : ''));
    if (p.kind === 'emo') el.textContent = p.ch;
    const frames = AT.map(o => {
      const [dx, dy, r] = pos[Math.min(pos.length - 1, Math.round(o * p.max))];
      return { offset: o, opacity: o <= 0.6 ? 1 : Math.max(0, 1 - (o - 0.6) / 0.4), transform: `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${r.toFixed(2)}rad)` };
    });
    layer.appendChild(el);
    const an = el.animate(frames, { duration: p.max * 1000 / 60, easing: 'linear', fill: 'both' });
    an.onfinish = an.oncancel = () => el.remove();
  }
  function burst(x, y, n = 22, big = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (big ? 4 : 2.5) + Math.random() * (big ? 7 : 5);
      const p = { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, g: 0.18, life: 0, max: Math.round(40 + Math.random() * 25), size: (big ? 7 : 5) + Math.random() * 6, col: COLS[i % COLS.length], kind: i % 3 ? 'spark' : 'dot', rot: Math.random() * 6, vr: (Math.random() - .5) * .3 };
      if (quick) fly(p); else parts.push(p);
    }
    if (!quick) go();
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
      const p = { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.16, life: 0, max: Math.round(55 + Math.random() * 25), size: 20 + Math.random() * 16, kind: 'emo', ch: list[i % list.length], rot: (Math.random() - .5), vr: (Math.random() - .5) * .12 };
      if (quick) fly(p); else parts.push(p);
    }
    if (!quick) go();
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
  function clear() { parts = []; if (layer) layer.replaceChildren(); }
  return { burst, confetti, clear, emoji, sunRain };
})();
