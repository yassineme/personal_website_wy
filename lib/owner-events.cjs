'use strict';
const fs=require('node:fs'),path=require('node:path');
function createOwnerEventsHandler() {
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('CDN-Cache-Control','no-store');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'self'; script-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
  if(!['GET','HEAD'].includes(req.method)){
   res.setHeader('Allow','GET, HEAD');res.statusCode=405;return res.end('Method not allowed.');
  }
  res.statusCode=200;
  if(req.method==='HEAD')return res.end();
  const data=fs.readFileSync(path.join(__dirname,'owner-events-data.json'),'utf8').replace(/</g,'\\u003c');
  res.end(fs.readFileSync(path.join(__dirname,'owner-events-page.html'),'utf8').replace('__EVENTS_DATA__',data));
 };
}
module.exports={createOwnerEventsHandler};
