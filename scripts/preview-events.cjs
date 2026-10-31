'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {createOwnerEventsHandler}=require('../lib/owner-events.cjs');
const {buildPublic}=require('./build-public.cjs');
const root=path.resolve(__dirname,'..');
const handler=createOwnerEventsHandler();
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};
buildPublic(root).then(()=>{
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname==='/api/owner-events')return await handler(req,res);
   if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;return res.end();}
   const file=path.resolve(root,'public','.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   const relative=path.relative(path.join(root,'public'),file);
   if(relative.startsWith('..')||relative.split(path.sep).some(part=>part.startsWith('.'))){res.statusCode=404;return res.end('Not found');}
   const stat=await fs.promises.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error();
   const contents=await fs.promises.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:contents);
  }catch{res.statusCode=404;res.end('Not found');}
 });
 server.listen(8784,'127.0.0.1',()=>console.log('Local events preview: http://127.0.0.1:8784/'));
}).catch(error=>{console.error(error.message);process.exitCode=1;});
