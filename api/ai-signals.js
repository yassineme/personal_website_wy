'use strict';
const {createService}=require('../lib/ai-signals.cjs');
const snapshot=require('../data/ai-signals.json');
const getSignals=createService({seed:snapshot});
module.exports=async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='GET' && req.method!=='HEAD') {res.setHeader('Allow','GET, HEAD');res.statusCode=405;return res.end(JSON.stringify({error:'Method not allowed'}));}
  try {
    const data=await getSignals();
    res.setHeader('Cache-Control','public, max-age=60, s-maxage=900, stale-while-revalidate=3600');
    res.statusCode=200;
    res.end(req.method==='HEAD'?undefined:JSON.stringify(data));
  } catch {
    res.setHeader('Cache-Control','public, max-age=30, s-maxage=60');
    res.statusCode=200;
    res.end(req.method==='HEAD'?undefined:JSON.stringify({...snapshot,status:'stale'}));
  }
};
