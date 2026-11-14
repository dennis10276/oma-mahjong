'use strict';
// Local lab persistence. Hydrate before lab.js captures its ratings object, so
// localhost and 127.0.0.1 both recover the same saved verdicts from this PC.
const http=require('http'),fs=require('fs'),path=require('path');
const dir=path.resolve(process.argv[2]),port=+(process.argv[3]||8265),out=dir+'-findings.json';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg'};
function saved(){return fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{ratings:{}};}
function hydrate(ratings){
  try{
    const key='omamj.lab.ratings',local=JSON.parse(localStorage.getItem(key)||'{}');
    for(const [id,record]of Object.entries(ratings)){
      const dst=local[id]||(local[id]={});
      for(const [k,v]of Object.entries(record)){
        if(k==='results'){const both=[...(dst.results||[]),...(v||[])],seen=new Set();dst.results=both.filter(x=>{const s=JSON.stringify(x);if(seen.has(s))return false;seen.add(s);return true;}).sort((a,b)=>(a.t||0)-(b.t||0)).slice(-30);}
        else if(['starts','tries','wins'].includes(k))dst[k]=Math.max(+dst[k]||0,+v||0);
        else if(dst[k]==null||dst[k]===''||dst[k]===0)dst[k]=v;
      }
    }
    localStorage.setItem(key,JSON.stringify(local));
  }catch(e){console.error('Could not restore saved lab verdicts',e);}
}
function client(){
  let last='';
  const badge=(message,ok)=>{let b=document.getElementById('labPcSave');if(!b){b=document.createElement('div');b.id='labPcSave';b.style.cssText='position:fixed;right:8px;bottom:8px;z-index:99999;font:600 12px sans-serif;padding:4px 8px;border-radius:8px;color:#fff';document.body.appendChild(b);}b.style.background=ok?'#2e7d32':'#c62828';b.textContent=message;};
  function send(){try{
    const dom={};document.querySelectorAll('.lab-card').forEach(c=>{dom[c.dataset.id]={note:c.querySelector('.lab-note')?.value||'',stars:c.querySelectorAll('.lab-stars button.on').length,verdict:c.querySelector('.lab-v.on')?.dataset.v||null};});
    const body=JSON.stringify({ls:JSON.parse(localStorage.getItem('omamj.lab.ratings')||'{}'),dom});if(body===last)return;
    const x=new XMLHttpRequest();x.open('POST','/findings');x.setRequestHeader('Content-Type','application/json');x.onload=()=>{if(x.status===200){last=body;badge('Verdicts saved on this PC',true);}else badge('Verdicts not saved',false);};x.onerror=()=>badge('Verdicts not saved (server off)',false);x.send(body);
  }catch(e){badge('Verdicts not saved',false);}}
  window.addEventListener('load',send);document.addEventListener('input',()=>setTimeout(send,300),true);document.addEventListener('click',()=>setTimeout(send,300),true);setInterval(send,3000);window.addEventListener('pagehide',send);
}
http.createServer((q,r)=>{
  let url;try{url=decodeURIComponent(q.url.split('?')[0]);}catch{r.writeHead(400);return r.end();}
  if(q.method==='GET'&&url==='/ratings-restore.js'){
    r.writeHead(200,{'Content-Type':types['.js'],'Cache-Control':'no-store'});return r.end('('+hydrate.toString()+')('+JSON.stringify(saved().ratings||{})+');');
  }
  if(q.method==='GET'&&url==='/findings'){
    r.writeHead(200,{'Content-Type':types['.json'],'Cache-Control':'no-store'});return r.end(JSON.stringify(saved()));
  }
  if(q.method==='POST'&&url==='/findings'){
    let body='';q.on('data',d=>{body+=d;if(body.length>5e6)q.destroy();});q.on('end',()=>{try{
      const j=JSON.parse(body),at=new Date().toISOString(),ratings=saved().ratings||{};fs.appendFileSync(out+'l',JSON.stringify({at,...j})+'\n');
      for(const src of [j.ls||{},j.dom||{}])for(const [id,v]of Object.entries(src)){const dst=ratings[id]||(ratings[id]={});for(const [k,x]of Object.entries(v||{}))if(!(['note','stars','verdict'].includes(k)&&!x&&dst[k]))dst[k]=x;}
      fs.writeFileSync(out+'.tmp',JSON.stringify({savedAt:at,ratings},null,1));fs.renameSync(out+'.tmp',out);r.writeHead(200);r.end('ok');
    }catch(e){r.writeHead(400);r.end();}});return;
  }
  if(url==='/')url='/lab.html';const file=path.resolve(dir,'.'+url);
  if(!file.startsWith(dir+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){r.writeHead(404);return r.end();}
  const ext=path.extname(file);r.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});
  if(ext==='.html'){
    let html=fs.readFileSync(file,'utf8'),boot='<script src="/ratings-restore.js"></script>';
    html=html.includes('<head>')?html.replace('<head>','<head>'+boot):boot+html;
    const saver='<script>('+client.toString()+')();</script>';return r.end(html.includes('</body>')?html.replace('</body>',saver+'</body>'):html+saver);
  }
  fs.createReadStream(file).pipe(r);
}).listen(port,'127.0.0.1',()=>console.log(`Lab and saved verdicts: http://127.0.0.1:${port}/`));
