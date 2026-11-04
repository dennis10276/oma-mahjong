'use strict';
// Two tile removals = one pair immediately after saving a clock. Peeking alone
// cannot move a loss out of this class; no milliseconds threshold is inferred.
const CONTACT_REMOVALS=2;
function clockLossTiming(phase,clockLeft,endLeft){
 if(phase===null)return null;
 if(phase==='clock'||phase==='beforeClock')return 'beforeClock';
 if(phase==='unknown')return 'unknown';
 if(Number.isInteger(clockLeft)&&Number.isInteger(endLeft)&&clockLeft>=endLeft&&clockLeft-endLeft<=CONTACT_REMOVALS)return 'clockContact';
 return phase;
}
module.exports={clockLossTiming,CONTACT_REMOVALS};
