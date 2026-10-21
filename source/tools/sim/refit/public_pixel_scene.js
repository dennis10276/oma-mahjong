'use strict';
const assert = require('assert/strict');
const { createPage } = require('./personal_render_page.js');
const { roundedContains } = require('./public_tile_pixels.js');
const TARGET_OPAQUE_INSET = 1.5;

async function sceneOf(page) {
  return page.evaluate(() => {
    const board = document.querySelector('#board'), bounds = board.getBoundingClientRect(), style = getComputedStyle(board);
    const tiles = Array.from(board.querySelectorAll('.tile[data-i]'), tile => {
      const rectangle = tile.getBoundingClientRect();
      return { index: +tile.dataset.i, alive: !tile.classList.contains('hidden'),
        classes: Array.from(tile.classList).filter(value => ['tile', 'hidden', 'back', 'gold', 'blocked', 'clocked'].includes(value)),
        style: ['left', 'top', 'width', 'height', 'z-index'].map(property => property + ':' + tile.style.getPropertyValue(property)).join(';'),
        overlay: tile.querySelector('.ob')?.dataset.k || null,
        bounds: { left: rectangle.left, top: rectangle.top, right: rectangle.right, bottom: rectangle.bottom },
        zIndex: +tile.style.zIndex || 0 };
    });
    const badge = board.querySelector('#clockBadge');
    return { bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      depth: style.getPropertyValue('--d'), fontSize: style.getPropertyValue('--fs'),
      bodyClasses: Array.from(document.body.classList).filter(value => ['nonum', 'contrast'].includes(value)),
      boardClasses: Array.from(board.classList).filter(value => value === 'hl'), tiles,
      badge: badge ? { style: ['left', 'top', 'font-size'].map(property => property + ':' + badge.style.getPropertyValue(property)).join(';'),
        icon: badge.querySelector('span')?.textContent || '', count: badge.querySelector('b')?.textContent || '',
        urgent: badge.classList.contains('urgent') } : null };
  });
}

function areaOf(scene, index, recognized = new Set()) {
  assert(recognized instanceof Set && [...recognized].every(value => Number.isInteger(value)
    && scene.tiles.some(tile => tile.index === value && tile.alive)));
  const target = scene.tiles.find(tile => tile.index === index); assert(target?.alive);
  const box = target.bounds, rectangle = { left: Math.floor(box.left), top: Math.floor(box.top),
    width: Math.ceil(box.right) - Math.floor(box.left), height: Math.ceil(box.bottom) - Math.floor(box.top) };
  const position = scene.tiles.indexOf(target);
  const higher = scene.tiles.filter((tile, offset) => tile.alive && tile.index !== index
    && (tile.zIndex > target.zIndex || tile.zIndex === target.zIndex && offset > position));
  const depth = parseFloat(scene.depth || '0'); assert(Number.isFinite(depth) && depth >= 0);
  const opaque = higher.flatMap(tile => [[0, 0], [depth * .5, depth * .6], [depth, depth * 1.2]].map(([horizontal, vertical]) => ({
    left: tile.bounds.left + horizontal, right: tile.bounds.right + horizontal,
    top: tile.bounds.top + vertical, bottom: tile.bounds.bottom + vertical, inset: recognized.has(tile.index) ? 1 : -1 })));
  const mask = [];
  for (let row = 0; row < rectangle.height; row++) for (let column = 0; column < rectangle.width; column++) {
    const horizontal = rectangle.left + column + .5, vertical = rectangle.top + row + .5;
    mask.push(+(roundedContains(horizontal, vertical, box, TARGET_OPAQUE_INSET)
      && !opaque.some(bounds => roundedContains(horizontal, vertical, bounds, bounds.inset))));
  }
  return { rectangle, mask, box, higher: higher.map(tile => tile.bounds) };
}

async function templatePageOf(page, scene, theme) {
  const viewport = page.viewportSize();
  assert.equal(await page.evaluate(() => devicePixelRatio), 1, 'Public scene templates currently require device scale1');
  const template = await createPage(page.context().browser(), viewport.width, viewport.height);
  try {
    await template.evaluate(({ scene, theme }) => {
      S.theme = theme;
      document.body.className = scene.bodyClasses.join(' ');
      const wrap = document.querySelector('#boardWrap'), board = document.querySelector('#board');
      for (const [property, value] of Object.entries({ position: 'relative', left: scene.bounds.left + 'px', top: scene.bounds.top + 'px',
        width: scene.bounds.width + 'px', height: scene.bounds.height + 'px' })) wrap.style.setProperty(property, value, 'important');
      board.className = scene.boardClasses.join(' ');
      board.style.setProperty('--d', scene.depth); board.style.setProperty('--fs', scene.fontSize);
      for (const entry of scene.tiles) {
        const tile = document.createElement('div'); tile.className = entry.classes.join(' '); tile.dataset.i = entry.index;
        tile.style.cssText = entry.style;
        const face = document.createElement('div'); face.className = 'face'; face.innerHTML = Tiles.faceHTML(theme, 0); tile.appendChild(face);
        if (entry.overlay) { const overlay = document.createElement('div'); overlay.className = 'ob'; overlay.dataset.k = entry.overlay; tile.appendChild(overlay); }
        board.appendChild(tile);
      }
      if (scene.badge) {
        const badge = document.createElement('div'); badge.id = 'clockBadge'; badge.className = 'ck';
        badge.style.cssText = scene.badge.style; badge.classList.toggle('urgent', scene.badge.urgent);
        const icon = document.createElement('span'), count = document.createElement('b');
        icon.textContent = scene.badge.icon; count.textContent = scene.badge.count;
        badge.append(icon, count); board.appendChild(badge);
      }
    }, { scene, theme });
    await template.evaluate(() => document.fonts.ready);
    return template;
  } catch (error) { await template.close(); throw error; }
}

module.exports = { sceneOf, areaOf, templatePageOf, TARGET_OPAQUE_INSET };
