// Hand idea 2 "Don't take the clock yet" (Claude, 2026-11-17), castle layout 1020. The clock (69) stands alone on top, free from the
// start: everyone takes it first. But a taken clock waits in the tray for its twin, 38, deep in the block, and the way to 38 needs all
// three slots (67, 70, 66 wait at once). With the clock waiting it overflows late. Right: dig to 38 first, then take the clock - it
// matches. Pictures of the block: exact search (orders.js with the clock waiting vs not), scratchpad idea2_search.js.
module.exports = {
  title: "Don't take the clock yet",
  idea: 'The clock is free from the start. But a taken clock waits in the tray for its twin, deep in the castle, and the way there needs all three slots. Dig to the twin first; then the clock matches it.',
  layout: 1020, exact: true, clockN: 9, clock: 69,
  route: [67, 70, 66, 49, 65, 40, 38, 69],
  pairs: { a: [65, 40], b: [49, 66], k: [38, 69], h1: [67, 27], h2: [70, 28], h3: [68, 29], h4: [71, 30], h5: [50, 33], h6: [43, 34], h7: [44, 35], h8: [41, 36], h9: [39, 42] },
  baits: [{ at: 1, take: [69], why: 'take the free clock first' }],
  digPairs: 0.3, pressure: 1.6,
};
