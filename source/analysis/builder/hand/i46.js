// Idea 46 "Start at the far edge" (u-shape, layout 1023). The clock (22) lies under 38, 39, 63, 66. Every tile of the dig waits for a twin
// further on; only one first move works, far from the clock. The natural start - the free tiles right beside the clock (66, 67) - fills
// the tray too early. A pure order puzzle: no face-down tile, no special.
module.exports = {
  id: 'i46', title: 'Start at the far edge',
  idea: 'Every tile on the way waits for a twin further on. Only one first move works, and it is not next to the clock.',
  layout: 1023, block: [66, 63, 70, 48, 39, 20, 38, 21, 67, 40, 23, 64, 50, 47], target: 22, limit: 10,
  fixed: {}, inside: [3, 5],
  tests: [{ name: 'dig', expect: 'win', peek: false, firsts: 2 }, { name: 'near66', expect: 'none', peek: false, gone: [66], goneFaces: true }, { name: 'near67', expect: 'none', peek: false, gone: [67], goneFaces: true }],
  hand: { clock: 22, spare: 1, routeTest: 'dig', baits: [{ at: 1, take: [66], why: 'start beside the clock' }, { at: 1, take: [67], why: 'start beside the clock' }] },
};
