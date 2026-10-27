// Local static preview with the same API handler used on Vercel.
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const handler=require('../api/ai-signals.js');
const {createHandler}=require('../api/ai-markets.js');
const {createQuoteService}=require('../lib/ai-markets.cjs');
const root=path.resolve(__dirname,'..');
async function localMarketKey(){
 if(process.env.FINNHUB_API_KEY)return process.env.FINNHUB_API_KEY;
 try{
  const text=await fs.readFile(path.join(root,'.env.local'),'utf8');
  const value=text.match(/^\s*FINNHUB_API_KEY\s*=\s*([^\r\n]*)/m)?.[1]?.trim()||'';
  return value.startsWith('"')||value.startsWith("'")?value.slice(1,value.indexOf(value[0],1)):value.split(/\s+#/)[0].trim();
 }catch{return '';}
}
// Re-read this one private setting per request so saving the key activates the feed.
let currentMarketKey='';
const markets=createHandler(createQuoteService({apiKey:()=>currentMarketKey}));
const port=Number(process.argv[2]||4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid preview port');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ico':'image/x-icon','.pdf':'application/pdf'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/ai-signals')return handler(req,res);
 if(url.pathname==='/api/ai-markets'){currentMarketKey=await localMarketKey();return markets(req,res);}
 try{
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)||file.split(path.sep).some(p=>p.startsWith('.'))||/\/(api|lib|tests|node_modules|scripts)\//.test(file))throw Error();
  const body=await fs.readFile(file);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.statusCode=404;res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:'+port));
