/* Release gate for the measured progression. Read-only; no network or player data. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const H=require('../../www/hard'),P=require('./ordered_policy');
function check(){
 const root=path.resolve(__dirname,'../..'),read=f=>vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8')+';HARD_LEVELS');
 const T=read('www/levels-hard.js');if(T.v<5)return H.GENV>=5?['Level table predates the required ordered progression']:[];
 const errors=[],assert=(ok,msg)=>{if(!ok)errors.push(msg);},hash=x=>crypto.createHash('sha256').update(x).digest('hex');
 const report=JSON.parse(fs.readFileSync(path.join(root,'analysis/validation-ordered.json'))),old=read('analysis/levels-1.49.js');
 assert(T.v===H.GENV,'design version');assert(report.modelVersion===H.MODEL_VERSION,'observer version');
 assert(report.observerHash===hash(H.play.toString()),'measurements belong to this observer');
 assert(JSON.stringify(report.profile)===JSON.stringify(H.REF.focused),'approved focused persona');
 assert(report.runs>=8192,'enough fresh games');assert(report.rows.length===T.from+T.levels.length-80,'all harder levels measured');
 assert(T.overflow==='hardest'&&T.cycleFrom===T.from+T.levels.length-1,'never cycle back to easier levels');
 for(let lv=T.from;lv<80;lv++)assert(JSON.stringify(T.levels[lv-T.from])===JSON.stringify(old.levels[lv-old.from]),'earlier level preserved '+lv);
 let previous=null;
 for(let i=0;i<report.rows.length;i++){
  const r=report.rows[i],lv=80+i,row=T.levels[lv-T.from],d=H.unpack(lv,row),source=H.unpack(r.sourceLevel,old.levels[r.sourceLevel-old.from]);
  assert(r.lv===lv,'no missing or duplicate level '+lv);assert(r.hash===hash(JSON.stringify(row)),'measured board '+lv);
  assert(row[8]===r.sensible&&row[9]===r.focused&&r.focused===r.win,'logged measurement '+lv);
  assert(Math.abs(r.target-H.target(lv,'strong'))<1e-10,'target agrees '+lv);
  assert(Math.abs(r.focused-r.target)<=.015,'within 1.5 percentage points of target '+lv);
  assert(P.quality(r),'clock and visible-information quality '+lv);
  assert(r.sensible<=r.focused+.05,'stronger planning remains useful '+lv);
  assert(P.protectedBoard(d,source),'unchanged clock route, full solution, readable tiles '+lv);
  assert(P.clockFits(d,lv),'approved clock margin '+lv);
  if(previous){assert(r.focused<previous.focused,'no easier full level '+lv);assert(previous.focused-r.focused<=.04,'no abrupt difficulty cliff '+lv);assert(r.afterClock<previous.afterClock,'no easier board after the clock '+lv);}
  previous=r;
 }
 return errors;
}
module.exports=check;
if(require.main===module){try{const errors=check();if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Ordered difficulty and protected clocks verified');}catch(e){console.error(e.message);process.exitCode=1;}}
