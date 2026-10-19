'use strict';
/**
 * Explainable Educational Coaching Popups Engine for Oma's Mahjong.
 *
 * Generates context-aware, pedagogical, and compassionate popups (in Dutch and English)
 * to educate players when they make mistakes or get stuck, helping them master the
 * core skills of Mahjong Solitaire.
 */

const { SKILL_CATEGORIES } = require('./skill_analyzer.js');

const TILE_NAMES_NL = {
  0: 'Bamboe 1 (Vogel)', 1: 'Bamboe 2', 2: 'Bamboe 3', 3: 'Bamboe 4', 4: 'Bamboe 5',
  5: 'Bamboe 6', 6: 'Bamboe 7', 7: 'Bamboe 8', 8: 'Bamboe 9',
  9: 'Karakter 1', 10: 'Karakter 2', 11: 'Karakter 3', 12: 'Karakter 4', 13: 'Karakter 5',
  14: 'Karakter 6', 15: 'Karakter 7', 16: 'Karakter 8', 17: 'Karakter 9',
  18: 'Kring 1', 19: 'Kring 2', 20: 'Kring 3', 21: 'Kring 4', 22: 'Kring 5',
  23: 'Kring 6', 24: 'Kring 7', 25: 'Kring 8', 26: 'Kring 9',
  27: 'Oostenwind', 28: 'Zuidenwind', 29: 'Westenwind', 30: 'Noordenwind',
  31: 'Rode Draak', 32: 'Groene Draak', 33: 'Witte Draak',
  34: 'Lente / Bloem', 35: 'Zomer / Bloem', 36: 'Herfst / Bloem', 37: 'Winter / Bloem'
};

const TILE_NAMES_EN = {
  0: 'Bamboo 1 (Bird)', 1: 'Bamboo 2', 2: 'Bamboo 3', 3: 'Bamboo 4', 4: 'Bamboo 5',
  5: 'Bamboo 6', 6: 'Bamboo 7', 7: 'Bamboo 8', 8: 'Bamboo 9',
  9: 'Character 1', 10: 'Character 2', 11: 'Character 3', 12: 'Character 4', 13: 'Character 5',
  14: 'Character 6', 15: 'Character 7', 16: 'Character 8', 17: 'Character 9',
  18: 'Circle 1', 19: 'Circle 2', 20: 'Circle 3', 21: 'Circle 4', 22: 'Circle 5',
  23: 'Circle 6', 24: 'Circle 7', 25: 'Circle 8', 26: 'Circle 9',
  27: 'East Wind', 28: 'South Wind', 29: 'West Wind', 30: 'North Wind',
  31: 'Red Dragon', 32: 'Green Dragon', 33: 'White Dragon',
  34: 'Spring / Flower', 35: 'Summer / Flower', 36: 'Autumn / Flower', 37: 'Winter / Flower'
};

function getTileName(face, lang = 'nl') {
  const dict = lang === 'nl' ? TILE_NAMES_NL : TILE_NAMES_EN;
  return dict[face] || (lang === 'nl' ? `Steen ${face}` : `Tile ${face}`);
}

/**
 * Generates an educational coaching popup based on a detected blunder or move analysis.
 */
function generateCoachingPopup(game, moveAnalysis, lang = 'nl') {
  if (!moveAnalysis || !moveAnalysis.skillDiscrepancies || !moveAnalysis.skillDiscrepancies.length) {
    return null;
  }

  const primaryDisc = moveAnalysis.skillDiscrepancies[0];
  const playerAction = moveAnalysis.playerAction;
  const optimalAction = moveAnalysis.optimalAction;
  const isDutch = lang === 'nl';

  const tileName = playerAction.face !== undefined ? getTileName(playerAction.face, lang) : '';
  const optTileName = optimalAction?.face !== undefined ? getTileName(optimalAction.face, lang) : '';

  let popup = {
    skillId: primaryDisc.skill,
    severity: moveAnalysis.severity,
    turn: moveAnalysis.turn,
    targetTileIndex: optimalAction?.index ?? (optimalAction?.indices ? optimalAction.indices[0] : null),
    playerTileIndex: playerAction?.index ?? (playerAction?.indices ? playerAction.indices[0] : null),
    badge: '',
    title: '',
    situation: '',
    explanation: '',
    coachAlternative: '',
    takeawayTip: ''
  };

  switch (primaryDisc.skill) {
    case 'TRAY_HEADROOM': {
      if (primaryDisc.type === 'FATAL_TRAY_OVERFLOW') {
        popup.badge = isDutch ? '⚠️ Tray Overvol' : '⚠️ Tray Overflow';
        popup.title = isDutch ? 'Je tray raakte overvol!' : 'Your tray overflowed!';
        popup.situation = isDutch
          ? `Op zet ${moveAnalysis.turn} had je al 3 stenen in je tray en pakte je de ${tileName}.`
          : `On move ${moveAnalysis.turn}, you already had 3 tiles in your tray and took ${tileName}.`;
        popup.explanation = isDutch
          ? 'Omdat je tray maximaal 4 stenen kan bevatten en deze steen niet direct paste, liep het spel direct vast.'
          : 'Because the tray holds a maximum of 4 tiles and this tile had no instant match, the game immediately ended.';
        popup.coachAlternative = isDutch
          ? `De Coach speelde eerst een zet die ruimte vrijmaakte: ${optimalAction?.description || 'een vrije match'}.`
          : `The Coach instead made a headroom-preserving move: ${optimalAction?.description || 'a free match'}.`;
        popup.takeawayTip = isDutch
          ? '💡 Gouden Tip: Met 3 stenen in je tray mag je ALLEEN nog een steen pakken die direct matcht met een wachtende steen!'
          : '💡 Golden Rule: With 3 tiles in your tray, ONLY take a tile that immediately pairs with a waiting tile!';
      } else {
        popup.badge = isDutch ? '💡 Ruimtebeheer' : '💡 Tray Headroom';
        popup.title = isDutch ? 'Houd altijd buffer in je tray' : 'Keep buffer in your tray';
        popup.situation = isDutch
          ? `Je legde de ${tileName} in je 3e tray slot, terwijl de partner nog niet vrij was.`
          : `You placed ${tileName} into your 3rd tray slot while its twin was not yet free.`;
        popup.explanation = isDutch
          ? 'Een 3e steen in je tray laten wachten is heel gevaarlijk: je hebt nu 0 vrije reserve-slots meer over.'
          : 'Leaving a 3rd tile waiting in your tray leaves zero buffer: any next unmatched tile is fatal.';
        popup.coachAlternative = isDutch
          ? `De Coach koos ervoor om eerst ${optTileName ? optTileName : 'een dichte steen om te draaien'} om de tray open te houden.`
          : `The Coach opted to peek a face-down tile first to preserve tray headroom.`;
        popup.takeawayTip = isDutch
          ? '💡 Coach Tip: Probeer je tray zoveel mogelijk op 1 of 2 stenen te houden. Gebruik vrije dichte stenen om matches te zoeken!'
          : '💡 Coach Tip: Keep your tray at 1 or 2 tiles whenever possible. Use free hidden tiles to find matches without tray cost!';
      }
      break;
    }

    case 'BURIED_MATE': {
      popup.badge = isDutch ? '🔍 Diepte-Inzicht' : '🔍 Layer Depth Awareness';
      popup.title = isDutch ? 'Let op de diepte van de partnersteen!' : 'Watch out for buried partner tiles!';
      popup.situation = isDutch
        ? `Je koos de ${tileName}, maar de partnersteen ligt ${playerAction.mateDepth?.toFixed(1) || '4'} lagen diep begraven.`
        : `You chose ${tileName}, but its partner is buried ${playerAction.mateDepth?.toFixed(1) || '4'} layers deep.`;
      popup.explanation = isDutch
        ? 'Als de partner van een steen diep onder andere stenen ligt, moet je eerst heel veel tussenliggende stenen wegspelen. Daardoor blokkeert deze steen heel lang een plek in je tray.'
        : 'When a tile’s twin is buried deep under other tiles, it will take many turns to unblock. This causes the first tile to jam your tray for a long time.';
      popup.coachAlternative = isDutch
        ? `De Coach koos ${optTileName}, waarvan de partner al aan de oppervlakte ligt (max 1 laag diep).`
        : `The Coach picked ${optTileName}, whose partner was already near the surface (depth $\\le 1$).`;
      popup.takeawayTip = isDutch
        ? '💡 Coach Tip: Kijk vóór het pakken altijd even waar de partner ligt! Pak bij voorkeur stenen waarvan de partner maximaal 1 laag diep ligt.'
        : '💡 Coach Tip: Before picking a single, glance at where its twin lies! Prioritize singles whose twins are at depth 0 or 1.';
      break;
    }

    case 'CLOCK_URGENCY': {
      popup.badge = isDutch ? '⏰ Wekker Urgentie' : '⏰ Clock Emergency';
      popup.title = isDutch ? 'Focus op de wekkersteen!' : 'Focus on the clock tile!';
      popup.situation = isDutch
        ? `Je speelde een paar aan de zijkant van het bord, terwijl de wekker nog maar weinig zetten overhad.`
        : `You cleared peripheral tiles while the alarm clock was running out of moves.`;
      popup.explanation = isDutch
        ? 'Als de wekker bijna afgaat, telt elke zet dubbel. Zijpaartjes pakken leidt af en kost kostbare tijd!'
        : 'When the alarm clock is ticking down, every move counts. Peripheral pairs waste valuable clock budget!';
      popup.coachAlternative = isDutch
        ? `De Coach speelde direct op de stenen die bovenop of naast de wekkersteen lagen.`
        : `The Coach played strictly on tiles that directly covered or flanked the clock tile.`;
      popup.takeawayTip = isDutch
        ? '💡 Coach Tip: Zie je het klokje tikken? Negeer alle makkelijke zijpaartjes en focus als een laser op de stenen die de wekker blokkeren!'
        : '💡 Coach Tip: Is the clock ticking down? Ignore tempting perimeter pairs and laser-focus on tiles blocking the clock!';
      break;
    }

    case 'SAFE_PEEKING': {
      popup.badge = isDutch ? '👁️ Veilig Verkennen' : '👁️ Safe Peeking';
      popup.title = isDutch ? 'Eerst verkennen, dan pas pakken!' : 'Inspect first, take later!';
      popup.situation = isDutch
        ? `Je nam een losse steen (${tileName}) in je tray, terwijl er nog vrije dichte stenen lagen.`
        : `You took a single (${tileName}) into your tray while free face-down tiles were available.`;
      popup.explanation = isDutch
        ? 'Dichte stenen omdraaien kost GEEN tray-ruimte! Vaak draai je precies de steen om die je nodig hebt, waardoor je tray juist leeg blijft.'
        : 'Flipping face-down tiles consumes ZERO tray slots! Frequently, peeking reveals the exact twin you need without taking a tray slot.';
      popup.coachAlternative = isDutch
        ? 'De Coach draaide eerst een vrije dichte steen om om gratis informatie te verzamelen.'
        : 'The Coach peeked a free face-down tile first to gather information safely.';
      popup.takeawayTip = isDutch
        ? '💡 Coach Tip: Zie je een vrije dichte steen? Draai hem altijd eerst even om voordat je een losse open steen in je tray legt!'
        : '💡 Coach Tip: Spot a free hidden tile? Always flip it first before committing singles into your tray!';
      break;
    }

    case 'FREE_MATCH': {
      popup.badge = isDutch ? '✨ Directe Match' : '✨ Immediate Match';
      popup.title = isDutch ? 'Pak openstaande matches direct aan!' : 'Take open matches immediately!';
      popup.situation = isDutch
        ? `Er lag een directe match klaar voor een wachtende traysteen, maar je pakte een nieuwe losse steen.`
        : `An immediate match was ready for a waiting tray tile, but you took a new single instead.`;
      popup.explanation = isDutch
        ? 'Een wachtende steen in de tray direct wegspelen maakt meteen een tray-slot vrij en vermindert de chaos.'
        : 'Matching a waiting tray tile immediately restores headroom and prevents clutter.';
      popup.coachAlternative = isDutch
        ? `De Coach maakte direct de match af met ${optTileName}.`
        : `The Coach immediately paired ${optTileName} to clean up the tray.`;
      popup.takeawayTip = isDutch
        ? '💡 Coach Tip: Zie je een partner van een traysteen vrijliggen? Pak hem meteen weg!'
        : '💡 Coach Tip: See a partner of a tray tile free? Clear it immediately to restore your safety buffer!';
      break;
    }
  }

  return popup;
}

/**
 * Renders a coaching popup as a beautiful GitHub Markdown alert card.
 */
function renderMarkdownCard(popup, lang = 'nl') {
  if (!popup) return '';
  const isDutch = lang === 'nl';

  return `
> [!TIP]
> ### ${popup.badge}: ${popup.title}
> **${isDutch ? 'Wat gebeurde er?' : 'What happened?'}** ${popup.situation}
>
> **${isDutch ? 'Waarom is dit riskant?' : 'Why is this risky?'}** ${popup.explanation}
>
> **${isDutch ? 'Wat deed de Coach Bot?' : 'What did the Coach Bot do?'}** ${popup.coachAlternative}
>
> ${popup.takeawayTip}
`.trim();
}

module.exports = {
  TILE_NAMES_NL,
  TILE_NAMES_EN,
  getTileName,
  generateCoachingPopup,
  renderMarkdownCard
};
