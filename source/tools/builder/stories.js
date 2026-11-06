/* Builder v2 - the stories (Claude, 2026-11-06). A story is the one-sentence reason a level is hard, written as a
   ROLE SPEC that the builder turns into geometry: which tile is the clock, where the keys lie, what is locked or
   frozen. The pictures (tray pressure, traps) are not part of a story; the builder places them afterwards along the
   way the story implies. Titles follow the lab's recipe names Dennis already knows (tools/lab/ideas.js).

   spec fields (all optional):
     clockDepth: [min, max] tiles above the clock     clockLock: the clock itself is locked
     clockIce: 1|2 the clock is frozen                 lockIceNeighbours: lock enough of the clock's ice-neighbours
                                                       that the thaw needs the keys
     coverLock: lock this many tiles of the clock's cover (from the top)
     keys: 'far' | 'deep' | 'near' | 'island'          keyCover: [min, max] tiles above each key
     keyIce: 1|2 the keys are frozen (their guards must go first)
     coverPartners: 'locked' | 'frozen' | 'buried'      the twins of the tiles on the clock are out of reach
     chain: true                                        a lock whose tile thaws a frozen tile on the way (chain)
*/
'use strict';
const STORIES = {
  keysFarSide: { title: 'Keys on the far side', sentence: 'The clock is locked; its keys are buried on the other side of the pile.',
    spec: { clockDepth: [0, 2], clockLock: true, keys: 'far', keyCover: [2, 4] } },
  keysOnIsland: { title: 'Keys on the other island', sentence: 'The clock is locked; the keys sit on the other island.',
    spec: { clockDepth: [0, 2], clockLock: true, keys: 'island', keyCover: [1, 3] }, needs: 'islands' },
  clockInSight: { title: 'Clock in sight, keys out of reach', sentence: 'The clock is on top and locked; the keys are deep in the pile.',
    spec: { clockDepth: [0, 0], clockLock: true, keys: 'deep', keyCover: [3, 6] } },
  iceLockClock: { title: 'Ice, lock, then the clock', sentence: 'The clock is frozen; the tiles that would thaw it are locked, so the keys come first.',
    spec: { clockDepth: [0, 1], clockIce: 2, lockIceNeighbours: true, keys: 'far', keyCover: [1, 3] } },
  lockBeside: { title: 'A lock beside the clock', sentence: 'A locked tile sits on the clock; dig out the keys before you can reach it.',
    spec: { clockDepth: [2, 4], coverLock: 1, keys: 'deep', keyCover: [2, 4] } },
  frozenGuards: { title: 'Frozen guards', sentence: 'The keys are frozen in; clear their guards, then the keys, then the lock on the clock.',
    spec: { clockDepth: [1, 3], clockLock: true, keys: 'far', keyCover: [0, 2], keyIce: 2 } },
  chainReaction: { title: 'Chain reaction', sentence: 'Keys open a lock, the lock thaws the ice, the ice frees the clock.',
    spec: { clockDepth: [0, 2], clockIce: 1, lockIceNeighbours: true, keys: 'far', keyCover: [1, 3], keyIce: 1 } },
  roomInTrayLocked: { title: 'Room in the tray: locked partners', sentence: 'The tiles on the clock have locked twins: they wait in the tray until you find the keys.',
    spec: { clockDepth: [3, 5], coverPartners: 'locked', keys: 'deep', keyCover: [2, 4] } },
  roomInTrayFrozen: { title: 'Room in the tray: frozen partners', sentence: 'The tiles on the clock have frozen twins: they wait in the tray while the ice melts.',
    spec: { clockDepth: [3, 5], coverPartners: 'frozen' } },
  deepClock: { title: 'The deep clock', sentence: 'The clock is buried deep; every tile on it costs a move and a tray spot.',
    spec: { clockDepth: [4, 7], coverPartners: 'buried' } },
};
module.exports = { STORIES };
