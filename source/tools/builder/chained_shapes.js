'use strict';
// Declarative TASK 15 recipes. Kept separate from the constructor so the audit
// can validate geometry without importing either story implementation.
const rows = [
  ['waitLookalikeRoof',0,'earlyClock','clock<lock; keyA<cover:ice','The free clock and the easy matching key lookalike both spend the space needed to thaw the real key roof and open the clock twin.',true],
  ['waitLookalikeWay',1,'earlyClock','clock<lock; keyA<way:ice','Leave the clock exposed and refuse the ordinary key lookalike; the icy way to the true key must be prepared before either can be paired safely.',true],
  ['waitLookalikeThaw',3,'earlyClock','clock<ice; thaw<lock','The free clock must wait for its frozen twin, whose thaw tile needs the two real keys rather than the easy matching lookalike.',true],
  ['waitLookalikeCoverThaw',5,'earlyClock','clock<cover:ice; coverThaw<lock','A free alarm and a free key lookalike compete with the route through the true keys, the locked thaw tile and the roof over the clock twin.',true],
  ['waitLookalikeCoverLock',7,'earlyClock','clock<cover:lock; keyA<cover:ice','The clock picture is free but its twin waits under a locked roof; melt the true key roof instead of pairing the key lookalike or parking the alarm.',true],
  ['waitThawKey',11,'earlyClock','clock<ice; thaw<lock; keyA<cover:ice','Prepare the frozen key roof, use both keys to open the thaw tile, and melt the clock picture before collecting its exposed clock twin.'],
  ['waitCoverKey',13,'earlyClock','clock<cover:ice; coverThaw<lock; keyA<cover:ice','The exposed clock must wait while the key roof opens the locked neighbour that melts the roof over its twin.'],
  ['waitCoverWay',32,'earlyClock','clock<cover:ice; coverThaw<lock; keyA<way:ice','Work past the icy way to the key before opening the locked thaw tile; the free clock would occupy the slot that work needs.'],
  ['waitNested',10,'earlyClock','clock<lock; clock<cover:ice; coverThaw<ice','The free clock is only the end of the route: keys open its twin, but two nested melts still need the tray first.'],
  ['roofCoverKey',9,'roofKey','clock<lock; clock<cover:ice; keyA<cover:ice','Leave the key on the clock roof until its partner is reached through another frozen roof; only then can the clock roof be melted safely.'],
  ['roofThawKey',11,'roofKey','clock<ice; thaw<lock; keyA<cover:ice','The roof key uncovers the clock but cannot thaw it: first reach its partner through ice, then unlock the thaw neighbour.'],
  ['roofCoverWay',30,'roofKey','clock<lock; clock<cover:ice; keyA<way:ice','The roof key looks like progress; the frozen way to its partner must be solved before the icy clock roof can be cleared.'],
  ['lookalikeThaw',11,'repeatKeys','clock<ice; thaw<lock; keyA<cover:ice','A matching ordinary picture cannot replace the guarded key: save the true key pair to unlock the neighbour that thaws the clock.'],
  ['lookalikeCover',9,'repeatKeys','clock<lock; clock<cover:ice; keyA<cover:ice','Reject the easy lookalike pair, thaw the real key roof, then open the lock and melt the separate clock roof.'],
  ['lookalikeNested',10,'repeatKeys','clock<lock; clock<cover:ice; coverThaw<ice','Pair the actual keys rather than the ordinary lookalike, then follow both melts under the clock roof.'],
  ['twoFrontThaw',3,'dualMelt','clock<ice; thaw<lock','Do not park either lonely thaw picture: prepare the key roof on one front, unlock the thaw tile on the other, then collect the clock.'],
  ['twoFrontCoverThaw',5,'dualMelt','clock<cover:ice; coverThaw<lock','The lonely neighbours on the key roof and the clock roof compete for the same tray room; solve the key melt before the locked clock melt.'],
  ['nestedThaw',3,'freezeRight','clock<ice; thaw<lock','The lonely outer neighbour cannot replace the inner melt: unlock one thaw front while melting the other, then collect the clock.'],
  ['nestedCoverThaw',5,'freezeRight','clock<cover:ice; coverThaw<lock','The clock roof needs a locked neighbour and a neighbour behind its own ice; prepare both fronts rather than parking the lonely thaw picture.'],
  ['nestedThawKey',11,'freezeRight','clock<ice; thaw<lock; keyA<cover:ice','The lonely thaw tile waits on one front while the key roof is melted on the other; unlock and thaw the inner neighbour before the clock.'],
  ['nestedCoverKey',13,'freezeRight','clock<cover:ice; coverThaw<lock; keyA<cover:ice','Follow the key roof through the locked neighbour and its own ice before melting the clock roof; neither lonely neighbour is a shortcut.'],
  ['lookalikeWay',30,'repeatKeys','clock<lock; clock<cover:ice; keyA<way:ice','The matching lookalike spends the wrong key; thaw the way to the true partner before the separate clock roof.'],
  ['roofNested',10,'roofKey','clock<lock; clock<cover:ice; coverThaw<ice','The key on the clock roof must wait for its partner, and opening the lock still leaves the two-stage melt to prepare.'],
  ['waitThawWay',12,'earlyClock','clock<ice; thaw<lock; keyA<way:ice','The free clock must wait while an icy way yields the key pair that opens its twin’s thaw neighbour.'],
  ['waitLockCover',9,'earlyClock','clock<lock; clock<cover:ice; keyA<cover:ice','Prepare the frozen key roof before melting the locked twin’s roof; leave its exposed clock picture on the board.'],
  ['waitKeyRoofs',8,'earlyClock','clock<lock; keyA<cover:ice; keyB<cover:ice','Neither guarded key can spare a slot for the exposed clock: thaw both key roofs and unlock its twin first.'],
  ['roofThawWay',12,'roofKey','clock<ice; thaw<lock; keyA<way:ice','The roof key exposes a clock that is still frozen; the icy way to the far key must open the locked thaw tile first.'],
  ['roofCoverThaw',13,'roofKey','clock<cover:ice; coverThaw<lock; keyA<cover:ice','The roof key is only one key: thaw its partner’s roof to unlock the neighbour that melts the separate clock roof.'],
  ['lookalikeThawWay',12,'repeatKeys','clock<ice; thaw<lock; keyA<way:ice','Save the real key pair through the icy way, rather than matching the lookalike and stranding the locked clock-thaw route.'],
  ['lookalikeCoverThaw',13,'repeatKeys','clock<cover:ice; coverThaw<lock; keyA<cover:ice','The wrong matching key picture leaves the thaw tile locked; first melt the true key roof, then the clock roof.'],
];
const extension = {dualMelt:'keyA<lonelyMeltRoof:ice',earlyClock:'clock<waitForTwin',roofKey:'keyB<clockRoof',repeatKeys:'keyPair<lookalikeChoice',freezeRight:'thaw<innerIce'};
const SHAPES = Object.fromEntries(rows.map(([name,chain,mode,baseSignature,see,repeat=false])=>[name,{
  name,base:'chain',chain,mode,baseSignature,repeat,signature:baseSignature+'; '+extension[mode]+(repeat?'; keyPair<lookalikeChoice':''),see,
  baseLinks:baseSignature.split('; ').length,links:baseSignature.split('; ').length+1+(repeat?1:0),
  extension:extension[mode],recipe:(repeat?'Two special gates, a waiting clock and a guarded-key lookalike choice':baseSignature.split('; ').length+' existing gate links plus '+extension[mode]),trapType:'chained:'+name,chained:true,
  dials:{easier:'spare 2; obviousness dial 0',harder:'spare 1; obviousness dial 2 requires a greedy first bait'},
}]));
module.exports={SHAPES};
