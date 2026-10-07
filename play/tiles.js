/* Tile faces: 36 kinds. Classic = drawn SVG, other themes = big emoji. */
const Tiles = (() => {
  const NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const B = '#1f5fbf', G = '#178a4a', R = '#d23a2c';

  /* Chunky glyphs (Noto Sans CJK Bold outlines, SIL Open Font License) so the tiles look
     the same bold way on every phone, whatever fonts it has. [path, xMin, yMin, xMax, yMax] */
  const GLYPH = {'一':['M38 455V324H964V455Z',38,324,964,455],'二':['M138 712V580H864V712ZM54 131V-6H947V131Z',54,-6,947,712],'三':['M119 754V631H882V754ZM188 432V310H802V432ZM63 93V-29H935V93Z',63,-29,935,754],'四':['M77 766V-56H198V10H795V-48H922V766ZM198 126V263C223 240 253 198 264 172C421 257 443 406 447 650H545V386C545 283 565 235 660 235C678 235 728 235 747 235C763 235 781 235 795 238V126ZM198 270V650H330C327 448 318 338 198 270ZM657 650H795V339C779 336 758 335 744 335C729 335 692 335 678 335C659 335 657 349 657 382Z',77,-56,922,766],'五':['M167 468V351H338C322 253 305 159 287 77H54V-42H951V77H757C771 207 784 349 790 466L695 473L673 468H488L514 640H885V758H112V640H381L357 468ZM420 77C436 158 453 252 469 351H654C648 268 639 168 629 77Z',54,-42,951,758],'六':['M290 387C227 248 126 94 34 0C67 -19 127 -59 155 -82C243 24 351 192 425 344ZM572 338C657 206 774 30 825 -76L953 -6C894 100 771 270 688 394ZM385 806C417 740 458 652 475 598H48V473H956V598H481L610 646C589 700 544 785 511 848Z',34,-82,956,848],'七':['M322 827V510L41 467L61 346L322 385V171C322 12 375 -46 527 -46C560 -46 699 -46 738 -46C791 -46 848 -45 875 -36C870 -8 864 46 861 78C832 71 782 68 740 68C699 68 562 68 522 68C467 68 452 93 452 163V404L946 478L927 602L452 530V827Z',41,-46,946,827],'八':['M281 785C268 502 230 163 27 -9C56 -27 104 -69 125 -93C343 99 390 465 413 778ZM493 806V685H568C606 384 679 84 848 -97C879 -70 934 -32 969 -14C790 157 712 483 677 806Z',27,-97,969,806],'九':['M73 604V483H312C293 277 229 113 22 7C53 -15 92 -59 109 -90C343 36 417 239 441 483H622V91C622 -39 654 -75 753 -75C773 -75 834 -75 855 -75C946 -75 977 -21 988 142C954 150 903 172 875 194C871 68 867 41 842 41C830 41 786 41 775 41C750 41 747 48 747 90V604H449C452 679 452 756 453 836H322C322 755 322 677 320 604Z',22,-90,988,836],'萬':['M278 446H440V401H278ZM555 446H720V401H555ZM278 565H440V520H278ZM555 565H720V520H555ZM100 309V281H62V185H100V-87H214V185H440V108L256 101L265 0C373 7 519 15 661 25C667 6 671 -11 673 -26L724 -13C734 -37 743 -67 747 -90C801 -90 842 -89 873 -73C904 -57 911 -31 911 17V281H555V322H840V643H163V322H440V281H214V309ZM605 164 628 117 555 113V185H689ZM766 6C755 57 726 130 694 185H795V19C795 9 791 6 781 6ZM52 799V700H261V658H378V700H483V799H378V850H261V799ZM516 799V700H616V658H733V700H947V799H733V850H616V799Z',52,-90,947,850],'東':['M142 598V213H346C263 134 144 63 29 23C56 -1 93 -48 112 -78C228 -28 345 53 435 149V-90H560V154C651 55 771 -30 889 -80C908 -48 946 0 975 24C858 64 735 134 651 213H867V598H560V655H946V767H560V849H435V767H58V655H435V598ZM259 364H435V303H259ZM560 364H744V303H560ZM259 508H435V448H259ZM560 508H744V448H560Z',29,-90,975,849],'南':['M436 843V767H56V655H436V580H94V-87H214V470H406L314 443C333 411 354 368 364 337H276V244H440V178H255V82H440V-61H553V82H745V178H553V244H723V337H636C655 367 676 403 697 441L596 469C582 430 556 375 535 339L542 337H390L466 362C455 393 432 437 410 470H784V33C784 18 778 13 760 13C744 12 682 12 633 15C648 -13 667 -57 672 -87C753 -87 812 -86 853 -69C893 -53 907 -25 907 33V580H567V655H944V767H567V843Z',56,-87,944,843],'西':['M49 795V679H336V571H100V-86H216V-29H791V-84H913V571H663V679H948V795ZM216 82V231C232 213 248 192 256 179C398 244 436 355 442 460H549V354C549 239 571 206 676 206C697 206 763 206 785 206H791V82ZM216 279V460H335C330 393 307 328 216 279ZM443 571V679H549V571ZM663 460H791V319C787 318 782 317 773 317C759 317 705 317 694 317C666 317 663 321 663 354Z',49,-86,948,795],'北':['M20 47 75 -76C194 -29 348 33 490 93L469 200L413 180V833H288V612H56V493H288V136C185 100 89 68 20 47ZM545 833V122C545 -17 578 -59 689 -59C709 -59 787 -59 809 -59C922 -59 950 20 961 229C928 237 875 261 846 285C840 104 834 58 796 58C781 58 722 58 707 58C674 58 670 67 670 121V494H932V614H670V833Z',20,-76,961,833],'中':['M434 850V676H88V169H208V224H434V-89H561V224H788V174H914V676H561V850ZM208 342V558H434V342ZM788 342H561V558H788Z',88,-89,914,850],'發':['M97 657C127 640 162 616 189 596C137 563 80 537 22 519C42 498 71 457 86 432C117 443 147 456 176 470V455H323V384H145C136 305 120 205 106 140H316C309 71 300 38 288 28C279 19 268 18 251 18C231 18 180 19 130 23C149 -4 163 -46 164 -78C219 -79 270 -79 298 -76C333 -74 357 -66 379 -43C405 -16 417 49 427 185C429 199 430 227 430 227H220L230 295H429V325C450 307 479 278 490 262C573 314 597 390 601 460H693V402C693 321 709 287 794 287C808 287 843 287 857 287C877 287 900 287 914 292C910 316 908 350 906 374C894 371 869 369 855 369C844 369 816 369 806 369C793 369 791 377 791 401V488C827 469 865 453 905 440C921 469 952 512 977 534C925 548 877 567 833 590C870 616 914 649 952 683L865 743C837 712 792 670 754 640C735 654 717 669 700 685C737 712 782 747 823 783L736 843C713 815 676 779 642 750C620 780 601 812 586 845L490 817C538 710 605 620 693 551H501V480C501 435 492 386 429 345V545H298C379 606 446 685 487 783L413 819L394 815H130V721H329C312 698 292 677 270 657C241 679 198 703 165 720ZM739 178C722 152 702 129 678 109L547 178ZM452 130 592 53C539 26 478 8 412 -3C431 -25 453 -64 463 -90C547 -71 623 -43 688 -3C742 -36 790 -66 824 -90L884 -11C854 9 813 33 768 59C816 106 853 165 878 239L813 262L794 259H468V178H492Z',22,-90,977,845]};
  // draw a character centred at (cx, cy), h = its height in tile units
  function glyph(ch, cx, cy, h, fill, wmax = 52) {
    const [d, x0, y0, x1, y1] = GLYPH[ch];
    const s = Math.min(h / (y1 - y0), wmax / (x1 - x0));
    const tx = cx - (x0 + x1) / 2 * s, ty = cy + (y0 + y1) / 2 * s;
    return `<path d="${d}" fill="${fill}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(5)} ${(-s).toFixed(5)})"/>`;
  }

  const svg = inner => `<svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const corner = (n, col = '#a08a5c') =>
    `<text class="cn" x="4" y="12" font-size="11" font-weight="900" fill="${col}" font-family="Nunito,Arial,sans-serif">${n}</text>`;
  // bold coin: coloured disc, white ring, coloured heart (easy to see, even small)
  const dot = (x, y, r, c) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>` +
    `<circle cx="${x}" cy="${y}" r="${(r * 0.62).toFixed(2)}" fill="#fff"/>` +
    `<circle cx="${x}" cy="${y}" r="${(r * 0.36).toFixed(2)}" fill="${c}"/>`;
  // chunky bamboo stick with a knot in the middle and at both ends
  const stick = (x, y, h, c, w = 8.6) => {
    const t = y - h / 2, dk = c === G ? '#0f6a37' : c === B ? '#154a99' : '#a82a1f';
    return `<rect x="${x - w / 2}" y="${t}" width="${w}" height="${h}" rx="${w / 2.4}" fill="${c}"/>` +
      `<rect x="${(x - w / 2 + 1.6).toFixed(2)}" y="${t + 2.4}" width="2" height="${h - 4.8}" rx="1" fill="#fff" opacity=".5"/>` +
      `<rect x="${x - w / 2 - .8}" y="${y - 1.4}" width="${w + 1.6}" height="2.8" rx="1.4" fill="${dk}"/>` +
      `<rect x="${x - w / 2 - .4}" y="${t + .6}" width="${w + .8}" height="2.2" rx="1.1" fill="${dk}"/>` +
      `<rect x="${x - w / 2 - .4}" y="${t + h - 2.8}" width="${w + .8}" height="2.2" rx="1.1" fill="${dk}"/>`;
  };

  const DOTS = [
    null,
    [[30, 22, 0, B], [30, 58, 0, G]],
    [[15, 17, 0, B], [30, 40, 0, R], [45, 63, 0, G]],
    [[17, 22, 0, B], [43, 22, 0, G], [17, 58, 0, G], [43, 58, 0, B]],
    [[16, 18, 0, B], [44, 18, 0, G], [30, 40, 0, R], [16, 62, 0, G], [44, 62, 0, B]],
    [[18, 17, 0, G], [42, 17, 0, G], [18, 41, 0, R], [42, 41, 0, R], [18, 64, 0, R], [42, 64, 0, R]],
    [[15, 13, 7.2, G], [30, 21.5, 7.2, G], [45, 30, 7.2, G], [18, 48, 7.6, R], [42, 48, 7.6, R], [18, 67, 7.6, R], [42, 67, 7.6, R]],
    [[18, 12, 0, B], [42, 12, 0, B], [18, 30.5, 0, B], [42, 30.5, 0, B], [18, 49.5, 0, B], [42, 49.5, 0, B], [18, 68, 0, B], [42, 68, 0, B]],
    [[13, 16, 0, B], [30, 16, 0, B], [47, 16, 0, B], [13, 40, 0, R], [30, 40, 0, R], [47, 40, 0, R], [13, 64, 0, G], [30, 64, 0, G], [47, 64, 0, G]],
  ];
  const DOT_R = [0, 0, 13, 11, 11.2, 10.4, 10, 7.6, 8.6, 8.2];

  function dots(n) {
    let s = corner(n);
    if (n === 1) {
      // the big flower-coin of 1-circle
      let petals = '';
      for (let i = 0; i < 8; i++) petals += `<ellipse cx="30" cy="22.5" rx="3.6" ry="5" fill="${G}" transform="rotate(${i * 45} 30 41)"/>`;
      s += `<circle cx="30" cy="41" r="23" fill="${G}"/><circle cx="30" cy="41" r="19.5" fill="#fff"/>` + petals +
        `<circle cx="30" cy="41" r="13" fill="${R}"/><circle cx="30" cy="41" r="9" fill="#fff"/><circle cx="30" cy="41" r="5.5" fill="${B}"/>`;
    } else {
      for (const [x, y, r, c] of DOTS[n - 1]) s += dot(x, y, r || DOT_R[n], c);
    }
    return svg(s);
  }

  const BAM = [
    null,
    [[30, 22, 28, G], [30, 59, 28, B]],
    [[30, 22, 28, B], [17, 59, 28, G], [43, 59, 28, G]],
    [[19, 22, 28, B], [41, 22, 28, G], [19, 59, 28, G], [41, 59, 28, B]],
    [[14, 22, 28, G], [46, 22, 28, B], [30, 40, 26, R], [14, 59, 28, B], [46, 59, 28, G]],
    [[14, 22, 28, G], [30, 22, 28, G], [46, 22, 28, G], [14, 59, 28, B], [30, 59, 28, B], [46, 59, 28, B]],
    [[30, 13, 19, R], [14, 40, 19, G], [30, 40, 19, G], [46, 40, 19, G], [14, 65, 19, B], [30, 65, 19, B], [46, 65, 19, B]],
    [[10.5, 22, 28, G], [23.5, 22, 28, B], [36.5, 22, 28, B], [49.5, 22, 28, G], [10.5, 59, 28, B], [23.5, 59, 28, G], [36.5, 59, 28, G], [49.5, 59, 28, B]],
    [[14, 14, 20, G], [30, 14, 20, R], [46, 14, 20, B], [14, 40, 20, G], [30, 40, 20, R], [46, 40, 20, B], [14, 66, 20, G], [30, 66, 20, R], [46, 66, 20, B]],
  ];

  function bamboo(n) {
    let s = corner(n);
    if (n === 1) {
      // a cheerful little bird on a branch (traditional 1-bamboo)
      s += `<path d="M8 67 Q30 58 54 65" stroke="#8a5a2b" stroke-width="4" fill="none" stroke-linecap="round"/>` +
        `<path d="M14 40 Q2 28 6 18 Q16 27 23 34 Z" fill="${R}"/>` +
        `<ellipse cx="30" cy="42" rx="15" ry="13" fill="${G}"/>` +
        `<circle cx="39" cy="29" r="9" fill="${G}"/>` +
        `<circle cx="41.5" cy="27.5" r="2.6" fill="#fff"/><circle cx="42.2" cy="27.5" r="1.4" fill="#111"/>` +
        `<path d="M47 29 L55 31 L47 34 Z" fill="#f2a300"/>` +
        `<path d="M21 44 Q30 53 41 45" stroke="#fff" stroke-width="2.4" fill="none" opacity=".65"/>` +
        `<path d="M26 55 L24 63 M33 55 L33 63" stroke="#f2a300" stroke-width="2.8" stroke-linecap="round"/>`;
    } else {
      for (const [x, y, h, c] of BAM[n - 1]) s += stick(x, y, h, c);
    }
    return svg(s);
  }

  // characters: a big, bold number on top, the red sign for "ten thousand" below
  function chars(n) {
    const one = n === 1, flat = n <= 3;
    return svg(corner(n, '#c62828') +
      glyph(NUMS[n - 1], 30, flat ? 25 : 24, one ? 6 : n === 2 ? 20 : n === 3 ? 26 : 30, '#1b2f7a', 48) +
      glyph('萬', 30, 61, 29, '#c62828', 44));
  }

  function wind(ch, letter) {
    return svg(`<text class="cn" x="5" y="13" font-size="11" font-weight="900" fill="${B}" font-family="Nunito,Arial,sans-serif">${letter}</text>` +
      glyph(ch, 30, 43, 46, '#1d1d1d', 46));
  }

  function dragon(kind) {
    if (kind === 0) return svg(glyph('中', 30, 41, 54, '#d0261b', 46));
    if (kind === 1) return svg(glyph('發', 30, 41, 50, '#13843d', 50));
    return svg(`<rect x="10" y="12" width="40" height="56" rx="5" fill="none" stroke="${B}" stroke-width="5.5"/>` +
      `<rect x="18" y="20" width="24" height="40" rx="2.5" fill="none" stroke="${B}" stroke-width="2.6"/>`);
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
    if (kind === 100) return '<span class="emo sp">🎁</span>';
    if (kind === 101) return '<span class="emo sp">🃏</span>';
    const t = THEMES[theme] || THEMES.classic;
    return t.svg ? t.faces[kind] : `<span class="emo">${t.faces[kind]}</span>`;
  }

  return { THEMES, faceHTML, COUNT: 36 };
})();
