'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {Readable}=require('node:stream'),{EventEmitter}=require('node:events');
const {createStore}=require('../lib/household/store.cjs'),{createHandler}=require('../lib/household/handler.cjs');
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'etf-stream-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const store=createStore(dir);await store.init({revision:1},'012345678901');return store;}
function response(){const res=new EventEmitter();res.statusCode=200;res.headers={};res.output='';res.writableLength=0;res.writableEnded=false;res.setHeader=(k,v)=>{res.headers[k.toLowerCase()]=v;};res.write=value=>{res.output+=value;return true;};res.end=value=>{if(value)res.output+=value;res.writableEnded=true;res.emit('close');};return res;}
async function request(handler,{login=false,cookie}={}){const req=Readable.from(login?[JSON.stringify({pin:'012345678901'})]:[]);Object.assign(req,{url:login?'/api/household?action=unlock':'/api/household?resource=etf-stream',method:login?'POST':'GET',headers:{host:'127.0.0.1:9999',...(cookie?{cookie}:{}),...(login?{'content-type':'application/json',origin:'http://127.0.0.1:9999'}:{})},socket:{remoteAddress:'127.0.0.1'}});const res=response();await handler(req,res);return res;}
async function login(handler){const res=await request(handler,{login:true});assert.equal(res.statusCode,200);return res.headers['set-cookie'].split(';')[0];}
function quotes(){let reads=0,subscribed=0,removed=0;const get=async()=>{reads++;return {leaders:{rows:[]}};};get.subscribeEtfQuotes=callback=>{subscribed++;callback({status:'connected',quotes:[{isin:'IE00TEST0001',currency:'EUR',price:101}]});return()=>{removed++;};};get.counts=()=>({reads,subscribed,removed});return get;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('quote stream requires the PIN session and releases its subscription when closed',async t=>{
 const store=await fixture(t),service=quotes(),handler=createHandler({store,investmentQuotes:service});
 assert.equal((await request(handler)).statusCode,401);assert.equal(service.counts().reads,0);
 const cookie=await login(handler),res=await request(handler,{cookie});t.after(()=>res.end());assert.equal(res.statusCode,200);assert.equal(res.headers['content-type'],'text/event-stream');assert.match(res.headers['cache-control'],/no-store/);assert.match(res.output,/"status":"connected"/);assert.ok(!res.output.includes('csrf'));res.end();assert.equal(service.counts().removed,1);
});
test('stream activity cannot extend idle access and PIN rotation closes existing streams',async t=>{
 const store=await fixture(t);let time=new Date('2026-11-07T12:00:00Z');const service=quotes(),handler=createHandler({store,investmentQuotes:service,now:()=>time,quoteHeartbeatMs:5});
 const cookie=await login(handler),res=await request(handler,{cookie});t.after(()=>res.end());time=new Date(time.getTime()+15*60000+1);
 for(let i=0;i<50&&!res.writableEnded;i++)await wait(5);assert.equal(res.writableEnded,true);assert.match(res.output,/session_expired/);assert.equal((await request(handler,{cookie})).statusCode,401);
 const fresh=await login(handler),rotated=await request(handler,{cookie:fresh});t.after(()=>rotated.end());await store.rotate('111111111111');for(let i=0;i<50&&!rotated.writableEnded;i++)await wait(5);assert.equal(rotated.writableEnded,true);assert.match(rotated.output,/session_expired/);
});
test('simultaneous quote streams are bounded per authenticated session',async t=>{
 const store=await fixture(t),handler=createHandler({store,investmentQuotes:quotes()}),cookie=await login(handler),streams=[];t.after(()=>streams.forEach(res=>res.end()));
 for(let i=0;i<3;i++)streams.push(await request(handler,{cookie}));assert.ok(streams.every(res=>res.statusCode===200));assert.equal((await request(handler,{cookie})).statusCode,429);streams[0].end();const extra=await request(handler,{cookie});assert.equal(extra.statusCode,200);extra.end();
});
