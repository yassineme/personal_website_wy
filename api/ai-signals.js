'use strict';
const {createArchiveService}=require('../lib/signals-service.cjs');
const snapshot=require('../data/ai-signals.json');
const getSignals=createArchiveService({seed:snapshot});
module.exports=async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='GET' && req.method!=='HEAD') {res.setHeader('Allow','GET, HEAD');res.statusCode=405;return res.end(JSON.stringify({error:'Method not allowed'}));}
  try {
    const query=new URL(req.url||'/api/ai-signals','https://www.wyassine.com').searchParams;
    const data=await getSignals({archive:query.get('view')==='archive'});
    res.setHeader('Cache-Control',data.status==='stale'?'no-store':'public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    res.statusCode=200;
    res.end(req.method==='HEAD'?undefined:JSON.stringify(data));
  } catch {
    res.setHeader('Cache-Control','no-store');
    res.statusCode=200;
    res.end(req.method==='HEAD'?undefined:JSON.stringify({...snapshot,status:'stale'}));
  }
};
