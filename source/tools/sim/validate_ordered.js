/* Fresh measurements of local candidates. Does not modify any app or publish anything. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{fork}=require('child_process');
const H=require('../../www/hard'),P=require('./ordered_policy'),{game}=require('./tighten_clocks');
const root=path.resolve(__dirname,'../..');
if(process.argv[2]==='--worker')process.on('message',jobs=>{try{
 for(const c of jobs){const d=H.unpack(c.goalLevel,c.row),m=P.sample(d,P.POLICY.validationRuns,P.POLICY.validationSeed);
  const sensible=H.rate(game(d),1024,378521,H.persona('sensible')).rate;
  process.send({...c,m,sensible});}
 process.send({done:true});
}catch(e){process.send({error:e.stack});process.exit(1);}});
else {
 const input=JSON.parse(fs.readFileSync(path.join(root,'analysis/ordered-candidates.json'))),jobs=+(process.argv[2]||8);
 const signature=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'www/hard.js'))).update(fs.readFileSync(path.join(__dirname,'ordered_policy.js'))).update(fs.readFileSync(__filename)).digest('hex');
 const file=path.join(root,'analysis/ordered-measured.json');let rows={};
 if(fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file));if(old.signature===signature)rows=old.rows;}
 const pending=input.rows.filter(c=>!rows[c.hash]),save=()=>fs.writeFileSync(file,JSON.stringify({signature,modelVersion:H.MODEL_VERSION,policy:P.POLICY,profile:H.REF.focused,rows},null,2));
 let left=Math.min(jobs,pending.length),start=Date.now();console.log(`${Object.keys(rows).length} cached, ${pending.length} fresh measurements of ${P.POLICY.validationRuns} games`);
 for(let j=0;j<left;j++){const w=fork(__filename,['--worker']);w.on('message',m=>{
  if(m.error){console.error(m.error);process.exit(1);}if(m.done){w.kill();if(--left===0){save();console.log('Local measurements finished');}return;}
  rows[m.hash]=m;save();console.log(`${Object.keys(rows).length}/${input.rows.length}: ${m.id} win ${m.m.win.toFixed(4)}, reach ${m.m.reach.toFixed(4)}${P.quality(m.m)?'':' REJECT'}; ${Math.round((Date.now()-start)/1000)}s`);
 });w.on('exit',c=>{if(c){console.error('Measurement worker failed',c);process.exit(1);}});w.send(pending.filter((_,i)=>i%jobs===j));}
 if(!left)save();
}
