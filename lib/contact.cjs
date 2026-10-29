'use strict';
const crypto = require('node:crypto');
const {gate} = require('./cv-access-ui.cjs');
const {createSubmissionClient} = require('./website-submissions.cjs');

function createContactHandler({env=process.env,notify,now=()=>Math.floor(Date.now()/1000),secure=true,maxRequests=3}={}) {
  const sender=notify || createSubmissionClient(env);
  const attempts=new Map(),submitted=new Map();
  const sign=value=>crypto.createHmac('sha256',env.WEBSITE_FORMS_SECRET).update(value).digest('hex');
  function token(time) {const value=(time+1200)+'.'+crypto.randomBytes(16).toString('hex');return value+'.'+sign(value);}
  function valid(value,time) {
    const parts=String(value||'').split('.');
    if(parts.length!==3 || !/^\d+$/.test(parts[0]) || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2]))return false;
    return Number(parts[0])>time && Number(parts[0])<=time+1200 && crypto.timingSafeEqual(Buffer.from(parts[2],'hex'),Buffer.from(sign(parts.slice(0,2).join('.')),'hex'));
  }
  return async(req,res)=>{
    for(const [key,value] of [['Cache-Control','private, no-store'],['X-Content-Type-Options','nosniff'],['Referrer-Policy','same-origin'],['X-Frame-Options','DENY'],['Content-Security-Policy',"default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"]])res.setHeader(key,value);
    const send=(status,options={})=>{res.statusCode=status;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.method==='HEAD'?undefined:gate({kind:'enquiry',...options}));};
    if(!['GET','HEAD','POST'].includes(req.method)){res.setHeader('Allow','GET, HEAD, POST');return send(405,{message:'Method not allowed.'});}
    if(!/^[a-f0-9]{64}$/.test(env.WEBSITE_FORMS_SECRET||''))return send(503,{unavailable:true,message:'The contact form is temporarily unavailable.'});
    const time=now();
    for(const map of [attempts,submitted])for(const [key,record] of map)if(record.until<=time)map.delete(key);
    if(req.method!=='POST')return send(200,{token:token(time)});
    try{const origin=new URL(req.headers.origin);if(origin.protocol!==(secure?'https:':'http:')||origin.host.toLowerCase()!==String(req.headers.host||'').toLowerCase())throw Error();}catch{return send(403,{message:'Please submit this form from the website.'});}
    if(req.headers['content-type']?.split(';')[0].trim()!=='application/x-www-form-urlencoded')return send(415,{message:'Invalid form submission.'});
    let raw=req.body;
    if(raw && typeof raw==='object' && !Buffer.isBuffer(raw)){
      const parsed=new URLSearchParams();
      for(const [name,value] of Object.entries(raw))for(const entry of Array.isArray(value)?value:[value]){
        if(typeof entry!=='string')return send(400,{message:'Invalid form submission.'});
        parsed.append(name,entry);
      }
      raw=parsed.toString();
    }
    if(raw==null){const chunks=[];let size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>16384)return send(413,{message:'Your message is too long.'});chunks.push(Buffer.from(chunk));}raw=Buffer.concat(chunks);}
    if(Buffer.byteLength(raw)>16384)return send(413,{message:'Your message is too long.'});
    const fields=new URLSearchParams(raw.toString()),requestToken=fields.get('request_token');
    if(['action','kind','request_token'].some(name=>fields.getAll(name).length!==1)||fields.get('action')!=='request'||fields.get('kind')!=='enquiry'||!valid(requestToken,time))return send(400,{token:token(time),message:'Please use this fresh form and try again.'});
    const values={name:(fields.get('name')||'').trim(),email:(fields.get('email')||'').trim(),message:(fields.get('message')||'').trim()};
    const page={token:requestToken,values};
    if(fields.get('website') || ['name','email','message'].some(name=>fields.getAll(name).length!==1) || !values.name || values.name.length>80 || /[\r\n\x00-\x1f]/.test(values.name) || values.email.length>254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(values.email) || !values.message || values.message.length>1000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(values.message))return send(400,{...page,message:'Please enter your name, a valid email address and a message (up to 1,000 characters).'});
    const id=crypto.createHash('sha256').update(requestToken).digest('hex');
    if(submitted.has(id))return send(200,{success:true,preview:submitted.get(id).preview});
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim(),record=attempts.get(ip);
    if(record && record.count>=maxRequests){res.setHeader('Retry-After',String(Math.max(1,record.until-time)));return send(429,{...page,message:'You’ve sent several messages. Please try again later.'});}
    if(attempts.size>=2000&&!record)attempts.delete(attempts.keys().next().value);
    attempts.set(ip,{count:(record?.count||0)+1,until:record?.until||time+900});
    try{const result=await sender({id,kind:'enquiry',...values});if(submitted.size>=2000)submitted.delete(submitted.keys().next().value);submitted.set(id,{until:time+1200,preview:result?.preview===true});return send(200,{success:true,preview:result?.preview===true});}
    catch{return send(503,{...page,message:'Your message could not be saved. Please try again later or email hello@wyassine.com.'});}
  };
}
module.exports={createContactHandler};
