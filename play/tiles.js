/* Tile faces: 36 kinds. Classic = drawn SVG, other themes = big emoji. */
const Tiles = (() => {
  const CJK = "'Noto Serif CJK SC','Noto Serif SC','Noto Sans CJK SC','Noto Sans SC','Source Han Sans SC','Microsoft YaHei','SimSun',serif";
  const NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const B = '#1f5fbf', G = '#178a4a', R = '#d23a2c';

  const svg = inner => `<svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const corner = (n, col = '#a08a5c') =>
    `<text class="cn" x="4" y="12" font-size="11" font-weight="900" fill="${col}" font-family="Nunito,Arial,sans-serif">${n}</text>`;
  const dot = (x, y, r, c) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${c}" stroke-width="${(r * 0.42).toFixed(1)}"/>` +
    `<circle cx="${x}" cy="${y}" r="${(r * 0.36).toFixed(1)}" fill="${c}"/>`;
  const stick = (x, y, h, c, w = 7) => {
    const t = y - h / 2;
    return `<rect x="${x - w / 2}" y="${t}" width="${w}" height="${h}" rx="${w / 2}" fill="${c}"/>` +
      `<rect x="${x - w / 2 + 1.4}" y="${t + 2}" width="1.6" height="${h - 4}" rx=".8" fill="#fff" opacity=".45"/>` +
      `<rect x="${x - w / 2 - .6}" y="${y - .9}" width="${w + 1.2}" height="1.8" rx=".9" fill="${c}" opacity=".9"/>` +
      `<rect x="${x - w / 2}" y="${y - .5}" width="${w}" height="1" fill="#fff" opacity=".5"/>`;
  };

  const DOTS = [
    null,
    [[30, 22, 0, B], [30, 58, 0, G]],
    [[16, 18, 0, B], [30, 40, 0, R], [44, 62, 0, G]],
    [[18, 23, 0, B], [42, 23, 0, G], [18, 57, 0, G], [42, 57, 0, B]],
    [[17, 20, 0, B], [43, 20, 0, G], [30, 40, 0, R], [17, 60, 0, G], [43, 60, 0, B]],
    [[19, 18, 0, G], [41, 18, 0, G], [19, 42, 0, R], [41, 42, 0, R], [19, 63, 0, R], [41, 63, 0, R]],
    [[19, 15, 6.2, G], [31, 22, 6.2, G], [43, 29, 6.2, G], [19, 49, 7, R], [41, 49, 7, R], [19, 67, 7, R], [41, 67, 7, R]],
    [[19, 13, 0, B], [41, 13, 0, B], [19, 31, 0, B], [41, 31, 0, B], [19, 49, 0, B], [41, 49, 0, B], [19, 67, 0, B], [41, 67, 0, B]],
    [[15, 17, 0, B], [30, 17, 0, B], [45, 17, 0, B], [15, 40, 0, R], [30, 40, 0, R], [45, 40, 0, R], [15, 63, 0, G], [30, 63, 0, G], [45, 63, 0, G]],
  ];
  const DOT_R = [0, 0, 11, 10, 9.5, 8.6, 8.4, 7, 7.6, 7.4];

  function dots(n) {
    let s = corner(n);
    if (n === 1) {
      s += `<circle cx="30" cy="41" r="19" fill="#fff" stroke="${G}" stroke-width="5"/>` +
        `<circle cx="30" cy="41" r="12" fill="#fff" stroke="${R}" stroke-width="4.5"/>` +
        `<circle cx="30" cy="41" r="5" fill="${B}"/>`;
    } else {
      for (const [x, y, r, c] of DOTS[n - 1]) s += dot(x, y, r || DOT_R[n], c);
    }
    return svg(s);
  }

  const BAM = [
    null,
    [[30, 24, 24, G], [30, 57, 24, B]],
    [[30, 24, 24, B], [18, 57, 24, G], [42, 57, 24, G]],
    [[20, 24, 24, B], [40, 24, 24, G], [20, 57, 24, G], [40, 57, 24, B]],
    [[15, 24, 24, G], [45, 24, 24, B], [30, 40, 24, R], [15, 57, 24, B], [45, 57, 24, G]],
    [[15, 24, 24, G], [30, 24, 24, G], [45, 24, 24, G], [15, 57, 24, B], [30, 57, 24, B], [45, 57, 24, B]],
    [[30, 14, 17, R], [15, 40, 17, G], [30, 40, 17, G], [45, 40, 17, G], [15, 64, 17, B], [30, 64, 17, B], [45, 64, 17, B]],
    [[12, 24, 24, G], [24, 24, 24, B], [36, 24, 24, B], [48, 24, 24, G], [12, 57, 24, B], [24, 57, 24, G], [36, 57, 24, G], [48, 57, 24, B]],
    [[15, 15, 18, G], [30, 15, 18, R], [45, 15, 18, B], [15, 40, 18, G], [30, 40, 18, R], [45, 40, 18, B], [15, 65, 18, G], [30, 65, 18, R], [45, 65, 18, B]],
  ];

  function bamboo(n) {
    let s = corner(n);
    if (n === 1) {
      // a cheerful little bird on a branch (traditional 1-bamboo)
      s += `<path d="M10 66 Q30 58 52 64" stroke="#8a5a2b" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
        `<ellipse cx="30" cy="42" rx="14" ry="12" fill="${G}"/>` +
        `<circle cx="38" cy="30" r="8" fill="${G}"/>` +
        `<circle cx="40.5" cy="28.5" r="2" fill="#fff"/><circle cx="41" cy="28.5" r="1" fill="#222"/>` +
        `<path d="M45.5 30 L52 31.5 L45.5 33.5 Z" fill="#f2a300"/>` +
        `<path d="M16 40 Q4 30 8 22 Q16 30 22 36 Z" fill="${R}"/>` +
        `<path d="M22 44 Q30 52 40 45" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>` +
        `<path d="M27 54 L25 62 M33 54 L33 62" stroke="#f2a300" stroke-width="2.4" stroke-linecap="round"/>`;
    } else {
      for (const [x, y, h, c] of BAM[n - 1]) s += stick(x, y, h, c);
    }
    return svg(s);
  }

  function chars(n) {
    return svg(corner(n, '#c62828') +
      `<text x="30" y="35" text-anchor="middle" font-size="27" font-weight="700" fill="#1b2f7a" font-family="${CJK}">${NUMS[n - 1]}</text>` +
      `<text x="30" y="70" text-anchor="middle" font-size="30" font-weight="700" fill="#c62828" font-family="${CJK}">萬</text>`);
  }

  function wind(ch, letter) {
    return svg(`<text class="cn" x="5" y="13" font-size="11" font-weight="900" fill="${B}" font-family="Nunito,Arial,sans-serif">${letter}</text>` +
      `<text x="30" y="55" text-anchor="middle" font-size="40" font-weight="700" fill="#1d1d1d" font-family="${CJK}">${ch}</text>`);
  }

  function dragon(kind) {
    if (kind === 0) return svg(`<text x="30" y="56" text-anchor="middle" font-size="44" font-weight="700" fill="#cf2a1f" font-family="${CJK}">中</text>`);
    if (kind === 1) return svg(`<text x="30" y="56" text-anchor="middle" font-size="42" font-weight="700" fill="#16843f" font-family="${CJK}">發</text>`);
    return svg(`<rect x="11" y="13" width="38" height="54" rx="4" fill="none" stroke="${B}" stroke-width="4"/>` +
      `<rect x="18" y="20" width="24" height="40" rx="2" fill="none" stroke="${B}" stroke-width="2"/>`);
  }

  function flower() {
    let p = '';
    for (let i = 0; i < 5; i++) p += `<ellipse cx="30" cy="25" rx="7.5" ry="12" fill="#f06292" transform="rotate(${i * 72} 30 37)"/>`;
    return svg(`<path d="M30 48 Q28 62 34 72" stroke="#2e7d32" stroke-width="3" fill="none"/>` +
      `<ellipse cx="40" cy="62" rx="7" ry="3.5" fill="#43a047" transform="rotate(-30 40 62)"/>` + p +
      `<circle cx="30" cy="37" r="6" fill="#ffca28"/><circle cx="30" cy="37" r="2.5" fill="#f57f17"/>`);
  }

  function season() {
    let r = '';
    for (let i = 0; i < 12; i++) r += `<rect x="28.5" y="12" width="3" height="10" rx="1.5" fill="#ff9800" transform="rotate(${i * 30} 30 40)"/>`;
    return svg(r + `<circle cx="30" cy="40" r="12.5" fill="#ffc107" stroke="#ff8f00" stroke-width="2"/>` +
      `<circle cx="26" cy="38" r="1.6" fill="#7a4a00"/><circle cx="34" cy="38" r="1.6" fill="#7a4a00"/>` +
      `<path d="M25 43 Q30 48 35 43" stroke="#7a4a00" stroke-width="1.8" fill="none" stroke-linecap="round"/>`);
  }

  const classic = [];
  for (let i = 1; i <= 9; i++) classic.push(dots(i));
  for (let i = 1; i <= 9; i++) classic.push(bamboo(i));
  for (let i = 1; i <= 9; i++) classic.push(chars(i));
  classic.push(wind('東', 'O'), wind('南', 'Z'), wind('西', 'W'), wind('北', 'N'));
  classic.push(dragon(0), dragon(1), dragon(2), flower(), season());

  const THEMES = {
    classic: { name: 'Klassiek', faces: classic, svg: true },
    fruit: { name: 'Lekkernijen', faces: [...'🍎🍐🍊🍋🍌🍉🍇🍓🍒🍑🍍🥥🥝🍅🍆🥑🥕🌽🥦🍄🥐🍞🧀🥚🍳🥨🍰🍦🧁🍪🍩🍫🍬🍭🍯☕'] },
    animals: { name: 'Dieren', faces: [...'🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🐤🦆🦉🐴🦄🐝🐛🦋🐌🐞🐢🐍🐙🦀🐠🐬🐳🦒'] },
    // the big prize theme, unlocked after level 20
    sunflower: { name: 'Zonnebloem', prize: true, faces: [...'🌻🐝🌼🍯🦋🐞🌞🌈🍓🍉🍋🍑🍒🌽🥕🍅🌷🌹🌸🌺🍀🌿🌾🐌🐛🐤🦆🐸🐢🍄🌳🏡🚲🍦🎀👒'] },
    happy: { name: 'Vrolijk', faces: ['🌸', '🌺', '🌻', '🌹', '🌷', '🌼', '💐', '🍀', '🌿', '🌵', '🌴', '🌳', '🍁', '🍂', '🌾', '🐚', '🌙', '⭐', '🌞', '🌈', '❄️', '🔥', '💧', '⚡', '🎈', '🎀', '🎁', '💎', '👑', '🔔', '🎵', '🏠', '⚓', '🚲', '⛵', '🧶'] },
  };

  function faceHTML(theme, kind) {
    const t = THEMES[theme] || THEMES.classic;
    return t.svg ? t.faces[kind] : `<span class="emo">${t.faces[kind]}</span>`;
  }

  return { THEMES, faceHTML, COUNT: 36 };
})();
