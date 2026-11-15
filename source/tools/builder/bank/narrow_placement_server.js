'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),crypto=require('crypto');
const B=require('./narrow_placement_build'),M=require('./narrow_placement_model');
function createServer({port=8269,dataDir=B.DATA,assetDir=B.OUT}={}){
  fs.mkdirSync(dataDir,{recursive:true});fs.mkdirSync(path.join(dataDir,'jobs'),{recursive:true});
  const dataset=JSON.parse(fs.readFileSync(path.join(assetDir,'placement-data.json'))),rows=new Map(dataset.levels.map(r=>[r.level,r])),jobs=new Map(),queue=[];let active=false,serial=0;
  const catalogueId=crypto.createHash('sha256').update(JSON.stringify(dataset)).digest('hex');fs.mkdirSync(path.join(dataDir,'catalogues'),{recursive:true});const catalogueFile=path.join(dataDir,'catalogues',catalogueId+'.json');if(!fs.existsSync(catalogueFile))fs.writeFileSync(catalogueFile,JSON.stringify(dataset));
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  const stateFile=lv=>path.join(dataDir,'level-'+lv+'.json');
  const save=(row,body)=>{const s={...M.validate(row,body),catalogueId};fs.appendFileSync(path.join(dataDir,'history.jsonl'),JSON.stringify({at:new Date().toISOString(),...s})+'\n');const tmp=stateFile(row.level)+'.tmp';fs.writeFileSync(tmp,JSON.stringify(s,null,2)+'\n');fs.renameSync(tmp,stateFile(row.level));return s;};
  function next(){if(active||!queue.length)return;active=true;const j=queue.shift();j.status='checking';
    const fd=fs.openSync(j.log,'a'),child=cp.spawn(process.execPath,[path.join(__dirname,'../loop/heavy.js'),'--label','manual-placement-'+j.level,'--cores','1','--',process.execPath,path.join(__dirname,'narrow_placement_check.js'),j.input,j.output],{cwd:path.resolve(__dirname,'../../../..'),windowsHide:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);
    child.on('error',e=>{j.status='done';j.result={status:'unknown',ok:false,message:e.message,placementKey:j.placementKey};active=false;next();});
    child.on('exit',()=>{if(fs.existsSync(j.output))j.result=JSON.parse(fs.readFileSync(j.output));else j.result={status:'unknown',ok:false,message:'The checker stopped; your arrangement is still saved.',placementKey:j.placementKey};j.status='done';active=false;next();});
  }
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='GET'&&url.pathname==='/api/state'){const levels={},checks={};for(const [lv]of rows)if(fs.existsSync(stateFile(lv)))levels[lv]=JSON.parse(fs.readFileSync(stateFile(lv)));
      for(const name of fs.readdirSync(path.join(dataDir,'jobs')).filter(n=>n.endsWith('.result.json')).sort()){try{const r=JSON.parse(fs.readFileSync(path.join(dataDir,'jobs',name)));if(levels[r.level]&&M.key(levels[r.level])===r.placementKey)checks[r.level]=r;}catch{}}
      return json(res,200,{levels,checks});}
    if(req.method==='GET'&&url.pathname.startsWith('/api/check/')){const j=jobs.get(url.pathname.split('/').pop());return json(res,j?200:404,j?{id:j.id,status:j.status,result:j.result}: {error:'Check not found'});}
    if(req.method==='POST'&&['/api/save','/api/check'].includes(url.pathname)){
      let text='';req.on('data',chunk=>{text+=chunk;if(text.length>1000000)req.destroy();});req.on('end',()=>{try{
        const body=JSON.parse(text),row=rows.get(body.level);if(!row)throw Error('Level is not part of this placement lab');const saved=save(row,body);
        if(url.pathname==='/api/save')return json(res,200,{saved,placementKey:M.key(saved)});
        const id=Date.now()+'-'+(++serial),prefix=path.join(dataDir,'jobs',id),job={id,level:row.level,status:'queued',input:prefix+'.input.json',output:prefix+'.result.json',log:prefix+'.log',placementKey:M.key(saved)};
        fs.writeFileSync(job.input,JSON.stringify({row,snapshot:saved}));jobs.set(id,job);queue.push(job);json(res,202,{id,saved,placementKey:job.placementKey});next();
      }catch(e){json(res,400,{error:e.message});}});return;
    }
    if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
    let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return json(res,400,{error:'Bad path'});}
    const file=path.resolve(assetDir,'.'+(pathname==='/'?'/lab.html':pathname));if(!file.startsWith(path.resolve(assetDir)+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return json(res,404,{error:'Not found'});
    const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
  });
  return {server,listen:()=>new Promise(resolve=>server.listen(port,'127.0.0.1',()=>{console.log('Placement lab http://127.0.0.1:'+server.address().port+'/ — edits '+dataDir);resolve(server.address());})),jobs};
}
if(require.main===module)createServer({port:+process.argv[2]||8269,...(process.argv[3]?{dataDir:path.resolve(process.argv[3])}:{})}).listen();
module.exports={createServer};
