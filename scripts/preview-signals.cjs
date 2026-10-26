// Local static preview with the same API handler used on Vercel.
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const handler=require('../api/ai-signals.js');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ico':'image/x-icon','.pdf':'application/pdf'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/ai-signals')return handler(req,res);
 try{
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)||file.split(path.sep).some(p=>p.startsWith('.'))||/\/(api|lib|tests|node_modules|scripts)\//.test(file))throw Error();
  const body=await fs.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.statusCode=404;res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173'));
