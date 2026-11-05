'use strict';
// Task 07: existing won/right-or-hard lab plays can replace the skilled rating
// for that exact board. No routine playtesting, fuzzy IDs or self-reported rows.
const {boardKey,digest}=require('./meter.js');
const VERSION='approved-skilled-evidence-v1';
const APPROVED=Object.freeze([
  Object.freeze({id:'dennis-task05-200',board:'58a099f8cfe6eb4da0774999dcaf73cbe8862285f0b017758bd9cfb4a70d1e19',gold:Object.freeze([7,17]),tries:5,verdict:'right',won:true,stars:3,source:'TASK-05 §1; TASK-07 §5 exact-board rule'}),
  Object.freeze({id:'dennis-task05-225',board:'869ece46999c0ecba6a9f38e0740dc45e90faa6e1855e4aaa40c9ebaa7e9b806',gold:Object.freeze([28,49]),tries:4,verdict:'right',won:true,stars:5,source:'TASK-07 §5: existing 225 win, 4 tries, right, 5 stars'})
]);
function get(row){
  if(!row.useHumanSkilled||!row.design)return null;
  const key=boardKey(row.design),gold=JSON.stringify([...(row.design.gold||[])].sort((a,b)=>a-b));
  return APPROVED.find(e=>e.board===key&&gold===JSON.stringify(e.gold)&&e.won&&['right','hard'].includes(e.verdict))||null;
}
function fingerprint(row){const evidence=get(row);return evidence?digest({version:VERSION,evidence}):null;}
function rating(row,botExp,botValid=true){const evidence=get(row);return {exp:evidence?.tries??botExp,valid:!!evidence||botValid,botExp,botValid,...(evidence?{evidence}: {})};}
module.exports={VERSION,APPROVED,get,fingerprint,rating};
