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

  /* Nunito Black outlines of the corner marks (SIL Open Font License), for the board pictures:
     a picture cannot use the page's fonts. [path in 1000-unit em, advance] */
  const CORNER = {"1":["M157 0Q120 0 100 20Q81 39 81 75Q81 111 100 130Q120 149 157 149H247V558H331L186 469Q160 453 137 456Q114 460 98 476Q82 492 77 515Q72 538 81 561Q90 584 117 600L255 686Q277 700 300 707Q324 714 350 714Q388 714 409 694Q430 675 430 638V149H510Q547 149 566 130Q586 111 586 75Q586 39 566 20Q547 0 510 0Z",600],"2":["M144 0Q100 0 80 20Q61 41 61 81Q61 109 74 131Q86 153 106 174L281 357Q320 399 336 429Q353 459 353 489Q353 527 328 546Q303 565 256 565Q232 565 205 558Q178 552 147 536Q120 524 98 529Q77 534 62 551Q48 568 44 590Q41 612 51 634Q61 655 87 669Q133 694 182 705Q232 716 282 716Q364 716 420 692Q475 668 504 622Q533 577 533 510Q533 468 520 428Q508 388 480 348Q453 308 407 263L245 103V149H492Q529 149 548 130Q568 111 568 75Q568 39 548 20Q529 0 492 0Z",600],"3":["M279 -11Q228 -11 177 -1Q126 9 89 27Q57 42 44 64Q32 86 34 109Q36 132 50 150Q65 168 88 174Q112 181 142 168Q179 152 210 146Q241 140 272 140Q308 140 332 148Q356 156 368 172Q380 189 380 214Q380 249 356 266Q331 282 284 282H230Q192 282 172 301Q152 320 152 355Q152 390 172 409Q192 428 230 428H266Q295 428 316 436Q336 444 347 460Q358 475 358 498Q358 531 334 548Q311 565 265 565Q237 565 208 559Q179 553 146 538Q120 527 98 533Q77 539 64 556Q50 574 47 596Q44 617 54 638Q64 659 92 673Q134 694 184 705Q233 716 283 716Q362 716 418 693Q474 670 504 626Q533 583 533 522Q533 482 518 448Q503 414 474 392Q445 369 406 359V373Q476 362 516 314Q555 267 555 196Q555 132 522 85Q489 38 427 14Q365 -11 279 -11Z",600],"4":["M406 -9Q364 -9 340 14Q317 37 317 82V118H116Q72 118 48 138Q23 158 23 199Q23 223 32 246Q41 268 64 300L308 656Q328 686 353 700Q378 714 412 714Q450 714 472 692Q494 669 494 623V257H518Q556 257 576 239Q595 221 595 188Q595 154 576 136Q556 118 518 118H494V82Q494 38 472 14Q449 -9 406 -9ZM317 257V493H345L157 214V257Z",600],"5":["M295 -11Q247 -11 194 0Q141 11 96 34Q69 48 58 70Q48 93 52 116Q55 139 70 157Q84 175 106 180Q129 186 156 172Q189 156 224 148Q260 140 291 140Q325 140 349 150Q373 160 386 179Q398 198 398 224Q398 264 371 287Q344 310 299 310Q279 310 256 304Q232 298 207 281Q196 275 177 268Q158 260 138 260Q102 260 85 277Q68 294 68 325V627Q68 665 88 685Q109 705 146 705H460Q497 705 517 686Q537 667 537 630Q537 594 517 575Q497 556 460 556H241V399H199Q223 427 262 442Q301 456 347 456Q414 456 465 428Q516 399 544 348Q573 297 573 229Q573 157 540 102Q506 48 444 18Q381 -11 295 -11Z",600],"6":["M328 -11Q235 -11 170 31Q106 73 72 152Q38 232 38 346Q38 433 60 502Q82 571 124 618Q166 666 226 691Q286 716 362 716Q403 716 445 706Q487 696 525 676Q549 664 558 644Q567 623 564 600Q562 578 549 560Q536 543 514 536Q493 529 466 541Q436 555 410 560Q384 565 360 565Q310 565 277 544Q244 524 227 482Q210 441 210 379V327H195Q204 370 228 400Q252 431 288 447Q323 463 367 463Q426 463 472 434Q518 404 545 352Q572 300 572 234Q572 162 541 107Q510 52 455 20Q400 -11 328 -11ZM318 129Q344 129 364 141Q383 153 394 175Q404 197 404 226Q404 256 394 278Q383 299 364 312Q344 324 318 324Q293 324 274 312Q254 299 243 278Q232 256 232 226Q232 197 243 175Q254 153 274 141Q293 129 318 129Z",600],"7":["M177 -9Q143 -9 122 6Q101 22 98 48Q95 74 112 105L389 608V555H108Q71 555 50 574Q30 593 30 630Q30 667 50 686Q71 705 108 705H484Q521 705 546 685Q570 665 570 628Q570 596 560 572Q551 549 537 523L281 49Q265 18 240 4Q216 -9 177 -9Z",600],"8":["M300 -11Q215 -11 153 14Q91 38 58 84Q25 130 25 193Q25 244 46 283Q66 322 102 346Q138 371 184 376V347Q122 360 83 408Q44 456 44 523Q44 584 75 627Q106 670 164 693Q222 716 300 716Q379 716 436 693Q494 670 525 627Q556 584 556 523Q556 478 538 440Q521 403 490 379Q460 355 420 348V376Q488 366 532 316Q575 267 575 193Q575 130 542 84Q509 38 448 14Q386 -11 300 -11ZM300 127Q353 127 381 148Q409 168 409 207Q409 247 381 267Q353 287 300 287Q247 287 219 267Q191 247 191 207Q191 168 219 148Q247 127 300 127ZM300 426Q329 426 349 435Q369 444 380 462Q390 479 390 502Q390 537 366 558Q342 578 300 578Q258 578 234 558Q211 537 211 502Q211 467 234 446Q258 426 300 426Z",600],"9":["M238 -11Q197 -11 155 -1Q113 9 75 29Q51 41 42 62Q33 82 36 104Q38 127 51 144Q64 162 86 169Q107 176 134 164Q164 150 190 145Q216 140 240 140Q290 140 324 160Q357 181 374 222Q390 264 390 326V378H405Q397 336 372 305Q348 274 312 258Q277 242 233 242Q175 242 128 272Q82 301 55 354Q28 406 28 471Q28 543 59 598Q90 653 146 684Q201 716 272 716Q365 716 430 674Q494 632 528 552Q562 473 562 359Q562 272 540 203Q518 134 476 86Q434 39 374 14Q314 -11 238 -11ZM282 382Q308 382 328 394Q347 407 358 428Q368 450 368 479Q368 509 358 531Q347 553 328 564Q308 576 282 576Q256 576 237 564Q218 553 207 531Q196 509 196 479Q196 450 207 428Q218 407 237 394Q256 382 282 382Z",600],"O":["M404 -11Q297 -11 216 34Q135 80 90 162Q46 244 46 353Q46 435 72 502Q97 569 144 617Q192 665 258 690Q324 716 404 716Q511 716 592 671Q672 626 717 544Q762 463 762 353Q762 271 736 204Q711 137 664 88Q616 40 550 14Q484 -11 404 -11ZM404 143Q457 143 494 168Q531 193 551 240Q571 287 571 353Q571 452 527 507Q483 562 404 562Q352 562 314 538Q277 513 257 466Q237 420 237 353Q237 254 281 198Q325 143 404 143Z",807],"Z":["M129 0Q94 0 72 15Q49 30 41 56Q33 81 41 112Q49 142 74 173L419 606V554H115Q76 554 56 574Q36 593 36 630Q36 667 56 686Q76 705 115 705H505Q540 705 562 690Q585 675 593 650Q601 625 593 594Q585 563 560 532L215 99V151H535Q573 151 594 132Q614 113 614 76Q614 39 594 20Q573 0 535 0Z",625],"W":["M338 -9Q301 -9 278 8Q255 26 242 63L47 606Q31 651 52 682Q74 714 129 714Q166 714 187 696Q208 679 220 642L369 195H322L482 642Q496 679 517 696Q538 714 571 714Q604 714 624 696Q644 679 657 641L807 195H767L920 642Q932 679 952 696Q973 714 1010 714Q1056 714 1078 682Q1099 651 1082 606L885 62Q872 26 850 8Q827 -9 790 -9Q752 -9 730 8Q707 26 694 63L553 459H578L434 62Q420 26 398 8Q376 -9 338 -9Z",1128],"N":["M150 -9Q108 -9 86 13Q64 35 64 78V623Q64 667 86 690Q108 714 144 714Q176 714 194 702Q212 690 234 662L551 266H523V628Q523 670 544 692Q566 714 608 714Q650 714 672 692Q693 670 693 628V74Q693 36 673 14Q653 -9 619 -9Q585 -9 566 4Q546 16 524 43L207 440H235V78Q235 35 214 13Q192 -9 150 -9Z",758],"E":["M160 0Q113 0 88 24Q64 49 64 95V610Q64 656 88 680Q113 705 160 705H499Q535 705 553 687Q571 669 571 635Q571 600 553 582Q535 563 499 563H240V429H477Q512 429 530 411Q549 393 549 358Q549 323 530 305Q512 287 477 287H240V142H499Q535 142 553 124Q571 105 571 71Q571 36 553 18Q535 0 499 0Z",614],"S":["M326 -11Q286 -11 242 -6Q199 0 160 11Q121 22 90 37Q63 50 52 72Q41 93 44 117Q47 141 61 160Q75 178 98 184Q121 191 150 178Q188 160 236 150Q284 140 326 140Q392 140 418 158Q445 175 445 201Q445 224 426 238Q408 252 361 262L244 287Q148 307 101 357Q54 407 54 486Q54 538 76 580Q97 623 136 653Q176 683 230 700Q285 716 352 716Q404 716 458 704Q511 693 550 670Q573 658 583 637Q593 616 591 594Q589 571 576 554Q562 537 540 532Q517 526 486 539Q457 552 420 558Q384 565 350 565Q313 565 287 556Q261 548 248 532Q234 516 234 495Q234 474 252 460Q269 445 316 435L432 410Q529 389 577 341Q625 293 625 216Q625 164 604 122Q583 80 544 50Q505 21 450 5Q395 -11 326 -11Z",651]};
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
  // in English the winds carry E, S, W, N in the corner (Dutch: O, Z, W, N)
  const classicEn = classic.slice();
  classicEn.splice(27, 4, wind('東', 'E'), wind('南', 'S'), wind('西', 'W'), wind('北', 'N'));

  // (their names are in js/lang.js: theme_<id>)
  const THEMES = {
    classic: { faces: classic, svg: true },
    fruit: { faces: [...'🍎🍐🍊🍋🍌🍉🍇🍓🍒🍑🍍🥥🥝🍅🍆🥑🥕🌽🥦🍄🥐🍞🧀🥚🍳🥨🍰🍦🧁🍪🍩🍫🍬🍭🍯☕'] },
    animals: { faces: [...'🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🐤🦆🦉🐴🦄🐝🐛🦋🐌🐞🐢🐍🐙🦀🐠🐬🐳🦒'] },
    // the big prize theme, unlocked after level 20
    sunflower: { prize: true, faces: [...'🌻🐝🐞🦋🍓🍉🍋🍇🥕🍄🐸🐢🐤🐌🌈🏡🚲🍦👒🐷⛵🐠🍩🌷🍀🦔🐘🦊🐳🍭🧺🐧🍯🧀🚜🦜'] },
    happy: { faces: ['🌸', '🌺', '🌻', '🌹', '🌷', '🌼', '💐', '🍀', '🌿', '🌵', '🌴', '🌳', '🍁', '🍂', '🌾', '🐚', '🌙', '⭐', '🌞', '🌈', '❄️', '🔥', '💧', '⚡', '🎈', '🎀', '🎁', '💎', '👑', '🔔', '🎵', '🏠', '⚓', '🚲', '⛵', '🧶'] },
  };

  // special tiles have numbers from 100 (see js/specials.js)
  const SPECIAL = { 101: '🃏' };
  function faceHTML(theme, kind) {
    if (SPECIAL[kind]) return `<span class="emo sp">${SPECIAL[kind]}</span>`;
    const t = THEMES[theme] || THEMES.classic;
    if (t.svg) return (t === THEMES.classic && typeof isEn === 'function' && isEn() ? classicEn : t.faces)[kind];
    return `<span class="emo">${t.faces[kind]}</span>`;
  }

  /* On the board the classic faces are pictures, not live SVG: a pile of 96 SVG tiles is ~1500
     elements the phone has to style and lay out on every start (and draw again while playing).
     A picture is decoded once and then only copied. Each face is one rule in a small style sheet,
     so every tile with that face shares one image. A picture cannot use the page's fonts, so the
     corner marks become outlines (CORNER); with "numbers off" (body.nonum) they are left out. */
  const cornerAsPaths = svgText => svgText.replace(/<text class="cn" x="([\d.]+)" y="([\d.]+)" font-size="([\d.]+)"[^>]*fill="([^"]+)"[^>]*>([^<]*)<\/text>/, (m, x, y, fs, fill, txt) => {
    const k = fs / 1000; let ox = +x, out = '';
    for (const ch of txt) { const g = CORNER[ch]; if (!g) continue; out += `<path d="${g[0]}" transform="translate(${ox.toFixed(2)} ${y}) scale(${k} ${-k})"/>`; ox += g[1] * k; }
    return `<g class="cn" fill="${fill}">${out}</g>`;
  });
  const url = svgText => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}")`;
  let sheet = null, sheetLang = '', rules = {};
  function faceRule(en, kind) {
    const pic = cornerAsPaths((en ? classicEn : classic)[kind]), bare = pic.replace(/<g class="cn"[^]*?<\/g>/, '');
    return `.fi[data-f="${kind}"]{background-image:${url(pic)}}` + (bare !== pic ? `body.nonum .fi[data-f="${kind}"]{background-image:${url(bare)}}` : '');
  }
  // make sure these faces have their picture (one write of the sheet for a whole pile)
  function useFaces(theme, kinds) {
    const t = THEMES[theme] || THEMES.classic;
    if (!t.svg) return;
    const en = typeof isEn === 'function' && isEn() ? 'e' : 'n';
    if (sheetLang !== en) { sheetLang = en; rules = {}; }
    let added = false;
    for (const k of kinds) if (classic[k] && !rules[k]) { rules[k] = faceRule(en === 'e', k); added = true; }
    if (!added) return;
    if (!sheet) { sheet = document.createElement('style'); sheet.id = 'faceSheet'; document.head.appendChild(sheet); }
    sheet.textContent = Object.values(rules).join('\n');
  }
  // while the home screen shows: get all face pictures ready, so the first level opens quickly too
  const warmed = new Set();
  function warm(theme) {
    if (!(THEMES[theme] || THEMES.classic).svg) return;
    useFaces(theme, classic.map((_, k) => k));
    for (const m of (sheet ? sheet.textContent : '').matchAll(/url\("([^"]+)"\)/g)) {
      if (warmed.has(m[1])) continue;
      warmed.add(m[1]); const im = new Image(); im.src = m[1];
    }
  }
  function boardFace(theme, kind) {
    const t = THEMES[theme] || THEMES.classic;
    if (SPECIAL[kind] || !t.svg || !classic[kind]) return faceHTML(theme, kind);
    useFaces(theme, [kind]);
    return `<i class="fi" data-f="${kind}"></i>`;
  }

  return { THEMES, faceHTML, boardFace, useFaces, warm };
})();
