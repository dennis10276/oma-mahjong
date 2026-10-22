// game tips: shared helpers over walk.json (WALK=path, default next to this file)
const A=JSON.parse(require('fs').readFileSync(process.env.WALK||require('path').join(__dirname,'walk.json'),'utf8'));
function free(i,a,att){if(!a[i])return false;for(const j of att.nbAbove[i])if(a[j])return false;let l=true;for(const j of att.nbL[i])if(a[j]){l=false;break;}if(l)return true;for(const j of att.nbR[i])if(a[j])return false;return true;}
function takeable(i,s,att){ if(!free(i,s.alivePre,att)) return false; if(s.ob){ if((s.ob.left||{})[i]>0) return false; if(!s.ob.unlocked && att.ob && (att.ob.locks||[]).includes(i)) return false;} return true;}
const acts=att=>att.steps.filter(s=>['toTray','trayMatch','pair'].includes(s.kind));
module.exports={A,free,takeable,acts};
