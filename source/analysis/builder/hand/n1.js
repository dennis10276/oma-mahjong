// New idea N1 "The circle" (hand-made layout 3001 "Alcove"). The clock C (48) sits in a floor row N F M C W E under its roof P. The
// left looks short: N, F, M. But F (46) is frozen 2 and its only melters are N and M - and M lies boxed in between F and the clock.
// F waits for M, M waits for F: the short way is a loop that can never open. The way is the right: S, R, P, E, W.
// Wrong idea: "take N to start melting the wall" - a wasted move and a slot that the right side's dig needs.
module.exports = {
  id: 'n1', title: 'The circle',
  idea: 'The short way to the clock goes through a frozen wall. Its only melters are the free tile beside it and the tile between it and the clock - which the wall itself boxes in. It can never melt before the clock: go the long way.',
  layout: 3001, block: [53, 52, 51, 50, 49, 45, 46, 47, 20, 21, 22, 23, 24, 25], target: 48, limit: 7,
  fixed: { 45: 'n' }, ice: { 46: 2 }, inside: [3, 6],
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'loop', expect: 'none', peek: false, tiles: [45, 46, 47, 51], limit: 30 },
    { name: 'nFirst', expect: 'none', peek: false, gone: [45], tray0: ['n'] }],
  hand: { clock: 48, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [45], why: 'take N to start melting the wall' }] },
};
