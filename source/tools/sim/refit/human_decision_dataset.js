'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { gamesOf } = require('./mimic_games.js');
const { NAMES, boardId, publicBoardId } = require('./personal_model.js');
const { createSession } = require('./production_physical_session.js');

/**
 * Reconstructs valid physical decision examples from recorded human play.
 * For every decision:
 * - Uses public state available strictly BEFORE the action.
 * - Targets/outcomes are separated from input features.
 * - Distinguishes inspections, tray matches, board matches, and single tray additions.
 * - Distinguishes consecutive attempts within a campaign from replays.
 * - Binds exact board ID, public board ID, timestamps, and attempt number.
 */
function reconstructHumanDecisions(playerName, cutoffTime = Infinity) {
  const games = gamesOf(playerName)
    .filter(g => g.availableAt < cutoffTime && g.t < cutoffTime)
    .sort((a, b) => a.t - b.t);

  const decisions = [];
  const unresolvedEvents = [];
  let unreconstructableCount = 0;

  // Track campaigns: consecutive attempts on the same board
  const boardCampaigns = new Map();

  for (const game of games) {
    const pId = publicBoardId(game.g);
    const bId = boardId(game.g);
    const prevInBoard = boardCampaigns.get(bId) || [];
    const isNewCampaign = prevInBoard.length === 0 || game.at === 1
      || prevInBoard[prevInBoard.length - 1].won
      || (game.t - prevInBoard[prevInBoard.length - 1].t > 4 * 3600 * 1000);

    const activeCampaign = isNewCampaign ? [] : prevInBoard;
    const campaignId = isNewCampaign
      ? `camp_${game.key}_${game.t}`
      : activeCampaign[activeCampaign.length - 1].campaignId;

    const attemptNumber = activeCampaign.length + 1;
    activeCampaign.push({ ...game, campaignId, attemptNumber });
    boardCampaigns.set(bId, activeCampaign);

    // Reconstruct through production physical session
    let session;
    try {
      session = createSession(game.g);
    } catch (e) {
      unreconstructableCount++;
      unresolvedEvents.push({ aid: game.aid, campaignId, stage: 'createSession', status: 'unresolved', reason: e.message });
      continue;
    }

    let frame = session.view();
    let lastPeek = -1;
    let localTaps = 0;

    for (let s = 0; s < game.take.length; s++) {
      const tap = game.take[s];
      let actionIndex;
      let isInspection = false;

      if (tap < 0) {
        actionIndex = -(tap + 1);
        isInspection = true;
        // Skip duplicate state peek messages for the same open peek
        if (actionIndex === lastPeek && frame.state.openPeek === actionIndex) {
          continue;
        }
        lastPeek = actionIndex;
      } else {
        actionIndex = tap;
        isInspection = false;
        lastPeek = -1;
      }

      // Check if action is currently legal in production frame
      if (!frame.legalTiles || !frame.legalTiles.includes(actionIndex)) {
        unreconstructableCount++;
        unresolvedEvents.push({ aid: game.aid, campaignId, eventIndex: s, actionIndex,
          status: 'unresolved', reason: 'Recorded action is not legal in the production replay',
          remainingRecordedEvents: game.take.length - s });
        break;
      }

      const preState = {
        moves: frame.state.moves,
        openPeek: frame.state.openPeek,
        tray: frame.state.tray.slice(),
        trayLength: frame.state.tray.length,
        aliveCount: frame.state.alive.reduce((sum, v) => sum + v, 0),
        relieved: frame.state.relieved,
        physicalTaps: frame.state.physicalTaps
      };

      const legalCount = frame.legalTiles.length;
      const pic = game.g.faces[actionIndex];
      const inTray = frame.state.tray.indexOf(pic) >= 0;
      const inPeek = frame.state.openPeek >= 0 && game.g.faces[frame.state.openPeek] === pic;

      let actionKind;
      if (isInspection) {
        actionKind = 'inspection';
      } else if (inTray) {
        actionKind = 'trayMatch';
      } else if (inPeek) {
        actionKind = 'boardMatch';
      } else {
        actionKind = 'singleTrayAdd';
      }

      decisions.push({
        name: playerName,
        aid: game.aid,
        lv: game.lv,
        attempt: attemptNumber,
        campaignId,
        boardId: bId,
        publicBoardId: pId,
        t: game.t,
        openedAt: game.t,
        availableAt: game.availableAt,
        completedAt: game.availableAt,
        preState,
        legalCount,
        legalTiles: frame.legalTiles.slice(),
        targetIndex: actionIndex,
        actionKind,
        revealedFace: isInspection ? pic : null
      });

      localTaps++;
      try {
        frame = session.tap(actionIndex);
        if (frame.type === 'productionPhysicalEnd-v1') break;
      } catch (e) {
        unreconstructableCount++;
        const invalid = decisions.pop();
        unresolvedEvents.push({ aid: game.aid, campaignId, eventIndex: s, actionIndex,
          status: 'unresolved', reason: e.message, attemptedDecision: invalid,
          remainingRecordedEvents: game.take.length - s });
        break;
      }
    }
  }

  return {
    playerName,
    gamesProcessed: games.length,
    decisionCount: decisions.length,
    unreconstructableCount,
    unresolvedEvents,
    decisions
  };
}

module.exports = { reconstructHumanDecisions };
