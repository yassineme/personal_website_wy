'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {createStore}=require('../lib/household/store.cjs'),{createHandler}=require('../lib/household/handler.cjs'),{buildPublic}=require('./build-public.cjs');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};
async function start({port=Number(process.argv[2]||8790),directory=path.join(root,'.household')}={}){
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local preview port.');
 await buildPublic(root);const publicRoot=path.join(root,'public'),handler=createHandler({store:createStore(directory)});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host||'')){res.statusCode=421;return res.end('Host not allowed.');}
  try{
   const url=new URL(req.url,'http://'+req.headers.host);
   if(['/private-desk','/private-desk/','/api/household'].includes(url.pathname))return await handler(req,res);
   if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;return res.end('Method not allowed.');}
   let pathname=decodeURIComponent(url.pathname);if(pathname.endsWith('.html')){res.writeHead(308,{Location:pathname.slice(0,-5)+url.search});return res.end();}
   if(pathname==='/')pathname='/index.html';else if(!path.extname(pathname))pathname+='.html';
   const target=path.resolve(publicRoot,'.'+pathname),rel=path.relative(publicRoot,target);
   if(!rel||rel.startsWith('..')||path.isAbsolute(rel)||rel.split(path.sep).some(x=>x.startsWith('.')))throw Error();
   for(const part of rel.split(path.sep).map((_,i,a)=>a.slice(0,i+1).join(path.sep)))if((await fs.lstat(path.join(publicRoot,part))).isSymbolicLink())throw Error();
   const content=await fs.readFile(target);res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:content);
  }catch{res.statusCode=404;res.end('Not found.');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return server;
}
if(require.main===module)start().then(()=>console.log('Private local preview: http://127.0.0.1:'+(process.argv[2]||8790)+'/private-desk\nHomepage doorway: http://127.0.0.1:'+(process.argv[2]||8790)+'/')).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={start};
