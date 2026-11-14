/* TASK-14 local proposal entry. Loaded only by tools/builder/ribbon-prototype.html. */
'use strict';
(async function(){
  while(!window.__mjReady) await new Promise(r=>setTimeout(r,40));
  // Prototype sessions are local. No telemetry, score, replay or progress writes.
  logEvt=()=>{};endLevel=()=>{};pushScore=()=>{};replayBegin=()=>{};replayCapture=()=>{};replayDrain=()=>{};
  win=()=>{openModal('<h2>Gelukt!</h2><p>Dit was een voorbeeld. Het verandert geen level.</p><button id="ribbonWinAgain" class="big-btn">Nog eens</button>',true);document.getElementById('ribbonWinAgain').onclick=()=>{closeModal();play();};};
  saveCur=()=>{};
  const root=new URL('../analysis/builder/bank/variety-v1/prototypes/ribbon/',document.baseURI);
  const manifest=await fetch(new URL('examples.json',root)).then(r=>r.json());
  const examples=await Promise.all(manifest.files.map(f=>fetch(new URL(f,root)).then(r=>r.json())));
  const bar=document.createElement('div');bar.id='ribbonControls';
  bar.innerHTML='<strong>Voorstel · eerst deze</strong><select aria-label="Voorbeeld"></select><button id="ribbonLesson">Uitleg</button><button id="ribbonReset">Opnieuw</button>';
  document.body.appendChild(bar);const select=bar.querySelector('select');
  examples.forEach((r,i)=>{const o=document.createElement('option');o.value=i;o.textContent='Voorbeeld '+(i+1)+' · '+r.card.shape;select.appendChild(o);});
  function play(){
    const r=examples[+select.value],d=JSON.parse(JSON.stringify(r.design));d.info={};
    begin({mode:'lab',prototype:'ribbon-v1',key:'TASK14-RIBBON-'+select.value,track:'',level:300,title:'Eerst deze · voorstel',fixedAspect:1.6,makeSpec:()=>({tiles:d.tiles.map(([x,y,z])=>({x,y,z})),kinds:new Set(d.faces).size,seed:14001+(+select.value),diff:Layouts.difficultyFor(201),made:d})},true);
  }
  function lesson(){openModal('<h2>Eerst deze</h2><p>Neem eerst de steen met 1. Daarna mag de steen met 1→. IJs en sloten werken nog steeds.</p>'+lessonDemoHTML('ribbon')+'<button id="ribbonGotIt" class="big-btn">Begrepen</button>',true);document.getElementById('ribbonGotIt').onclick=closeModal;startLessonDemo();}
  select.onchange=play;document.getElementById('ribbonReset').onclick=play;document.getElementById('ribbonLesson').onclick=lesson;
  window.__ribbonPrototype={examples,play,lesson};play();
})().catch(e=>{console.error(e);const p=document.createElement('p');p.textContent='Voorbeeld niet geladen: '+e.message;document.body.appendChild(p);});
