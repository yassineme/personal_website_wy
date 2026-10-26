'use strict';
const {collect,fetchFeed,TTL}=require('./ai-signals.cjs');
const {mergeArchive,responseFrom,parsePerspective}=require('./signals-archive.cjs');
const {createStore}=require('./signals-store.cjs');
const fallbackPerspective=require('../data/ai-perspective.json');
function createArchiveService({seed,store=createStore(),collector=collect,clock=Date.now,fetcher=fetch}={}){
 let state=mergeArchive(null,{...seed,perspective:seed?.perspective||fallbackPerspective},clock()),checked=0,pending=null,storage=store.kind;
 async function update(force=false){
  let envelope=null;
  try{envelope=await store.read();if(envelope?.state)state={...envelope.state,perspective:envelope.state.perspective||fallbackPerspective};storage=store.kind;}catch{storage='unavailable';}
  if(!force&&Date.parse(state.checkedAt)>clock()-TTL){checked=clock();return;}
  const [batch,perspective]=await Promise.all([
   collector({previous:{...state,items:state.articles},now:clock()}),
   fetchFeed({feed:'https://aizeitgeist.tv/data/quotes.json'},fetcher).then(xml=>parsePerspective(JSON.parse(xml),clock())).catch(()=>null)
  ]);
  batch.perspective=perspective;
  state=mergeArchive(state,batch,clock());
  if(store.kind==='unconfigured'){storage='unconfigured';checked=clock();return;}
  try{
   let saved=false;
   for(let attempt=0;attempt<4&&!saved;attempt++){
    saved=await store.save(state,envelope?.revision||'');
    if(!saved){envelope=await store.read();const newer=Date.parse(envelope?.state?.checkedAt)>Date.parse(batch.checkedAt);state=mergeArchive(envelope?.state,batch,clock());if(newer){state.checkedAt=envelope.state.checkedAt;state.updatedAt=envelope.state.updatedAt;state.status=envelope.state.status;state.sources=envelope.state.sources;}}
   }
   storage=saved?store.kind:'unavailable';
  }catch{storage='unavailable';}
  checked=clock();
 }
 return async function getSignals({archive=false,force=false}={}){
  if(force||!checked||clock()-checked>=TTL){if(!pending)pending=update(force).finally(()=>{pending=null;});try{await pending;}catch{state={...state,status:'stale'};}}
  return responseFrom(state,{archive,storage,now:clock()});
 };
}
module.exports={createArchiveService};
