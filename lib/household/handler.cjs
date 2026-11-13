'use strict';
const path=require('node:path'),fs=require('node:fs/promises'),crypto=require('node:crypto');
const {hashPin}=require('./store.cjs'),{view,monthOK,today}=require('./model.cjs');
const {createSync}=require('./sync.cjs');
const {localAssetState,saveLocalAsset}=require('./local-assets.cjs');
const {etfForecast}=require('./etf-forecast.cjs');
const {assessedState,wealthAssessment}=require('./wealth.cjs');
const tax=require('./tax.cjs');
const {waterState,saveLocalReading,waterView}=require('./water.cjs');
const {dossier}=require('./tax-export.cjs');
const {createInvestmentService}=require('./investments.cjs');
const COOKIE='household-local-session',IDLE=15*60*1000,ABSOLUTE=8*60*60*1000;
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
async function body(req,limit=65536){if(req.headers['content-type']?.split(';')[0]!=='application/json')throw Object.assign(Error('Send JSON.'),{status:415});let bytes=0,chunks=[];for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>limit)throw Object.assign(Error('Request too large.'),{status:413});chunks.push(Buffer.from(chunk));}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(Error('Invalid JSON.'),{status:400});}}
function createHandler({store,now=()=>new Date(),localOnly=true,failureDelay=()=>new Promise(r=>setTimeout(r,300)),sync=createSync({store,now}),investmentQuotes=createInvestmentService({store}),quoteHeartbeatMs=10000}={}){
 const sessions=new Map();
 return async(req,res)=>{
  for(const[k,v]of Object.entries({'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}))res.setHeader(k,v);
  const send=(status,value,type='application/json; charset=utf-8')=>{res.statusCode=status;res.setHeader('Content-Type',type);res.end(req.method==='HEAD'?undefined:typeof value==='string'?value:JSON.stringify(value));};
  try{
   if(!localOnly||process.env.VERCEL)return send(503,{error:'This private draft is available only in the local preview.'});
   if(!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host||''))return send(421,{error:'Host not allowed.'});
   const url=new URL(req.url,'http://'+req.headers.host),action=url.searchParams.get('action'),asset=url.searchParams.get('asset');
   if(!['GET','HEAD','POST'].includes(req.method)){res.setHeader('Allow','GET, HEAD, POST');return send(405,{error:'Method not allowed.'});}
   const time=now().getTime();for(const[k,v]of sessions)if(time-v.last>IDLE||time-v.started>ABSOLUTE)sessions.delete(k);
   const values=String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
   const token=values.length===1?values[0].slice(COOKIE.length+1):'',session=sessions.get(sha(token));
   let cfg;try{cfg=await store.config();}catch{return send(503,'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Private workspace</title><p>Private workspace needs local setup. Run npm run setup:household in the website directory.</p></html>','text/html; charset=utf-8');}
   const authenticated=!!session&&session.epoch===cfg.epoch;
   const cookie=(value,age)=>`${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`;
   if(req.method==='POST'){
    if(req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Open the form from this local website.'});
    if(action==='unlock'){
     const input=await body(req),key=sha((req.socket?.remoteAddress||'local')+cfg.salt);
     const allowed=await store.limits(s=>{for(const k of Object.keys(s))if(s[k].until<=time)delete s[k];if((s[key]?.count||0)>=8||(s.all?.count||0)>=24)return false;for(const k of[key,'all'])s[k]={count:(s[k]?.count||0)+1,until:s[k]?.until||time+15*60*1000};return true;});
     if(!allowed){res.setHeader('Retry-After','900');return send(429,{error:'Too many attempts. Try again in 15 minutes.'});}
     if(typeof input.pin!=='string'||!/^\d{8,16}$/.test(input.pin)||!equal(hashPin(input.pin,cfg.salt),cfg.pinHash)){
      await failureDelay();return send(401,{error:'That PIN did not match.'});
     }
     await store.limits(s=>{delete s[key];});const fresh=crypto.randomBytes(32).toString('base64url');
     if(sessions.size>=100)sessions.delete(sessions.keys().next().value);sessions.set(sha(fresh),{csrf:crypto.randomBytes(32).toString('base64url'),epoch:cfg.epoch,started:time,last:time});res.setHeader('Set-Cookie',cookie(fresh,ABSOLUTE/1000));return send(200,{ok:true});
    }
    if(!authenticated)return send(401,{error:'Unlock the workspace again.'});
    if(!equal(req.headers['x-csrf-token']||'',session.csrf))return send(403,{error:'The session could not verify this save. Reload the page.'});
    if(action==='lock'){sessions.delete(sha(token));res.setHeader('Set-Cookie',cookie('',0));return send(200,{ok:true});}
    const input=await body(req,action==='tax-document'?8*1024*1024:65536);if(!Number.isSafeInteger(input.revision))return send(400,{error:'Invalid revision.'});
    if(['tax-profile','tax-entry','tax-checklist','tax-document'].includes(action)){const result=await store.updateTax(input.revision,action.slice(4),input.item,now().toISOString());session.last=time;return send(200,{ok:true,tax:result});}
    if(action==='set-action-status'){const plan=await store.updateAction(input.revision,input.id,input.done,now().toISOString());session.last=time;return send(200,{ok:true,actions:plan});}
    if(action==='refresh-google'){await sync.refresh(input.revision);session.last=time;return send(200,{ok:true});}
    if(!input.item||typeof input.item!=='object'||Array.isArray(input.item))return send(400,{error:'Invalid save.'});
    if(action==='add-reading'&&['cold-water','hot-water'].includes(input.item.kind)){
     await store.mutate(input.revision,state=>saveLocalReading(state,input.item,now()));
     session.last=time;return send(200,{ok:true,mode:'local'});
    }
    if(action==='save-asset'&&(await store.read()).localAssets?.[input.item.id]){
     await store.mutate(input.revision,state=>saveLocalAsset(state,input.item,now()));
     session.last=time;return send(200,{ok:true,mode:'local'});
    }
    await sync.save(input.revision,action,input.item);session.last=time;return send(200,{ok:true,mode:(await sync.status()).mode});
   }
   const publicAssets={'gate.css':['gate.css','text/css; charset=utf-8'],'gate.js':['gate.js','text/javascript; charset=utf-8']};
   if(asset&&publicAssets[asset])return send(200,await fs.readFile(path.join(__dirname,'ui',publicAssets[asset][0]),'utf8'),publicAssets[asset][1]);
   if(!authenticated){if(asset||url.searchParams.get('resource'))return send(401,{error:'Unlock the private workspace.'});return send(200,await fs.readFile(path.join(__dirname,'ui','gate.html'),'utf8'),'text/html; charset=utf-8');}
   // Background quote refreshes must not keep an unattended financial session alive.
   if(url.searchParams.get('resource')==='investment-quotes')return send(200,await investmentQuotes());
   if(url.searchParams.get('resource')==='etf-stream'){
    if(req.method==='HEAD')return send(200,'','text/event-stream');
    if(typeof investmentQuotes.subscribeEtfQuotes!=='function')return send(503,{error:'The ETF stream is unavailable.'});
    if((session.liveStreams||0)>=3)return send(429,{error:'Too many open quote streams.'});
    await investmentQuotes();
    if(now().getTime()-session.last>IDLE||now().getTime()-session.started>ABSOLUTE)return send(401,{error:'Unlock the workspace again.'});
    res.statusCode=200;res.setHeader('Content-Type','text/event-stream');res.setHeader('Connection','keep-alive');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();
    session.liveStreams=(session.liveStreams||0)+1;let stopped=false,unsubscribe=()=>{},timer,busy=false;
    const stop=()=>{if(stopped)return;stopped=true;clearInterval(timer);unsubscribe();session.liveStreams--;if(!res.writableEnded)res.end();};
    const write=value=>{if(stopped)return;if(res.writableLength>131072)return stop();res.write('data: '+JSON.stringify(value)+'\n\n');};
    res.on?.('close',stop);res.on?.('error',stop);unsubscribe=investmentQuotes.subscribeEtfQuotes(write);if(stopped){unsubscribe();return;}
    timer=setInterval(async()=>{if(stopped||busy)return;busy=true;try{const cfg=await store.config(),time=now().getTime();if(!sessions.has(sha(token))||cfg.epoch!==session.epoch||time-session.last>IDLE||time-session.started>ABSOLUTE){write({status:'session_expired',quotes:[]});stop();}else res.write(': heartbeat\n\n');}catch{stop();}finally{busy=false;}},quoteHeartbeatMs);timer.unref?.();return;
   }
   session.last=time;
   if(url.searchParams.get('resource')==='tax-export'){const state=await store.secret('tax-2025')||tax.empty();res.setHeader('Content-Disposition','attachment; filename="joint-tax-dossier-2025.zip"');res.statusCode=200;res.setHeader('Content-Type','application/zip');return res.end(req.method==='HEAD'?undefined:dossier(state));}
   if(url.searchParams.get('resource')==='tax-document'){const state=await store.secret('tax-2025'),doc=state?.documents.find(d=>d.id===url.searchParams.get('id'));if(!doc)return send(404,{error:'Document not found.'});res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(doc.name).replace(/['()]/g,c=>'%'+c.charCodeAt(0).toString(16)));res.statusCode=200;res.setHeader('Content-Type','application/octet-stream');return res.end(req.method==='HEAD'?undefined:Buffer.from(doc.content,'base64'));}
   if(asset){const assets={'site-motion.js':'text/javascript; charset=utf-8','water.js':'text/javascript; charset=utf-8','wealth.js':'text/javascript; charset=utf-8','tax.js':'text/javascript; charset=utf-8','app.css':'text/css; charset=utf-8','app.js':'text/javascript; charset=utf-8'};if(!assets[asset])return send(404,{error:'Not found.'});return send(200,await fs.readFile(path.join(__dirname,'ui',asset),'utf8'),assets[asset]);}
   if(url.searchParams.get('resource')==='state'){
    const month=url.searchParams.get('month')||today(now()).slice(0,7);if(!monthOK(month))return send(400,{error:'Choose a valid month.'});
    const raw=await store.read(),snapshot=await store.secret('investments'),assessment=await store.secret('assessment');
    const state=assessedState(waterState(localAssetState(raw)),assessment,month),result=view(state,month,now());
    for(const p of result.properties)if(p.assessment){
     p.purchasePriceCents=p.assessment.purchasePriceCents;
    }
    const planningNotices=result.properties.map(p=>p.assessment?.cashPlanningNote).filter(Boolean);
    return send(200,{...result,planningNotices,water:waterView(state.readings,month.slice(0,4)),tax:tax.view(await store.secret('tax-2025')),actions:await store.secret('actions'),wealth:wealthAssessment(state,snapshot,month,today(now())),etfForecast:etfForecast(state,snapshot,month),sync:await sync.status(),csrf:session.csrf});
   }
   return send(200,await fs.readFile(path.join(__dirname,'ui','app.html'),'utf8'),'text/html; charset=utf-8');
  }catch(error){const status=error.status||503;return send(status,{error:error.status?error.message:'The private store is unavailable. No save has been confirmed.'});}
 };
}
module.exports={createHandler};
