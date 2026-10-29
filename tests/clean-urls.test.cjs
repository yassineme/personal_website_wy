'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const config=require('../vercel.json');
const port=19837;
const origin='http://127.0.0.1:'+port;
let server;
before(async()=>{
 server=spawn(process.execPath,[path.join(root,'scripts/preview-signals.cjs'),String(port)],{cwd:root,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Preview did not start')),10000);
  server.once('error',error=>{clearTimeout(timeout);reject(error);});
  server.once('exit',code=>{clearTimeout(timeout);reject(Error('Preview exited: '+code));});
  server.stdout.on('data',data=>{if(data.toString().includes('Preview:')){clearTimeout(timeout);resolve();}});
 });
});
after(()=>server?.kill());
test('hosting enables clean paths and keeps home and private CV aliases',()=>{
 assert.equal(config.cleanUrls,true);assert.equal(config.trailingSlash,false);
 for(const source of ['/index','/index.html'])assert.equal(config.redirects.find(r=>r.source===source)?.destination,'/');
 for(const source of ['/mydigital-resume','/mydigital-resume.html'])assert.equal(config.redirects.find(r=>r.source===source)?.destination,'/digital-cv');
 assert.equal(config.rewrites.find(r=>r.source==='/digital-cv')?.destination,'/api/digital-cv');
});
test('clean homepage, pages and nested articles serve their original HTML files',async()=>{
 for(const route of ['/','/blog','/privacy','/signals','/blog/ai-roadmap-prioritisation']){
  const response=await fetch(origin+route);assert.equal(response.status,200,route);
  const file=route==='/'?'index.html':route.slice(1)+'.html';
  assert.equal(await response.text(),fs.readFileSync(path.join(root,file),'utf8'),route);
 }
});
test('legacy URLs redirect without losing query parameters or creating loops',async()=>{
 for(const [from,to,status] of [['/index.html?font=instrument-newsreader','/?font=instrument-newsreader',308],['/index','/',308],['/blog.html?topic=ai','/blog?topic=ai',308],['/blog/ai-roadmap-prioritisation.html','/blog/ai-roadmap-prioritisation',308],['/signals/','/signals',308],['/mydigital-resume','/digital-cv',307]]){
  const response=await fetch(origin+from,{redirect:'manual'});assert.equal(response.status,status,from);assert.equal(response.headers.get('location'),to,from);
 }
});
test('unknown routes and private paths remain unavailable',async()=>{
 for(const route of ['/missing-page','/lib/private-cv-content.json','/.env.local','/scripts/build-public.cjs'])assert.equal((await fetch(origin+route)).status,404,route);
});
