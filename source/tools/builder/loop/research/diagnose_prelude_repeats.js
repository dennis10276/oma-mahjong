#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const T=require('../traces.js'),A=require('../../task11_analyze.js'),GP=require('../gate_profile.js'),P=require('../run_pipeline.js');
function main(){
 const a={};for(let i=2;i<process.argv.length;i+=2)a[process.argv[i].slice(2)]=process.argv[i+1];if(!a.out)throw Error('Use heavy.js -- node diagnose_prelude_repeats.js --out new.json');
 const root=path.resolve(__dirname,'../../../../..'),owner=JSON.parse(fs.readFileSync(path.join(root,'source/build/heavy.lock/owner.json'),'utf8'));if(owner.pid!==process.ppid)throw Error('Run through heavy.js');
 const fixed=JSON.parse(fs.readFileSync(path.join(root,'source/analysis/builder/dependency-choices-v1/qualified-check/manifest.json'),'utf8')),d=fixed.design;
 if(fs.existsSync(a.out))throw Error('Preserve the earlier diagnostic');
 const raw=T.captureFamily(d,{runs:2,seed:4711}),analyzer=A.analyzer({design:d},T.BUDGET),analysis=analyzer.trace(raw);
 const result={schema:'prelude-repeat-diagnostic-v1',note:'Two fixed diagnostic campaigns, not new ratings or acceptance.',design:d,options:raw.options,profile:analysis.profile,states:analyzer.records,code:P.codeFingerprints(),runner:GP.digest(fs.readFileSync(__filename,'utf8'))};
 fs.writeFileSync(a.out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({story:analysis.profile.story,errors:analysis.profile.attemptProfiles.filter(x=>x.firstError).map(x=>({attempt:x.attempt,move:x.firstError.move,at:x.firstError.removalMove,kind:x.firstError.kind,known:x.firstError.knownChoice,knownWins:x.firstError.knownWinningOptions,delay:x.firstError.actualDelayToTerminal,repeated:x.firstError.repeatedSameLosingMove}))}));
}
if(require.main===module)main();
